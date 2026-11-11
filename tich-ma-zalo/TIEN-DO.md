# Tích mã – tiến độ lắp đặt

## ✅ 11/11/2026 – ĐÃ BẬT, CHẠY THẬT (đọc mục này trước)
- 15:01–15:08: sửa `logic.js` (TM.phanLoai: câu nói vòng; đổi quà hợp lệ → chúc mừng nhóm khách có tag, không hợp lệ → chỉ nhắn riêng), build, PATCH node "Xu ly" của `iMSooaBPyj7B9XS2` (commit 9bf7727). Test máy: logic 18/18, n8n 12/12, phân loại (93 câu mục 8 skill không câu nào sang tích mã), gateway, kết bạn: OK. n8n thật: 7/7 + đổi quà OK, đã xóa dòng test-.
- 15:12: lắp gateway tích mã (index.js = bản kết bạn + tích mã, TICHMA_ON tắt). Sao lưu `zalo-gateway/index.js.bak-tichma-20261111-0812`. Thử thật Zalo: hi → menu, đặt đơn → thả tim → nhóm CSKH nhận: OK.
- ~15:22: BẬT. Sheet `bat_chuc_nang=BAT`; file mới `/opt/zalo-n8n-stack/docker-compose.override.yml` (TICHMA_ON=1, nhóm, 3 người duyệt); build image (zca-js vẫn 2.2.0, image cũ sao lưu `zalo-gw-backup:truoc-tichma`). Log `[tichma] BẬT: nhóm 5606409292553201202, 3 người duyệt`.
- 15:23–15:26 thử thật: "Hiệp Assistant" nhắn "Tích mã" → tin nhóm có tag, msgId 8476651593695 ghi yeu_cau → Trần Đại Hiệp thả ❤️ → khách nhận M-EVCGF 1/3; "Mã của tôi" → 1/3; "Hi" và đặt món xen giữa vẫn về bot bán hàng. Dữ liệu thử thật này còn trong Sheet.
- TẮT: Sheet TAT, hoặc gateway `cd /opt/zalo-n8n-stack && rm docker-compose.override.yml && docker compose up -d zalo-gateway`.
- Còn treo: thử đổi quà qua Zalo thật; dọn dữ liệu Hiệp Assistant (nếu muốn); các điểm chủ quán chưa chốt (mọi cảm xúc đều duyệt; không bắt vào nhóm; mã không hạn); đổi tên/tag workflow. Không chạy bộ 108 bước (gửi thẳng n8n, không qua gateway) – thay bằng thử thật qua Zalo.
- Chi tiết vận hành: skill bot-zalo-nhi-nhi mục 00a.B, zalo-gateway, 8b.
- 15:32–15:40 THỬ TRỌN VẸN qua Zalo thật (khách Hiệp Assistant, người duyệt Trần Đại Hiệp; tạm so_lan_moi_ngay=3): 3 lần tích mã ("tích mã", "cho mình tích mã với", "tích điểm") + 3 ❤️ → M-3ZBMP, M-U7W26, M-AMKHN; ❤️ lại tin cũ → không cấp thêm; "Mã của tôi" → đủ 3; "Muốn đổi quà" → nhóm khách "🎉 Chúc mừng @Hiệp Assistant…" + riêng "ĐỔI QUÀ THÀNH CÔNG QUA-B25K8", 3 mã da_doi; "Đổi quà" lần 2 → chỉ riêng 0/3; "Hi" → menu. TẤT CẢ OK. ~15:45 đã XÓA toàn bộ dữ liệu thử (chủ hệ thống xem rồi đồng ý) → tong_hop = 0.
- Sau đó, theo yêu cầu chủ hệ thống:
  - `so_lan_moi_ngay` = **10** (khách mua nhiều lần/ngày phải được cấp mã mỗi lần). Quy tắc: **mỗi lần mua từ 30K = 1 mã, bill lớn hơn vẫn 1 mã** (nhân viên thả tim 1 lần/bill). Code: giá trị nhỏ nhất là 1.
  - Số tiền quà khai báo ở **1 ô**: `qua_tang` = "Giảm {gia_tri} khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip"; `{gia_tri}` được thay bằng `gia_tri_giam` (logic.js docCauHinh, commit 7aab4d0, node "Xu ly" đã PATCH, kiểm trên n8n thật ra "Giảm 5.000đ…"). Nâng giá trị sau này: chỉ sửa ô `gia_tri_giam` (số, vd 10000), có hiệu lực ngay. Không xóa `{gia_tri}`.
  - `test/kiem-tra-phan-loai.js`: chỉ đọc mục 8 của skill tới trước "### 8b" (8b là kịch bản tích mã).
- **Trạng thái cuối 11/11:** tích mã ĐANG BẬT cho khách thật; Sheet sạch; 2 workflow active; gateway (kết bạn + tích mã) chạy trên VPS.

Cập nhật 10/11/2026 (chiều, phiên có trình duyệt). Làm theo `KE-HOACH.md`.

## ▶ PHIÊN 10/11 CHIỀU – ĐÃ LÀM (đọc mục này trước)

Phạm vi theo chủ quán: chỉ tạo 2 workflow và chạy `kiem-tra-that.paste.js`. **CHƯA đụng gateway, CHƯA chạy bộ hồi quy cũ.** Phần còn lại làm sau 15:00 ngày 11/11/2026. Không sửa, tắt hay xóa workflow cũ nào.

**Workflow mới (đang ACTIVE):**

| Tên | ID |
|---|---|
| `TICH MA - Nhan su kien` (POST `/webhook/tich-ma`) | `iMSooaBPyj7B9XS2` |
| `TICH MA - Quet qua han` (5 phút/lần) | `INiudIHltr4pX3NV` |

Bot cũ không bị ảnh hưởng: gateway chưa chuyển sự kiện nào sang `/webhook/tich-ma`.

**Bước 1 (chỉ đọc, từ execution thật 10/11 09:50–10:22 giờ VN, workflow chính):**
- Tên trường reaction nhóm đã ĐÚNG như code: `raw.data.uidFrom`, `raw.data.content.rMsg[0].gMsgID`, `raw.threadId`, `raw.isGroup=true`. Lưu ý: `gMsgID` là **số** (vd `8471340294372`), code đã so sánh bằng `String()` nên không sao.
- Nhóm khách hàng: **`5606409292553201202`**. ✅ ĐÃ XÁC NHẬN 10/11 11:39 giờ VN: chủ hệ thống nhắn "Hóng." vào nhóm khách → execution có threadId này. Đã điền `cau_hinh!B11`. (Nhóm `5563765501687455177` là nhóm khác của "Hiệp Assistant", KHÔNG dùng.)
- Nick "Trần Đại Hiệp" (chủ hệ thống) có ID **`4215278939136353152`**, giống nhau ở cả nhóm lẫn chat riêng. Như vậy ID Zalo không đổi theo ngữ cảnh.
- `cau_hinh` hiện tại: `nguoi_duyet` = `306769430050266425;4215278939136353152`, `ten_nguoi_duyet` = `Chủ quán;Trần Đại Hiệp` (chủ hệ thống xác nhận Trần Đại Hiệp được duyệt, 10/11). Chủ quán cần **3 người duyệt**, còn thiếu ID người khác (đã nhờ "Bảo Trân" và nick "Bánh Tráng Nhi Nhi" trong nhóm `1322697685107634084` nhắn cho bot, đến 11:47 chưa thấy tin). Chưa rõ có giữ `306769430050266425` không.
- Lấy ID: tin của chính nick bot gửi đi KHÔNG tới n8n (gateway `selfListen:false`, `if (m.isSelf) return`). Người cần lấy ID phải tự nhắn cho nick bot **"Bánh Tráng Nhi Nhi Lái Thiêu"** (nhắn riêng hoặc tag bot trong nhóm), rồi đọc `fromId` + `fromName` ở execution của workflow chính `kUbBNgPV55En8gbH`.
- Nhóm `1322697685107634084`: nhóm nội bộ có chủ hệ thống, Bảo Trân, Bánh Tráng Nhi Nhi và bot (không phải nhóm khách).
- 10/11 13:14 VN: lấy thêm ID **`6074310419531054771`**, nick "Bánh Tráng Nhi Nhi" (tag bot trong nhóm `1322697685107634084`). Đã thêm vào `cau_hinh`: `nguoi_duyet` = `306769430050266425;4215278939136353152;6074310419531054771`, `ten_nguoi_duyet` = `Chủ quán;Trần Đại Hiệp;Bánh Tráng Nhi Nhi`. Còn chờ ID của Bảo Trân. Chưa rõ có giữ `306769430050266425` không.
- **CHỐT 10/11 (chủ hệ thống xác nhận):** `6074310419531054771` = **CHỦ QUÁN**, `4215278939136353152` Trần Đại Hiệp = **nhân viên**, thêm **1 nhân viên nữa** (chưa có ID, có thể là Bảo Trân). Đã BỎ `306769430050266425` khỏi `nguoi_duyet`, vì chủ hệ thống chỉ kể 3 người duyệt và ID này không thuộc ai trong số đó. (ID này vẫn là `zalo_chu_quan` trong Sheet của bot cũ, dùng để gửi thông báo; KHÔNG đụng tới.) `cau_hinh` hiện tại: `nguoi_duyet` = `6074310419531054771;4215278939136353152`, `ten_nguoi_duyet` = `Chủ quán;Trần Đại Hiệp (NV)`. Khi có ID nhân viên thứ 2: thêm vào cuối cả 2 ô, và vào `TICHMA_APPROVERS`.
- ✅ **ĐỦ 3 NGƯỜI DUYỆT (10/11 14:10 VN):** nhân viên thứ 2 là **Bảo Trân `3824883582396729323`** (tag bot trong nhóm `1322697685107634084`). `cau_hinh` hiện tại: `nguoi_duyet` = `6074310419531054771;4215278939136353152;3824883582396729323`, `ten_nguoi_duyet` = `Chủ quán;Trần Đại Hiệp (NV);Bảo Trân (NV)`.
  Giá trị cho gateway: `TICHMA_GROUP: "5606409292553201202"`, `TICHMA_APPROVERS: "6074310419531054771,4215278939136353152,3824883582396729323"`.
- Chạy lại `kiem-tra-that.paste.js` với `NGUOI_DUYET = '4215278939136353152'` (10/11 11:54): **7/7 OK**, `ma_tich` ghi người duyệt "Trần Đại Hiệp". Đã xóa dòng thử, `bat_chuc_nang` = TAT.
- Khi gateway bật TICHMA_ON: `TICHMA_APPROVERS` phải trùng với `nguoi_duyet` (cách nhau dấu phẩy).
- 2 nick đã thả ❤️ trong nhóm đó: **`795750324388112116`** (thả 1 lần) và **`7997260400133550852`** (thả 3 lần). ⚠ **Chưa biết ai là chủ quán, ai là nhân viên.** Chưa thêm vào `nguoi_duyet` (hiện chỉ có `306769430050266425`). Lưu ý: nick "Trần Đại Hiệp" nhắn riêng với bot có ID `4215278939136353152`. Cả 3 ID này đều khác `306769430050266425` → cần hỏi chủ quán `nguoi_duyet` đúng là ID nào. Cách chắc nhất: chủ quán và nhân viên mỗi người thả tim 1 tin trong nhóm, ghi giờ thả, rồi đối chiếu `uidFrom` theo giờ.
- Node Google Sheets ở Luồng 2: typeVersion **4.5**, có `columns.matchingColumns` và `options.cellFormat`.

**Sửa trong lúc tạo:** n8n không cho activate vì node Sheets thiếu `parameters.authentication = 'serviceAccount'`. Đã thêm tham số này vào 2 workflow TICH MA (PATCH chỉ 2 workflow mới), và sửa `n8n/build.js` để lần sau script tự chép (đã chạy lại build + `kiem-tra-n8n.js`: 12/12 OK).

**Kết quả `kiem-tra-that.paste.js` trên n8n thật: 7/7 OK** (id thử `test-tm-1794283812142`). Ghi Sheet chạy được nghĩa là Sheet đã chia sẻ đúng cho service account.
1. tích mã → tin nhóm có tag + ghi yeu_cau ✔
2. tim người duyệt → cấp mã M-56CT8, 1/3 ✔
3. tim lần 2 → bỏ qua ✔
4. tim người lạ → bỏ qua ✔
5. tích mã lần 2 trong ngày → từ chối ✔
6. mã của tôi → 1/3 ✔
7. đổi quà khi chưa đủ → từ chối ✔

Đã xóa các dòng thử ở `yeu_cau`, `khach_hang`, `ma_tich`. `bat_chuc_nang` đã trả về **TAT**.

### ✅ ĐÃ SỬA: lỗi cột F `khach_hang` (phát hiện khi chạy thử)
Lỗi: node **"Them khach_hang"** (Append, `autoMapInputData`) ghi chuỗi rỗng vào mọi cột có tiêu đề, kể cả cột F (`so_ma_con`). Ô F1 là công thức mảng, nên bị chặn và báo `#REF!`.
Cách sửa (chỉ trong Sheet, KHÔNG sửa workflow):
- Bỏ công thức ở `khach_hang!F1`. Tab `khach_hang` giờ chỉ có 5 cột A..E, nên n8n chỉ ghi A..E.
- 3 công thức "KHÁCH ĐỦ QUÀ CHƯA ĐỔI" ở `tong_hop!A11:C11` tự đếm mã bằng `COUNTIFS(ma_tich!B2:B;khach_hang!A2:A;ma_tich!G2:G;"con")`, không dùng cột F nữa. Đã thử với dữ liệu giả (1 khách 3 mã, 1 khách 1 mã): chỉ khách 3 mã hiện ra, đúng.
- Chạy lại `kiem-tra-that.paste.js`: **7/7 OK** (id `test-tm-1794284444879`). `khach_hang` không còn bị ghi cột F. Đã xóa dòng thử, `bat_chuc_nang` = TAT.
- `logic.js` không đọc `so_ma_con`. Bảng cột `khach_hang` trong KE-HOACH giờ là: zalo_id, ten_zalo, lan_dau, trang_thai, ghi_chu (không còn so_ma_con).

### ✍ YÊU CẦU MỚI CỦA CHỦ QUÁN – ĐỔI QUÀ (chốt 10/11, làm TRƯỚC khi vá gateway)
Vấn đề: tin "✅ QUÀ HỢP LỆ" nằm lại trong Zalo của khách → lần sau khách đưa tin cũ hoặc ảnh chụp ra. Lúc quán đông, người bán không kịp tra Sheet.
Cách đã chốt:
- Khách tại quầy nhắn "đổi quà". Bot tự đối chiếu mã trong Sheet.
- **Hợp lệ:** trừ 3 mã, ghi `doi_qua`. Bot **đăng vào NHÓM KHÁCH** (`5606409292553201202`, có tag khách): "🎉 Chúc mừng @Tên đã đổi quà <qua_tang>! (HH:mm)", kèm mã quà nếu cần. Đồng thời nhắn riêng khách xác nhận ngắn.
- **Không hợp lệ** (chưa đủ mã / mã đã dùng): **chỉ nhắn riêng** khách (vd "mã đã dùng lúc… / mới có n/3 mã"), **KHÔNG đăng nhóm** (tránh làm khách ngại).
- Quy tắc cho người bán: **"Chỉ đưa quà khi thấy tin 🎉 chúc mừng MỚI của bot trong nhóm khách."** Không tin màn hình khách.
- Đổi quà KHÔNG cần thả tim duyệt (đã bàn và bỏ, để nhanh lúc đông khách).
- Chưa chốt: có thu hồi (undo) 3 tin mã cũ trong Zalo khách sau khi đổi không. Cách này cần gateway trả `cliMsgId` + thêm `/undo`, và Zalo có giới hạn thời gian thu hồi. Mặc định: KHÔNG làm.
Việc cần sửa: `logic.js` (nhánh `doi_qua`: thêm tin `den:'group'` có mentions khi hợp lệ, tin không hợp lệ chỉ gửi riêng), test `kiem-tra.js` + `kiem-tra-n8n.js` + `kiem-tra-that.paste.js` (thêm bước đổi quà đủ 3 mã → có tin nhóm; đổi lần 2 → không có tin nhóm), build lại, PATCH node "Xu ly" của `iMSooaBPyj7B9XS2` (workflow TICH MA, được phép sửa).
Các câu đã hỏi nhưng chủ quán CHƯA trả lời (mặc định giữ như code hiện tại): chỉ nhận ❤️ hay mọi cảm xúc (hiện: mọi cảm xúc); bắt buộc khách là thành viên nhóm (hiện: không); mã có hạn dùng (hiện: không, `han_ma_ngay=0`); quán tự kiểm bill 30K (hiện: có); thời hạn duyệt 30 phút, 1 mã/ngày (hiện: giữ).

### ✍ YÊU CẦU MỚI 2 – NHẬN CẢ CÂU NÓI VÒNG (cách a, chốt 10/11)
Vấn đề: hiện chỉ tin **bắt đầu bằng** từ khóa mới sang tích mã. "cho mình tích mã với" hay "tích điểm sao bạn" rơi về bot bán hàng, mà bot này không biết chương trình.
Chủ quán yêu cầu: **KHÔNG được ảnh hưởng chức năng tư vấn bán hàng.** Không sửa workflow cũ, không sửa Sheet của bot cũ.
Quy tắc mới (chép GIỐNG HỆT vào `logic.js` `nenChuyenTichMa` + `loaiTin` VÀ `gateway/tichma-snippet.js`; lệch nhau thì khách nhắn mà không ai trả lời):
- Giữ quy tắc cũ: tin chat riêng **bắt đầu bằng** từ khóa → tích mã.
- Thêm: tin chat riêng **ngắn** (sau khi bỏ dấu ≤ 30 ký tự) **có chứa** cụm `tich ma`, `tich diem`, `doi qua`, `ma cua toi` ở bất kỳ đâu → tích mã.
- NGOẠI LỆ, luôn về bot bán hàng: tin có mã món (`\bm\s?\d{1,2}\b`, vd M14), có số điện thoại (≥ 9 chữ số liền), có ảnh/sticker/danh thiếp, tin nhóm.
- Từ khóa nhập nhằng (`doi ma`, `so ma`, `xem ma`, `kiem tra ma`, `nhan qua`) chỉ tính khi **đứng đầu tin**, như hiện tại.
Kiểm tra bắt buộc trước khi vá gateway:
1. Test đơn vị: các câu "cho mình tích mã với", "tích điểm sao bạn", "mình muốn đổi quà" → tích mã; "M14 tích điểm được ko", "0907754132 tích mã" → bot bán hàng.
2. **Chạy MỌI tin trong bộ hồi quy cũ (mục 8 skill)** qua hàm chia đường: không tin nào được sang tích mã (gồm hi, 1, M14, 3 phần, địa chỉ, "Hôm qua mua bánh bị thiếu tóp mỡ", "Món nào ăn chay dc", "Muon mua them"…).
3. `test/kiem-tra-gateway.js`: TICHMA_ON=0 vẫn y hệt bản gốc.
4. Sau khi vá: chạy đủ bộ hồi quy cũ 108 bước.

### ⚠ GATEWAY TRÊN VPS ĐÃ THAY ĐỔI (10/11 17:13 VN) – phần KẾT BẠN
Phiên Code đã lắp phần kết bạn vào zalo-gateway, theo yêu cầu riêng của chủ hệ thống (workflow n8n kết bạn do phiên chat làm).
- Sao lưu bản trước: `/opt/zalo-n8n-stack/zalo-gateway/index.js.bak-ketban-20261110-1013`. Bản trước đó = `gateway/goc/index.js` (đã so hash).
- Bản đang chạy = `va-ketban.js` áp lên goc. Trong repo: `gateway/va-ketban.js`, `gateway/index-ketban-dang-chay.js` (bản đang chạy trên VPS), test `test/kiem-tra-ketban.js`.
- Chi tiết định dạng: skill bot-zalo-nhi-nhi, mục zalo-gateway.
- **VÁ TÍCH MÃ: phải áp lên `gateway/index-ketban-dang-chay.js`, KHÔNG áp lên goc/index.js** (nếu không sẽ mất phần kết bạn). Sửa `va-gateway.js` đọc file này. Chạy lại cả `kiem-tra-gateway.js` và `kiem-tra-ketban.js`.
- Triển khai không dùng `--build`: dùng `docker cp` vào /app + `docker compose restart zalo-gateway` (giữ zca-js 2.2.0). Có thể dùng lại cách trong `Downloads\trien-khai-ketban.sh`.

### Việc tiếp (sau 15:00 ngày 11/11)
0. Làm yêu cầu ĐỔI QUÀ và yêu cầu 2 ở trên (sửa logic + snippet gateway, test, PATCH workflow TICH MA, sinh lại `gateway/index.js`) TRƯỚC khi vá gateway.
1. Chủ quán xác nhận nhóm `5606409292553201202` và ID chủ quán/nhân viên, rồi điền `cau_hinh` (`nguoi_duyet`, `ten_nguoi_duyet`).
2. (Lỗi cột F đã sửa xong.) Khi chạy lại `kiem-tra-that.paste.js`: bật `bat_chuc_nang=BAT` trước khi chạy, trả về TAT sau khi chạy, rồi xóa các dòng `test-`.
3. Vá gateway (mục "Lắp lên VPS" bên dưới), sao lưu trước, rồi chạy đủ bộ hồi quy cũ (108 bước).
4. Cập nhật skill `bot-zalo-nhi-nhi` (kiến trúc, ID 2 workflow, kịch bản hồi quy tích mã). Lưu ý: n8n hiện có thêm `LUONG 6 - Cham soc khach (chu quan duyet)` `LSl9oibQnLvx2B1M` và vài bản lưu `BAN LUU TAM ...` mà skill chưa ghi.

---
(Phần dưới là nội dung trước phiên này.)

## Đã xong

| Việc | File / chỗ |
|---|---|
| Logic tích mã, 18 nhóm kiểm tra OK | `logic.js`, `test/kiem-tra.js` |
| 2 workflow mới dựng sẵn, chạy thử trên máy được 11 nhóm OK | `n8n/code-nodes.js`, `n8n/build.js` → `n8n/workflows.json`, `n8n/tao-workflow.paste.js`; test `test/kiem-tra-n8n.js` |
| Phần thêm cho gateway, có công tắc `TICHMA_ON`, kiểm tra OK (trùng quy tắc với logic.js; TICHMA_ON=0 → mọi sự kiện đi đường cũ) | `gateway/tichma-gateway.js`, `test/kiem-tra-gateway.js` |
| Sửa công thức "Mã cấp hôm nay" ở `tong_hop!B5`: thời gian lưu dạng chữ nên công thức cũ luôn ra 0 | Sheet (chỉ ô này) |

Chạy lại toàn bộ kiểm tra:
```bash
node tich-ma-zalo/test/kiem-tra.js && node tich-ma-zalo/n8n/build.js && node tich-ma-zalo/test/kiem-tra-n8n.js && node tich-ma-zalo/test/kiem-tra-gateway.js
```

## Cách 2 workflow mới chạy

**`TICH MA - Nhan su kien`** (Webhook POST `/webhook/tich-ma`):
1. Đọc 4 tab: cau_hinh → khach_hang → yeu_cau → ma_tich.
2. Node "Xu ly" chạy `logic.js`.
3. Các nhánh ghi Sheet chạy trước (sắp từ trên xuống, executionOrder v1). Một nhánh lỗi thì cả lượt dừng, khách không nhận tin.
4. Nhánh "Chuan bi tin → Gui tin" chạy sau cùng.
5. "Lay msgId" ghi msgId của tin nhóm vào `yeu_cau`.

Ghi chú:
- Ghi Sheet dùng `cellFormat: RAW`. Nếu không, Zalo ID 18–19 chữ số bị đổi thành số và mất các chữ số cuối.
- Tin `test-…`: vẫn ghi Sheet nhưng không gửi Zalo. Tin nhóm nhận msgId giả `test-msg-<ma_yc>`, dùng để thử bước thả tim.
- Script tạo workflow chỉ **đọc** (GET) Luồng 2 để chép typeVersion + credential của node Google Sheets. Nó chỉ POST tạo mới, để **tắt**, và dừng nếu đã có workflow trùng tên.

**`TICH MA - Quet qua han`** chạy 5 phút/lần:
- Đọc cau_hinh, yeu_cau. Yêu cầu quá 30 phút thì đổi `het_han` và nhắn khách.
- Không lưu các lượt chạy thành công, để khỏi đầy ~290 execution/ngày. Lượt lỗi vẫn lưu.

## ⛔ Đang chờ (cần trước khi lắp tiếp)

1. **Trình duyệt:** phiên trước chạy trên đám mây, không kết nối được trình duyệt trong app Claude, nên không vào được n8n. Mạng của phiên cũng chặn `bot.trandaihiepauto.click`. Cần mở phiên trên app Claude Desktop của máy đã đăng nhập n8n.
2. ~~**Code gateway**~~ ĐÃ CÓ (10/11), bản vá ở `gateway/index.js`. (Cũ: cần file `index.js` thật trên VPS để viết bản vá chính xác. Chủ quán chạy trong **PowerShell trên Windows**:
   ```powershell
   scp root@45.77.42.161:/opt/zalo-n8n-stack/zalo-gateway/index.js $HOME\Downloads\zalo-gateway-index.js
   ```
   Sau đó gửi file này cho Claude.)
3. **Chia sẻ Sheet:** chưa kiểm được Sheet đã chia sẻ cho `zalo-bot-reader@zalo-bot-513800.iam.gserviceaccount.com` (quyền Người chỉnh sửa) chưa. Công cụ Sheets của Claude không xem được danh sách chia sẻ. Chủ quán mở Sheet → **Chia sẻ** → kiểm tra. Khi tạo workflow, lượt chạy thử đầu tiên cũng sẽ báo lỗi 403 nếu chưa chia sẻ.
4. **`cau_hinh`:** còn trống `nhom_khach_id` và Zalo ID nhân viên. Lấy theo Bước 1 của KE-HOACH (đọc execution có `raw.isGroup=true`), cần vào được n8n.

## Bước tiếp theo (phiên có trình duyệt)

1. **Bước 1 KE-HOACH:** chỉ đọc. Lấy 1 reaction nhóm thật, xác nhận đúng các trường:
   - `raw.data.uidFrom`;
   - `raw.data.content.rMsg[0].gMsgID` (code "Xu ly" cũng thử `msgId`);
   - `raw.threadId`.

   Nếu tên trường khác: sửa `n8n/code-nodes.js`, rồi chạy lại build và test.
2. Kiểm tra `POST /rest/node-types` cho `googleSheets` đúng typeVersion của node mẫu: có `columns.matchingColumns` (bản ≥4.4) hay `columnToMatchOn`, và có `options.cellFormat`.
3. **Báo chủ quán**, rồi chạy `n8n/tao-workflow.paste.js` trong tab n8n. Đọc `window.__TM_TAO` để lấy ID 2 workflow.
4. Activate 2 workflow mới. Bot cũ không bị ảnh hưởng vì gateway chưa chuyển gì sang. Thử `/webhook/tich-ma` bằng `test-…` theo đúng thứ tự trong `test/kiem-tra-n8n.js`, rồi xóa các dòng thử trong Sheet.
5. **Vá gateway**, theo mục dưới.

## Vá zalo-gateway (ĐÃ SOẠN XONG từ index.js thật lấy trên VPS 10/11)

- `gateway/goc/index.js`: bản gốc lấy từ VPS, không có khóa bí mật (chỉ dùng `process.env`).
- `gateway/tichma-snippet.js`: khối TÍCH MÃ được chèn vào.
- `gateway/va-gateway.js`: sinh bản vá. Mỗi chỗ thay đều kiểm tra chuỗi gốc phải xuất hiện đúng 1 lần.
- `gateway/index.js`: **bản vá**, dùng để chép lên VPS.

Thay đổi (4 chỗ, gộp vào index.js nên không phải sửa Dockerfile):
1. Thêm khối `TICHMA` sau phần đọc biến môi trường.
2. Tin nhắn: `postJson(TICHMA.url(payload, N8N_WEBHOOK_URL), payload)`.
3. Thả cảm xúc: tương tự, chọn đường qua `TICHMA.url`.
4. `/send`:
   - nhận `mentions`, chỉ dùng khi TICHMA_ON=1, tin nhóm và chỉ 1 đoạn;
   - JSON trả về có thêm `msgId`. Các workflow cũ không đọc trường này.

`test/kiem-tra-gateway.js` chạy THẬT cả bản gốc lẫn bản vá, với zca-js/express/fetch giả:
- TICHMA_ON không đặt, `=0`, hay `=0` có đủ cấu hình: đường đi sự kiện và tin gửi **y hệt bản gốc**;
- TICHMA_ON=1: chỉ "tích mã/đổi quà/mã của tôi" (chat riêng) và tim của người duyệt trong nhóm khách đi sang `/webhook/tich-ma`.

### Lắp lên VPS
Làm cùng lúc chạy bộ hồi quy, nên **làm trong phiên có trình duyệt**.

Chưa cần sửa `docker-compose.yml`: không có biến TICHMA_ON thì gateway chạy như cũ. Gateway khởi động lại mất vài giây. Phiên Zalo nằm ở volume `zalo_data` nên không phải quét QR lại.

1. **PowerShell trên Windows**: tải `tich-ma-zalo/gateway/index.js` từ nhánh về `Downloads\zalo-gateway-index-moi.js`, rồi chép lên VPS:
   ```powershell
   scp $HOME\Downloads\zalo-gateway-index-moi.js root@45.77.42.161:/opt/zalo-n8n-stack/zalo-gateway/index.js.moi
   ```
2. **Trên VPS** (`ssh root@45.77.42.161`), sao lưu bản cũ rồi thay bằng bản mới:
   ```bash
   cd /opt/zalo-n8n-stack/zalo-gateway && cp index.js index.js.bak-$(date +%Y%m%d-%H%M) && mv index.js.moi index.js
   ```
3. **Trên VPS**, build lại gateway và xem log:
   ```bash
   cd /opt/zalo-n8n-stack && docker compose up -d --build zalo-gateway && sleep 20 && docker compose logs --tail 10 zalo-gateway
   ```
   Log phải có `đăng nhập bằng cookie đã lưu: OK` và `[listener] đã kết nối`.
4. Chạy đủ bộ hồi quy cũ (108 bước).
5. Khi đã có `nhom_khach_id` và ID nhân viên, thêm vào service `zalo-gateway` trong `docker-compose.yml` (mục `environment:`):
   ```yaml
         TICHMA_ON: "1"
         TICHMA_GROUP: "<nhom_khach_id>"
         TICHMA_APPROVERS: "306769430050266425,<id nhân viên>"
         TICHMA_WEBHOOK: "http://n8n:5678/webhook/tich-ma"
   ```
   Rồi chạy `docker compose up -d zalo-gateway`. Log sẽ có dòng `[tichma] BẬT: ...`.

**Hoàn tác**, chạy trên VPS:
```bash
cd /opt/zalo-n8n-stack/zalo-gateway && ls index.js.bak-*
```
Chép file `.bak` mới nhất đè lên `index.js`, rồi `docker compose up -d --build zalo-gateway`. Hoặc chỉ cần đặt `TICHMA_ON: "0"`.

## Kịch bản hồi quy tích mã (thêm vào mục 8 skill khi đã lắp)

Bộ kịch bản `TICH-MA`, chạy với tin `test-tm-<ts>` gửi vào `/webhook/tich-ma`:
1. "tích mã" → có `yeu_cau` cho_duyet với msg_id_nhom `test-msg-…`.
2. Tim của người duyệt vào msg đó → `da_duyet` + 1 dòng `ma_tich`.
3. Tim lần 2 → không thêm dòng.
4. Tim của người lạ → bỏ qua.
5. "tích mã" lần 2 trong ngày → từ chối.
6. Thêm 2 mã → "mã của tôi" báo 3 mã.
7. "đổi quà" → `doi_qua` + 3 mã `da_doi`.
8. Yêu cầu cũ hơn 30 phút → quét → `het_han`.

Cuối cùng xóa các dòng `test-`.

Gửi `/webhook/zalo-in` để kiểm tra bot cũ:
- tin "tích mã" trong lúc `TICHMA_ON=0` → bot cũ trả lời như trước;
- tim xác nhận đơn (chat riêng) → vẫn `don_ok`.
