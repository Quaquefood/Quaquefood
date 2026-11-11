/**
 * Kiểm tra quy tắc chia tin (11/11): câu nói vòng sang tích mã, KHÔNG câu nào của bot bán hàng bị chuyển nhầm.
 *   node tich-ma-zalo/test/kiem-tra-phan-loai.js [đường dẫn SKILL.md]
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const TM = require('../logic');

const src = fs.readFileSync(path.join(__dirname, '..', 'gateway', 'tichma-snippet.js'), 'utf8');
const GW = new Function('process', src + '\nreturn TICHMA;')({ env: { TICHMA_ON: '1', TICHMA_GROUP: 'G', TICHMA_APPROVERS: 'A' } });
const cauHinh = { bat: true, nhomKhachId: 'G', nguoiDuyet: ['A'] };
const tin = text => ({ event: 'message', threadId: '1', threadType: 'user', text });
const kiem = (text, mong) => {
  assert.strictEqual(TM.phanLoai(text), mong, JSON.stringify(text));
  assert.strictEqual(TM.nenChuyenTichMa(tin(text), cauHinh), !!mong, 'logic ' + JSON.stringify(text));
  assert.strictEqual(GW.nenChuyen(tin(text)), !!mong, 'gateway ' + JSON.stringify(text));
};

// 1. Câu sang tích mã
[['tích mã', 'tich_ma'], ['Tích mã nha', 'tich_ma'], ['tích điểm', 'tich_ma'], ['cho mình tích mã với', 'tich_ma'],
 ['tích điểm sao bạn', 'tich_ma'], ['Em ơi tích mã', 'tich_ma'], ['mình muốn đổi quà', 'doi_qua'], ['Đổi quà', 'doi_qua'],
 ['đổi mã', 'doi_qua'], ['mã của tôi', 'xem_ma'], ['xem mã', 'xem_ma'], ['cho xem mã của tôi', 'xem_ma'],
 ['tích mã để đổi quà', 'tich_ma'], ['muốn đổi quà, tích mã', 'doi_qua']].forEach(([t, m]) => kiem(t, m));
console.log('OK  câu nói vòng → tích mã');

// 2. Luôn về bot bán hàng
['M14 tích điểm được ko', 'm 14 tích mã', '0907754132 tích mã', '0907 754 132 doi qua', 'tích mãi', 'tichmaa',
 'hi', '1', 'ok', 'OK', 'M14', '3 phần', 'Thêm 1 tóp mỡ', 'Hôm qua mua bánh bị thiếu tóp mỡ', 'Món nào ăn chay dc',
 'quán có chương trình tích điểm gì không vậy bạn ơi', 'Muon mua them', '', null, '😊']
  .forEach(t => kiem(t, null));
console.log('OK  mã món, SĐT, câu dài, câu bán hàng → bot bán hàng');

// 3. MỌI câu trong bộ hồi quy bot bán hàng (mục 8 skill) → không câu nào sang tích mã
const skill = process.argv[2] || path.join(process.env.LOCALAPPDATA || '', 'Claude-Data');
let file = skill;
if (fs.existsSync(skill) && fs.statSync(skill).isDirectory()) {
  const tim = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name);
    if (f.isDirectory()) { const r = tim(p); if (r) return r; } else if (f.name === 'SKILL.md' && p.includes('bot-zalo-nhi-nhi')) return p; } return null; };
  try { file = tim(skill); } catch (e) { file = null; }
}
if (file && fs.existsSync(file)) {
  const md = fs.readFileSync(file, 'utf8');
  const muc8 = md.slice(md.indexOf('## 8.'));
  const cau = [...muc8.matchAll(/"([^"\n]{1,200})"/g)].map(m => m[1].replace(/\\n/g, '\n'))
    .concat([...muc8.matchAll(/'([^'\n]{1,200})'/g)].map(m => m[1]));
  let sai = cau.filter(c => TM.phanLoai(c) || GW.nenChuyen(tin(c)));
  assert.deepStrictEqual(sai, [], 'câu hồi quy bị chuyển nhầm sang tích mã');
  console.log('OK  ' + cau.length + ' câu trong bộ hồi quy bot bán hàng (' + path.basename(path.dirname(file)) + ') → không câu nào sang tích mã');
} else {
  console.log('BỎ QUA bước 3: không thấy SKILL.md (truyền đường dẫn làm tham số)');
}

// 4. Gateway và logic.js trùng nhau trên nhiều câu ngẫu nhiên ghép từ khóa
const manh = ['tích', 'mã', 'điểm', 'đổi', 'quà', 'của', 'tôi', 'xem', 'cho', 'mình', 'M14', '0907754132', 'nha', 'với', 'ok', '3', 'phần'];
let n = 0;
for (let i = 0; i < 3000; i++) {
  const k = 1 + (i % 6), c = [];
  for (let j = 0; j < k; j++) c.push(manh[(i * 7 + j * 13 + (i >> 3)) % manh.length]);
  const t = c.join(' ');
  assert.strictEqual(GW.nenChuyen(tin(t)), TM.nenChuyenTichMa(tin(t), cauHinh), t); n++;
}
console.log('OK  gateway = logic.js trên ' + n + ' câu ghép');

// 5. Đổi quà: hợp lệ → tin chúc mừng vào nhóm khách (có tag) + nhắn riêng; không hợp lệ → chỉ nhắn riêng
const CH = [['bat_chuc_nang', 'BAT'], ['nhom_khach_id', 'G1'], ['so_ma_doi', '3'], ['qua_tang', 'Giảm 5.000đ'], ['ten_quan', 'Bánh tráng Nhi Nhi'], ['nguoi_duyet', 'A']]
  .map(([khoa, gia_tri]) => ({ khoa, gia_tri }));
const ma = (n, tt) => Array.from({ length: n }, (_, i) => ({ ma: 'M-' + i, zalo_id: 'K1', thoi_gian_duyet: '2026-11-10 10:0' + i + ':00', trang_thai: tt || 'con' }));
const now = Date.UTC(2026, 10, 11, 9, 5);
const ok = TM.xuLyTinKhach({ fromId: 'K1', fromName: 'Lan', threadId: 'K1', text: 'mình muốn đổi quà' }, { cau_hinh: CH, ma_tich: ma(3) }, now);
const g = ok.tin.filter(t => t.den === 'group');
assert.strictEqual(g.length, 1); assert.strictEqual(g[0].threadId, 'G1');
assert.ok(/^🎉 Chúc mừng @Lan đã đổi quà: Giảm 5\.000đ! \(16:05\)/.test(g[0].text), g[0].text);
assert.deepStrictEqual(g[0].mentions, [{ pos: g[0].text.indexOf('@Lan'), len: 4, uid: 'K1' }]);
assert.ok(!g[0].cho_msgId);
assert.strictEqual(ok.tin.filter(t => t.den === 'user').length, 1);
assert.strictEqual(ok.ghi.filter(x => x.tab === 'ma_tich' && x.dong.trang_thai === 'da_doi').length, 3);
const lan2 = TM.xuLyTinKhach({ fromId: 'K1', fromName: 'Lan', threadId: 'K1', text: 'đổi quà' }, { cau_hinh: CH, ma_tich: ma(3, 'da_doi') }, now);
assert.ok(lan2.tin.length === 1 && lan2.tin[0].den === 'user' && !lan2.ghi.length, 'đổi lần 2: chỉ nhắn riêng');
const thieu = TM.xuLyTinKhach({ fromId: 'K1', fromName: 'Lan', threadId: 'K1', text: 'đổi quà' }, { cau_hinh: CH, ma_tich: ma(2) }, now);
assert.ok(thieu.tin.length === 1 && thieu.tin[0].den === 'user' && !thieu.ghi.length);
console.log('OK  đổi quà: hợp lệ → chúc mừng nhóm khách (tag) + riêng; lần 2 / chưa đủ → chỉ nhắn riêng');

console.log('PHAN LOAI + DOI QUA: KIỂM TRA OK');
