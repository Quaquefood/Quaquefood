/**
 * LOGIC TÍCH MÃ QUA BOT ZALO – Bánh tráng Nhi Nhi
 * ================================================
 * Hàm thuần (không gọi mạng, không đọc file). Dán nguyên file này vào node Code
 * của các workflow MỚI "TICH MA - ..." trong n8n, hoặc require() khi chạy kiểm tra.
 *
 * Dữ liệu vào: các dòng của Google Sheet "Chuong trinh khuyen mai" dạng object theo
 * tiêu đề cột (đúng như node Google Sheets của n8n trả về).
 * Dữ liệu ra: { tin: [...tin cần gửi], ghi: [...thao tác ghi Sheet] }
 *   tin  = { den: 'user'|'group', threadId, text, mentions?: [{pos,len,uid}], cho_msgId?: true }
 *   ghi  = { tab, kieu: 'them'|'sua', khop?: {cot: giaTri}, dong: {cot: giaTri} }
 *
 * KHÔNG đụng workflow cũ: logic này chỉ chạy trong workflow mới, nhận sự kiện
 * qua webhook riêng /webhook/tich-ma do zalo-gateway chuyển sang (xem KE-HOACH.md).
 */
'use strict';

var TM = (function () {
  var CHU = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function boDau(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function ngauNhien(n, rnd) {
    rnd = rnd || Math.random;
    var s = '';
    for (var i = 0; i < n; i++) s += CHU.charAt(Math.floor(rnd() * CHU.length));
    return s;
  }

  /** Giờ Việt Nam (UTC+7), không phụ thuộc múi giờ máy chủ. */
  function vn(d) {
    var x = new Date(new Date(d).getTime() + 7 * 3600000);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return {
      ngay: x.getUTCFullYear() + '-' + p(x.getUTCMonth() + 1) + '-' + p(x.getUTCDate()),
      hien: p(x.getUTCHours()) + ':' + p(x.getUTCMinutes()) + ' ' + p(x.getUTCDate()) + '/' + p(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear(),
      sheet: x.getUTCFullYear() + '-' + p(x.getUTCMonth() + 1) + '-' + p(x.getUTCDate()) + ' ' + p(x.getUTCHours()) + ':' + p(x.getUTCMinutes()) + ':' + p(x.getUTCSeconds())
    };
  }

  /** Đọc thời gian đã ghi trong Sheet ('yyyy-MM-dd HH:mm:ss' giờ VN) thành mốc UTC. */
  function docGio(s) {
    if (s instanceof Date) return s.getTime();
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) { var t = Date.parse(s); return isNaN(t) ? NaN : t; }
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5], +(m[6] || 0));
  }

  function tienVn(n) { return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }

  /** Đọc tab cau_hinh (mảng {khoa, gia_tri}) thành object cấu hình đã chuẩn hóa. */
  function docCauHinh(rows) {
    var c = {};
    (rows || []).forEach(function (r) { if (r && String(r.khoa || '').trim()) c[String(r.khoa).trim()] = r.gia_tri; });
    var so = function (v, md) { var t = String(v == null ? '' : v).replace(/[^\d]/g, ''); return t === '' ? md : Number(t); };
    var ds = function (v) { return String(v == null ? '' : v).split(';').map(function (x) { return x.trim(); }).filter(String); };
    var ids = ds(c.nguoi_duyet), tens = ds(c.ten_nguoi_duyet);
    var nguoiDuyet = {};
    ids.forEach(function (id, i) { nguoiDuyet[id] = tens[i] || ('Người duyệt ' + (i + 1)); });
    return {
      bat: String(c.bat_chuc_nang || '').trim().toUpperCase() === 'BAT',
      ten_quan: String(c.ten_quan || 'Quán'),
      so_ma_doi: Math.max(1, so(c.so_ma_doi, 3)),
      bill_toi_thieu: so(c.bill_toi_thieu, 30000),
      // (11/11) {gia_tri} trong qua_tang được thay bằng gia_tri_giam → đổi số tiền chỉ cần sửa 1 ô gia_tri_giam.
      qua_tang: String(c.qua_tang || 'Quà tặng').replace(/\{gia_tri\}/g, tienVn(so(c.gia_tri_giam, 5000))),
      gia_tri_giam: so(c.gia_tri_giam, 5000),
      han_ma_ngay: so(c.han_ma_ngay, 0),
      han_duyet_phut: Math.max(1, so(c.han_duyet_phut, 30)),
      so_lan_moi_ngay: Math.max(1, so(c.so_lan_moi_ngay, 1)),
      nhom_khach_id: String(c.nhom_khach_id || '').trim(),
      nguoi_duyet: nguoiDuyet,
      tu_khoa: ds(c.tu_khoa_tich_ma || 'tích mã;tich ma').map(boDau)
    };
  }

  /**
   * Phân loại tin (DÙNG CHUNG với zalo-gateway: tichma-snippet.js chép NGUYÊN hàm này – sửa thì sửa cả hai).
   * 1) Tin BẮT ĐẦU bằng từ khóa (như cũ).
   * 2) (11/11) Tin NGẮN (≤ 30 ký tự sau khi bỏ dấu) CÓ CHỨA "tich ma|tich diem|doi qua|ma cua toi" ở bất kỳ đâu,
   *    trừ tin có mã món (M14, m 14) hoặc số điện thoại (≥ 9 chữ số) → các tin đó luôn về bot bán hàng.
   * Trả 'tich_ma' | 'doi_qua' | 'xem_ma' | null.
   */
  function phanLoai(text) {
    var t = boDau(text);
    if (!t) return null;
    if (/^(doi qua|doi ma|nhan qua)( |$)/.test(t)) return 'doi_qua';
    if (/^(ma cua toi|xem ma|kiem tra ma|so ma)( |$)/.test(t)) return 'xem_ma';
    if (/^(tich ma|tich diem)( |$)/.test(t)) return 'tich_ma';
    if (t.length > 30 || /(^| )m ?\d{1,2}( |$)/.test(t) || t.replace(/\D/g, '').length >= 9) return null;
    var tot = null, viTri = 999;
    [['doi_qua', /(^| )doi qua( |$)/], ['xem_ma', /(^| )ma cua toi( |$)/], ['tich_ma', /(^| )tich (ma|diem)( |$)/]].forEach(function (k) {
      var m = k[1].exec(t);
      if (m && m.index < viTri) { viTri = m.index; tot = k[0]; }
    });
    return tot;
  }

  /** Phân loại tin khách nhắn riêng cho bot. Trả 'tich_ma' | 'doi_qua' | 'xem_ma' | null. */
  function loaiTin(text, cfg) {
    var t = boDau(text);
    if (!t) return null;
    var p = phanLoai(text);
    if (p) return p;
    for (var i = 0; i < cfg.tu_khoa.length; i++) {
      var k = cfg.tu_khoa[i];
      if (t === k || t.indexOf(k + ' ') === 0) return 'tich_ma';
    }
    return null;
  }

  function maConHieuLuc(maTich, zaloId, cfg, now) {
    return (maTich || []).filter(function (r) {
      if (String(r.zalo_id) !== String(zaloId) || String(r.trang_thai) !== 'con') return false;
      if (cfg.han_ma_ngay > 0 && now - docGio(r.thoi_gian_duyet) > cfg.han_ma_ngay * 86400000) return false;
      return true;
    }).sort(function (a, b) { return docGio(a.thoi_gian_duyet) - docGio(b.thoi_gian_duyet); });
  }

  function yeuCauDangCho(yeuCau, zaloId, cfg, now) {
    return (yeuCau || []).filter(function (r) {
      return String(r.zalo_id) === String(zaloId) && String(r.trang_thai) === 'cho_duyet' &&
        now - docGio(r.thoi_gian) <= cfg.han_duyet_phut * 60000;
    });
  }

  function tinUser(threadId, text) { return { den: 'user', threadId: String(threadId), text: text }; }

  /* ------------------------------------------------------------------ */
  /** Khách nhắn riêng cho bot. evt = {fromId, fromName, threadId, text}; db = {cau_hinh, khach_hang, yeu_cau, ma_tich}. */
  function xuLyTinKhach(evt, db, now, opt) {
    opt = opt || {};
    now = now == null ? Date.now() : now;
    var cfg = docCauHinh(db.cau_hinh);
    var out = { tin: [], ghi: [], loai: null };
    if (!cfg.bat) return out;
    var loai = loaiTin(evt.text, cfg);
    out.loai = loai;
    if (!loai) return out;
    var uid = String(evt.fromId || evt.threadId), ten = String(evt.fromName || 'bạn').trim() || 'bạn';
    var kh = (db.khach_hang || []).filter(function (r) { return String(r.zalo_id) === uid; })[0];
    if (kh && String(kh.trang_thai) === 'khoa') {
      out.tin.push(tinUser(evt.threadId, 'Dạ tài khoản của anh/chị đang tạm ngưng tham gia chương trình tích mã. Anh/chị liên hệ quán giúp em nhé ạ.'));
      return out;
    }
    var con = maConHieuLuc(db.ma_tich, uid, cfg, now);

    if (loai === 'xem_ma') {
      out.tin.push(tinUser(evt.threadId, con.length >= cfg.so_ma_doi
        ? 'Dạ anh/chị đang có ' + con.length + ' mã 🎉 Đã đủ đổi quà: ' + cfg.qua_tang + '. Khi mua tại quán anh/chị nhắn "đổi quà" giúp em nhé!'
        : 'Dạ anh/chị đang có ' + con.length + '/' + cfg.so_ma_doi + ' mã' + (con.length ? ' (' + con.map(function (r) { return r.ma; }).join(', ') + ')' : '') +
          '. Mỗi bill từ ' + tienVn(cfg.bill_toi_thieu) + ' được 1 mã, đủ ' + cfg.so_ma_doi + ' mã được ' + cfg.qua_tang + ' ạ 😊'));
      return out;
    }

    if (loai === 'doi_qua') {
      if (con.length < cfg.so_ma_doi) {
        out.tin.push(tinUser(evt.threadId, 'Dạ anh/chị mới có ' + con.length + '/' + cfg.so_ma_doi + ' mã, chưa đủ đổi quà ạ. Tích thêm ' +
          (cfg.so_ma_doi - con.length) + ' mã nữa nhé 😊'));
        return out;
      }
      var dung = con.slice(0, cfg.so_ma_doi);
      var maQua = 'QUA-' + ngauNhien(5, opt.rnd);
      var g = vn(now);
      dung.forEach(function (r) { out.ghi.push({ tab: 'ma_tich', kieu: 'sua', khop: { ma: r.ma }, dong: { trang_thai: 'da_doi', ma_doi_qua: maQua } }); });
      out.ghi.push({ tab: 'doi_qua', kieu: 'them', dong: { ma_doi_qua: maQua, zalo_id: uid, ten_zalo: ten, thoi_gian: g.sheet,
        ma_da_dung: dung.map(function (r) { return r.ma; }).join(', '), gia_tri_giam: cfg.gia_tri_giam } });
      var conLai = con.length - cfg.so_ma_doi;
      // (11/11) Quán chỉ tin TIN CHÚC MỪNG MỚI của bot trong NHÓM KHÁCH (không tin màn hình khách → tin cũ/ảnh chụp vô dụng).
      if (cfg.nhom_khach_id) {
        var tagQ = '@' + ten;
        var chuc = '🎉 Chúc mừng ' + tagQ + ' đã đổi quà: ' + cfg.qua_tang + '! (' + g.hien.slice(0, 5) + ') Cảm ơn bạn đã ủng hộ ' + cfg.ten_quan + ' ❤️';
        out.tin.push({ den: 'group', threadId: cfg.nhom_khach_id, text: chuc, mentions: [{ pos: chuc.indexOf(tagQ), len: tagQ.length, uid: uid }] });
      }
      out.tin.push(tinUser(evt.threadId, '✅ ĐỔI QUÀ THÀNH CÔNG\n🎁 ' + cfg.qua_tang + '\n👤 ' + ten + '\n🕒 ' + g.hien + '\n🔖 Mã quà: ' + maQua +
        '\n\nEm đã báo quán trong nhóm Zalo của quán, quán xác nhận qua tin chúc mừng trong nhóm ạ. Còn lại ' + conLai + '/' + cfg.so_ma_doi + ' mã. Cảm ơn anh/chị đã ủng hộ ' + cfg.ten_quan + '! ❤️'));
      out.ma_qua = maQua;
      return out;
    }

    // loai === 'tich_ma'
    if (!cfg.nhom_khach_id) {
      out.tin.push(tinUser(evt.threadId, 'Dạ chương trình tích mã đang được cài đặt, anh/chị quay lại sau giúp em nhé ạ.'));
      return out;
    }
    if (opt.laThanhVien === false) {
      out.tin.push(tinUser(evt.threadId, 'Dạ chương trình tích mã dành cho thành viên nhóm Zalo của ' + cfg.ten_quan +
        '. Anh/chị tham gia nhóm rồi nhắn lại "tích mã" giúp em nhé ạ 😊'));
      return out;
    }
    if (yeuCauDangCho(db.yeu_cau, uid, cfg, now).length) {
      out.tin.push(tinUser(evt.threadId, 'Dạ yêu cầu tích mã của anh/chị đã gửi vào nhóm, đang chờ quán xác nhận ❤️ ạ. Anh/chị đợi chút giúp em nhé!'));
      return out;
    }
    var homNay = vn(now).ngay;
    var daTichHomNay = (db.ma_tich || []).filter(function (r) {
      return String(r.zalo_id) === uid && vn(docGio(r.thoi_gian_duyet)).ngay === homNay;
    }).length;
    if (daTichHomNay >= cfg.so_lan_moi_ngay) {
      out.tin.push(tinUser(evt.threadId, 'Dạ hôm nay anh/chị đã được tích ' + daTichHomNay + ' mã rồi ạ (tối đa ' + cfg.so_lan_moi_ngay +
        ' mã/ngày). Hẹn anh/chị lần mua sau nhé 😊 Anh/chị đang có ' + con.length + '/' + cfg.so_ma_doi + ' mã.'));
      return out;
    }
    var maYc = 'YC-' + ngauNhien(6, opt.rnd);
    var tag = '@' + ten;
    var noiDung = '🎉 Cảm ơn ' + tag + ' đã ủng hộ quán! ' + cfg.ten_quan + ' tặng bạn 1 mã tích điểm (đủ ' + cfg.so_ma_doi +
      ' mã được ' + cfg.qua_tang + '). Quán xác nhận ❤️ là mã sẽ được gửi riêng cho bạn nhé!';
    out.tin.push({ den: 'group', threadId: cfg.nhom_khach_id, text: noiDung,
      mentions: [{ pos: noiDung.indexOf(tag), len: tag.length, uid: uid }], cho_msgId: true, ma_yc: maYc });
    out.tin.push(tinUser(evt.threadId, 'Dạ em đã gửi yêu cầu tích mã vào nhóm ' + cfg.ten_quan + '. Quán xác nhận ❤️ xong em gửi mã cho anh/chị ngay ạ!'));
    out.ghi.push({ tab: 'yeu_cau', kieu: 'them', dong: { ma_yc: maYc, zalo_id: uid, ten_zalo: ten, thoi_gian: vn(now).sheet,
      msg_id_nhom: '', trang_thai: 'cho_duyet', nguoi_duyet: '', thoi_gian_duyet: '' } });
    if (!kh) out.ghi.push({ tab: 'khach_hang', kieu: 'them', dong: { zalo_id: uid, ten_zalo: ten, lan_dau: vn(now).sheet, trang_thai: 'hoat_dong', ghi_chu: '' } });
    out.ma_yc = maYc;
    return out;
  }

  /** Sau khi gửi tin vào nhóm thành công: ghi msgId của tin đó vào yêu cầu (để biết tim thả vào tin nào). */
  function ganMsgId(maYc, msgId) {
    return { tab: 'yeu_cau', kieu: 'sua', khop: { ma_yc: maYc }, dong: { msg_id_nhom: String(msgId) } };
  }

  /** Có người thả cảm xúc vào 1 tin trong nhóm khách. r = {groupId, uidFrom, msgId (id tin được thả), icon}. */
  function xuLyThaTim(r, db, now, opt) {
    opt = opt || {};
    now = now == null ? Date.now() : now;
    var cfg = docCauHinh(db.cau_hinh);
    var out = { tin: [], ghi: [], ket_qua: 'bo_qua' };
    if (!cfg.bat || String(r.groupId) !== cfg.nhom_khach_id) return out;
    if (!Object.prototype.hasOwnProperty.call(cfg.nguoi_duyet, String(r.uidFrom))) { out.ket_qua = 'khong_phai_nguoi_duyet'; return out; }
    var yc = (db.yeu_cau || []).filter(function (x) { return String(x.msg_id_nhom) === String(r.msgId) && String(x.msg_id_nhom) !== ''; })[0];
    if (!yc) { out.ket_qua = 'khong_phai_tin_tich_ma'; return out; }
    if (String(yc.trang_thai) !== 'cho_duyet') { out.ket_qua = 'da_xu_ly'; return out; }
    if (now - docGio(yc.thoi_gian) > cfg.han_duyet_phut * 60000) {
      out.ket_qua = 'qua_han';
      out.ghi.push({ tab: 'yeu_cau', kieu: 'sua', khop: { ma_yc: yc.ma_yc }, dong: { trang_thai: 'het_han' } });
      return out;
    }
    var nguoi = cfg.nguoi_duyet[String(r.uidFrom)];
    var g = vn(now);
    var ma = 'M-' + ngauNhien(5, opt.rnd);
    out.ghi.push({ tab: 'yeu_cau', kieu: 'sua', khop: { ma_yc: yc.ma_yc }, dong: { trang_thai: 'da_duyet', nguoi_duyet: nguoi, thoi_gian_duyet: g.sheet } });
    out.ghi.push({ tab: 'ma_tich', kieu: 'them', dong: { ma: ma, zalo_id: String(yc.zalo_id), ten_zalo: String(yc.ten_zalo), thoi_gian_duyet: g.sheet,
      nguoi_duyet: nguoi, ma_yc: yc.ma_yc, trang_thai: 'con', ma_doi_qua: '' } });
    var soMa = maConHieuLuc(db.ma_tich, yc.zalo_id, cfg, now).length + 1;
    var text = '✅ ' + cfg.ten_quan + ' đã xác nhận! Mã tích điểm của anh/chị: ' + ma + '\nAnh/chị đang có ' + soMa + '/' + cfg.so_ma_doi + ' mã.';
    if (soMa >= cfg.so_ma_doi) {
      text += '\n\n🎉 CHÚC MỪNG! Anh/chị đã đủ ' + cfg.so_ma_doi + ' mã để nhận: ' + cfg.qua_tang +
        '.\nLần tới mua tại quán, anh/chị nhắn "đổi quà" cho em rồi đưa màn hình cho quán nhé!';
    } else {
      text += ' Tích thêm ' + (cfg.so_ma_doi - soMa) + ' mã nữa để nhận: ' + cfg.qua_tang + ' 😊';
    }
    out.tin.push(tinUser(yc.zalo_id, text));
    out.ket_qua = 'da_duyet';
    out.ma = ma;
    return out;
  }

  /** Chạy định kỳ (5 phút/lần): hủy yêu cầu quá hạn và báo khách. */
  function quetQuaHan(db, now) {
    now = now == null ? Date.now() : now;
    var cfg = docCauHinh(db.cau_hinh);
    var out = { tin: [], ghi: [] };
    (db.yeu_cau || []).forEach(function (yc) {
      if (String(yc.trang_thai) === 'cho_duyet' && now - docGio(yc.thoi_gian) > cfg.han_duyet_phut * 60000) {
        out.ghi.push({ tab: 'yeu_cau', kieu: 'sua', khop: { ma_yc: yc.ma_yc }, dong: { trang_thai: 'het_han' } });
        out.tin.push(tinUser(yc.zalo_id, 'Dạ yêu cầu tích mã lúc ' + vn(docGio(yc.thoi_gian)).hien.slice(0, 5) +
          ' chưa được quán xác nhận nên đã hết hạn ạ. Lần mua tại quán anh/chị nhắn "tích mã" lại giúp em nhé!'));
      }
    });
    return out;
  }

  /**
   * Dùng ở zalo-gateway: sự kiện này có nên chuyển sang workflow tích mã (thay vì bot cũ) không?
   * cauHinh = { bat, nhomKhachId, nguoiDuyet: [uid...] } lấy từ biến môi trường của gateway.
   */
  function nenChuyenTichMa(su, cauHinh) {
    if (!cauHinh || !cauHinh.bat) return false;
    if (su.event === 'message') {
      if (String(su.threadType) !== 'user') return false;
      return !!phanLoai(su.text);
    }
    if (su.event === 'reaction') {
      var raw = su.raw || {};
      return !!raw.isGroup && String(raw.threadId) === String(cauHinh.nhomKhachId) &&
        (cauHinh.nguoiDuyet || []).map(String).indexOf(String((raw.data || {}).uidFrom)) >= 0;
    }
    return false;
  }

  return { boDau: boDau, vn: vn, docGio: docGio, docCauHinh: docCauHinh, phanLoai: phanLoai, loaiTin: loaiTin, xuLyTinKhach: xuLyTinKhach,
    ganMsgId: ganMsgId, xuLyThaTim: xuLyThaTim, quetQuaHan: quetQuaHan, nenChuyenTichMa: nenChuyenTichMa };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TM;
