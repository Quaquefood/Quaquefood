/**
 * HỆ THỐNG TÍCH MÃ KHUYẾN MÃI CHO THÀNH VIÊN NHÓM ZALO
 * ------------------------------------------------------
 * Mỗi lần thành viên nhóm Zalo đến mua hàng, nhân viên cấp 1 mã.
 * Gom đủ số mã quy định (mặc định 5) → được đổi phần thưởng.
 *
 * Dữ liệu lưu trong Google Sheet (gắn script này vào Sheet):
 *   - Tab "ma_tich_diem": mỗi dòng là 1 mã đã cấp.
 *   - Tab "cau_hinh":     số mã cần để đổi, phần thưởng, hạn dùng...
 * Mật khẩu nhân viên KHÔNG để trong Sheet mà lưu ở Script Properties
 * (khóa PIN_NHAN_VIEN) – xem HUONG-DAN.md.
 */

var TAB_MA = 'ma_tich_diem';
var TAB_CAU_HINH = 'cau_hinh';
var COT = ['ma', 'sdt', 'ten', 'so_tien', 'ngay_cap', 'trang_thai', 'ngay_doi', 'ma_doi_thuong', 'ghi_chu'];
var CAU_HINH_MAC_DINH = [
  ['so_ma_doi', 5, 'Số mã cần gom để đổi 1 lần khuyến mãi'],
  ['phan_thuong', 'Giảm 20.000đ cho đơn kế tiếp', 'Nội dung khuyến mãi khi đủ mã'],
  ['han_su_dung_ngay', 90, 'Mã hết hạn sau bao nhiêu ngày (0 = không hết hạn)'],
  ['so_tien_toi_thieu', 0, 'Hóa đơn tối thiểu (đồng) để được cấp mã (0 = không giới hạn)'],
  ['tien_to_ma', 'QF', 'Chữ đứng đầu mỗi mã, ví dụ QF-7K3QX'],
  ['ten_quan', 'Quaque Food', 'Tên quán hiện trong tin nhắn gửi khách']
];
var BANG_CHU = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bỏ 0/O, 1/I/L cho dễ đọc

/* ======================= API ======================= */

function doGet(e) {
  return traVe_(xuLy_((e && e.parameter) || {}));
}

function doPost(e) {
  var p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { p = {}; }
  return traVe_(xuLy_(p));
}

function traVe_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function xuLy_(p) {
  try {
    switch (p.action) {
      case 'cau_hinh':
        var ch = docCauHinh_();
        return { ok: true, so_ma_doi: ch.so_ma_doi, phan_thuong: ch.phan_thuong, han_su_dung_ngay: ch.han_su_dung_ngay, ten_quan: ch.ten_quan };
      case 'tra_cuu':            // khách tự tra cứu bằng SĐT
        return traCuu_(p.sdt, false);
      case 'kiem_pin':
        kiemPin_(p.pin);
        return { ok: true };
      case 'nv_tra_cuu':         // nhân viên tra cứu (xem đủ mã)
        kiemPin_(p.pin);
        return traCuu_(p.sdt, true);
      case 'cap_ma':
        kiemPin_(p.pin);
        return khoa_(function () { return capMa_(p); });
      case 'doi_thuong':
        kiemPin_(p.pin);
        return khoa_(function () { return doiThuong_(p); });
      default:
        return { ok: false, loi: 'Thao tác không hợp lệ.' };
    }
  } catch (err) {
    return { ok: false, loi: String((err && err.message) || err) };
  }
}

/* ======================= NGHIỆP VỤ ======================= */

function capMa_(p) {
  var ch = docCauHinh_();
  var sdt = chuanHoaSdt_(p.sdt);
  var soTien = Number(String(p.so_tien || '0').replace(/[^\d]/g, '')) || 0;
  if (ch.so_tien_toi_thieu > 0 && soTien < ch.so_tien_toi_thieu) {
    throw new Error('Hóa đơn chưa đủ ' + dinhDangTien_(ch.so_tien_toi_thieu) + ' để được cấp mã.');
  }
  var sh = layTab_(TAB_MA);
  var duLieu = sh.getDataRange().getValues();
  var daCo = {};
  for (var i = 1; i < duLieu.length; i++) daCo[String(duLieu[i][0])] = true;

  var ma;
  do { ma = ch.tien_to_ma + '-' + chuoiNgauNhien_(5); } while (daCo[ma]);

  var bayGio = new Date();
  sh.appendRow([ma, "'" + sdt, String(p.ten || '').trim(), soTien, bayGio, 'con', '', '', String(p.ghi_chu || '').trim()]);

  var kq = traCuu_(sdt, true);
  kq.ma_moi = ma;
  kq.tin_nhan = tinNhanCapMa_(ch, ma, kq);
  return kq;
}

function doiThuong_(p) {
  var ch = docCauHinh_();
  var sh = layTab_(TAB_MA);
  var duLieu = sh.getDataRange().getValues();
  var bayGio = new Date();
  var dongDung = []; // chỉ số dòng (0-based trong duLieu) sẽ dùng để đổi

  if (p.ma_list) {
    // Đổi bằng danh sách mã khách đưa (khách "tổng mã lại")
    var dsMa = String(p.ma_list).toUpperCase().split(/[\s,;]+/).filter(String);
    var trung = {};
    dsMa.forEach(function (m) {
      if (trung[m]) throw new Error('Mã ' + m + ' bị nhập trùng.');
      trung[m] = true;
    });
    if (dsMa.length !== ch.so_ma_doi) {
      throw new Error('Cần đúng ' + ch.so_ma_doi + ' mã để đổi, đang nhập ' + dsMa.length + ' mã.');
    }
    dsMa.forEach(function (m) {
      var idx = -1;
      for (var i = 1; i < duLieu.length; i++) if (String(duLieu[i][0]).toUpperCase() === m) { idx = i; break; }
      if (idx < 0) throw new Error('Mã ' + m + ' không tồn tại.');
      var tt = trangThaiMa_(duLieu[idx], ch, bayGio);
      if (tt === 'da_doi') throw new Error('Mã ' + m + ' đã được dùng để đổi thưởng rồi.');
      if (tt === 'het_han') throw new Error('Mã ' + m + ' đã hết hạn.');
      dongDung.push(idx);
    });
  } else {
    // Đổi theo SĐT: lấy các mã còn hạn, cũ nhất trước
    var sdt = chuanHoaSdt_(p.sdt);
    for (var j = 1; j < duLieu.length; j++) {
      if (chuanHoaSdtMem_(duLieu[j][1]) === sdt && trangThaiMa_(duLieu[j], ch, bayGio) === 'con') dongDung.push(j);
    }
    dongDung.sort(function (a, b) { return new Date(duLieu[a][4]) - new Date(duLieu[b][4]); });
    if (dongDung.length < ch.so_ma_doi) {
      throw new Error('Khách mới có ' + dongDung.length + '/' + ch.so_ma_doi + ' mã còn hạn, chưa đủ để đổi.');
    }
    dongDung = dongDung.slice(0, ch.so_ma_doi);
  }

  var maDoi = 'DT-' + chuoiNgauNhien_(6);
  dongDung.forEach(function (idx) {
    sh.getRange(idx + 1, 6, 1, 3).setValues([['da_doi', bayGio, maDoi]]);
  });
  var dsDaDung = dongDung.map(function (idx) { return String(duLieu[idx][0]); });
  var sdtChu = chuanHoaSdtMem_(duLieu[dongDung[0]][1]);
  var conLai = traCuu_(sdtChu, true);
  return {
    ok: true,
    ma_doi_thuong: maDoi,
    phan_thuong: ch.phan_thuong,
    ma_da_dung: dsDaDung,
    sdt: sdtChu,
    so_ma_con_lai: conLai.so_ma,
    tin_nhan: 'Dạ ' + ch.ten_quan + ' xác nhận anh/chị đã đổi ' + ch.so_ma_doi + ' mã (' + dsDaDung.join(', ') +
      ') lấy khuyến mãi: ' + ch.phan_thuong + '. Mã đổi thưởng: ' + maDoi + '. Cảm ơn anh/chị đã ủng hộ quán ạ! 😊'
  };
}

function traCuu_(sdtVao, dayDu) {
  var ch = docCauHinh_();
  var sdt = chuanHoaSdt_(sdtVao);
  var duLieu = layTab_(TAB_MA).getDataRange().getValues();
  var bayGio = new Date();
  var con = [], daDoi = 0, hetHan = 0, ten = '';
  for (var i = 1; i < duLieu.length; i++) {
    if (chuanHoaSdtMem_(duLieu[i][1]) !== sdt) continue;
    if (duLieu[i][2]) ten = String(duLieu[i][2]);
    var tt = trangThaiMa_(duLieu[i], ch, bayGio);
    if (tt === 'con') {
      con.push({ ma: String(duLieu[i][0]), ngay_cap: dinhDangNgay_(duLieu[i][4]), het_han: dinhDangNgay_(ngayHetHan_(duLieu[i][4], ch)) });
    } else if (tt === 'da_doi') daDoi++;
    else hetHan++;
  }
  var kq = {
    ok: true,
    sdt: dayDu ? sdt : anSdt_(sdt),
    so_ma: con.length,
    so_ma_doi: ch.so_ma_doi,
    phan_thuong: ch.phan_thuong,
    du_doi: con.length >= ch.so_ma_doi,
    so_lan_da_doi: Math.floor(daDoi / ch.so_ma_doi),
    so_ma_het_han: hetHan
  };
  if (dayDu) {
    kq.ten = ten;
    kq.danh_sach = con;
  } else {
    // Khách tra cứu: chỉ hiện ngày cấp/hết hạn và 2 ký tự cuối của mã
    kq.danh_sach = con.map(function (x) { return { ma: '•••' + x.ma.slice(-2), ngay_cap: x.ngay_cap, het_han: x.het_han }; });
  }
  return kq;
}

function tinNhanCapMa_(ch, ma, kq) {
  var s = 'Dạ ' + ch.ten_quan + ' gửi anh/chị mã tích điểm: ' + ma + '. ' +
    'Anh/chị đang có ' + kq.so_ma + '/' + ch.so_ma_doi + ' mã. ';
  if (kq.du_doi) s += 'Anh/chị đã đủ mã để nhận: ' + ch.phan_thuong + ' – lần tới đến quán báo nhân viên để đổi nhé ạ! 🎉';
  else s += 'Gom thêm ' + (ch.so_ma_doi - kq.so_ma) + ' mã nữa để nhận: ' + ch.phan_thuong + ' ạ. 😊';
  if (ch.han_su_dung_ngay > 0) s += ' (Mã có hạn ' + ch.han_su_dung_ngay + ' ngày.)';
  return s;
}

/* ======================= TIỆN ÍCH ======================= */

function trangThaiMa_(dong, ch, bayGio) {
  if (String(dong[5]) === 'da_doi') return 'da_doi';
  var hh = ngayHetHan_(dong[4], ch);
  if (hh && bayGio > hh) return 'het_han';
  return 'con';
}

function ngayHetHan_(ngayCap, ch) {
  if (!(ch.han_su_dung_ngay > 0)) return null;
  var d = new Date(ngayCap);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + ch.han_su_dung_ngay * 86400000);
}

function chuanHoaSdtMem_(v) {
  var s = String(v == null ? '' : v).replace(/[^\d+]/g, '');
  if (s.indexOf('+84') === 0) s = '0' + s.slice(3);
  else if (s.indexOf('84') === 0 && s.length === 11) s = '0' + s.slice(2);
  s = s.replace(/\D/g, '');
  if (s.length === 9) s = '0' + s; // Sheet có thể làm mất số 0 đầu
  return s;
}

function chuanHoaSdt_(v) {
  var s = chuanHoaSdtMem_(v);
  if (!/^0\d{9}$/.test(s)) throw new Error('Số điện thoại không hợp lệ (cần 10 số, ví dụ 0907754132).');
  return s;
}

function anSdt_(sdt) { return sdt.slice(0, 3) + '****' + sdt.slice(-3); }

function chuoiNgauNhien_(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += BANG_CHU.charAt(Math.floor(Math.random() * BANG_CHU.length));
  return s;
}

function dinhDangNgay_(d) {
  if (!d) return '';
  d = new Date(d);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
}

function dinhDangTien_(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }

function kiemPin_(pin) {
  var dung = PropertiesService.getScriptProperties().getProperty('PIN_NHAN_VIEN');
  if (!dung) throw new Error('Chưa đặt mật khẩu nhân viên (Script Properties: PIN_NHAN_VIEN).');
  if (String(pin || '') !== String(dung)) throw new Error('Sai mật khẩu nhân viên.');
}

function khoa_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function layTab_(ten) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ten);
  if (!sh) { caiDat(); sh = ss.getSheetByName(ten); }
  return sh;
}

function docCauHinh_() {
  var ch = {};
  CAU_HINH_MAC_DINH.forEach(function (r) { ch[r[0]] = r[1]; });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_CAU_HINH);
  if (sh) {
    sh.getDataRange().getValues().slice(1).forEach(function (r) {
      if (r[0] !== '' && r[1] !== '') ch[String(r[0]).trim()] = r[1];
    });
  }
  ch.so_ma_doi = Math.max(1, parseInt(ch.so_ma_doi, 10) || 5);
  ch.han_su_dung_ngay = Math.max(0, parseInt(ch.han_su_dung_ngay, 10) || 0);
  ch.so_tien_toi_thieu = Math.max(0, Number(String(ch.so_tien_toi_thieu).replace(/[^\d]/g, '')) || 0);
  ch.tien_to_ma = String(ch.tien_to_ma || 'QF').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'QF';
  ch.phan_thuong = String(ch.phan_thuong);
  ch.ten_quan = String(ch.ten_quan);
  return ch;
}

/** Chạy 1 lần (menu Chạy ▶ caiDat) để tạo 2 tab cần thiết. Chạy lại không mất dữ liệu. */
function caiDat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shMa = ss.getSheetByName(TAB_MA) || ss.insertSheet(TAB_MA);
  if (shMa.getLastRow() === 0) {
    shMa.appendRow(COT);
    shMa.setFrozenRows(1);
    shMa.getRange('B:B').setNumberFormat('@'); // giữ số 0 đầu SĐT
  }
  var shCh = ss.getSheetByName(TAB_CAU_HINH) || ss.insertSheet(TAB_CAU_HINH);
  if (shCh.getLastRow() === 0) {
    shCh.appendRow(['khoa', 'gia_tri', 'giai_thich']);
    CAU_HINH_MAC_DINH.forEach(function (r) { shCh.appendRow(r); });
    shCh.setFrozenRows(1);
  }
  // Tự tạo mật khẩu nhân viên 6 số nếu chưa có
  var props = PropertiesService.getScriptProperties();
  var pin = props.getProperty('PIN_NHAN_VIEN');
  if (!pin) {
    pin = String(Math.floor(100000 + Math.random() * 900000));
    props.setProperty('PIN_NHAN_VIEN', pin);
  }
  Logger.log('Đã cài đặt xong. Mật khẩu nhân viên: ' + pin);
  return pin;
}
