/**
 * Sinh tich-ma-zalo/n8n/tao-workflow.paste.js: script dán vào tab n8n (built-in browser, javascript_tool).
 * Script đó CHỈ TẠO MỚI 2 workflow "TICH MA - ..." (tắt, active:false). Không PATCH/xóa workflow nào.
 * Nó chỉ ĐỌC (GET) workflow Luồng 2 để sao cấu hình node Google Sheets (typeVersion + credential) cho đúng bản n8n đang chạy.
 *
 * Chạy: node tich-ma-zalo/n8n/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./code-nodes');

const SHEET_ID = '1NA2LvEKf4Wyw8k_igntERwlx8sbtoS6iDGIZUi_oNs4';
const logic = fs.readFileSync(path.join(__dirname, '..', 'logic.js'), 'utf8')
  .replace(/if \(typeof module !== 'undefined'[^\n]*\n?/, '');
const voiLogic = code => logic + '\n// ===== Hết logic.js =====\n' + code;

const code = (name, js, x, y) => ({ name, type: 'n8n-nodes-base.code', typeVersion: 2, position: [x, y], parameters: { jsCode: js } });
// Node Sheets: SHEET_TPL được script thay bằng typeVersion/credentials của node Sheets có sẵn (chỉ đọc).
const sheetDoc = (name, tab, x, y) => ({ name, type: 'n8n-nodes-base.googleSheets', __tpl: true, position: [x, y],
  executeOnce: true, alwaysOutputData: true, retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
  parameters: { documentId: { __rl: true, mode: 'id', value: SHEET_ID }, sheetName: { __rl: true, mode: 'name', value: tab }, options: {} } });
const sheetGhi = (name, tab, kieu, khoa, x, y) => ({ name, type: 'n8n-nodes-base.googleSheets', __tpl: true, position: [x, y],
  retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
  parameters: Object.assign({ operation: kieu === 'sua' ? 'update' : 'append',
    documentId: { __rl: true, mode: 'id', value: SHEET_ID }, sheetName: { __rl: true, mode: 'name', value: tab },
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: khoa ? [khoa] : [], schema: [] },
    // RAW: giữ Zalo ID 18-19 chữ số dạng chữ (USER_ENTERED biến thành số, mất chữ số cuối).
    options: { cellFormat: 'RAW' } }, khoa ? { columnToMatchOn: khoa } : {}) });
const guiTin = (name, x, y) => ({ name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y],
  parameters: { method: 'POST', url: '={{ $env.ZALO_GATEWAY_URL }}/send', sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-api-key', value: '={{ $env.ZALO_GATEWAY_KEY }}' }] },
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ threadId: $json.threadId, threadType: $json.threadType, text: $json.text, mentions: ($json.mentions && $json.mentions.length) ? $json.mentions : undefined }) }}',
    options: {} } });
const noi = pairs => { const c = {}; pairs.forEach(([a, b]) => { (c[a] = c[a] || { main: [[]] }).main[0].push({ node: b, type: 'main', index: 0 }); }); return c; };

// ----- Workflow 1: Nhan su kien -----
// Thứ tự nhánh sau "Xu ly" theo vị trí từ TRÊN xuống (executionOrder v1): ghi Sheet trước, gửi tin SAU CÙNG.
// Một node ghi lỗi → cả execution dừng → khách không nhận "đã xác nhận" khi Sheet chưa ghi.
const GHI = [['yeu_cau', 'them', ''], ['yeu_cau', 'sua', 'ma_yc'], ['khach_hang', 'them', ''], ['ma_tich', 'them', ''],
  ['ma_tich', 'sua', 'ma'], ['doi_qua', 'them', '']];
const n1 = [
  { name: 'Nhan tich ma', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 300], __webhook: true,
    parameters: { httpMethod: 'POST', path: 'tich-ma', responseMode: 'onReceived', options: {} } },
  sheetDoc('Doc cau_hinh', 'cau_hinh', 220, 300), sheetDoc('Doc khach_hang', 'khach_hang', 440, 300),
  sheetDoc('Doc yeu_cau', 'yeu_cau', 660, 300), sheetDoc('Doc ma_tich', 'ma_tich', 880, 300),
  code('Xu ly', voiLogic(C.XU_LY), 1100, 300)
];
const c1 = [['Nhan tich ma', 'Doc cau_hinh'], ['Doc cau_hinh', 'Doc khach_hang'], ['Doc khach_hang', 'Doc yeu_cau'],
  ['Doc yeu_cau', 'Doc ma_tich'], ['Doc ma_tich', 'Xu ly']];
GHI.forEach(([tab, kieu, khoa], i) => {
  const y = i * 140, loc = 'Loc ' + tab + ' ' + kieu, ghi = (kieu === 'sua' ? 'Sua ' : 'Them ') + tab;
  n1.push(code(loc, C.locGhi(tab, kieu), 1320, y), sheetGhi(ghi, tab, kieu, khoa, 1540, y));
  c1.push(['Xu ly', loc], [loc, ghi]);
});
const yT = GHI.length * 140 + 60;
n1.push(code('Gia lap msgId (thu)', C.GIA_LAP_MSGID, 1320, yT),
  code('Chuan bi tin', C.CHUAN_BI_TIN, 1320, yT + 160), guiTin('Gui tin', 1540, yT + 160),
  code('Lay msgId', C.LAY_MSGID, 1760, yT + 160),
  sheetGhi('Ghi msgId', 'yeu_cau', 'sua', 'ma_yc', 1980, yT + 80));
c1.push(['Xu ly', 'Gia lap msgId (thu)'], ['Gia lap msgId (thu)', 'Ghi msgId'],
  ['Xu ly', 'Chuan bi tin'], ['Chuan bi tin', 'Gui tin'], ['Gui tin', 'Lay msgId'], ['Lay msgId', 'Ghi msgId']);

// ----- Workflow 2: Quet qua han (5 phút/lần) -----
const n2 = [
  { name: 'Moi 5 phut', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 200],
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } } },
  sheetDoc('Doc cau_hinh', 'cau_hinh', 220, 200), sheetDoc('Doc yeu_cau', 'yeu_cau', 440, 200),
  code('Quet', voiLogic(C.QUET), 660, 200),
  code('Loc het han', C.LOC_HET_HAN, 880, 100), sheetGhi('Sua yeu_cau', 'yeu_cau', 'sua', 'ma_yc', 1100, 100),
  code('Tin het han', C.TIN_HET_HAN, 880, 300), guiTin('Gui tin', 1100, 300)
];
const c2 = [['Moi 5 phut', 'Doc cau_hinh'], ['Doc cau_hinh', 'Doc yeu_cau'], ['Doc yeu_cau', 'Quet'],
  ['Quet', 'Loc het han'], ['Loc het han', 'Sua yeu_cau'], ['Quet', 'Tin het han'], ['Tin het han', 'Gui tin']];

const SETTINGS = { executionOrder: 'v1', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' };
const WF = [
  { name: 'TICH MA - Nhan su kien', nodes: n1, connections: noi(c1), settings: SETTINGS },
  // Quét 5 phút/lần: không lưu execution thành công (tránh ~290 execution/ngày); lỗi vẫn lưu.
  { name: 'TICH MA - Quet qua han', nodes: n2, connections: noi(c2), settings: Object.assign({}, SETTINGS, { saveDataSuccessExecution: 'none' }) }
];

const script = `// SINH TỰ ĐỘNG bởi tich-ma-zalo/n8n/build.js – KHÔNG sửa tay.
// Dán vào tab n8n (https://bot.trandaihiepauto.click). CHỈ TẠO MỚI workflow "TICH MA - ...", để TẮT.
// Chạy nền: kết quả ở window.__TM_TAO.
window.__TM_TAO = { trang_thai: 'dang_chay' };
(async () => {
  const h = { 'browser-id': localStorage.getItem('n8n-browserId') || '', 'content-type': 'application/json' };
  const get = async u => { const r = await fetch(u, { credentials: 'include', headers: h }); if (!r.ok) throw new Error(u + ' ' + r.status); return (await r.json()).data; };
  const WF = ${JSON.stringify(WF)};
  // 1) Không được trùng tên workflow đang có (không ghi đè gì).
  const ds = await get('/rest/workflows?limit=250');
  const ten = (Array.isArray(ds) ? ds : (ds.data || [])).map(w => w.name);
  const trung = WF.filter(w => ten.indexOf(w.name) >= 0).map(w => w.name);
  if (trung.length) throw new Error('Đã có workflow trùng tên, dừng: ' + trung.join(', '));
  // 2) Chỉ ĐỌC Luồng 2 để sao cấu hình node Google Sheets.
  const L2 = await get('/rest/workflows/LRXGmF0MEYZ7Q2Io');
  const tpl = L2.nodes.find(n => n.type === 'n8n-nodes-base.googleSheets' && n.credentials);
  if (!tpl) throw new Error('Không thấy node Google Sheets mẫu ở Luồng 2');
  const kq = [];
  for (const w of WF) {
    w.nodes.forEach(n => {
      n.id = crypto.randomUUID();
      if (n.__tpl) { n.typeVersion = tpl.typeVersion; n.credentials = tpl.credentials; delete n.__tpl;
        // Bắt buộc chép cả authentication (serviceAccount), thiếu thì n8n không cho activate (10/11).
        if (tpl.parameters && tpl.parameters.authentication) n.parameters = Object.assign({ authentication: tpl.parameters.authentication }, n.parameters); }
      if (n.__webhook) { n.webhookId = crypto.randomUUID(); delete n.__webhook; }
    });
    const r = await fetch('/rest/workflows', { method: 'POST', credentials: 'include', headers: h,
      body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings, active: false }) });
    const j = await r.json();
    if (!r.ok) throw new Error(w.name + ': ' + JSON.stringify(j).slice(0, 400));
    kq.push({ ten: w.name, id: j.data.id, active: j.data.active });
  }
  window.__TM_TAO = { trang_thai: 'xong', sheets_typeVersion: tpl.typeVersion, workflow: kq };
})().catch(e => { window.__TM_TAO = { trang_thai: 'loi', loi: String(e && e.message || e) }; });
`;
fs.writeFileSync(path.join(__dirname, 'tao-workflow.paste.js'), script);
fs.writeFileSync(path.join(__dirname, 'workflows.json'), JSON.stringify(WF, null, 2));
console.log('Đã sinh tao-workflow.paste.js (' + script.length + ' ký tự) và workflows.json');
module.exports = { WF };
