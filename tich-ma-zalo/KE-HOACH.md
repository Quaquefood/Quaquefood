# Tích mã qua bot Zalo – kế hoạch lắp đặt

Tài liệu dành cho phiên Claude chạy trên máy tính của chủ quán (có quyền vào n8n qua trình duyệt). Đọc kèm skill `bot-zalo-nhi-nhi`.

## ⛔ Nguyên tắc bắt buộc (chủ quán yêu cầu)
- **KHÔNG sửa, xóa, tắt hay đổi tên bất kỳ workflow nào đang có trong n8n.** Chỉ TẠO workflow MỚI, tên bắt đầu bằng `TICH MA - `.
- Chỗ duy nhất được sửa là **zalo-gateway** (chương trình giữ nick Zalo, không phải workflow), và phải:
  - sao lưu file cũ trước khi sửa;
  - có công tắc `TICHMA_ON`: đặt `0` thì gateway chạy y như cũ.
- Sau khi sửa gateway: chạy lại **đủ bộ hồi quy** của bot (mục 8 của skill). Có kịch bản nào hỏng thì hoàn tác ngay.

## Chương trình
- Khách trong nhóm Zalo mua bill từ 30K, quét QR nick bot ở quầy và nhắn **"tích mã"**.
- Bot đăng vào **nhóm khách hàng**, tag khách: "🎉 Cảm ơn @Tên đã ủng hộ quán! … Quán xác nhận ❤️ là mã sẽ được gửi riêng cho bạn nhé!"
- **Chủ quán hoặc nhân viên** (2 nick Zalo được chỉ định) thả ❤️ vào tin đó. Bot nhắn riêng mã cho khách (`M-XXXXX`, đang có n/3) và ghi Sheet.
- Đủ 3 mã: bot nhắn chúc mừng và nhắc đổi quà (**giảm 5K khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip**).
- Khách nhắn **"đổi quà"**: bot trả "✅ QUÀ HỢP LỆ" kèm giờ và mã quà. Người bán nhìn màn hình khách là xong. 3 mã bị trừ.
- Khách nhắn **"mã của tôi"**: bot báo số mã.
- Chống gian lận:
  - Yêu cầu không được thả tim trong 30 phút thì tự hủy (khách quét ở nhà).
  - Mỗi nick chỉ được 1 mã/ngày.
  - Chỉ tính tim của người được duyệt.
  - Mỗi yêu cầu chỉ duyệt được 1 lần.

## Đã làm sẵn (phiên trên đám mây)
1. **Google Sheet "Chuong trinh khuyen mai"**, ID `1NA2LvEKf4Wyw8k_igntERwlx8sbtoS6iDGIZUi_oNs4`:

   | Tab | Cột / nội dung |
   |---|---|
   | `tong_hop` | Công thức tự tính: số khách, mã đã cấp, mã hôm nay, quà đã đổi, tiền giảm, yêu cầu chờ, danh sách khách đủ quà chưa đổi |
   | `yeu_cau` | ma_yc, zalo_id, ten_zalo, thoi_gian, msg_id_nhom, trang_thai (cho_duyet / da_duyet / het_han), nguoi_duyet, thoi_gian_duyet |
   | `khach_hang` | zalo_id, ten_zalo, lan_dau, trang_thai (hoat_dong / khoa), ghi_chu, so_ma_con (cột F là công thức – **không ghi đè**) |
   | `ma_tich` | ma, zalo_id, ten_zalo, thoi_gian_duyet, nguoi_duyet, ma_yc, trang_thai (con / da_doi), ma_doi_qua |
   | `doi_qua` | ma_doi_qua, zalo_id, ten_zalo, thoi_gian, ma_da_dung, gia_tri_giam |
   | `cau_hinh` | `bat_chuc_nang` (đang **TAT**), so_ma_doi 3, qua_tang, han_duyet_phut 30, so_lan_moi_ngay 1, `nhom_khach_id` (**cần điền**), `nguoi_duyet` (đã có chủ quán `306769430050266425`; **cần thêm ID nhân viên**), ten_nguoi_duyet, tu_khoa_tich_ma |

   Thời gian ghi dạng chữ `yyyy-MM-dd HH:mm:ss`, giờ Việt Nam.
2. **`tich-ma-zalo/logic.js`**: toàn bộ quy tắc dưới dạng hàm thuần, dán vào node Code. Kiểm tra bằng `node tich-ma-zalo/test/kiem-tra.js` (18 nhóm tình huống, đều OK). Các hàm:
   - `xuLyTinKhach(evt, db, now, {laThanhVien})`: xử lý "tích mã", "đổi quà", "mã của tôi".
   - `xuLyThaTim({groupId, uidFrom, msgId}, db, now)`: xử lý ❤️ trong nhóm khách.
   - `ganMsgId(maYc, msgId)`: sau khi gửi tin nhóm, ghi msgId vào yêu cầu.
   - `quetQuaHan(db, now)`: chạy định kỳ, hủy yêu cầu quá hạn và báo khách.
   - `nenChuyenTichMa(suKien, {bat, nhomKhachId, nguoiDuyet})`: quy tắc chuyển đường cho gateway.
   - Dữ liệu ra: `{tin:[{den:'user'|'group', threadId, text, mentions?, cho_msgId?, ma_yc?}], ghi:[{tab, kieu:'them'|'sua', khop, dong}]}`.

## Việc còn lại (phiên trên máy tính)

### Bước 0 – Chủ quán làm
- Chia sẻ Sheet cho `zalo-bot-reader@zalo-bot-513800.iam.gserviceaccount.com`, quyền **Người chỉnh sửa**.
- Vô hiệu bản web cũ: trong Apps Script của Sheet, vào **Triển khai → Quản lý các tùy chọn triển khai → Lưu trữ**, rồi xóa code trong `Mã.gs`.
- Đưa nick bot vào **nhóm khách hàng**, nếu chưa có.

### Bước 1 – Đọc trước, chưa sửa gì
- Đọc code gateway (bản sao `Downloads/zalo-gateway-index.js`; bản thật trên VPS `/opt/zalo-n8n-stack/zalo-gateway/`) để tìm:
  - chỗ POST sự kiện sang `/webhook/zalo-in`;
  - hàm xử lý `/send` (có trả msgId không, có nhận `mentions` không).
- Lấy 1 sự kiện **reaction trong nhóm** thật để xác định đúng tên trường:
  - người thả: dự kiến `raw.data.uidFrom`;
  - id tin được thả: dự kiến `raw.data.content.rMsg[0].gMsgID`;
  - id nhóm: `raw.threadId`.
  - Cách lấy: bot cũ đang lọc bỏ reaction nhóm ở node "Tin van ban can tra loi?", nên execution chỉ có 2 node nhưng vẫn lưu body. Tìm execution của workflow chính có `raw.isGroup=true`.
- Lấy `nhom_khach_id`: threadId của nhóm khách, xem từ execution có tin nhắn trong nhóm. Lấy Zalo ID nhân viên: nhờ nhân viên thả tim 1 tin trong nhóm, đọc `uidFrom`. Điền cả hai vào `cau_hinh`.

### Bước 2 – Workflow MỚI (không đụng workflow cũ)
1. **`TICH MA - Nhan su kien`**: Webhook POST `/webhook/tich-ma`.
   - Code "Phan loai" dùng `nenChuyenTichMa` để phân biệt message hay reaction.
   - Google Sheets đọc 4 tab: `cau_hinh`, `khach_hang`, `yeu_cau`, `ma_tich`. Mỗi tin chỉ 4 lần đọc, vẫn dưới quota 60 lần/phút.
   - (Tùy chọn) HTTP gọi gateway lấy danh sách thành viên nhóm, để truyền `laThanhVien`.
   - Code: dán `logic.js` rồi gọi `TM.xuLyTinKhach` hoặc `TM.xuLyThaTim`.
   - Gửi tin qua gateway `POST /send` (header `x-api-key`):
     - tin nhóm có `mentions`, lấy msgId trả về rồi ghi bằng `ganMsgId`;
     - tin `test-…` thì không gửi thật, giống quy ước của bot cũ.
   - Ghi Sheet:
     - `them` dùng Append, chỉ các cột A..E của `khach_hang`;
     - `sua` dùng Update theo cột khóa (`ma_yc` hoặc `ma`).
   - Tất cả node Sheets: thử lại 5 lần, cách 5 giây. Lỗi ghi Sheet thì không gửi tin "đã xác nhận" cho khách.
2. **`TICH MA - Quet qua han`**: Schedule mỗi 5 phút, đọc Sheet, `TM.quetQuaHan`, rồi gửi tin và ghi Sheet. Không có yêu cầu `cho_duyet` thì dừng sớm.
3. Settings giống các luồng hiện có: `saveDataSuccessExecution: 'all'`. Activate.

### Bước 3 – Sửa zalo-gateway (sao lưu trước)
- `cp index.js index.js.bak-$(date +%Y%m%d-%H%M)`.
- Thêm biến môi trường trong `.env` / docker-compose: `TICHMA_ON=0` lúc đầu, `TICHMA_GROUP=<nhom_khach_id>`, `TICHMA_APPROVERS=<id1>,<id2>`, `TICHMA_WEBHOOK=http://n8n:5678/webhook/tich-ma`.
- Ở chỗ chuyển sự kiện sang n8n: nếu `TICHMA_ON==='1'` và `nenChuyenTichMa(event)` thì POST sang `TICHMA_WEBHOOK` **thay cho** `zalo-in`. Mọi sự kiện khác giữ nguyên đường cũ. Chép hàm `nenChuyenTichMa` và `boDau` từ `logic.js`.
- `/send`:
  - nhận thêm `mentions` (tùy chọn) và truyền vào `api.sendMessage({msg, mentions}, threadId, type)`;
  - trả về `msgId` trong JSON;
  - không có `mentions` thì chạy y như cũ.
- (Tùy chọn) `GET /group-members?groupId=` trả danh sách uid thành viên (zca-js `getGroupInfo`).
- Chủ quán chạy: `docker compose up -d --build zalo-gateway`. Phiên Zalo nằm ở volume `zalo_data` nên không phải quét QR lại. Kiểm tra `GET /health`.
- **Hoàn tác:** chép file `.bak` về chỗ cũ rồi build lại, hoặc chỉ cần đặt `TICHMA_ON=0`.

### Bước 4 – Kiểm tra
- Gọi trực tiếp `/webhook/tich-ma` bằng sự kiện giả có threadId `test-…`. Kiểm từng tình huống như trong `test/kiem-tra.js`, rồi xóa các dòng thử trong Sheet.
- Chạy **đủ bộ hồi quy cũ (108 bước)**: phải 100% OK, vì gateway có thay đổi.
- Bật `TICHMA_ON=1` và `bat_chuc_nang=BAT`, rồi nhờ chủ quán thử thật:
  - tích mã, chờ thả tim, nhận mã;
  - đủ 3 mã thì nhận tin chúc mừng;
  - đổi quà;
  - quét mà không ai thả tim thì sau 30 phút yêu cầu tự hủy.
- Kiểm tra lại: tim xác nhận **đơn hàng** (chat riêng) vẫn đi bot cũ; khách đang đặt món vẫn bình thường.

### Bước 5 – Ghi lại
Cập nhật skill `bot-zalo-nhi-nhi`, ghi vào các mục sau:
- mục Kiến trúc: gateway có chuyển đường tích mã;
- mục Các luồng: tên và ID các workflow `TICH MA - …`;
- bộ hồi quy: thêm kịch bản tích mã;
- câu chữ đã chốt.

## Câu chữ đã chốt (đã có trong logic.js)
- **Tin nhóm:** "🎉 Cảm ơn @Tên đã ủng hộ quán! Bánh tráng Nhi Nhi tặng bạn 1 mã tích điểm (đủ 3 mã được Giảm 5.000đ khi mua Trà tắc hoặc Bánh tráng phơi sương muối sặc túi zip). Quán xác nhận ❤️ là mã sẽ được gửi riêng cho bạn nhé!"
- **Sau khi thả tim:** "✅ Bánh tráng Nhi Nhi đã xác nhận! Mã tích điểm của anh/chị: M-XXXXX / Anh/chị đang có n/3 mã." Đủ 3 mã thì thêm "🎉 CHÚC MỪNG! …nhắn "đổi quà"…".
- **Đổi quà:** "✅ QUÀ HỢP LỆ ✅ / 🎁 … / 👤 Tên / 🕒 giờ / 🔖 Mã quà: QUA-XXXXX …"
