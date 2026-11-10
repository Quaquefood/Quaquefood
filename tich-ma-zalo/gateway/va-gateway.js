/**
 * Sinh index.js MỚI cho zalo-gateway từ bản gốc (goc/index.js lấy từ VPS 10/11/2026) + tichma-snippet.js.
 *   node tich-ma-zalo/gateway/va-gateway.js   → gateway/index.js (bản vá)
 * Mỗi chỗ thay đều kiểm tra chuỗi gốc có đúng 1 lần, không thấy thì dừng (không đoán).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const goc = fs.readFileSync(path.join(__dirname, 'goc', 'index.js'), 'utf8');
const snippet = fs.readFileSync(path.join(__dirname, 'tichma-snippet.js'), 'utf8');
let s = goc;
function thay(cu, moi) {
  const n = s.split(cu).length - 1;
  if (n !== 1) throw new Error('Chuỗi gốc xuất hiện ' + n + ' lần (cần 1): ' + cu.slice(0, 80));
  s = s.replace(cu, () => moi);
}
// 1) Chèn khối TÍCH MÃ ngay sau phần đọc biến môi trường
thay('const CRED_FILE = `${DATA_DIR}/credentials.json`;', snippet + '\nconst CRED_FILE = `${DATA_DIR}/credentials.json`;');
// 2) Tin nhắn: chọn đường (tích mã hay bot cũ)
thay('    const ok = await postJson(N8N_WEBHOOK_URL, payload);', '    const ok = await postJson(TICHMA.url(payload, N8N_WEBHOOK_URL), payload);');
// 3) Thả cảm xúc: chọn đường
thay('  l.on("reaction", (ev) => postJson(N8N_WEBHOOK_URL, { event: "reaction", raw: ev }));',
  '  l.on("reaction", (ev) => {\n    const p = { event: "reaction", raw: ev };\n    postJson(TICHMA.url(p, N8N_WEBHOOK_URL), p);\n  });');
// 4) /send: nhận mentions (tùy chọn), trả thêm msgId. Không có mentions → gửi y như cũ.
thay('  const { threadId, threadType = "user", text } = req.body || {};',
  '  const { threadId, threadType = "user", text, mentions } = req.body || {};');
thay('    for (const part of splitText(String(text).normalize("NFC"))) {\n      results.push(await enqueue(() => api.sendMessage({ msg: part }, threadId, type)));\n    }\n    res.json({ ok: true, parts: results.length, results });',
  '    const parts = splitText(String(text).normalize("NFC"));\n    const tag = TICHMA.cfg.bat && parts.length === 1 && type === ThreadType.Group ? TICHMA.mentions(mentions) : null;\n' +
  '    for (const part of parts) {\n      results.push(await enqueue(() => api.sendMessage(tag ? { msg: part, mentions: tag } : { msg: part }, threadId, type)));\n    }\n' +
  '    res.json({ ok: true, parts: results.length, results, msgId: TICHMA.msgId(results[0]) });');
fs.writeFileSync(path.join(__dirname, 'index.js'), s);
console.log('Đã sinh tich-ma-zalo/gateway/index.js (' + s.length + ' ký tự)');
