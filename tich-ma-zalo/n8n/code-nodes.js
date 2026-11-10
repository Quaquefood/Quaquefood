/**
 * Code của các node Code trong 2 workflow MỚI "TICH MA - ...".
 * build.js ghép logic.js vào đầu các node cần TM.* rồi sinh script tạo workflow.
 * Kiểm tra offline: node tich-ma-zalo/test/kiem-tra-n8n.js
 */
'use strict';

// ---------- Workflow "TICH MA - Nhan su kien" ----------

/** Sau 4 node đọc Sheet: chạy logic, trả 1 item {kq, ghi, tin, test}. Cần logic.js ở đầu. */
const XU_LY = `
const body = $('Nhan tich ma').first().json.body || {};
const rows = n => $(n).all().map(i => i.json).filter(r => r && Object.keys(r).some(k => k !== 'row_number' && String(r[k] == null ? '' : r[k]).trim() !== ''));
const db = { cau_hinh: rows('Doc cau_hinh'), khach_hang: rows('Doc khach_hang'), yeu_cau: rows('Doc yeu_cau'), ma_tich: rows('Doc ma_tich') };
const now = Date.now();
let kq = { tin: [], ghi: [], ket_qua: 'bo_qua' };
if (body.event === 'reaction') {
  const raw = body.raw || {}, d = raw.data || {}, c = d.content || {};
  const rm = (Array.isArray(c.rMsg) && c.rMsg[0]) || {};
  kq = TM.xuLyThaTim({ groupId: raw.threadId, uidFrom: d.uidFrom, msgId: rm.gMsgID || rm.msgId || d.msgId, icon: c.rIcon }, db, now);
} else if (body.event === 'message' && String(body.threadType || 'user') === 'user') {
  kq = TM.xuLyTinKhach({ fromId: body.fromId, fromName: body.fromName, threadId: body.threadId, text: body.text }, db, now);
}
const test = String(body.threadId || '').indexOf('test-') === 0 || String(body.fromId || '').indexOf('test-') === 0;
return [{ json: { su_kien: body.event || '', ket_qua: kq.ket_qua || kq.loai || '', test, ghi: kq.ghi || [], tin: kq.tin || [] } }];
`;

/** Bộ lọc trước mỗi node ghi Sheet: chỉ lấy thao tác đúng tab + kiểu. Không có gì → nhánh dừng. */
function locGhi(tab, kieu) {
  return `
const x = $('Xu ly').first().json;
return (x.ghi || []).filter(g => g.tab === ${JSON.stringify(tab)} && g.kieu === ${JSON.stringify(kieu)})
  .map(g => ({ json: ${kieu === 'sua' ? 'Object.assign({}, g.khop, g.dong)' : 'Object.assign({}, g.dong)'} }));
`;
}

/** Nhánh cuối (chạy sau khi ghi Sheet xong): các tin cần gửi thật. Tin thử (test-) không gửi. */
const CHUAN_BI_TIN = `
const x = $('Xu ly').first().json;
if (x.test) return [];
// Gateway chuẩn hóa NFC trước khi gửi → tính lại vị trí tag trên chữ đã NFC.
const nfcTag = (text, ds) => (ds || []).map(m => {
  const tag = String(text).substr(m.pos, m.len).normalize('NFC'), t = String(text).normalize('NFC');
  const pos = t.indexOf(tag);
  return pos >= 0 ? { pos, len: tag.length, uid: String(m.uid) } : null;
}).filter(Boolean);
return (x.tin || []).filter(t => String(t.threadId).indexOf('test-') !== 0).map(t => ({ json: {
  threadId: String(t.threadId), threadType: t.den === 'group' ? 'group' : 'user', text: String(t.text).normalize('NFC'),
  mentions: nfcTag(t.text, t.mentions), ma_yc: t.ma_yc || '', cho_msgId: !!t.cho_msgId } }));
`;

/** Tin thử: không gửi Zalo, nhưng giả msgId của tin nhóm để thử được bước thả tim. */
const GIA_LAP_MSGID = `
const x = $('Xu ly').first().json;
if (!x.test) return [];
return (x.tin || []).filter(t => t.cho_msgId && t.ma_yc).map(t => ({ json: { ma_yc: t.ma_yc, msg_id_nhom: 'test-msg-' + t.ma_yc } }));
`;

/** Sau "Gui tin": lấy msgId gateway trả về cho tin nhóm → ghi vào yêu cầu. */
const LAY_MSGID = `
const src = $('Chuan bi tin').all();
const out = [];
$input.all().forEach((it, i) => {
  const s = (src[i] || {}).json || {};
  if (!s.cho_msgId || !s.ma_yc) return;
  const r = it.json || {};
  const id = r.msgId || (r.data && (r.data.msgId || (r.data.message && r.data.message.msgId))) || (r.message && r.message.msgId) || (r.result && r.result.msgId);
  if (id) out.push({ json: { ma_yc: s.ma_yc, msg_id_nhom: String(id) } });
});
return out;
`;

// ---------- Workflow "TICH MA - Quet qua han" ----------

/** Cần logic.js ở đầu. Không có yêu cầu quá hạn → trả 1 item ghi=[] (các nhánh dừng). */
const QUET = `
const rows = n => $(n).all().map(i => i.json).filter(r => r && Object.keys(r).some(k => k !== 'row_number' && String(r[k] == null ? '' : r[k]).trim() !== ''));
const kq = TM.quetQuaHan({ cau_hinh: rows('Doc cau_hinh'), yeu_cau: rows('Doc yeu_cau') }, Date.now());
return [{ json: { ghi: kq.ghi, tin: kq.tin, so_het_han: kq.ghi.length } }];
`;

const LOC_HET_HAN = `
const x = $('Quet').first().json;
return (x.ghi || []).map(g => ({ json: Object.assign({}, g.khop, g.dong) }));
`;

const TIN_HET_HAN = `
const x = $('Quet').first().json;
return (x.tin || []).filter(t => String(t.threadId).indexOf('test-') !== 0)
  .map(t => ({ json: { threadId: String(t.threadId), threadType: 'user', text: t.text, mentions: [] } }));
`;

module.exports = { XU_LY, locGhi, CHUAN_BI_TIN, GIA_LAP_MSGID, LAY_MSGID, QUET, LOC_HET_HAN, TIN_HET_HAN };
