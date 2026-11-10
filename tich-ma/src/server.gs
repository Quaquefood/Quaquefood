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

/** Menu "🎁 Tích mã" trên Google Sheet (tự hiện mỗi khi mở Sheet). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎁 Tích mã')
    .addItem('Cài đặt & xem mật khẩu', 'menuXemMatKhau')
    .addItem('Xem link trang web', 'menuXemLink')
    .addToUi();
}

function menuXemMatKhau() {
  SpreadsheetApp.getUi().alert('Tích mã', caiDat(), SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuXemLink() {
  var u = urlApp_();
  SpreadsheetApp.getUi().alert('Link trang web', u
    ? 'Đăng ký (ghim nhóm Zalo): ' + u + '\n\nNhân viên: ' + u + '?p=nv\n\nChủ quán: ' + u + '?p=chu'
    : 'Chưa triển khai. Vào Apps Script → Triển khai → Tùy chọn triển khai mới → Ứng dụng web.', SpreadsheetApp.getUi().ButtonSet.OK);
}

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
var TRANG_HTML = String.raw`__TRANG_HTML__`;
