// FILE TỰ SINH từ tich-ma/src – sửa ở src rồi chạy: node tich-ma/build.js
/**
 * THẺ TÍCH MÃ – KHÁCH HÀNG NHÓM ZALO
 * ==================================
 * Chương trình: mỗi bill từ 30.000đ trở lên được 1 mã. Gom đủ 3 mã → được
 * giảm 5.000đ khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip.
 *
 * TẤT CẢ NẰM TRONG 1 FILE NÀY: dán vào Apps Script của 1 Google Sheet,
 * chạy hàm caiDat 1 lần, Triển khai → Ứng dụng web. Xem tich-ma/HUONG-DAN.md.
 *
 * Trang web (cùng 1 đường link, khác phần đuôi):
 *   <link>            → Khách đăng ký thẻ (ghim link này trong nhóm Zalo)
 *   <link>?the=XXXX   → Thẻ của khách (khách đưa QR cho nhân viên quét)
 *   <link>?p=nv       → Nhân viên: tìm khách, đăng ký hộ, gửi lại thẻ
 *   <link>?p=chu      → Chủ quán: thống kê, danh sách khách cần nhắc đổi quà
 *
 * Dữ liệu (các tab trong Sheet – chủ quán xem/sửa trực tiếp được):
 *   khach_hang, ma_tich, doi_qua, cau_hinh
 */

var TAB = { KH: 'khach_hang', MA: 'ma_tich', QUA: 'doi_qua', CH: 'cau_hinh' };
var COT_KH = ['the', 'ten', 'sdt', 'ngay_dang_ky', 'nguoi_dang_ky', 'trang_thai', 'ghi_chu'];
var COT_MA = ['ma', 'the', 'ten', 'sdt', 'so_tien_bill', 'thoi_gian', 'nhan_vien', 'trang_thai', 'ma_doi_qua'];
var COT_QUA = ['ma_doi_qua', 'the', 'ten', 'sdt', 'thoi_gian', 'mon', 'giam', 'ma_da_dung', 'nhan_vien'];
var CAU_HINH_MAC_DINH = [
  ['ten_quan', 'Bánh tráng Nhi Nhi', 'Tên quán hiện trên thẻ và tin nhắn'],
  ['so_ma_doi', 3, 'Số mã cần gom để đổi 1 quà'],
  ['bill_toi_thieu', 30000, 'Bill tối thiểu (đồng) để được 1 mã'],
  ['qua_tang', 'Giảm 5.000đ khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip', 'Nội dung quà khi đủ mã'],
  ['gia_tri_giam', 5000, 'Số tiền giảm (đồng) – để ghi sổ'],
  ['mon_ap_dung', 'Trà tắc; Bánh tráng phơi sương muối sặc túi zip', 'Các món được áp dụng quà, cách nhau bằng dấu ;'],
  ['han_ma_ngay', 0, 'Mã hết hạn sau bao nhiêu ngày (0 = không hết hạn)'],
  ['phut_chong_trung', 10, 'Cùng 1 thẻ được cộng 2 mã trong vòng N phút thì hỏi lại nhân viên (chống bấm nhầm 2 lần)'],
  ['link_nhom_zalo', '', 'Link nhóm Zalo của quán (không bắt buộc, hiện trên trang đăng ký)']
];
var CHU = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bỏ 0/O, 1/I/L cho dễ đọc
var TZ = 'Asia/Ho_Chi_Minh';

/* ============================ TRANG WEB ============================ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var ch = docCauHinh_();
  var boot = {
    view: p.the ? 'the' : (p.p === 'nv' ? 'nv' : (p.p === 'chu' ? 'chu' : 'dk')),
    the: String(p.the || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    url: urlApp_(),
    cfg: congKhai_(ch)
  };
  var html = TRANG_HTML.replace('/*__BOOT__*/', 'var BOOT = ' + JSON.stringify(boot).replace(/</g, '\\u003c') + ';');
  return HtmlService.createHtmlOutput(html)
    .setTitle('Thẻ tích mã – ' + ch.ten_quan)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ============================ API (gọi từ trang web) ============================ */

function apiDangNhap(pin) {
  return bocLoi_(function () { return { ok: true, vai_tro: vaiTro_(pin) }; });
}

/** Khách tự đăng ký (pin rỗng) hoặc nhân viên đăng ký hộ (có pin). */
function apiDangKy(ten, sdt, pin, nhanVien) {
  return bocLoi_(function () {
    var nguoi = 'khách tự đăng ký';
    if (pin) { vaiTro_(pin); nguoi = tenNv_(nhanVien); }
    ten = String(ten || '').replace(/\s+/g, ' ').trim();
    if (ten.length < 2 || ten.length > 50) throw new Error('Vui lòng nhập tên (tên Zalo) từ 2 đến 50 ký tự.');
    var so = chuanSdt_(sdt);
    return khoa_(function () {
      var sh = tab_(TAB.KH);
      var rows = sh.getDataRange().getValues();
      var daCo = {};
      for (var i = 1; i < rows.length; i++) {
        daCo[String(rows[i][0])] = true;
        if (sdtMem_(rows[i][2]) === so) {
          if (pin) return { ok: true, da_co: true, the: String(rows[i][0]), ten: String(rows[i][1]), url: urlThe_(rows[i][0]) };
          throw new Error('Số điện thoại này đã có thẻ. Anh/chị nhắn quán qua Zalo hoặc nhờ nhân viên gửi lại link thẻ nhé.');
        }
      }
      var id;
      do { id = ngauNhien_(8); } while (daCo[id]);
      sh.appendRow([id, ten, "'" + so, new Date(), nguoi, 'hoat_dong', '']);
      return { ok: true, the: id, ten: ten, url: urlThe_(id) };
    });
  });
}

/** Thông tin thẻ (ai có link thẻ đều xem được – link thẻ là bí mật của khách). */
function apiThe(id) {
  return bocLoi_(function () { return thongTinThe_(id, docCauHinh_()); });
}

function apiCongMa(id, soTien, pin, nhanVien, boQuaTrung) {
  return bocLoi_(function () {
    vaiTro_(pin);
    var nv = tenNv_(nhanVien);
    var ch = docCauHinh_();
    var tien = Number(String(soTien || '').replace(/[^\d]/g, '')) || 0;
    if (tien < 1000) throw new Error('Nhập số tiền bill (ví dụ 35000).');
    if (tien < ch.bill_toi_thieu) throw new Error('Bill ' + tienVn_(tien) + ' chưa đủ ' + tienVn_(ch.bill_toi_thieu) + ' nên chưa được cộng mã.');
    return khoa_(function () {
      var kh = timThe_(id);
      if (kh.trang_thai === 'khoa') throw new Error('Thẻ này đang bị khóa. Liên hệ chủ quán.');
      var sh = tab_(TAB.MA);
      var rows = sh.getDataRange().getValues();
      var bayGio = new Date();
      var daCo = {};
      var lanCuoi = null;
      for (var i = 1; i < rows.length; i++) {
        daCo[String(rows[i][0])] = true;
        if (String(rows[i][1]) === kh.the) {
          var t = new Date(rows[i][5]);
          if (!lanCuoi || t > lanCuoi) lanCuoi = t;
        }
      }
      if (!boQuaTrung && ch.phut_chong_trung > 0 && lanCuoi && (bayGio - lanCuoi) < ch.phut_chong_trung * 60000) {
        return { ok: false, can_xac_nhan: true,
          loi: 'Thẻ này vừa được cộng mã lúc ' + gio_(lanCuoi) + '. Nếu đây là 1 bill KHÁC thì bấm "Vẫn cộng mã".' };
      }
      var ma;
      do { ma = 'M-' + ngauNhien_(5); } while (daCo[ma]);
      sh.appendRow([ma, kh.the, kh.ten, "'" + kh.sdt, tien, bayGio, nv, 'con', '']);
      var tt = thongTinThe_(kh.the, ch);
      tt.ma_moi = ma;
      tt.tin_nhan = tinCongMa_(ch, tt, ma, tien);
      return tt;
    });
  });
}

function apiDoiQua(id, mon, pin, nhanVien) {
  return bocLoi_(function () {
    vaiTro_(pin);
    var nv = tenNv_(nhanVien);
    var ch = docCauHinh_();
    mon = String(mon || '').trim();
    if (!mon) throw new Error('Chọn món khách mua để áp dụng quà.');
    return khoa_(function () {
      var kh = timThe_(id);
      if (kh.trang_thai === 'khoa') throw new Error('Thẻ này đang bị khóa. Liên hệ chủ quán.');
      var sh = tab_(TAB.MA);
      var rows = sh.getDataRange().getValues();
      var bayGio = new Date();
      var dung = [];
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][1]) === kh.the && trangThaiMa_(rows[i], ch, bayGio) === 'con') dung.push(i);
      }
      dung.sort(function (a, b) { return new Date(rows[a][5]) - new Date(rows[b][5]); });
      if (dung.length < ch.so_ma_doi) throw new Error('Khách mới có ' + dung.length + '/' + ch.so_ma_doi + ' mã, chưa đủ đổi quà.');
      dung = dung.slice(0, ch.so_ma_doi);
      var maQua = 'QUA-' + ngauNhien_(5);
      dung.forEach(function (r) { sh.getRange(r + 1, 8, 1, 2).setValues([['da_doi', maQua]]); });
      var dsMa = dung.map(function (r) { return String(rows[r][0]); });
      tab_(TAB.QUA).appendRow([maQua, kh.the, kh.ten, "'" + kh.sdt, bayGio, mon, ch.gia_tri_giam, dsMa.join(', '), nv]);
      var tt = thongTinThe_(kh.the, ch);
      tt.ma_qua = maQua;
      tt.tin_nhan = 'Dạ ' + ch.ten_quan + ' cảm ơn ' + kh.ten + ' ạ! Anh/chị đã dùng ' + ch.so_ma_doi + ' mã để được ' +
        ch.qua_tang + ' (món: ' + mon + '). Mã quà: ' + maQua + '. Anh/chị đang còn ' + tt.so_ma + '/' + ch.so_ma_doi +
        ' mã, tiếp tục tích để nhận quà lần sau nhé ạ 😊';
      return tt;
    });
  });
}

/** Nhân viên tìm khách theo SĐT hoặc tên. */
function apiTim(q, pin) {
  return bocLoi_(function () {
    vaiTro_(pin);
    var ch = docCauHinh_();
    var tu = boDau_(String(q || '')).trim();
    if (tu.length < 2) throw new Error('Nhập ít nhất 2 ký tự (SĐT hoặc tên).');
    var soTu = tu.replace(/\D/g, '');
    var dem = demMa_(ch);
    var kq = [];
    tab_(TAB.KH).getDataRange().getValues().slice(1).forEach(function (r) {
      var sdt = sdtMem_(r[2]);
      var khop = (soTu.length >= 3 && sdt.indexOf(soTu) >= 0) || boDau_(String(r[1])).indexOf(tu) >= 0;
      if (khop && kq.length < 30) {
        var so = dem[String(r[0])] || 0;
        kq.push({ the: String(r[0]), ten: String(r[1]), sdt: sdt, so_ma: so, du_qua: so >= ch.so_ma_doi,
          trang_thai: String(r[5]), url: urlThe_(r[0]) });
      }
    });
    return { ok: true, ds: kq };
  });
}

/** Trang chủ quán: thống kê + khách đủ quà cần nhắc + hoạt động gần đây. */
function apiBaoCao(pin) {
  return bocLoi_(function () {
    if (vaiTro_(pin) !== 'chu') throw new Error('Trang này chỉ dành cho chủ quán (mật khẩu chủ quán).');
    var ch = docCauHinh_();
    var bayGio = new Date();
    var homNay = ngayKey_(bayGio), thangNay = homNay.slice(0, 7);
    var kh = tab_(TAB.KH).getDataRange().getValues().slice(1);
    var ma = tab_(TAB.MA).getDataRange().getValues().slice(1);
    var qua = tab_(TAB.QUA).getDataRange().getValues().slice(1);
    var tk = { tong_khach: kh.length, khach_moi_thang: 0, ma_hom_nay: 0, ma_thang: 0, qua_hom_nay: 0, qua_thang: 0, tien_giam_thang: 0, doanh_so_bill_thang: 0 };
    kh.forEach(function (r) { if (ngayKey_(r[3]).slice(0, 7) === thangNay) tk.khach_moi_thang++; });
    var nvHomNay = {};
    var hoatDong = [];
    ma.forEach(function (r) {
      var k = ngayKey_(r[5]);
      if (k === homNay) { tk.ma_hom_nay++; nvHomNay[r[6]] = (nvHomNay[r[6]] || 0) + 1; }
      if (k.slice(0, 7) === thangNay) { tk.ma_thang++; tk.doanh_so_bill_thang += Number(r[4]) || 0; }
      hoatDong.push({ t: new Date(r[5]).getTime(), loai: 'Cộng mã', ten: String(r[2]), chi_tiet: String(r[0]) + ' · bill ' + tienVn_(r[4]), nv: String(r[6]) });
    });
    qua.forEach(function (r) {
      var k = ngayKey_(r[4]);
      if (k === homNay) tk.qua_hom_nay++;
      if (k.slice(0, 7) === thangNay) { tk.qua_thang++; tk.tien_giam_thang += Number(r[6]) || 0; }
      hoatDong.push({ t: new Date(r[4]).getTime(), loai: 'Đổi quà', ten: String(r[2]), chi_tiet: String(r[0]) + ' · ' + String(r[5]), nv: String(r[8]) });
    });
    hoatDong.sort(function (a, b) { return b.t - a.t; });
    hoatDong = hoatDong.slice(0, 30).map(function (x) { x.luc = gioNgay_(new Date(x.t)); delete x.t; return x; });

    var dem = demMa_(ch);
    var canNhac = [];
    kh.forEach(function (r) {
      var so = dem[String(r[0])] || 0;
      if (so >= ch.so_ma_doi && String(r[5]) !== 'khoa') {
        var tt = { the: String(r[0]), ten: String(r[1]), sdt: sdtMem_(r[2]), so_ma: so, url: urlThe_(r[0]) };
        tt.tin_nhac = tinNhac_(ch, tt);
        canNhac.push(tt);
      }
    });
    return { ok: true, tk: tk, nv_hom_nay: nvHomNay, can_nhac: canNhac, hoat_dong: hoatDong,
      link_sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl(), cfg: congKhai_(ch) };
  });
}

/* ============================ NGHIỆP VỤ ============================ */

function thongTinThe_(id, ch) {
  var kh = timThe_(id);
  var bayGio = new Date();
  var ds = [], daDung = 0, hetHan = 0;
  tab_(TAB.MA).getDataRange().getValues().slice(1).forEach(function (r) {
    if (String(r[1]) !== kh.the) return;
    var tt = trangThaiMa_(r, ch, bayGio);
    if (tt === 'con') ds.push({ ma: String(r[0]), luc: gioNgay_(r[5]), bill: tienVn_(r[4]), t: new Date(r[5]).getTime() });
    else if (tt === 'da_doi') daDung++;
    else hetHan++;
  });
  ds.sort(function (a, b) { return a.t - b.t; });
  ds.forEach(function (x) { delete x.t; });
  var lichSuQua = [];
  tab_(TAB.QUA).getDataRange().getValues().slice(1).forEach(function (r) {
    if (String(r[1]) === kh.the) lichSuQua.push({ ma: String(r[0]), luc: gioNgay_(r[4]), mon: String(r[5]) });
  });
  return {
    ok: true, the: kh.the, ten: kh.ten, sdt: anSdt_(kh.sdt), trang_thai: kh.trang_thai, url: urlThe_(kh.the),
    so_ma: ds.length, so_ma_doi: ch.so_ma_doi, du_qua: ds.length >= ch.so_ma_doi,
    so_qua_co_the_doi: Math.floor(ds.length / ch.so_ma_doi),
    ds_ma: ds, lich_su_qua: lichSuQua.reverse(), so_ma_het_han: hetHan, cfg: congKhai_(ch)
  };
}

function tinCongMa_(ch, tt, ma, tien) {
  var s = 'Dạ ' + ch.ten_quan + ' đã cộng 1 mã (' + ma + ') cho bill ' + tienVn_(tien) + ' của ' + tt.ten + ' ạ. ' +
    'Anh/chị đang có ' + tt.so_ma + '/' + ch.so_ma_doi + ' mã. ';
  if (tt.du_qua) s += '🎉 Anh/chị đã ĐỦ MÃ nhận quà: ' + ch.qua_tang + '. Lần mua tới anh/chị đưa thẻ cho nhân viên để đổi nhé!';
  else s += 'Tích thêm ' + (ch.so_ma_doi - tt.so_ma) + ' mã nữa để nhận: ' + ch.qua_tang + ' ạ 😊';
  return s + '\nThẻ của anh/chị: ' + tt.url;
}

function tinNhac_(ch, tt) {
  return 'Dạ chào ' + tt.ten + ', anh/chị đã tích đủ ' + tt.so_ma + '/' + ch.so_ma_doi + ' mã tại ' + ch.ten_quan + ' 🎉 ' +
    'Lần mua tới anh/chị được ' + ch.qua_tang + '. Khi thanh toán anh/chị mở thẻ và đưa nhân viên quét giúp em nhé ạ!\n' +
    'Thẻ của anh/chị: ' + tt.url;
}

function demMa_(ch) {
  var bayGio = new Date(), dem = {};
  tab_(TAB.MA).getDataRange().getValues().slice(1).forEach(function (r) {
    if (trangThaiMa_(r, ch, bayGio) === 'con') dem[String(r[1])] = (dem[String(r[1])] || 0) + 1;
  });
  return dem;
}

function timThe_(id) {
  id = String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!id) throw new Error('Thiếu mã thẻ.');
  var rows = tab_(TAB.KH).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      return { the: id, ten: String(rows[i][1]), sdt: sdtMem_(rows[i][2]), trang_thai: String(rows[i][5] || 'hoat_dong') };
    }
  }
  throw new Error('Không tìm thấy thẻ. Kiểm tra lại link thẻ.');
}

function trangThaiMa_(r, ch, bayGio) {
  if (String(r[7]) === 'da_doi') return 'da_doi';
  if (ch.han_ma_ngay > 0) {
    var cap = new Date(r[5]);
    if (!isNaN(cap.getTime()) && bayGio - cap > ch.han_ma_ngay * 86400000) return 'het_han';
  }
  return 'con';
}

/* ============================ TIỆN ÍCH ============================ */

function vaiTro_(pin) {
  var props = PropertiesService.getScriptProperties();
  var p = String(pin || '');
  if (p && p === String(props.getProperty('PIN_CHU_QUAN'))) return 'chu';
  if (p && p === String(props.getProperty('PIN_NHAN_VIEN'))) return 'nv';
  throw new Error('Sai mật khẩu.');
}

function tenNv_(ten) {
  ten = String(ten || '').trim();
  if (!ten) throw new Error('Nhập tên nhân viên để ghi sổ.');
  return ten.slice(0, 30);
}

function bocLoi_(fn) {
  try { return fn(); } catch (err) { return { ok: false, loi: String((err && err.message) || err) }; }
}

function khoa_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function congKhai_(ch) {
  return { ten_quan: ch.ten_quan, so_ma_doi: ch.so_ma_doi, bill_toi_thieu: ch.bill_toi_thieu, qua_tang: ch.qua_tang,
    mon_ap_dung: ch.mon_ap_dung, han_ma_ngay: ch.han_ma_ngay, link_nhom_zalo: ch.link_nhom_zalo };
}

function docCauHinh_() {
  var ch = {};
  CAU_HINH_MAC_DINH.forEach(function (r) { ch[r[0]] = r[1]; });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.CH);
  if (sh) sh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (String(r[0]).trim() && String(r[1]).trim() !== '') ch[String(r[0]).trim()] = r[1];
  });
  var so = function (v, md) { var n = Number(String(v).replace(/[^\d]/g, '')); return isNaN(n) || String(v).replace(/[^\d]/g, '') === '' ? md : n; };
  ch.so_ma_doi = Math.max(1, so(ch.so_ma_doi, 3));
  ch.bill_toi_thieu = so(ch.bill_toi_thieu, 30000);
  ch.gia_tri_giam = so(ch.gia_tri_giam, 5000);
  ch.han_ma_ngay = so(ch.han_ma_ngay, 0);
  ch.phut_chong_trung = so(ch.phut_chong_trung, 10);
  ch.ten_quan = String(ch.ten_quan);
  ch.qua_tang = String(ch.qua_tang);
  ch.link_nhom_zalo = String(ch.link_nhom_zalo || '');
  ch.mon_ap_dung = String(ch.mon_ap_dung).split(';').map(function (s) { return s.trim(); }).filter(String);
  return ch;
}

function tab_(ten) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ten);
  if (!sh) { caiDat(); sh = ss.getSheetByName(ten); }
  return sh;
}

function urlApp_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}
function urlThe_(id) { return urlApp_() + '?the=' + id; }

function sdtMem_(v) {
  var s = String(v == null ? '' : v).replace(/[^\d+]/g, '');
  if (s.indexOf('+84') === 0) s = '0' + s.slice(3);
  else if (s.indexOf('84') === 0 && s.length === 11) s = '0' + s.slice(2);
  s = s.replace(/\D/g, '');
  if (s.length === 9) s = '0' + s;
  return s;
}
function chuanSdt_(v) {
  var s = sdtMem_(v);
  if (!/^0\d{9}$/.test(s)) throw new Error('Số điện thoại chưa đúng (cần 10 số, ví dụ 0907754132).');
  return s;
}
function anSdt_(s) { return s ? s.slice(0, 3) + '****' + s.slice(-3) : ''; }

function ngauNhien_(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += CHU.charAt(Math.floor(Math.random() * CHU.length));
  return s;
}

function boDau_(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function tienVn_(n) { return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function fmt_(d, f) { d = new Date(d); return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, TZ, f); }
function gio_(d) { return fmt_(d, 'HH:mm'); }
function gioNgay_(d) { return fmt_(d, 'HH:mm dd/MM/yyyy'); }
function ngayKey_(d) { return fmt_(d, 'yyyy-MM-dd'); }

/* ============================ CÀI ĐẶT ============================ */

/** Chạy 1 lần: tạo các tab và mật khẩu. Chạy lại không mất dữ liệu, không đổi mật khẩu cũ. */
function caiDat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [[TAB.KH, COT_KH], [TAB.MA, COT_MA], [TAB.QUA, COT_QUA]].forEach(function (x) {
    var sh = ss.getSheetByName(x[0]) || ss.insertSheet(x[0]);
    if (sh.getLastRow() === 0) {
      sh.appendRow(x[1]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, x[1].length).setFontWeight('bold');
    }
  });
  var shCh = ss.getSheetByName(TAB.CH) || ss.insertSheet(TAB.CH);
  if (shCh.getLastRow() === 0) {
    shCh.appendRow(['khoa', 'gia_tri', 'giai_thich']);
    CAU_HINH_MAC_DINH.forEach(function (r) { shCh.appendRow(r); });
    shCh.setFrozenRows(1);
    shCh.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  var props = PropertiesService.getScriptProperties();
  ['PIN_NHAN_VIEN', 'PIN_CHU_QUAN'].forEach(function (k) {
    if (!props.getProperty(k)) props.setProperty(k, String(Math.floor(100000 + Math.random() * 900000)));
  });
  var msg = 'ĐÃ CÀI ĐẶT XONG.\nMật khẩu NHÂN VIÊN: ' + props.getProperty('PIN_NHAN_VIEN') +
    '\nMật khẩu CHỦ QUÁN: ' + props.getProperty('PIN_CHU_QUAN') +
    '\n(Đổi mật khẩu: Cài đặt dự án → Thuộc tính tập lệnh)';
  Logger.log(msg);
  return msg;
}

/* ============================ GIAO DIỆN ============================ */
// (Trang web 1 trang, hiển thị theo đường link. Không dùng dấu ` hoặc ${ trong phần này.)
var TRANG_HTML = String.raw`<!DOCTYPE html>
<html lang="vi">
<head>
<base target="_top">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { --xanh: #2e7d32; --xanh-dam: #1b5e20; --xanh-nhat: #e8f5e9; --cam: #ef6c00; --nen: #f5f5f0; --the: #fff; --vien: #e0e0e0; --chu: #212121; --phu: #6b6b6b; --do: #c62828; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: var(--nen); color: var(--chu); font-size: 16px; line-height: 1.45; }
header { background: var(--xanh); color: #fff; padding: 14px 16px; text-align: center; }
header h1 { margin: 0; font-size: 1.2rem; }
header p { margin: 2px 0 0; opacity: .9; font-size: .9rem; }
main { max-width: 520px; margin: 0 auto; padding: 14px 16px 40px; }
.hop { background: var(--the); border: 1px solid var(--vien); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
h2 { font-size: 1.05rem; margin: 0 0 8px; }
label { display: block; font-weight: 600; margin: 10px 0 4px; font-size: .95rem; }
input, select, textarea { width: 100%; padding: 11px; font-size: 1rem; border: 1px solid #bdbdbd; border-radius: 8px; background: #fff; }
textarea { min-height: 96px; font-size: .9rem; font-family: inherit; }
button { width: 100%; background: var(--xanh); color: #fff; border: 0; border-radius: 8px; padding: 12px; font-size: 1rem; font-weight: 600; margin-top: 10px; cursor: pointer; }
button.phu { background: #fff; color: var(--xanh-dam); border: 1px solid var(--xanh); }
button.cam { background: var(--cam); }
button:disabled { opacity: .55; }
.nho { font-size: .85rem; color: var(--phu); }
.loi { color: var(--do); font-weight: 600; }
.ok { color: var(--xanh-dam); font-weight: 600; }
.an { display: none !important; }
.cham { display: flex; justify-content: center; gap: 14px; margin: 12px 0 4px; }
.cham span { width: 54px; height: 54px; border-radius: 50%; border: 3px dashed #bdbdbd; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #bdbdbd; }
.cham span.co { border: 3px solid var(--xanh); background: var(--xanh-nhat); color: var(--xanh); }
.so-lon { text-align: center; font-size: 1.6rem; font-weight: 700; }
.bang-qua { background: #fff3e0; border: 2px solid var(--cam); border-radius: 10px; padding: 12px; text-align: center; font-weight: 600; margin: 10px 0; }
#qr { display: flex; justify-content: center; margin: 8px 0; }
#qr img, #qr canvas { width: 200px; height: 200px; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--vien); vertical-align: top; }
.o-so { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.o-so div { background: var(--xanh-nhat); border-radius: 10px; padding: 10px; }
.o-so b { display: block; font-size: 1.4rem; }
.dong-kh { border-bottom: 1px solid var(--vien); padding: 10px 0; }
.dong-kh:last-child { border-bottom: 0; }
.hang-nut { display: flex; gap: 8px; }
.hang-nut button { margin-top: 8px; padding: 9px; font-size: .9rem; }
.the-so { text-align: center; letter-spacing: .12em; color: var(--phu); font-size: .9rem; }
ol { padding-left: 20px; margin: 6px 0; }
a { color: var(--xanh-dam); }
</style>
</head>
<body>
<header><h1 id="tieuDe">Thẻ tích mã</h1><p id="phuDe"></p></header>
<main id="noiDung"><p class="nho">Đang tải…</p></main>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
/*__BOOT__*/
var CFG = BOOT.cfg;
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function tien(n) { return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function luu(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function doc(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function api(ten) {
  var args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function (ok, loi) {
    var r = google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) { loi(new Error((e && e.message) || 'Lỗi kết nối, thử lại.')); });
    r[ten].apply(r, args);
  });
}
function bao(el, html) { $(el).innerHTML = html; }
function baoLoi(el, msg) { bao(el, '<p class="loi">' + esc(msg) + '</p>'); }
function chay(nut, fn) { nut.disabled = true; return Promise.resolve().then(fn).catch(function (e) { alert(e.message); }).then(function () { nut.disabled = false; }); }
function saoChep(id, nut) {
  var o = $(id); var txt = o.value;
  var xong = function () { nut.textContent = 'Đã sao chép ✓'; setTimeout(function () { nut.textContent = 'Sao chép'; }, 2000); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(xong, function () { o.select(); try { document.execCommand('copy'); xong(); } catch (e) {} });
  } else { o.select(); try { document.execCommand('copy'); xong(); } catch (e) {} }
}
var demSc = 0;
function hopSaoChep(tieuDe, txt) {
  var id = 'sc' + (++demSc);
  return '<p style="margin:10px 0 4px"><b>' + esc(tieuDe) + '</b></p><textarea id="' + id + '" readonly>' + esc(txt) + '</textarea>' +
    '<button class="phu" onclick="saoChep(\'' + id + '\', this)">Sao chép</button>';
}
function nv() { return { pin: doc('tm_pin'), ten: doc('tm_nv'), vai: doc('tm_vai') }; }
function luatChoi() {
  return '<ol><li>Mỗi bill từ <b>' + tien(CFG.bill_toi_thieu) + '</b> trở lên được <b>1 mã</b>.</li>' +
    '<li>Tích đủ <b>' + CFG.so_ma_doi + ' mã</b> → <b>' + esc(CFG.qua_tang) + '</b>.</li>' +
    '<li>Khi thanh toán, mở thẻ này và đưa nhân viên quét mã QR.</li></ol>' +
    (CFG.han_ma_ngay > 0 ? '<p class="nho">Mỗi mã có hạn ' + CFG.han_ma_ngay + ' ngày.</p>' : '');
}
$('tieuDe').textContent = CFG.ten_quan;

/* ---------- ĐĂNG NHẬP NHÂN VIÊN / CHỦ QUÁN ---------- */
function formDangNhap(sau) {
  var n = nv();
  return '<div class="hop"><h2>Đăng nhập</h2>' +
    '<label for="dnPin">Mật khẩu</label><input id="dnPin" type="password" inputmode="numeric" autocomplete="current-password">' +
    '<label for="dnTen">Tên nhân viên (để ghi sổ)</label><input id="dnTen" value="' + esc(n.ten) + '" placeholder="Ví dụ: Lan">' +
    '<button id="dnNut">Đăng nhập</button><div id="dnKq"></div></div>';
}
function ganDangNhap(sau) {
  $('dnNut').onclick = function () {
    chay($('dnNut'), function () {
      var pin = $('dnPin').value.trim(), ten = $('dnTen').value.trim();
      if (!ten) throw new Error('Nhập tên nhân viên.');
      return api('apiDangNhap', pin).then(function (r) {
        if (!r.ok) throw new Error(r.loi);
        luu('tm_pin', pin); luu('tm_nv', ten); luu('tm_vai', r.vai_tro);
        sau();
      });
    });
  };
}
function dangXuat() { luu('tm_pin', null); luu('tm_vai', null); location.reload(); }

/* ---------- KHÁCH ĐĂNG KÝ THẺ ---------- */
function veDangKy() {
  $('phuDe').textContent = 'Chương trình tích mã cho thành viên nhóm Zalo';
  var daLuu = doc('tm_the_cua_toi');
  $('noiDung').innerHTML =
    (daLuu ? '<div class="hop"><p>Máy này đã có thẻ của bạn.</p><button onclick="moThe(\'' + esc(daLuu) + '\')">Mở thẻ của tôi</button></div>' : '') +
    '<div class="hop"><h2>Cách nhận quà</h2>' + luatChoi() +
    (CFG.link_nhom_zalo ? '<p class="nho">Chương trình dành cho thành viên <a href="' + esc(CFG.link_nhom_zalo) + '">nhóm Zalo của quán</a>.</p>' : '') + '</div>' +
    '<div class="hop"><h2>Đăng ký thẻ (miễn phí)</h2>' +
    '<label for="dkTen">Tên Zalo của bạn</label><input id="dkTen" autocomplete="name">' +
    '<label for="dkSdt">Số điện thoại</label><input id="dkSdt" type="tel" inputmode="numeric" autocomplete="tel" placeholder="0907754132">' +
    '<button id="dkNut">Tạo thẻ của tôi</button><div id="dkKq"></div></div>';
  $('dkNut').onclick = function () {
    chay($('dkNut'), function () {
      return api('apiDangKy', $('dkTen').value, $('dkSdt').value, '', '').then(function (r) {
        if (!r.ok) return baoLoi('dkKq', r.loi);
        luu('tm_the_cua_toi', r.the);
        moThe(r.the, true);
      });
    });
  };
}

/* ---------- THẺ CỦA KHÁCH ---------- */
var THE = null;
function moThe(id, moiTao) {
  $('noiDung').innerHTML = '<p class="nho">Đang tải thẻ…</p>';
  return api('apiThe', id).then(function (r) {
    if (!r.ok) { $('noiDung').innerHTML = '<div class="hop"><p class="loi">' + esc(r.loi) + '</p></div>'; return; }
    THE = r; CFG = r.cfg; veThe(moiTao);
  }).catch(function (e) { $('noiDung').innerHTML = '<div class="hop"><p class="loi">' + esc(e.message) + '</p></div>'; });
}
function veThe(moiTao) {
  var t = THE, n = nv();
  $('phuDe').textContent = 'Thẻ tích mã của ' + t.ten;
  var cham = '';
  var hien = Math.max(t.so_ma_doi, Math.min(t.so_ma, t.so_ma_doi * 2));
  for (var i = 0; i < Math.min(hien, 6); i++) cham += '<span class="' + (i < t.so_ma ? 'co' : '') + '">' + (i < t.so_ma ? '✓' : (i + 1)) + '</span>';
  var h = '';
  if (moiTao) {
    h += '<div class="hop" style="border-color:var(--xanh)"><p class="ok">Tạo thẻ thành công!</p>' +
      '<p><b>Lưu thẻ để lần sau mở nhanh:</b> bấm "Sao chép" rồi dán gửi vào <b>Cloud của tôi</b> trên Zalo (hoặc nhắn cho quán).</p>' +
      hopSaoChep('Link thẻ của bạn', t.url) + '</div>';
  }
  if (t.trang_thai === 'khoa') h += '<div class="hop"><p class="loi">Thẻ đang tạm khóa. Vui lòng liên hệ quán.</p></div>';
  h += '<div class="hop" style="text-align:center"><h2>' + esc(t.ten) + '</h2><div class="the-so">Thẻ ' + esc(t.the.slice(0, 4) + '-' + t.the.slice(4)) + ' · ' + esc(t.sdt) + '</div>' +
    '<div class="cham">' + cham + '</div><div class="so-lon">' + t.so_ma + '/' + t.so_ma_doi + ' mã</div>' +
    (t.du_qua
      ? '<div class="bang-qua">🎉 Bạn đã đủ mã nhận quà!<br>' + esc(CFG.qua_tang) + (t.so_qua_co_the_doi > 1 ? '<br>(Đủ ' + t.so_qua_co_the_doi + ' lần quà)' : '') + '<br><span class="nho">Khi mua, đưa thẻ cho nhân viên để đổi.</span></div>'
      : '<p>Tích thêm <b>' + (t.so_ma_doi - t.so_ma) + ' mã</b> để nhận: ' + esc(CFG.qua_tang) + '</p>') +
    '<div id="qr"></div><p class="nho">Khi thanh toán, đưa mã QR này cho nhân viên quét.</p></div>';

  if (n.pin) {
    h += '<div class="hop" style="border:2px solid var(--xanh)"><h2>Nhân viên: ' + esc(n.ten) + '</h2>' +
      '<label for="nvTien">Số tiền bill (đồng)</label><input id="nvTien" inputmode="numeric" placeholder="Từ ' + tien(CFG.bill_toi_thieu) + ' trở lên">' +
      '<button id="nvCong">+ Cộng 1 mã</button>' +
      (t.du_qua
        ? '<label for="nvMon">Khách đổi quà – món áp dụng</label><select id="nvMon"><option value="">-- Chọn món --</option>' +
          CFG.mon_ap_dung.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>' +
          '<button id="nvDoi" class="cam">Đổi quà (dùng ' + t.so_ma_doi + ' mã)</button>'
        : '') +
      '<div id="nvKq"></div><p class="nho"><a href="' + esc(BOOT.url) + '?p=nv">← Trang nhân viên</a></p></div>';
  }

  h += '<div class="hop"><h2>Mã đang có</h2>' + (t.ds_ma.length
    ? '<table><tr><th>Mã</th><th>Bill</th><th>Lúc</th></tr>' + t.ds_ma.map(function (m) { return '<tr><td>' + esc(m.ma) + '</td><td>' + esc(m.bill) + '</td><td>' + esc(m.luc) + '</td></tr>'; }).join('') + '</table>'
    : '<p class="nho">Chưa có mã nào. Mua bill từ ' + tien(CFG.bill_toi_thieu) + ' để nhận mã đầu tiên!</p>') +
    (t.so_ma_het_han ? '<p class="nho">' + t.so_ma_het_han + ' mã đã hết hạn.</p>' : '') + '</div>';
  if (t.lich_su_qua.length) {
    h += '<div class="hop"><h2>Quà đã nhận</h2><table>' + t.lich_su_qua.map(function (q) { return '<tr><td>' + esc(q.ma) + '</td><td>' + esc(q.mon) + '</td><td>' + esc(q.luc) + '</td></tr>'; }).join('') + '</table></div>';
  }
  h += '<div class="hop"><h2>Cách nhận quà</h2>' + luatChoi() + '</div>';
  if (!n.pin) h += '<p class="nho" style="text-align:center"><a href="#" onclick="nvDangNhapTaiThe();return false">Nhân viên đăng nhập</a></p>';
  $('noiDung').innerHTML = h;

  try { new QRCode($('qr'), { text: t.url || t.the, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M }); }
  catch (e) { $('qr').innerHTML = '<p class="nho">Mã thẻ: <b>' + esc(t.the) + '</b></p>'; }

  if (n.pin) {
    var cong = function (boQua) {
      return api('apiCongMa', t.the, $('nvTien').value, n.pin, n.ten, !!boQua).then(function (r) {
        if (r.can_xac_nhan) {
          bao('nvKq', '<p class="loi">' + esc(r.loi) + '</p><button class="cam" id="nvVanCong">Vẫn cộng mã</button>');
          $('nvVanCong').onclick = function () { chay($('nvVanCong'), function () { return cong(true); }); };
          return;
        }
        if (!r.ok) return baoLoi('nvKq', r.loi);
        THE = r; veThe();
        bao('nvKq', '<p class="ok">✓ Đã cộng mã ' + esc(r.ma_moi) + '. Khách có ' + r.so_ma + '/' + r.so_ma_doi + ' mã.</p>' +
          (r.du_qua ? '<div class="bang-qua">🎉 Khách ĐỦ MÃ nhận quà – báo khách ngay!</div>' : '') +
          hopSaoChep('Tin nhắn gửi khách qua Zalo', r.tin_nhan));
        $('nvKq').scrollIntoView({ behavior: 'smooth' });
      });
    };
    $('nvCong').onclick = function () { chay($('nvCong'), function () { return cong(false); }); };
    if ($('nvDoi')) $('nvDoi').onclick = function () {
      chay($('nvDoi'), function () {
        var mon = $('nvMon').value;
        if (!mon) throw new Error('Chọn món khách mua.');
        if (!confirm('Đổi quà cho ' + t.ten + ' (' + mon + ')? ' + t.so_ma_doi + ' mã sẽ được dùng.')) return;
        return api('apiDoiQua', t.the, mon, n.pin, n.ten).then(function (r) {
          if (!r.ok) return baoLoi('nvKq', r.loi);
          THE = r; veThe();
          bao('nvKq', '<p class="ok">✓ Đã đổi quà ' + esc(r.ma_qua) + ' – giảm cho khách: ' + esc(CFG.qua_tang) + '</p>' + hopSaoChep('Tin nhắn gửi khách qua Zalo', r.tin_nhan));
          $('nvKq').scrollIntoView({ behavior: 'smooth' });
        });
      });
    };
  }
}
function nvDangNhapTaiThe() {
  $('noiDung').innerHTML = formDangNhap();
  ganDangNhap(function () { veThe(); });
}

/* ---------- TRANG NHÂN VIÊN ---------- */
function veNhanVien() {
  $('phuDe').textContent = 'Trang nhân viên';
  var n = nv();
  if (!n.pin) { $('noiDung').innerHTML = formDangNhap(); ganDangNhap(veNhanVien); return; }
  $('noiDung').innerHTML =
    '<div class="hop"><p>Xin chào <b>' + esc(n.ten) + '</b>' + (n.vai === 'chu' ? ' (chủ quán) · <a href="' + esc(BOOT.url) + '?p=chu">Trang chủ quán</a>' : '') + '</p>' +
    '<h2>Khi khách thanh toán</h2><ol><li>Khách mở thẻ, bạn dùng <b>camera điện thoại</b> quét mã QR trên thẻ.</li>' +
    '<li>Thẻ mở ra trên máy bạn → nhập tiền bill → <b>Cộng 1 mã</b>.</li><li>Khách đủ ' + CFG.so_ma_doi + ' mã + mua món áp dụng → <b>Đổi quà</b>.</li></ol></div>' +
    '<div class="hop"><h2>Tìm khách (khách quên điện thoại / cần gửi lại thẻ)</h2>' +
    '<input id="timQ" placeholder="SĐT hoặc tên"><button id="timNut">Tìm</button><div id="timKq"></div></div>' +
    '<div class="hop"><h2>Đăng ký thẻ hộ khách</h2>' +
    '<label for="hkTen">Tên Zalo của khách</label><input id="hkTen">' +
    '<label for="hkSdt">SĐT khách</label><input id="hkSdt" type="tel" inputmode="numeric">' +
    '<button id="hkNut">Tạo thẻ</button><div id="hkKq"></div></div>' +
    '<button class="phu" onclick="dangXuat()">Đăng xuất</button>';
  $('timNut').onclick = function () {
    chay($('timNut'), function () {
      return api('apiTim', $('timQ').value, n.pin).then(function (r) {
        if (!r.ok) return baoLoi('timKq', r.loi);
        if (!r.ds.length) return bao('timKq', '<p class="nho">Không tìm thấy khách.</p>');
        bao('timKq', r.ds.map(function (k, i) {
          return '<div class="dong-kh"><b>' + esc(k.ten) + '</b> · ' + esc(k.sdt) + '<br>' + k.so_ma + '/' + CFG.so_ma_doi + ' mã' +
            (k.du_qua ? ' · <span class="ok">ĐỦ QUÀ</span>' : '') + (k.trang_thai === 'khoa' ? ' · <span class="loi">khóa</span>' : '') +
            '<div class="hang-nut"><button onclick="moThe(\'' + esc(k.the) + '\')">Mở thẻ</button>' +
            '<button class="phu" onclick="hienLink(' + i + ')">Gửi lại link</button></div><div id="lk' + i + '"></div></div>';
        }).join(''));
        window.KQ_TIM = r.ds;
      });
    });
  };
  $('hkNut').onclick = function () {
    chay($('hkNut'), function () {
      return api('apiDangKy', $('hkTen').value, $('hkSdt').value, n.pin, n.ten).then(function (r) {
        if (!r.ok) return baoLoi('hkKq', r.loi);
        bao('hkKq', '<p class="ok">' + (r.da_co ? 'SĐT này đã có thẻ (' + esc(r.ten) + ').' : '✓ Đã tạo thẻ cho ' + esc(r.ten) + '.') + '</p>' +
          hopSaoChep('Tin nhắn gửi khách qua Zalo', 'Dạ ' + CFG.ten_quan + ' gửi ' + r.ten + ' thẻ tích mã ạ. Mỗi bill từ ' + tien(CFG.bill_toi_thieu) +
            ' được 1 mã, đủ ' + CFG.so_ma_doi + ' mã được ' + CFG.qua_tang + '. Khi thanh toán anh/chị mở link này đưa nhân viên quét nhé:\n' + r.url) +
          '<button onclick="moThe(\'' + esc(r.the) + '\')">Mở thẻ để cộng mã</button>');
      });
    });
  };
}
function hienLink(i) {
  var k = window.KQ_TIM[i];
  bao('lk' + i, hopSaoChep('Tin nhắn gửi khách qua Zalo', 'Dạ ' + CFG.ten_quan + ' gửi lại thẻ tích mã của ' + k.ten + ' ạ (đang có ' + k.so_ma + '/' + CFG.so_ma_doi + ' mã):\n' + k.url));
}

/* ---------- TRANG CHỦ QUÁN ---------- */
function veChuQuan() {
  $('phuDe').textContent = 'Trang chủ quán';
  var n = nv();
  if (!n.pin || n.vai !== 'chu') { $('noiDung').innerHTML = formDangNhap() + '<p class="nho">Dùng mật khẩu CHỦ QUÁN.</p>'; ganDangNhap(veChuQuan); return; }
  $('noiDung').innerHTML = '<p class="nho">Đang tải báo cáo…</p>';
  api('apiBaoCao', n.pin).then(function (r) {
    if (!r.ok) { $('noiDung').innerHTML = '<div class="hop"><p class="loi">' + esc(r.loi) + '</p><button class="phu" onclick="dangXuat()">Đăng nhập lại</button></div>'; return; }
    var t = r.tk;
    var h = '<div class="hop"><h2>Hôm nay</h2><div class="o-so">' +
      '<div><b>' + t.ma_hom_nay + '</b>mã đã cấp</div><div><b>' + t.qua_hom_nay + '</b>quà đã đổi</div></div>' +
      (Object.keys(r.nv_hom_nay).length ? '<p class="nho">Theo nhân viên: ' + Object.keys(r.nv_hom_nay).map(function (k) { return esc(k) + ' ' + r.nv_hom_nay[k]; }).join(' · ') + '</p>' : '') +
      '</div><div class="hop"><h2>Tháng này</h2><div class="o-so">' +
      '<div><b>' + t.ma_thang + '</b>mã đã cấp</div><div><b>' + t.qua_thang + '</b>quà đã đổi</div>' +
      '<div><b>' + tien(t.tien_giam_thang) + '</b>tiền đã giảm</div><div><b>' + tien(t.doanh_so_bill_thang) + '</b>tổng bill có tích mã</div>' +
      '<div><b>' + t.khach_moi_thang + '</b>khách mới đăng ký</div><div><b>' + t.tong_khach + '</b>tổng số thẻ</div></div></div>';
    h += '<div class="hop"><h2>Khách ĐỦ QUÀ chưa đổi – cần nhắc (' + r.can_nhac.length + ')</h2>' +
      (r.can_nhac.length ? r.can_nhac.map(function (k, i) {
        return '<div class="dong-kh"><b>' + esc(k.ten) + '</b> · ' + esc(k.sdt) + ' · ' + k.so_ma + ' mã' +
          '<div class="hang-nut"><button class="phu" onclick="hienNhac(' + i + ')">Tin nhắc qua Zalo</button><button onclick="moThe(\'' + esc(k.the) + '\')">Mở thẻ</button></div><div id="nh' + i + '"></div></div>';
      }).join('') : '<p class="nho">Chưa có khách nào đủ quà.</p>') + '</div>';
    h += '<div class="hop"><h2>Hoạt động gần đây</h2>' + (r.hoat_dong.length
      ? '<table><tr><th>Lúc</th><th>Việc</th><th>Khách</th><th>NV</th></tr>' + r.hoat_dong.map(function (x) {
          return '<tr><td>' + esc(x.luc) + '</td><td>' + esc(x.loai) + '<br><span class="nho">' + esc(x.chi_tiet) + '</span></td><td>' + esc(x.ten) + '</td><td>' + esc(x.nv) + '</td></tr>';
        }).join('') + '</table>'
      : '<p class="nho">Chưa có hoạt động.</p>') + '</div>';
    h += '<div class="hop"><h2>Quản lý</h2><p>Toàn bộ sổ sách nằm trong Google Sheet: <a href="' + esc(r.link_sheet) + '">mở Sheet</a>.</p>' +
      '<p class="nho">Đổi quy định (số mã, bill tối thiểu, quà, món áp dụng) ở tab <b>cau_hinh</b>. Khóa thẻ gian lận: tab <b>khach_hang</b>, cột trang_thai ghi <b>khoa</b>.</p>' +
      '<p class="nho">Link đăng ký ghim trong nhóm Zalo: <b>' + esc(BOOT.url) + '</b></p>' +
      '<button class="phu" onclick="veNhanVien()">Trang nhân viên</button><button class="phu" onclick="dangXuat()">Đăng xuất</button></div>';
    $('noiDung').innerHTML = h;
    window.DS_NHAC = r.can_nhac;
  }).catch(function (e) { $('noiDung').innerHTML = '<p class="loi">' + esc(e.message) + '</p>'; });
}
function hienNhac(i) { bao('nh' + i, hopSaoChep('Tin nhắc gửi khách', window.DS_NHAC[i].tin_nhac)); }

/* ---------- KHỞI ĐỘNG ---------- */
if (BOOT.view === 'the') moThe(BOOT.the);
else if (BOOT.view === 'nv') veNhanVien();
else if (BOOT.view === 'chu') veChuQuan();
else veDangKy();
</script>
</body>
</html>
`;
