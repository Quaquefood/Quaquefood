/**
 * Phần thêm cho zalo-gateway: chuyển sự kiện tích mã sang workflow mới "TICH MA - Nhan su kien".
 * Chép file này vào /opt/zalo-n8n-stack/zalo-gateway/ (cạnh index.js). Không phụ thuộc thư viện ngoài.
 *
 * Biến môi trường (thêm vào docker-compose.yml, service zalo-gateway):
 *   TICHMA_ON=0                    công tắc: 0 = gateway chạy y như cũ (mặc định), 1 = bật chuyển đường
 *   TICHMA_GROUP=<id nhóm khách>   threadId nhóm Zalo khách hàng
 *   TICHMA_APPROVERS=<id1>,<id2>   Zalo ID chủ quán, nhân viên được thả tim duyệt
 *   TICHMA_WEBHOOK=http://n8n:5678/webhook/tich-ma
 *
 * Quy tắc giống hệt TM.nenChuyenTichMa trong tich-ma-zalo/logic.js (có kiểm tra đối chiếu trong test).
 */
'use strict';

function boDau(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cauHinh(env) {
  env = env || process.env;
  return {
    bat: String(env.TICHMA_ON || '0').trim() === '1',
    nhomKhachId: String(env.TICHMA_GROUP || '').trim(),
    nguoiDuyet: String(env.TICHMA_APPROVERS || '').split(/[,;]/).map(function (x) { return x.trim(); }).filter(String),
    webhook: String(env.TICHMA_WEBHOOK || 'http://n8n:5678/webhook/tich-ma').trim()
  };
}

/** su = đúng object gateway đang gửi sang /webhook/zalo-in ({event:'message',...} hoặc {event:'reaction', raw}). */
function nenChuyen(su, ch) {
  ch = ch || cauHinh();
  if (!ch.bat || !su) return false;
  if (su.event === 'message') {
    if (String(su.threadType) !== 'user') return false;
    return /^(tich ma|tich diem|doi qua|doi ma|nhan qua|ma cua toi|xem ma|kiem tra ma|so ma)( |$)/.test(boDau(su.text));
  }
  if (su.event === 'reaction') {
    var raw = su.raw || {};
    return !!raw.isGroup && String(raw.threadId) === String(ch.nhomKhachId) &&
      ch.nguoiDuyet.map(String).indexOf(String((raw.data || {}).uidFrom)) >= 0;
  }
  return false;
}

/** Trả URL webhook cho sự kiện: tích mã → TICHMA_WEBHOOK, còn lại → urlCu (giữ nguyên đường cũ). */
function webhookCho(su, urlCu, ch) {
  ch = ch || cauHinh();
  try { return nenChuyen(su, ch) ? ch.webhook : urlCu; } catch (e) { return urlCu; }
}

/** Nội dung gửi cho api.sendMessage: có mentions hợp lệ → {msg, mentions}; không → giữ y như cũ (chuỗi text). */
function noiDungGui(text, mentions) {
  var ds = Array.isArray(mentions) ? mentions.filter(function (m) {
    return m && m.uid && Number.isInteger(Number(m.pos)) && Number(m.len) > 0;
  }).map(function (m) { return { pos: Number(m.pos), len: Number(m.len), uid: String(m.uid) }; }) : [];
  return ds.length ? { msg: String(text), mentions: ds } : text;
}

/** Lấy msgId từ kết quả api.sendMessage của zca-js ({message:{msgId}, attachment:[]}). */
function layMsgId(kq) {
  if (!kq) return null;
  var m = kq.message || kq;
  return m && m.msgId != null ? String(m.msgId) : null;
}

module.exports = { boDau: boDau, cauHinh: cauHinh, nenChuyen: nenChuyen, webhookCho: webhookCho, noiDungGui: noiDungGui, layMsgId: layMsgId };
