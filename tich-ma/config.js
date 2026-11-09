// Dán địa chỉ Web App của Google Apps Script vào đây (xem HUONG-DAN.md, bước 3).
// Ví dụ: 'https://script.google.com/macros/s/AKfycb.../exec'
window.TICH_MA_API = '';

// Gọi API: đọc dữ liệu bằng GET, ghi dữ liệu bằng POST (text/plain để Apps Script nhận được).
window.goiApi = async function (thamSo, ghi) {
  if (!window.TICH_MA_API) throw new Error('Chưa cấu hình địa chỉ API trong tich-ma/config.js.');
  let r;
  if (ghi) {
    r = await fetch(window.TICH_MA_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(thamSo) });
  } else {
    r = await fetch(window.TICH_MA_API + '?' + new URLSearchParams(thamSo).toString());
  }
  if (!r.ok) throw new Error('Không kết nối được máy chủ (' + r.status + ').');
  const j = await r.json();
  if (!j.ok) throw new Error(j.loi || 'Có lỗi xảy ra.');
  return j;
};
