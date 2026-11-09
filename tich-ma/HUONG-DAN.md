# Tích mã khuyến mãi cho thành viên nhóm Zalo

**Cách hoạt động**
1. Thành viên nhóm Zalo đến mua hàng → nhân viên mở `tich-ma/nhan-vien.html`, nhập SĐT khách, bấm **Cấp mã** → được 1 mã (ví dụ `QF-7K3QX`) cùng tin nhắn soạn sẵn, bấm **Sao chép** rồi dán gửi khách qua Zalo.
2. Khách gom đủ số mã (mặc định **5 mã**) → nhân viên vào tab **Đổi thưởng**, nhập SĐT *hoặc* các mã khách đưa → hệ thống đánh dấu các mã đã dùng và tạo mã đổi thưởng `DT-xxxxxx`.
3. Khách tự xem mình có bao nhiêu mã ở trang `tich-ma/khach-hang.html` (có thể ghim link này trong nhóm Zalo). Trang khách chỉ hiện SĐT đã che và 2 ký tự cuối của mã.

Mỗi mã chỉ dùng được 1 lần. Hệ thống chặn mã nhập trùng, mã đã đổi và mã hết hạn.

## Cài đặt (khoảng 5 phút, làm 1 lần, nên làm trên máy tính)

Phần này cần đăng nhập tài khoản Google của chủ quán nên phải tự làm:

1. Mở https://sheets.new để tạo Google Sheet mới, đặt tên ví dụ "Tich ma nhom Zalo".
2. Trong Sheet: **Tiện ích mở rộng → Apps Script**. Xóa code mặc định, dán toàn bộ `tich-ma/apps-script/Code.gs`, bấm 💾 Lưu.
3. Ở thanh trên chọn hàm **caiDat** → bấm **▶ Chạy** → cho phép quyền truy cập (nếu Google báo "chưa xác minh": Nâng cao → Đi tới dự án).
   Nhật ký thực thi hiện **Mật khẩu nhân viên: xxxxxx** – ghi lại mật khẩu này.
4. **Triển khai → Tùy chọn triển khai mới →** (bánh răng) **Ứng dụng web**: Thực thi với tư cách **Tôi**, Người có quyền truy cập **Bất kỳ ai** → Triển khai → sao chép URL `https://script.google.com/macros/s/.../exec`.
5. Dán URL vào `tich-ma/config.js` (`window.TICH_MA_API = '...'`) hoặc gửi URL cho Claude để Claude điền và push.

Đổi mật khẩu nhân viên: Cài đặt dự án (bánh răng) → Thuộc tính tập lệnh → sửa `PIN_NHAN_VIEN`.

> Sửa `Code.gs` sau này: phải **Triển khai → Quản lý triển khai → Chỉnh sửa → Phiên bản mới** thì thay đổi mới có hiệu lực.

## Đổi quy định khuyến mãi (sửa trực tiếp tab `cau_hinh`, có hiệu lực ngay)

| khoa | Mặc định | Ý nghĩa |
|---|---|---|
| so_ma_doi | 5 | Số mã cần gom để đổi 1 lần |
| phan_thuong | Giảm 20.000đ cho đơn kế tiếp | Nội dung khuyến mãi |
| han_su_dung_ngay | 90 | Mã hết hạn sau N ngày (0 = không hết hạn) |
| so_tien_toi_thieu | 0 | Hóa đơn tối thiểu để được cấp mã (0 = không giới hạn) |
| tien_to_ma | QF | Chữ đầu của mã |
| ten_quan | Quaque Food | Tên quán trong tin nhắn gửi khách |

## Lưu ý
- Hệ thống không tự đọc được danh sách nhóm Zalo; nhân viên phải đánh dấu ô "Đã kiểm tra khách là thành viên nhóm Zalo" trước khi cấp mã.
- Mật khẩu nhân viên chỉ lưu trong Script Properties, không nằm trong Sheet hay trong code web.
- Tab `ma_tich_diem` là sổ cái: xem được ai được cấp mã lúc nào, đổi thưởng lúc nào (cột `ma_doi_thuong`).
