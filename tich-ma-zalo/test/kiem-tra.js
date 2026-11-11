// Chạy: node tich-ma-zalo/test/kiem-tra.js
const assert = require('assert');
const TM = require('../logic');

// "Sheet" giả lập + áp dụng thao tác ghi đúng như workflow n8n sẽ làm
function moiDb(cfgThem) {
  const cau_hinh = [
    ['bat_chuc_nang', 'BAT'], ['ten_quan', 'Bánh tráng Nhi Nhi'], ['so_ma_doi', 3], ['bill_toi_thieu', 30000],
    ['qua_tang', 'Giảm 5.000đ khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip'], ['gia_tri_giam', 5000],
    ['han_ma_ngay', 0], ['han_duyet_phut', 30], ['so_lan_moi_ngay', 1], ['nhom_khach_id', 'G1'],
    ['nguoi_duyet', '111;222'], ['ten_nguoi_duyet', 'Chủ quán;Nhân viên Lan'], ['tu_khoa_tich_ma', 'tích mã; tich ma; tích điểm']
  ].map(([khoa, gia_tri]) => ({ khoa, gia_tri: (cfgThem && khoa in cfgThem) ? cfgThem[khoa] : gia_tri }));
  return { cau_hinh, khach_hang: [], yeu_cau: [], ma_tich: [], doi_qua: [] };
}
function ghi(db, ops) {
  ops.forEach(o => {
    if (o.kieu === 'them') db[o.tab].push(Object.assign({}, o.dong));
    else db[o.tab].filter(r => Object.keys(o.khop).every(k => String(r[k]) === String(o.khop[k]))).forEach(r => Object.assign(r, o.dong));
  });
}
let msgSeq = 0;
// Mô phỏng 1 lượt khách nhắn → workflow gửi tin nhóm → gán msgId
function khachNhan(db, uid, ten, text, t, opt) {
  const r = TM.xuLyTinKhach({ fromId: uid, fromName: ten, threadId: uid, text }, db, t, opt);
  ghi(db, r.ghi);
  r.tin.filter(x => x.cho_msgId).forEach(x => { x.msgId = 'm' + (++msgSeq); ghi(db, [TM.ganMsgId(x.ma_yc, x.msgId)]); });
  return r;
}
function thaTim(db, uidFrom, msgId, t) { const r = TM.xuLyThaTim({ groupId: 'G1', uidFrom, msgId }, db, t); ghi(db, r.ghi); return r; }
const NGAY = 86400000, PHUT = 60000;
const T0 = Date.UTC(2026, 10, 10, 3, 0); // 10:00 sáng 10/11 giờ VN

// 1. Tắt chức năng → im lặng
{ const db = moiDb({ bat_chuc_nang: 'TAT' }); assert.equal(khachNhan(db, 'u1', 'Lan', 'tích mã', T0).tin.length, 0); }

const db = moiDb();
// 2. Tin thường không phải lệnh → bỏ qua (để bot cũ lo)
assert.equal(khachNhan(db, 'u1', 'Lan', 'cho em 2 phần M14', T0).loai, null);

// 3. Tích mã: tin nhóm có tag đúng vị trí + tin riêng
let r = khachNhan(db, 'u1', 'Lan', 'Tích mã', T0);
const g = r.tin.find(x => x.den === 'group');
assert.equal(g.threadId, 'G1');
assert.equal(g.text.substr(g.mentions[0].pos, g.mentions[0].len), '@Lan');
assert.equal(g.mentions[0].uid, 'u1');
assert.match(r.tin.find(x => x.den === 'user').text, /chờ|xác nhận/);
assert.equal(db.yeu_cau.length, 1); assert.equal(db.khach_hang.length, 1);
const msg1 = db.yeu_cau[0].msg_id_nhom;

// 4. Nhắn lại khi đang chờ → không tạo yêu cầu mới
r = khachNhan(db, 'u1', 'Lan', 'tich ma', T0 + PHUT); assert.match(r.tin[0].text, /đang chờ/); assert.equal(db.yeu_cau.length, 1);

// 5. Khách khác / chính khách thả tim → bỏ qua
assert.equal(thaTim(db, 'u1', msg1, T0 + 2 * PHUT).ket_qua, 'khong_phai_nguoi_duyet');
assert.equal(thaTim(db, '999', msg1, T0 + 2 * PHUT).ket_qua, 'khong_phai_nguoi_duyet');
assert.equal(db.ma_tich.length, 0);

// 6. Nhân viên thả tim → cộng mã, nhắn riêng
r = thaTim(db, '222', msg1, T0 + 3 * PHUT);
assert.equal(r.ket_qua, 'da_duyet'); assert.equal(r.tin[0].threadId, 'u1'); assert.match(r.tin[0].text, /1\/3 mã/);
assert.equal(db.ma_tich[0].nguoi_duyet, 'Nhân viên Lan'); assert.equal(db.yeu_cau[0].trang_thai, 'da_duyet');

// 7. Chủ quán thả tim thêm vào cùng tin → không cộng lần 2
assert.equal(thaTim(db, '111', msg1, T0 + 4 * PHUT).ket_qua, 'da_xu_ly'); assert.equal(db.ma_tich.length, 1);

// 8. Cùng ngày xin tiếp → bị chặn (1 mã/ngày)
r = khachNhan(db, 'u1', 'Lan', 'tích mã', T0 + 10 * PHUT); assert.match(r.tin[0].text, /hôm nay/); assert.equal(db.yeu_cau.length, 1);

// 9. Đổi quà khi chưa đủ
r = khachNhan(db, 'u1', 'Lan', 'đổi quà', T0 + 11 * PHUT); assert.match(r.tin[0].text, /1\/3/); assert.equal(db.doi_qua.length, 0);

// 10. Quét ở nhà, không ai thả tim → quá hạn bị hủy, thả tim trễ cũng không cộng
r = khachNhan(db, 'u1', 'Lan', 'tích mã', T0 + NGAY);
const msg2 = db.yeu_cau[1].msg_id_nhom;
r = TM.quetQuaHan(db, T0 + NGAY + 31 * PHUT); ghi(db, r.ghi);
assert.equal(r.tin.length, 1); assert.match(r.tin[0].text, /hết hạn/); assert.equal(db.yeu_cau[1].trang_thai, 'het_han');
assert.equal(thaTim(db, '111', msg2, T0 + NGAY + 32 * PHUT).ket_qua, 'da_xu_ly'); assert.equal(db.ma_tich.length, 1);
// thả tim trễ trước khi bộ quét chạy cũng không được
khachNhan(db, 'u1', 'Lan', 'tích mã', T0 + NGAY + 40 * PHUT);
const msg3 = db.yeu_cau[2].msg_id_nhom;
assert.equal(thaTim(db, '111', msg3, T0 + NGAY + 80 * PHUT).ket_qua, 'qua_han'); assert.equal(db.yeu_cau[2].trang_thai, 'het_han');

// 11. Ngày 2 và 3 → đủ 3 mã, tin chúc mừng
for (const ngay of [2, 3]) {
  khachNhan(db, 'u1', 'Lan', 'tích mã', T0 + ngay * NGAY);
  const yc = db.yeu_cau[db.yeu_cau.length - 1];
  r = thaTim(db, '111', yc.msg_id_nhom, T0 + ngay * NGAY + PHUT);
}
assert.match(r.tin[0].text, /3\/3 mã/); assert.match(r.tin[0].text, /CHÚC MỪNG/);

// 12. Xem mã
r = khachNhan(db, 'u1', 'Lan', 'mã của tôi', T0 + 3 * NGAY + 5 * PHUT); assert.match(r.tin[0].text, /Đã đủ đổi quà/);

// 13. Đổi quà: trừ đúng 3 mã cũ nhất, ghi sổ, không đổi lần 2
r = khachNhan(db, 'u1', 'Lan', 'Đổi quà', T0 + 4 * NGAY);
assert.equal(r.tin[0].den, 'group'); assert.match(r.tin[0].text, /^🎉 Chúc mừng @Lan đã đổi quà/); assert.match(r.tin[1].text, /ĐỔI QUÀ THÀNH CÔNG/); assert.match(r.tin[1].text, /Còn lại 0\/3/);
assert.equal(db.doi_qua.length, 1); assert.equal(db.doi_qua[0].gia_tri_giam, 5000);
assert.equal(db.ma_tich.filter(x => x.trang_thai === 'da_doi').length, 3);
r = khachNhan(db, 'u1', 'Lan', 'đổi quà', T0 + 4 * NGAY + PHUT); assert.match(r.tin[0].text, /0\/3/); assert.equal(db.doi_qua.length, 1);

// 14. Thả tim ở nhóm khác / vào tin không phải tích mã → bỏ qua
assert.equal(TM.xuLyThaTim({ groupId: 'G9', uidFrom: '111', msgId: msg1 }, db, T0).ket_qua, 'bo_qua');
assert.equal(thaTim(db, '111', 'tin-khac', T0).ket_qua, 'khong_phai_tin_tich_ma');

// 15. Không phải thành viên nhóm → từ chối
r = khachNhan(db, 'u2', 'Minh', 'tích mã', T0, { laThanhVien: false }); assert.match(r.tin[0].text, /thành viên nhóm/); assert.equal(r.ghi.length, 0);

// 16. Thẻ bị khóa
db.khach_hang[0].trang_thai = 'khoa'; r = khachNhan(db, 'u1', 'Lan', 'tích mã', T0 + 9 * NGAY); assert.match(r.tin[0].text, /tạm ngưng/);

// 17. Mã hết hạn (khi chủ quán đặt han_ma_ngay)
{ const d2 = moiDb({ han_ma_ngay: 30 }); khachNhan(d2, 'u3', 'Hà', 'tích mã', T0); thaTim(d2, '111', d2.yeu_cau[0].msg_id_nhom, T0 + PHUT);
  assert.match(khachNhan(d2, 'u3', 'Hà', 'xem mã', T0 + 31 * NGAY).tin[0].text, /0\/3/); }

// 18. Bộ chuyển đường ở gateway: chỉ đúng lệnh / đúng tim mới sang tích mã
const gw = { bat: true, nhomKhachId: 'G1', nguoiDuyet: ['111', '222'] };
assert.equal(TM.nenChuyenTichMa({ event: 'message', threadType: 'user', text: 'Tích mã' }, gw), true);
assert.equal(TM.nenChuyenTichMa({ event: 'message', threadType: 'user', text: 'Đổi quà nha' }, gw), true);
assert.equal(TM.nenChuyenTichMa({ event: 'message', threadType: 'user', text: '2 phần M14' }, gw), false);
assert.equal(TM.nenChuyenTichMa({ event: 'message', threadType: 'user', text: 'ok' }, gw), false);
assert.equal(TM.nenChuyenTichMa({ event: 'message', threadType: 'group', text: 'tích mã' }, gw), false);
assert.equal(TM.nenChuyenTichMa({ event: 'reaction', raw: { isGroup: true, threadId: 'G1', data: { uidFrom: '222' } } }, gw), true);
assert.equal(TM.nenChuyenTichMa({ event: 'reaction', raw: { isGroup: true, threadId: 'G1', data: { uidFrom: '999' } } }, gw), false);
assert.equal(TM.nenChuyenTichMa({ event: 'reaction', raw: { isGroup: false, threadId: 'u1', data: { uidFrom: '111' } } }, gw), false); // tim xác nhận ĐƠN (chat riêng) vẫn về bot cũ
assert.equal(TM.nenChuyenTichMa({ event: 'message', threadType: 'user', text: 'tích mã' }, { bat: false }), false);

console.log('TICH MA ZALO: TẤT CẢ 18 NHÓM KIỂM TRA OK');
