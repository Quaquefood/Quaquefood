// Zalo gateway: giữ phiên Zalo cá nhân (zca-js), đẩy sự kiện sang n8n,
// nhận lệnh gửi tin từ n8n. Chỉ chạy 1 instance cho mỗi tài khoản Zalo.
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sizeOf from "image-size";
import { Zalo, ThreadType, LoginQRCallbackEventType } from "zca-js";

// zca-js v2 cần hàm đọc kích thước ảnh khi gửi ảnh từ file
async function imageMetadataGetter(filePath) {
  const buf = await fs.promises.readFile(filePath);
  const d = sizeOf(buf);
  return { width: d.width, height: d.height, size: buf.length };
}

const {
  N8N_WEBHOOK_URL,            // vd: http://n8n:5678/webhook/zalo-in
  ALERT_WEBHOOK_URL,          // webhook n8n khác để báo lỗi qua Telegram/Email
  API_KEY,                    // khóa bảo vệ API nội bộ
  PORT = 3000,
  DATA_DIR = "/data",
  MIN_SEND_DELAY_MS = 1500,   // giãn cách giữa 2 tin gửi đi (giảm rủi ro khóa nick)
} = process.env;

// ---------- TÍCH MÃ (thêm 10/11/2026) ----------
// Công tắc TICHMA_ON: không đặt hoặc "0" → gateway chạy y như cũ.
// "1" → tin "tích mã / đổi quà / mã của tôi" (chat riêng) và tim của người duyệt trong nhóm khách
// được chuyển sang TICHMA_WEBHOOK (workflow "TICH MA - Nhan su kien") thay cho N8N_WEBHOOK_URL.
const TICHMA = (() => {
  const env = process.env;
  const cfg = {
    bat: String(env.TICHMA_ON || "0").trim() === "1",
    nhomKhachId: String(env.TICHMA_GROUP || "").trim(),
    nguoiDuyet: String(env.TICHMA_APPROVERS || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean),
    webhook: String(env.TICHMA_WEBHOOK || "http://n8n:5678/webhook/tich-ma").trim(),
  };
  const boDau = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  // Giống hệt TM.nenChuyenTichMa trong tich-ma-zalo/logic.js
  function nenChuyen(su) {
    if (!cfg.bat || !su) return false;
    if (su.event === "message") {
      if (String(su.threadType) !== "user") return false;
      return /^(tich ma|tich diem|doi qua|doi ma|nhan qua|ma cua toi|xem ma|kiem tra ma|so ma)( |$)/.test(boDau(su.text));
    }
    if (su.event === "reaction") {
      const raw = su.raw || {};
      return !!raw.isGroup && String(raw.threadId) === cfg.nhomKhachId &&
        cfg.nguoiDuyet.indexOf(String((raw.data || {}).uidFrom)) >= 0;
    }
    return false;
  }
  // URL nhận sự kiện: tích mã → webhook tích mã; còn lại → urlCu. Lỗi bất ngờ → urlCu.
  function url(su, urlCu) {
    try { return nenChuyen(su) ? cfg.webhook : urlCu; } catch { return urlCu; }
  }
  // mentions hợp lệ → mảng [{pos,len,uid}]; không có → null (gửi y như cũ)
  function mentions(ds) {
    if (!Array.isArray(ds)) return null;
    const m = ds.filter((x) => x && x.uid && Number.isInteger(Number(x.pos)) && Number(x.len) > 0)
      .map((x) => ({ pos: Number(x.pos), len: Number(x.len), uid: String(x.uid) }));
    return m.length ? m : null;
  }
  const msgId = (kq) => (kq && kq.message && kq.message.msgId != null ? String(kq.message.msgId) : null);
  if (cfg.bat) console.log(`[tichma] BẬT: nhóm ${cfg.nhomKhachId}, ${cfg.nguoiDuyet.length} người duyệt → ${cfg.webhook}`);
  return { cfg, boDau, nenChuyen, url, mentions, msgId };
})();

const CRED_FILE = `${DATA_DIR}/credentials.json`;
const QR_FILE = `${DATA_DIR}/qr.png`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let api = null;
let listenerUp = false;
let downSince = Date.now();

// ---------- tiện ích ----------
async function postJson(url, body, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return true;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error(`[post] ${url} lần ${i} lỗi: ${e.message}`);
      if (i < retries) await sleep(1000 * 2 ** i);
    }
  }
  return false;
}

function alert(text) {
  console.warn("[alert]", text);
  if (ALERT_WEBHOOK_URL) postJson(ALERT_WEBHOOK_URL, { source: "zalo-gateway", text, at: new Date().toISOString() }, 2);
}

// chống trùng sự kiện trong 10 phút
const seen = new Map();
function isDuplicate(id) {
  if (!id) return false;
  const now = Date.now();
  if (seen.size > 5000) for (const [k, t] of seen) if (now - t > 600_000) seen.delete(k);
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

// hàng đợi gửi tuần tự có giãn cách + jitter
let chain = Promise.resolve();
function enqueue(fn) {
  const p = chain.then(fn);
  chain = p.catch(() => {}).then(() => sleep(Number(MIN_SEND_DELAY_MS) + Math.random() * 1000));
  return p;
}

function splitText(text, max = 2000) {
  const parts = [];
  let rest = String(text);
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

// ---------- đăng nhập ----------
async function login() {
  const zalo = new Zalo({ selfListen: false, checkUpdate: false, logging: false, imageMetadataGetter });

  if (fs.existsSync(CRED_FILE)) {
    try {
      const cred = JSON.parse(fs.readFileSync(CRED_FILE, "utf8"));
      const a = await zalo.login(cred);
      console.log("[login] đăng nhập bằng cookie đã lưu: OK");
      return a;
    } catch (e) {
      alert(`Cookie Zalo hết hạn/không hợp lệ (${e.message}). Cần quét QR lại tại GET /qr`);
    }
  }

  return zalo.loginQR({ qrPath: QR_FILE }, async (ev) => {
    if (ev.type === LoginQRCallbackEventType.QRCodeGenerated) {
      await ev.actions.saveToFile(QR_FILE);
      alert("Đã tạo mã QR mới. Mở GET /qr?key=API_KEY và quét bằng app Zalo trên điện thoại.");
    }
    if (ev.type === LoginQRCallbackEventType.QRCodeExpired) {
      ev.actions.retry();
    }
    if (ev.type === LoginQRCallbackEventType.GotLoginInfo) {
      // lưu cookie + imei + userAgent để lần sau không phải quét QR
      fs.writeFileSync(CRED_FILE, JSON.stringify(ev.data), { mode: 0o600 });
      console.log("[login] đã lưu thông tin đăng nhập");
    }
  });
}

// ---------- listener ----------
function startListener() {
  const l = api.listener;

  l.on("connected", () => {
    listenerUp = true;
    console.log("[listener] đã kết nối");
  });

  l.on("closed", (code, reason) => {
    listenerUp = false;
    downSince = Date.now();
    alert(`Listener Zalo bị ngắt (code=${code}, reason=${reason}). Đang tự kết nối lại...`);
  });

  l.on("error", (e) => console.error("[listener] lỗi:", e?.message || e));

  l.on("message", async (m) => {
    if (m.isSelf) return;
    const d = m.data || {};
    if (isDuplicate(d.msgId)) return;

    const payload = {
      event: "message",
      threadId: m.threadId,
      threadType: m.type === ThreadType.Group ? "group" : "user",
      msgId: d.msgId,
      fromId: d.uidFrom,
      fromName: d.dName,
      text: typeof d.content === "string" ? d.content : null,
      raw: d, // ảnh, file, sticker... n8n tự xử lý
      ts: Number(d.ts) || Date.now(),
    };
    const ok = await postJson(TICHMA.url(payload, N8N_WEBHOOK_URL), payload);
    if (!ok) alert(`Không đẩy được tin ${d.msgId} sang n8n sau 3 lần thử`);
  });

  l.on("group_event", (ev) => postJson(N8N_WEBHOOK_URL, { event: "group_event", raw: ev }));
  l.on("reaction", (ev) => {
    const p = { event: "reaction", raw: ev };
    postJson(TICHMA.url(p, N8N_WEBHOOK_URL), p);
  });

  l.start({ retryOnClose: true });
}

// Watchdog: listener chết quá 5 phút -> thoát để Docker restart & đăng nhập lại
setInterval(() => {
  if (!listenerUp && api && Date.now() - downSince > 5 * 60_000) {
    alert("Listener chết quá 5 phút, khởi động lại gateway.");
    process.exit(1);
  }
}, 30_000);

// ---------- HTTP API cho n8n ----------
const app = express();
app.use(express.json({ limit: "1mb" }));

const auth = (req, res, next) =>
  (req.get("x-api-key") || req.query.key) === API_KEY ? next() : res.status(401).json({ error: "unauthorized" });

app.get("/health", (_req, res) =>
  res.status(api && listenerUp ? 200 : 503).json({ loggedIn: !!api, listenerUp }));

app.get("/qr", auth, (_req, res) =>
  fs.existsSync(QR_FILE) ? res.sendFile(QR_FILE) : res.status(404).send("Chưa có QR"));

// body: { threadId, threadType: "user"|"group", text }
app.post("/send", auth, async (req, res) => {
  const { threadId, threadType = "user", text, mentions } = req.body || {};
  if (!api) return res.status(503).json({ error: "chưa đăng nhập Zalo" });
  if (!threadId || !text) return res.status(400).json({ error: "thiếu threadId hoặc text" });

  const type = threadType === "group" ? ThreadType.Group : ThreadType.User;
  try {
    const results = [];
    const parts = splitText(String(text).normalize("NFC"));
    const tag = TICHMA.cfg.bat && parts.length === 1 && type === ThreadType.Group ? TICHMA.mentions(mentions) : null;
    for (const part of parts) {
      results.push(await enqueue(() => api.sendMessage(tag ? { msg: part, mentions: tag } : { msg: part }, threadId, type)));
    }
    res.json({ ok: true, parts: results.length, results, msgId: TICHMA.msgId(results[0]) });
  } catch (e) {
    console.error("[send] lỗi:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Gửi ảnh: body là nội dung file ảnh (binary).
// Query: threadId, threadType=user|group, filename, caption (tùy chọn)
app.post("/send-image", auth, express.raw({ type: () => true, limit: "15mb" }), async (req, res) => {
  const { threadId, threadType = "user", filename = "anh.jpg", caption = "" } = req.query;
  if (!api) return res.status(503).json({ error: "chưa đăng nhập Zalo" });
  if (!threadId || !req.body || !req.body.length) return res.status(400).json({ error: "thiếu threadId hoặc ảnh" });

  const ext = (path.extname(String(filename)) || ".jpg").toLowerCase().replace(/[^.a-z0-9]/g, "");
  const tmp = path.join(os.tmpdir(), `zalo-img-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  const type = threadType === "group" ? ThreadType.Group : ThreadType.User;
  try {
    await fs.promises.writeFile(tmp, req.body);
    const result = await enqueue(() =>
      api.sendMessage({ msg: String(caption).normalize("NFC"), attachments: [tmp] }, String(threadId), type)
    );
    res.json({ ok: true, result });
  } catch (e) {
    console.error("[send-image] lỗi:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
});

app.listen(PORT, () => console.log(`[http] gateway chạy cổng ${PORT}`));

// ---------- khởi động ----------
(async () => {
  try {
    api = await login();
    startListener();
  } catch (e) {
    alert(`Đăng nhập Zalo thất bại: ${e.message}`);
    process.exit(1);
  }
})();

process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
