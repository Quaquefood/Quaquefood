/**
 * Thêm phần KẾT BẠN vào zalo-gateway (zca-js 2.2.0). CHỈ THÊM, không đổi dòng cũ nào ngoài dòng import.
 *   node va-ketban.js <index.js vào> <index.js ra>
 * Chạy được trên bản gốc (goc/index.js) lẫn bản đã vá tích mã (index.js): các chỗ neo không trùng chỗ tích mã sửa.
 * Mỗi chỗ neo phải xuất hiện đúng 1 lần, không thấy → dừng (không đoán).
 *
 * Hàm zca-js 2.2.0 đã tra trong mã nguồn (dist/):
 *  - listener.on("friend_event", ev): ev = {type: FriendEventType, data, threadId, isSelf}; REQUEST(=2): data = {toUid, fromUid, src, message}
 *    (zca-js tự bỏ act "req", chỉ phát "req_v2"; lời mời do chính bot gửi có isSelf=true và bị bỏ vì selfListen:false)
 *  - api.acceptFriendRequest(friendId) → ""
 *  - api.getGroupInfo(groupId) → {gridInfoMap: {[id]: {name, memVerList:["uid_ver"], memberIds, currentMems:[{id}], totalMember}}}
 *  - api.getFriendRecommendations() → {recommItems:[{dataInfo:{userId, zaloName, displayName, recommType (2 = lời mời nhận được), recommTime, recommInfo:{message}}}]}
 *  - api.getUserInfo(uid) → {changed_profiles: {[uid hoặc uid_0]: {displayName, zaloName}}}
 */
'use strict';
const fs = require('fs');
const [, , vao, ra] = process.argv;
if (!vao || !ra) throw new Error('Cách dùng: node va-ketban.js <vào> <ra>');
let s = fs.readFileSync(vao, 'utf8');
if (s.includes('KẾT BẠN (thêm')) throw new Error('File đã có phần kết bạn, dừng.');
function thay(cu, moi) {
  const n = s.split(cu).length - 1;
  if (n !== 1) throw new Error('Chuỗi neo xuất hiện ' + n + ' lần (cần 1): ' + cu.slice(0, 80));
  s = s.replace(cu, () => moi);
}

// 1) import thêm FriendEventType
thay('import { Zalo, ThreadType, LoginQRCallbackEventType } from "zca-js";',
  'import { Zalo, ThreadType, LoginQRCallbackEventType, FriendEventType } from "zca-js";');

// 2) listener: lời mời kết bạn → /webhook/ket-ban (đặt ngay trước l.start, không đụng message/reaction)
thay('  l.start({ retryOnClose: true });',
`  // ---------- KẾT BẠN (thêm 11/2026): chỉ loại REQUEST, chỉ gửi sang webhook ket-ban ----------
  l.on("friend_event", async (ev) => {
    try {
      if (!ev || ev.type !== FriendEventType.REQUEST || ev.isSelf) return;
      const d = ev.data || {};
      const fromId = String(d.fromUid || "");
      if (!fromId) return;
      const payload = { event: "friend_request", fromId, fromName: await KETBAN.tenNguoi(fromId),
        message: String(d.message || ""), ts: Date.now(), raw: ev };
      const ok = await postJson(KETBAN.webhook, payload);
      console.log(\`[ketban] lời mời từ \${fromId} → \${KETBAN.webhook}: \${ok ? "OK" : "LỖI"}\`);
    } catch (e) {
      console.error("[ketban] lỗi xử lý lời mời:", e?.message || e);
    }
  });

  l.start({ retryOnClose: true });`);

// 3) HTTP: 3 lệnh mới (đặt ngay trước app.listen)
thay('app.listen(PORT, () => console.log(`[http] gateway chạy cổng ${PORT}`));',
`// ---------- KẾT BẠN (thêm 11/2026): /group-members, /accept-friend, /friend-requests ----------
const KETBAN = {
  webhook: String(process.env.KETBAN_WEBHOOK_URL || "http://n8n:5678/webhook/ket-ban").trim(),
  cache: new Map(), // groupId → {t, data}, giữ 2 phút
  async tenNguoi(uid) {
    try {
      const r = await api.getUserInfo(uid);
      const p = (r && r.changed_profiles) || {};
      const x = p[uid] || p[uid + "_0"] || Object.values(p)[0] || {};
      return String(x.displayName || x.zaloName || "");
    } catch { return ""; }
  },
};
const boVersion = (x) => String(x).replace(/_\\d+$/, "");

// GET /group-members?groupId=<id>
app.get("/group-members", auth, async (req, res) => {
  const groupId = String(req.query.groupId || "").trim();
  if (!api) return res.status(503).json({ ok: false, error: "chưa đăng nhập Zalo" });
  if (!groupId) return res.status(400).json({ ok: false, error: "thiếu groupId" });
  const c = KETBAN.cache.get(groupId);
  if (c && Date.now() - c.t < 120_000) return res.json(c.data);
  try {
    const r = await api.getGroupInfo(groupId);
    const g = r && r.gridInfoMap && r.gridInfoMap[groupId];
    if (!g) return res.status(404).json({ ok: false, error: "không thấy nhóm (bot không ở trong nhóm hoặc sai groupId)" });
    const ds = new Set();
    (g.memVerList || []).forEach((x) => x && ds.add(boVersion(x)));
    (g.memberIds || []).forEach((x) => x && ds.add(boVersion(x)));
    (g.currentMems || []).forEach((m) => m && m.id && ds.add(boVersion(m.id)));
    const members = [...ds];
    const total = Number(g.totalMember) || members.length;
    // zca-js 2.2.0 không có hàm lấy thành viên theo trang → báo rõ nếu thiếu
    const data = { ok: true, groupId, name: String(g.name || ""), total, members, complete: members.length >= total };
    KETBAN.cache.set(groupId, { t: Date.now(), data });
    res.json(data);
  } catch (e) {
    console.error("[group-members] lỗi:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// POST /accept-friend  body {userId}
app.post("/accept-friend", auth, async (req, res) => {
  const userId = String((req.body || {}).userId || "").trim();
  if (!api) return res.status(503).json({ ok: false, error: "chưa đăng nhập Zalo" });
  if (!userId) return res.status(400).json({ ok: false, error: "thiếu userId" });
  try {
    await enqueue(() => api.acceptFriendRequest(userId));
    console.log(\`[ketban] đã đồng ý kết bạn \${userId}\`);
    res.json({ ok: true });
  } catch (e) {
    console.error("[accept-friend] lỗi:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// GET /friend-requests: lời mời đang chờ (để n8n quét lại lời mời bị lỡ)
app.get("/friend-requests", auth, async (_req, res) => {
  if (!api) return res.status(503).json({ ok: false, error: "chưa đăng nhập Zalo" });
  try {
    const r = await api.getFriendRecommendations();
    const requests = ((r && r.recommItems) || []).map((it) => (it && it.dataInfo) || {})
      .filter((d) => Number(d.recommType) === 2 && d.userId)
      .map((d) => ({ fromId: String(d.userId), fromName: String(d.displayName || d.zaloName || ""),
        message: String((d.recommInfo && d.recommInfo.message) || ""), ts: Number(d.recommTime) || 0 }));
    res.json({ ok: true, requests });
  } catch (e) {
    console.error("[friend-requests] lỗi:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(\`[http] gateway chạy cổng \${PORT}\`));`);

fs.writeFileSync(ra, s);
console.log('Đã sinh ' + ra + ' (' + s.length + ' ký tự)');
