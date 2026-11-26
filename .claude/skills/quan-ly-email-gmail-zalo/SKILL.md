---
name: quan-ly-email-gmail-zalo
description: >-
  Vận hành, sửa lỗi, nâng cấp hệ thống quản lý email Gmail → Zalo của Hiệp trên n8n (WF 32·33·34·35).
  Mail công ty Outlook (d-hiep@takakovietnam.com) tự forward sang Gmail (kèm "FW:"); WF 35 báo Zalo NGAY mỗi mail mới + đẩy lên trang Hộp thư.
  WF 32 lúc 8h sáng dùng Gemini phân loại Trả lời / Thông tin / Nên xoá, gửi Zalo gọn. WF 33 là trang Hộp thư trên điện thoại (Xoá, Xong, Gửi trả lời).
  WF 34 lúc 15h xoá mail trong ngày của d-hiep (CHỪA mail FW). Báo cáo tự gửi gắn mã [MA:...] để các WF nhận ra.
  Dùng khi Hiệp nhắc email, Gmail, hộp thư, trang Hộp thư, tin Zalo "EMAIL SÁNG"/"Mail mới", forward Outlook, lỗi 0x80040119,
  mail bị sót, xếp loại sai, nút xoá, đổi giờ, hoặc bất kỳ lỗi nào của WF 32/33/34/35. Bản 26/11/2026.
---

# Quản lý email Gmail → Zalo của Hiệp (WF 32 · 33 · 34 · 35)

Người dùng: Trần Đại Hiệp, chủ yếu dùng điện thoại. Trả lời tiếng Việt, ngắn, dễ đọc. Làm qua connector n8n (`mcp__n8n_Hi_p__*`) và Gmail (`mcp__Gmail__*`). Hạ tầng chung, bảo trì, báo lỗi xem skill **bao-tri-giam-sat-wf-n8n-hiep**.

## Mục tiêu hệ thống
Hiệp không muốn đọc từng mail. Mail công ty tự chảy về Gmail → hệ thống đọc giúp, tóm tắt, chia loại; Hiệp chỉ **lướt tin Zalo** rồi **bấm nút trên trang Hộp thư** để xoá/trả lời. Luôn ưu tiên: **tin Zalo NGẮN** (Hiệp góp ý nhiều lần), chi tiết để trên trang; có số, có nút, không bắt gõ lệnh.

## Luồng tổng thể
```
Mail công ty → Outlook (rule forward) → Gmail
   ├─ WF 35 (mỗi phút): mail mới → Zalo "📩 N mail mới từ…" + đẩy lên trang Hộp thư NGAY
   ├─ WF 32 (8h sáng): tổng hợp Inbox hôm trước → Zalo "📧 EMAIL SÁNG" gọn + đẩy lên trang
   ├─ WF 33: trang Hộp thư (xem/Xoá/Xong/Trả lời)
   └─ WF 34 (15h): dọn mail báo cáo [MA:] của ngày (CHỪA mail FW)
```

## Thành phần
| Thành phần | ID / giá trị | Vai trò |
|---|---|---|
| WF 32 Quan ly email - 8h | `8IEM4FN0b5XVyX7N` | **8h** hằng ngày + nút "Chay thu". Đọc Inbox 2 ngày, Gemini phân loại, nháp, Sheet, nhãn, ghi bảng, Zalo **gọn** |
| WF 33 Hop thu email - trang web | `VONku27YCdJ4N0Kd` | GET trang Hộp thư; POST `…-tac-vu` cho nút Xoá / Xong / Gửi trả lời |
| WF 34 Xoa mail d-hiep trong ngay - 15h | `Yxg66Ow0wm4TQRDT` | 15h: mail nhận hôm nay từ `d-hiep@takakovietnam.com` **KHÔNG phải FW** → Thùng rác → Zalo |
| **WF 35 Bao Zalo ngay khi co mail moi** | `syFySADK1cJjxPTz` | **MỚI**: mỗi phút quét Gmail, mail mới → tóm tắt + ghi bảng + Zalo gọn ngay |
| WF 01 nhánh EM | `tMVFAPVwuWWhm4Ud` | Tin riêng Hiệp bắt đầu "xoa/xoá" → POST webhook "Lenh xoa tu Zalo" của WF 32 |
| Data table `email_danh_so` | `BWWrYsABVp0zjFOk` | Mỗi mail 1 dòng: so, msg_id, thread_id, nguoi_gui, from_email, tieu_de, tieu_de_ngan, tom_tat, y_chinh, ly_do, loai, nhom, uu_tien, nhap_tra_loi, draft_id, link, ngay_nhan, tt_*, trang_thai, da_xoa, lo |
| Sheet thông tin | `1IG9KMrQcIDRBySTRBArNkHYuZFn_ixQNtR-qPPlsdWQ` tab gid `1876025034` | Mail loại Thông tin (WF 32) |
| Nhãn Gmail | Label_5 Cần trả lời, Label_6 Cần xoá, Label_7 Lấy thông tin, Label_8 Đã phân loại | Label_8 = WF 32 bỏ qua lần sau |
| Credential | Gmail `jZgpVnn05hVor7qG`, Gemini `dLj2X5dKnLEcd3DV`, Sheets `UYRdkR2BxMAdK9uK`, Zalo gateway `HSzJb2olMWUsJQxj` | |
| Zalo riêng Hiệp | `3672319784008477608` (threadType 0) | gửi qua `http://zalo-gateway:3000/send-text` |

Link trang Hộp thư + khoá webhook nằm trong code node WF 33/35. **Không chép link/khoá ra chat hay file chia sẻ**; chỉ nhắc Hiệp mở từ tin Zalo.

## Forward Outlook công ty → Gmail (phần máy Hiệp, không phải n8n)
- Mail công ty Hiệp là **Outlook desktop** (Microsoft 365), địa chỉ `d-hiep@takakovietnam.com`. **OWA (outlook.office.com) và Power Automate bị firewall công ty chặn**; Hiệp **không có mật khẩu** để đăng nhập máy/điện thoại khác → không làm được forward phía máy chủ.
- Giải pháp đang dùng: **Rule trong Outlook desktop** "Apply this rule after the message arrives → forward it to trandaihiep.td2020@gmail.com" (áp dụng MỌI mail). Đây là rule **client-only** → **chỉ chạy khi Outlook đang mở + khỏe**. Hiệp tự mở Outlook, không dùng task auto-mở (tránh xung đột).
- Mail forward về Gmail: **người gửi hiện là `d-hiep@takakovietnam.com`**, tiêu đề có tiền tố **"FW:"**, **người gửi thật nằm trong ruột** mail (dòng `From: Tên <email>`).
- Mail tới lúc Outlook **đóng/kẹt** → KHÔNG forward và rule **không tự bù sau** (dù mail chưa đọc). Phải forward tay từng cái, hoặc mở Outlook cho mail mới.

### ⚠️ Lỗi Outlook 0x80040119 (hay tái diễn)
- Outlook báo `0x80040119` ở Sending/Receiving → **Send/Receive hỏng → forward không chạy + mấy task báo cáo treo** (Task Scheduler stuck "Running").
- Nguyên nhân: **add-in xung đột** (chạy `outlook.exe /safe` thì hết lỗi = chắc chắn add-in). Các add-in đều của Microsoft.
- Cách sửa: File → Options → Add-ins → COM Add-ins → Go → **bỏ tick hết** (Social Connector, SharePoint Colleague Import, Exchange Add-in, VBA, OneNote — không cần cho gửi/nhận/forward) → đóng/mở lại Outlook. Vẫn lỗi → file OST hỏng, **nhờ IT công ty** (ScanPST / tạo profile mới). Đây là bảo trì Outlook, ngoài phạm vi n8n.

## Mã [MA:...] cho mail báo cáo tự gửi
- Hiệp có các **script PowerShell** (`GuiMailTuDong*.ps1`) chạy bằng **Task Scheduler**, dùng Outlook COM gửi báo cáo (kèm Excel) về Gmail. Mỗi script chèn **mã vào đầu `$Subject`**:
  - `[MA:TT-SOLNP]` thực tích SOLENOID N PISTON · `[MA:PP-SPNP]` phế phẩm · `[MA:PLAN-VS]` Plan VS · `[MA:TUOITHO-DAUGA]` tuổi thọ đầu gá.
- Mấy mail này là **file để chạy WF khác**, không cần tóm tắt. **WF 32 và WF 35 BỎ QUA** mail có `[MA:...]`; **WF 34 xoá** chúng lúc 15h.
- Khi Hiệp thêm/sửa script báo cáo: nhắc chèn `[MA:...]` vào `$Subject`. Trước khi đổi tiêu đề 1 báo cáo, kiểm có Apps Script/WF nào đọc mail đó **theo tiêu đề** không (WF 31 lấy file theo tên trên Drive, không theo tiêu đề mail → an toàn).

## WF 35 — báo mail mới NGAY (mỗi phút)
1. **Mail moi toi** (Gmail Trigger, poll everyMinute, `simple:false`, q `in:inbox`, readStatus both). Fire mỗi mail mới trong Inbox.
2. **Loc mail** (code): bỏ DRAFT / không INBOX / có `[MA:...]`. Mail **FW:** → `nguon='cong ty'`, bóc **người gửi thật** từ dòng `From:` trong ruột. Mail không FW → `nguon='truc tiep'`, dùng `From` thật; **bỏ qua mail từ `trandaihiep.td2020@gmail.com`** (mail hệ thống tự gửi — Matome, Giao ca…). Mỗi item kèm `body` gọi Gemini (responseSchema JSON: `tom_tat`, `loai`, `uu_tien`).
3. **Gemini tom tat** (HTTP, gemini-flash-latest, `onError:continueRegularOutput`): tóm tắt + phân loại từng mail.
4. **Doc bang** (dataTable get, executeOnce): để tính `lo`/`so` — **nối vào lô mới nhất** (maxLo) để lệnh "xoa N" không loạn.
5. **Soan tin Zalo mail FW** (code): ghép Gemini vào từng mail, nhóm (0/1/2/3), ra dòng ghi bảng + field `text`.
6. **Ghi vao bang** (dataTable insert, **mappingMode `defineBelow`** map từng cột — KHÔNG dùng autoMapInputData, vì item có field phụ `text`/`ping` làm autoMap lỗi; `onError:continueRegularOutput`): ghi MỌI mail lên trang (quảng cáo → nhóm 2 Nên xoá).
7. **Gom tin Zalo** (code) → **Gui Zalo rieng cho Hiep**: gom cả lần quét thành **1 tin gọn**: `📩 N mail mới từ: A, B, C… \n\n👉 Xem & xử lý:\n<link>`. **Ping mọi mail** (Hiệp đã chốt ping cả quảng cáo; quảng cáo vẫn vào tab Nên xoá).

## WF 32 — bản tin sáng 8h
1. **Hang ngay 8h** (cron `0 8 * * *`) hoặc nút **Chay thu** → **Doc email Inbox 2 ngay** (`in:inbox newer_than:2d`, 60 mail, `simple:false`). Giữ 2 ngày, không mở rộng.
2. **Chuan bi email va yeu cau AI**: bỏ Label_8 / DRAFT / không INBOX **và mail có `[MA:...]`**. Giữ mail Hiệp tự gửi cho mình (có SENT+INBOX). Gom **1 lần gọi Gemini** kèm `responseSchema` (bắt buộc).
3. **Gemini phan loai email**: mỗi mail trả loai (TRA_LOI/THONG_TIN/XOA/KHAC), uu_tien, tieu_de_ngan, tom_tat, ly_do, y_chinh, nhap_tra_loi, luu_thong_tin, thong_tin{…}.
4. **Phan tich ket qua AI**: chia nhóm 0..3, đánh số 1..N, gắn nhãn. Chặn AI điền bậy số tiền. Lỗi AI → `loi_ai=true`, không gắn nhãn (7h/8h hôm sau chạy lại).
5. Rẽ nhánh: nháp trả lời → ghi Sheet → gắn nhãn → **Soan tin Zalo tong hop** (GỌN) → ghi `email_danh_so`.
6. Nhánh **Lenh xoa tu Zalo** (WF 01): hiểu `xoa 4 5`/`xoa 2-4`/`xoa het` → Thùng rác → `trang_thai=da_xoa` → Zalo.

### Tin Zalo GỌN (cả WF 32 và WF 35 — Hiệp chốt 26/11)
```
📧 EMAIL SÁNG 26/11 – 8 mail mới
✍️ 0 trả lời · 📌 6 thông tin · 🗑 2 nên xoá
📩 Từ: Nguyen Cong Thanh, Bui Thi Dieu Huyen, Techcombank, …

👉 Xem & xử lý:
<link trang Hộp thư>
```
WF 35: `📩 N mail mới từ: A, B, C… 👉 Xem & xử lý: <link>`. **KHÔNG để tóm tắt chi tiết trong Zalo** — chi tiết (tom_tat, y_chinh, ly_do) để trên trang Hộp thư.

## WF 34 — dọn mail d-hiep 15h (CHỪA FW)
- `Tim mail d-hiep hom nay` (q `from:d-hiep@takakovietnam.com`, nhận trong ngày). `Chon mail can xoa`: bỏ mail `from` khác, **bỏ mail FW/Fwd** (`laChuyenTiep = /^\s*(fw|fwd)\s*:/i`), bỏ đã TRASH → Thùng rác → Zalo danh sách.
- Kết quả: xoá mail báo cáo `[MA:]` + mail d-hiep không-FW; **giữ lại mail FW công ty**.
- Mail có mã bị xoá 15h nên 8h hôm sau WF 32 không còn thấy (đúng thiết kế).

## WF 33 trang Hộp thư
- GET: đọc bảng, **gộp trùng theo msg_id lấy id lớn nhất**, ẩn dòng có `trang_thai`. Tab ✍️ Trả lời / 📌 Thông tin / 🗑 Nên xoá / ▫️ Khác. Thẻ: người gửi, giờ, tiêu đề ngắn, tóm tắt, 📄 NỘI DUNG CHÍNH, ⏰/💰, nháp sửa được + Gửi trả lời (chỉ nhóm Trả lời), 💡 Vì sao, nút Mở Gmail · ✓ Xong · 🗑 Xoá. Trang KHÔNG tự refresh — nhắc Hiệp **tải lại** mới thấy mail mới.
- POST `{action: xoa|xong|gui, ids, text}`. Lỗi cũ nút kẹt "Đang xử lý…" (đã sửa 25/11 — nhớ trả nút về sau mỗi thao tác).
- Sửa giao diện: viết lại code node "Dung trang hop thu", thử Playwright khung 390×844 (giả API bằng `page.route`), rồi update + publish.

## Lỗi/bẫy đã gặp trong phiên này (nhớ để khỏi lặp)
- **setNodeParameter path sai**: dùng path `/parameters/jsCode` tạo ra `parameters.parameters.jsCode` lồng nhau → node chạy code CŨ. **Sửa jsCode nên dùng `updateNodeParameters` với `replace:true`**, rồi `get_workflow_details` kiểm lại không bị lồng.
- **dataTable insert autoMapInputData lỗi khi item có field phụ** (text/ping) → dùng **`defineBelow`** map từng cột.
- **Bộ lọc "mail tự gửi" (TUMINH) từng gồm cả `d-hiep@takakovietnam.com`** → bỏ sót mail thật từ d-hiep. Chỉ nên gồm `trandaihiep.td2020@gmail.com`.
- test_workflow **pin node dataTable** → không insert thật khi test; muốn kiểm ghi bảng thật thì xem execution trigger thật, hoặc ghi tay bằng `add_data_table_rows`.

## Nguyên tắc riêng của hệ thống này
- **Xoá = Thùng rác** (`/trash`, khôi phục 30 ngày). Không tự gửi mail thay Hiệp (chỉ gửi khi Hiệp bấm "Gửi trả lời").
- Thử nghiệm chỉ nhắn Zalo riêng Hiệp `3672319784008477608`. Tránh xoá thật mail thật khi thử (dùng `ids:[99999]` / số không có).
- Sửa code node: lấy code hiện tại, sửa tối thiểu, test cục bộ (giả `$input`, `$()`), `updateNodeParameters`(+`replace:true` nếu thay cả jsCode) → test_workflow → `publish_workflow`. Ghi chú `(dd/mm)` đầu code.
- Mọi WF mới gắn errorWorkflow WF 25 `DENLXXHN9GUulj1x`, timezone `Asia/Ho_Chi_Minh`. **Số WF tiếp theo: 36.**
- Báo Hiệp: nói kết quả trước, 3–6 dòng, mỗi thay đổi 1 gạch đầu dòng; nói rõ cái gì đã chạy thật, cái gì chưa thử.
