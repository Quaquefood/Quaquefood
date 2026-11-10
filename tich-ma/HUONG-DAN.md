# Thẻ tích mã cho khách nhóm Zalo

**Chương trình:** mỗi bill từ **30.000đ** được **1 mã**. Gom đủ **3 mã** thì được **giảm 5.000đ khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip**.

## Cách chương trình chạy

| Ai | Làm gì |
|---|---|
| **Khách** | Bấm link đăng ký ghim trong nhóm Zalo, nhập tên Zalo và SĐT, rồi nhận **thẻ riêng có mã QR**. Khách lưu link thẻ vào "Cloud của tôi" trên Zalo. |
| **Khách thanh toán** | Mở thẻ và đưa mã QR cho nhân viên. |
| **Nhân viên** | Dùng camera điện thoại quét QR, thẻ khách mở trên máy nhân viên. Nhập tiền bill rồi bấm **+ Cộng 1 mã**. Màn hình hiện sẵn tin nhắn, nhân viên bấm Sao chép rồi gửi khách qua Zalo. |
| **Khách đủ 3 mã** | Thẻ của khách hiện chữ "🎉 Bạn đã đủ mã nhận quà!". Máy nhân viên báo "Khách ĐỦ MÃ". Tin nhắn gửi khách cũng báo đủ quà. |
| **Đổi quà** | Khi khách mua Trà tắc hoặc Bánh tráng túi zip, nhân viên chọn món rồi bấm **Đổi quà**. Hệ thống trừ 3 mã và ghi sổ. |
| **Chủ quán** | Mở trang chủ quán để xem số mã đã cấp, số quà đã đổi, tiền đã giảm, mã nào do nhân viên nào cấp, và **danh sách khách đủ quà chưa đổi** (kèm tin nhắc sẵn để gửi Zalo). |

### Chống gian lận và minh bạch
- **Mã gắn với thẻ có QR riêng, không gắn với SĐT.** Biết SĐT của người khác cũng không lấy được thẻ của họ. Một SĐT chỉ đăng ký được 1 thẻ.
- **Chỉ nhân viên có mật khẩu mới cộng được mã**, và chỉ cộng khi bill đủ 30.000đ.
- **Chống bấm nhầm:** nếu cùng 1 thẻ được cộng 2 lần trong 10 phút, máy sẽ hỏi lại "đây có phải bill khác không".
- **Mỗi lần cộng mã hoặc đổi quà đều ghi sổ** trong Google Sheet: giờ, số tiền bill, tên nhân viên. Chủ quán xem lại được tất cả.
- **Khóa thẻ:** nếu phát hiện gian lận, ghi `khoa` vào cột `trang_thai` của khách trong tab `khach_hang`.

## Cài đặt (khoảng 5 phút, làm 1 lần, nên dùng máy tính)

1. Mở **https://sheets.new** để tạo Google Sheet mới, đặt tên ví dụ "Tich ma Nhi Nhi".
2. Trong Sheet, vào **Tiện ích mở rộng → Apps Script**. Xóa hết code mẫu, dán **toàn bộ** file [`tich-ma/Code.gs`](Code.gs), rồi bấm 💾 **Lưu**.
3. Ở ô chọn hàm phía trên, chọn **caiDat** rồi bấm **▶ Chạy**.
   - Google sẽ hỏi quyền. Bấm **Xem xét quyền**, chọn tài khoản của bạn.
   - Nếu hiện "Google chưa xác minh ứng dụng này", bấm **Nâng cao → Đi tới … (không an toàn)** rồi bấm **Cho phép**. Đây là code của chính bạn nên an toàn.
   - Phần **Nhật ký thực thi** sẽ hiện **mật khẩu NHÂN VIÊN** và **mật khẩu CHỦ QUÁN**. Hãy ghi lại cả hai.
4. Bấm **Triển khai → Tùy chọn triển khai mới**, bấm bánh răng và chọn **Ứng dụng web**:
   - Thực thi với tư cách: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   - Bấm **Triển khai** rồi **sao chép URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).
5. Dùng link đó như sau:
   - **Link đăng ký cho khách** (ghim trong nhóm Zalo): `URL`
   - **Trang nhân viên**: `URL?p=nv`
   - **Trang chủ quán**: `URL?p=chu`

Mỗi máy nhân viên chỉ cần đăng nhập 1 lần, máy sẽ tự nhớ.

> Khi sửa code về sau: vào **Triển khai → Quản lý triển khai → ✏️ Chỉnh sửa → Phiên bản: Phiên bản mới → Triển khai**. Làm vậy link sẽ giữ nguyên.

## Đổi quy định (sửa tab `cau_hinh`, có hiệu lực ngay)

| khoa | Mặc định |
|---|---|
| ten_quan | Bánh tráng Nhi Nhi |
| so_ma_doi | 3 |
| bill_toi_thieu | 30000 |
| qua_tang | Giảm 5.000đ khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip |
| gia_tri_giam | 5000 |
| mon_ap_dung | Trà tắc; Bánh tráng phơi sương muối sặc túi zip |
| han_ma_ngay | 0 (không hết hạn) |
| phut_chong_trung | 10 |
| link_nhom_zalo | (trống) – điền link nhóm để hiện trên trang đăng ký |

Đổi mật khẩu: trong Apps Script vào **Cài đặt dự án (bánh răng) → Thuộc tính tập lệnh**, sửa `PIN_NHAN_VIEN` hoặc `PIN_CHU_QUAN`.

## Mẫu tin ghim trong nhóm Zalo

> 🎁 **TÍCH MÃ NHẬN QUÀ** – dành cho thành viên nhóm
> Mỗi bill từ 30K = 1 mã. Đủ 3 mã được **giảm 5K khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip**.
> 👉 Đăng ký thẻ miễn phí: *(dán link đăng ký)*
> Khi thanh toán, mở thẻ và đưa nhân viên quét QR là xong!

## Dành cho người sửa code
- Code nằm ở `src/server.gs` (xử lý) và `src/trang.html` (giao diện). Chạy `node tich-ma/build.js` để ghép thành `Code.gs`.
- Kiểm tra: `node tich-ma/test/kiem-tra.js` chạy trên Google Sheet giả lập.
