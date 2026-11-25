# Hướng dẫn cho Claude trong repo Quaquefood

Chủ repo: Trần Đại Hiệp (dùng chủ yếu trên điện thoại). Trả lời tiếng Việt, ngắn gọn, nói kết quả trước.

## Gọi skill ngay từ đầu

Skill nằm trong `.claude/skills/`. Khi yêu cầu thuộc các chủ đề dưới đây, **gọi skill tương ứng bằng công cụ Skill trước khi làm bất cứ việc gì khác** (kể cả khi chỉ hỏi han hay kiểm tra):

- Email, Gmail, hộp thư, trang Hộp thư, tin Zalo "EMAIL SÁNG", nhãn AI/*, mail bị sót hoặc xếp loại sai, nút Xoá / Xong / Gửi trả lời, lệnh "xoa 4 5", WF 32 / 33 / 34 → skill `quan-ly-email-gmail-zalo`.
- Tạo hoặc sửa bất kỳ workflow n8n nào → đọc thêm skill `bao-tri-giam-sat-wf-n8n-hiep` (nếu có trong danh sách skill của phiên) để theo quy ước đặt tên, số WF tiếp theo và gắn báo lỗi WF 25.

## An toàn

- Không ghi link trang Hộp thư, khoá webhook, token hay mật khẩu vào file trong repo hoặc vào chat.
- Xoá mail chỉ chuyển vào Thùng rác. Không tự gửi mail thay Hiệp.
- Khi thử, chỉ nhắn Zalo riêng cho Hiệp và dùng dữ liệu không gây xoá thật.
