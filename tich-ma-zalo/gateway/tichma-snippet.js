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
  // Giống hệt TM.phanLoai trong tich-ma-zalo/logic.js (11/11: thêm tin ngắn có chứa từ khóa; trừ mã món, SĐT)
  function phanLoai(text) {
    const t = boDau(text);
    if (!t) return null;
    if (/^(doi qua|doi ma|nhan qua)( |$)/.test(t)) return "doi_qua";
    if (/^(ma cua toi|xem ma|kiem tra ma|so ma)( |$)/.test(t)) return "xem_ma";
    if (/^(tich ma|tich diem)( |$)/.test(t)) return "tich_ma";
    if (t.length > 30 || /(^| )m ?\d{1,2}( |$)/.test(t) || t.replace(/\D/g, "").length >= 9) return null;
    let tot = null, viTri = 999;
    [["doi_qua", /(^| )doi qua( |$)/], ["xem_ma", /(^| )ma cua toi( |$)/], ["tich_ma", /(^| )tich (ma|diem)( |$)/]].forEach((k) => {
      const m = k[1].exec(t);
      if (m && m.index < viTri) { viTri = m.index; tot = k[0]; }
    });
    return tot;
  }
  // Giống hệt TM.nenChuyenTichMa trong tich-ma-zalo/logic.js
  function nenChuyen(su) {
    if (!cfg.bat || !su) return false;
    if (su.event === "message") {
      if (String(su.threadType) !== "user") return false;
      return !!phanLoai(su.text);
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
