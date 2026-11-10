# Tích mã – tiến độ lắp đặt

Cập nhật 10/11/2026. Làm theo `KE-HOACH.md`. Chưa đụng tới n8n, gateway hay bot đang chạy.

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
