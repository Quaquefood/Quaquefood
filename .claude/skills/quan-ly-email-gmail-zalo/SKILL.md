---
name: quan-ly-email-gmail-zalo
description: >-
  Vận hành, sửa lỗi, nâng cấp hệ thống quản lý email Gmail của Hiệp trên n8n.
  WF 32 lúc 7h sáng dùng Gemini phân loại Cần trả lời / Thông tin / Nên xoá, soạn nháp, ghi Sheet, gắn nhãn AI/*, gửi Zalo tóm tắt.
  WF 33 là trang Hộp thư trên điện thoại với nút Xoá, Xong, Gửi trả lời.
  WF 34 lúc 15h xoá mail trong ngày của d-hiep@takakovietnam.com. Lệnh "xoa 4 5" qua Zalo đi qua WF 01 nhánh EM.
  Dùng khi Hiệp nhắc email, Gmail, hộp thư, trang Hộp thư, tin Zalo "EMAIL SÁNG", mail bị sót, xếp loại sai,
  nút xoá không chạy, muốn thêm người gửi tự xoá, đổi giờ, hoặc bất kỳ lỗi nào của WF 32/33/34. Bản 25/11/2026.
---

# Quản lý email Gmail → Zalo của Hiệp (WF 32 · 33 · 34)

Người dùng: Trần Đại Hiệp, chủ yếu dùng điện thoại. Trả lời tiếng Việt, ngắn, dễ đọc. Làm qua connector n8n (`mcp__n8n_Hi_p__*`) và Gmail (`mcp__Gmail__*`). Hạ tầng chung, quy trình bảo trì và báo lỗi xem skill **bao-tri-giam-sat-wf-n8n-hiep**.

## Mục tiêu hệ thống
Hiệp không muốn đọc từng mail. Mỗi sáng hệ thống đọc giúp, chia 3 loại, Hiệp chỉ cần **lướt tin Zalo** rồi **bấm nút trên trang Hộp thư** để xoá hoặc trả lời. Hiệp góp ý nhiều lần là tin dài khó đọc, vì vậy luôn ưu tiên: ngắn, chia khối, có số, có nút bấm, không bắt gõ lệnh.

## Thành phần
| Thành phần | ID / giá trị | Vai trò |
|---|---|---|
| WF 32 Quan ly email - 7h | `8IEM4FN0b5XVyX7N` | 7h hằng ngày + nút "Chay thu". Đọc Inbox 2 ngày, Gemini phân loại, nháp, Sheet, nhãn, lưu bảng, Zalo |
| WF 33 Hop thu email - trang web | `VONku27YCdJ4N0Kd` | GET trang Hộp thư; POST `…-tac-vu` cho nút Xoá / Xong / Gửi trả lời |
| WF 34 Xoa mail d-hiep trong ngay - 15h | `Yxg66Ow0wm4TQRDT` | 15h hằng ngày (cả T7, CN): mail nhận hôm nay từ `d-hiep@takakovietnam.com` → Thùng rác → Zalo |
| WF 01 nhánh EM | `tMVFAPVwuWWhm4Ud`, node "EM - Lenh xoa email", "EM - Chuyen sang WF 32" | Tin riêng của Hiệp bắt đầu "xoa/xoá" → POST webhook "Lenh xoa tu Zalo" của WF 32 |
| Data table `email_danh_so` | `BWWrYsABVp0zjFOk` | Mỗi mail 1 dòng: so, msg_id, thread_id, nguoi_gui, from_email, tieu_de, tieu_de_ngan, tom_tat, y_chinh, ly_do, loai, nhom, uu_tien, nhap_tra_loi, draft_id, link, ngay_nhan, tt_*, trang_thai, lo |
| Sheet thông tin | `1IG9KMrQcIDRBySTRBArNkHYuZFn_ixQNtR-qPPlsdWQ` tab gid `1876025034` | Mail loại Thông tin (ngày, người gửi, tiêu đề, tóm tắt, số tiền, hạn, link) |
| Nhãn Gmail | Label_5 `AI/Cần trả lời`, Label_6 `AI/Cần xoá`, Label_7 `AI/Lấy thông tin`, Label_8 `AI/Đã phân loại` | Label_8 = đã xử lý, WF 32 bỏ qua lần sau |
| Credential | Gmail `jZgpVnn05hVor7qG`, Gemini `dLj2X5dKnLEcd3DV`, Sheets `UYRdkR2BxMAdK9uK`, Zalo gateway `HSzJb2olMWUsJQxj` | |

Link trang Hộp thư và khoá webhook nằm trong code node (WF 32 "Soan tin Zalo tong hop", WF 33 "Dung trang hop thu", "Kiem tra lenh xoa"). Ai có link trang là xoá được mail, nên **không chép link/khoá ra chat hay tài liệu chia sẻ**; chỉ nhắc Hiệp mở từ tin Zalo.

## Luồng WF 32 (7h)
1. **Doc email Inbox 2 ngay**: `in:inbox newer_than:2d`, 60 mail, `simple:false` (cần nội dung). Hiệp đã chọn giữ 2 ngày, **không quét mail cũ** — đừng tự mở rộng.
2. **Chuan bi email va yeu cau AI**: bỏ mail có Label_8, DRAFT, hoặc không có INBOX. Mail Hiệp **tự gửi cho mình** (báo cáo tự động, Matome, Giao ca) có nhãn SENT + INBOX — phải giữ lại (lỗi cũ: lọc SENT làm sót 5 mail). Gom tất cả vào **1 lần gọi Gemini** kèm `responseSchema` (bắt buộc, không có thì Gemini đôi khi trả JSON hỏng → cả lô "AI lỗi").
3. **Gemini phan loai email** (`gemini-flash-latest`, nhiệt 0.2). Mỗi mail trả: loai (TRA_LOI/THONG_TIN/XOA/KHAC), uu_tien, tieu_de_ngan (≤10 từ), tom_tat (1 câu ≤25 từ), **ly_do** (căn cứ xếp loại), **y_chinh** (2–5 ý nội dung), nhap_tra_loi, luu_thong_tin, thong_tin{loai,noi_dung,so_tien,han_chot}.
   - Quy tắc do Claude tự thêm, Hiệp có thể muốn bỏ: mail tự gửi có "(chạy thử)" → XOA.
4. **Phan tich ket qua AI**: chia nhóm (0 trả lời, 1 thông tin, 2 nên xoá, 3 khác), đánh số 1..N, gắn danh sách nhãn. **Chặn AI điền bậy**: số tiền chỉ giữ nếu dãy số có thật trong nội dung mail (lỗi cũ: Gemini chép "0 VND, chủ shop đổi vạn deal hời" từ mail Techcombank sang mail khác). Lỗi AI → `loi_ai=true`, không gắn nhãn để hôm sau xử lý lại.
5. Rẽ nhánh theo thứ tự: Soạn nháp trả lời (Gmail draft trong luồng) → Ghi Sheet → Gắn nhãn (HTTP `messages/{id}/modify`) → Soạn & gửi Zalo → Lưu bảng `email_danh_so` (xoá dòng `lo` > 7 ngày hoặc rỗng, rồi chèn lô mới, bỏ dòng loi_ai, kèm draft_id).
6. Nhánh webhook **Lenh xoa tu Zalo** (từ WF 01): đọc lô mới nhất trong bảng, hiểu `xoa 4 5`, `xoa 2-4`, `xoa het` (= cả nhóm XOA) → Thùng rác → đánh dấu `trang_thai=da_xoa` → Zalo xác nhận.

### Mẫu tin Zalo 7h (đã được Hiệp duyệt)
```
📧 EMAIL SÁNG 25/11 – 5 mail mới
✍️ 0 trả lời · 📌 4 thông tin · 🗑 1 nên xoá

👉 Xem & xoá / trả lời:
<link trang Hộp thư>

━━━━ TÓM TẮT ━━━━

📌 THÔNG TIN
• Tran Dai Hiep – Báo cáo phế phẩm PR3-TVC2 ngày 25/11
   Gửi báo cáo phế phẩm hàng ngày PR3-TVC2 kèm 2 file Excel.

🗑 NÊN XOÁ
• Techcombank – Quảng cáo ưu đãi Techcombank OneU
```
Trả lời/Thông tin: tiêu đề + 1 dòng tóm tắt (+⏰ hạn, 💰 tiền nếu có). Nên xoá: 1 dòng. 🔴 = gấp, xếp đầu. Tin >1800 ký tự tự chia (1/2), (2/2).

## WF 33 trang Hộp thư
- GET: đọc bảng, **gộp trùng theo msg_id lấy dòng id lớn nhất**, ẩn dòng có `trang_thai`. Tab ✍️ Trả lời / 📌 Thông tin / 🗑 Nên xoá. Thẻ: người gửi, giờ, tiêu đề ngắn, tóm tắt, **📄 NỘI DUNG CHÍNH**, ⏰/💰, bản nháp sửa được + "📤 Gửi trả lời", *💡 Vì sao xếp loại này*, nút Mở Gmail · ✓ Xong · 🗑 Xoá. Ô tick + thanh dưới "🗑 Xoá N mail"; tab Nên xoá có "🗑 Xoá tất cả (N)".
- POST `{action: xoa|xong|gui, ids:[id dòng], text}` → Switch: xoa = `messages/{id}/trash` + xoá nháp; gui = Gmail reply (replyToSenderOnly, không chữ ký n8n) + xoá nháp cũ; xong = chỉ cập nhật bảng. Trả `{ok, loi}`.
- Lỗi cũ: nút thanh dưới kẹt "Đang xử lý…" sau khi xoá thành công (không trả lại trạng thái nút) — đã sửa 25/11, khi sửa giao diện nhớ trả nút về sau mỗi thao tác.
- Sửa giao diện: viết lại code node "Dung trang hop thu", thử trước bằng Playwright khung 390×844 (giả lập API bằng `page.route` theo chuỗi `tac-vu`), rồi mới `update_workflow` + `publish_workflow`.

## Xử lý tình huống hay gặp
| Hiệp hỏi | Kiểm tra / làm |
|---|---|
| "Sao có nhiều mail mà liệt kê ít" | Mail >2 ngày không đọc (đúng thiết kế). Mail đã có Label_8 không báo lại. Mail đến sau lần chạy chờ 7h hôm sau. Dùng `search_threads` `in:inbox after:… before:…` để đối chiếu. |
| Thiếu mail trên trang / cần chạy bù | Gỡ Label_8 (+ nhãn loại) bằng `mcp__Gmail__unlabel_message` cho đúng các mail đó → **tạm tắt node "Ghi thong tin vao Sheet"** nếu mail đã từng ghi Sheet (tránh trùng) → chạy "Chay thu" → bật lại node + publish. Trang tự gộp dòng trùng. |
| "AI lỗi, N mail chưa phân loại" | Xem output node Gemini: thiếu `responseSchema`, quota 429, timeout. Mail lỗi không gắn nhãn nên 7h hôm sau tự chạy lại. |
| Xếp loại sai / "căn cứ vào đâu" | Đọc `ly_do` trong bảng. Sửa quy tắc trong mảng `he` của node "Chuan bi email va yeu cau AI" (giữ schema). |
| Số tiền/hạn vô lý | Kiểm tra bộ lọc số tiền trong "Phan tich ket qua AI" và regex `tien` trong trang. |
| Nút trang không chạy | `search_workflow_executions` WF 33 → xem "Chon dong", "Ket qua tac vu". "Mail đã được xử lý trước đó" = dòng đã có trang_thai, bảo Hiệp tải lại trang. |
| Lệnh `xoa …` qua Zalo không phản hồi | Xem execution WF 01 node EM (có chuyển không) rồi WF 32 nhánh "Lenh xoa tu Zalo". |
| Thêm người gửi tự xoá / đổi giờ WF 34 | Sửa `q` của node "Tim mail d-hiep hom nay" (vd `from:(a@x OR b@y)`) và hằng `NGUOI` trong "Chon mail can xoa"; giờ ở cron "Hang ngay 15h" (múi giờ WF = Asia/Ho_Chi_Minh). |

Lưu ý WF 34: mail d-hiep (báo cáo 9–11h) bị xoá lúc 15h nên 7h hôm sau WF 32 không còn thấy để tóm tắt/ghi Sheet. Nếu Hiệp cần lưu số liệu, đề xuất WF 34 ghi Sheet trước khi xoá.

## Nguyên tắc riêng của hệ thống này
- **Xoá = Thùng rác** (`/trash`, khôi phục 30 ngày), không dùng xoá vĩnh viễn. Không tự gửi mail thay Hiệp: chỉ gửi khi Hiệp bấm "Gửi trả lời".
- Chạy thử chỉ nhắn Zalo riêng Hiệp (`3672319784008477608`). Tránh xoá thật mail của Hiệp khi thử: dùng số không tồn tại (`xoa 9`) hoặc `ids:[99999]`.
- Sửa code node: lấy code hiện tại (`get_workflow_details`), sửa tối thiểu, chạy thử cục bộ bằng node (giả `$input`, `$()`), rồi `updateNodeParameters` + `publish_workflow`. Ghi chú `(dd/mm)` ở dòng đầu code.
- Mọi WF mới gắn errorWorkflow WF 25 `DENLXXHN9GUulj1x`, timezone `Asia/Ho_Chi_Minh`. Số WF tiếp theo: 35.
- Khi báo Hiệp: nói kết quả trước, 3–6 dòng, mỗi thay đổi 1 gạch đầu dòng; nói rõ cái gì đã chạy thật, cái gì chưa thử.
