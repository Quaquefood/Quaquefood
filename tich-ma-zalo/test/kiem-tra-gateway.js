/**
 * Kiểm tra bản vá zalo-gateway: chạy THẬT gateway/index.js (bản vá) và goc/index.js (bản gốc)
 * với zca-js / express / image-size GIẢ, fetch giả (ghi lại URL n8n được gọi).
 *   node tich-ma-zalo/gateway/va-gateway.js && node tich-ma-zalo/test/kiem-tra-gateway.js
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const TM = require('../logic');

const GW = path.join(__dirname, '..', 'gateway');
const NHOM = '5000000000000000001', CHU = '306769430050266425', NV = '7000000000000000002';

// Thư mục tạm có node_modules giả
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-'));
const mod = (ten, code) => { const d = path.join(tmp, 'node_modules', ten); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: ten, type: 'module', main: 'index.js' })); fs.writeFileSync(path.join(d, 'index.js'), code); };
mod('express', `export default function express(){ const app={ routes:{}, use(){}, get(p,...h){app.routes['GET '+p]=h[h.length-1]}, post(p,...h){app.routes['POST '+p]=h[h.length-1]}, listen(){ globalThis.__APP=app } }; return app; }
express.json=()=>null; express.raw=()=>null;`);
mod('image-size', 'export default function(){ return {width:1,height:1} }');
mod('zca-js', `export const ThreadType={User:0,Group:1}; export const LoginQRCallbackEventType={}; export const FriendEventType={REQUEST:2};
export class Zalo{ async login(){ const h={}; let n=0; const api={ listener:{ on(e,f){h[e]=f}, start(){ globalThis.__L=h } },
  async sendMessage(c,t,ty){ globalThis.__SENT.push({c,t,ty}); return {message:{msgId:900+(++n)},attachment:[]} } }; return api; } }`);
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));
fs.writeFileSync(path.join(tmp, 'credentials.json'), '{}');

const KICH_BAN = `
globalThis.__SENT=[]; globalThis.__POST=[];
globalThis.fetch=async(url,o)=>{ globalThis.__POST.push({url, body:JSON.parse(o.body)}); return {ok:true,status:200} };
setInterval=()=>0;
await import('./gw.mjs');
for (let i=0;i<50 && !globalThis.__L;i++) await new Promise(r=>setTimeout(r,10));
const L=globalThis.__L, app=globalThis.__APP, out={};
const tin=(text,type,id)=>L.message({ isSelf:false, threadId:'111', type: type==='group'?1:0, data:{ msgId:id, uidFrom:'111', dName:'Lan', content:text, ts:1 } });
const tim=(uid,nhom,isGroup)=>L.reaction({ threadId:nhom, isSelf:false, isGroup, data:{ uidFrom:uid, msgId:'r1', content:{ rIcon:'/-heart', rMsg:[{gMsgID:'55'}] } } });
await tin('Tích mã','user','a1'); await tin('OK','user','a2'); await tin('tích mã','group','a3'); await tin('đổi quà','user','a4');
await tim('${CHU}','${NHOM}',true); await tim('999','${NHOM}',true); await tim('${CHU}','777',false);
await new Promise(r=>setTimeout(r,50));
out.post=globalThis.__POST.map(p=>p.url.split('/').pop());
const call=async(body)=>{ let kq; const res={ status(c){this.c=c;return this}, json(j){kq={c:this.c||200,j}} }; await app.routes['POST /send']({body},res); return kq; };
out.s1=await call({threadId:'111',threadType:'user',text:'xin chào'});
out.s2=await call({threadId:'${NHOM}',threadType:'group',text:'Cảm ơn @Lan nhé',mentions:[{pos:7,len:4,uid:'111'}]});
out.s3=await call({threadId:'111',threadType:'user',text:'chat riêng',mentions:[{pos:0,len:4,uid:'111'}]});
out.sent=globalThis.__SENT;
console.log('@@'+JSON.stringify(out));
process.exit(0);
`;
fs.writeFileSync(path.join(tmp, 'chay.mjs'), KICH_BAN);

function chay(file, env) {
  fs.copyFileSync(file, path.join(tmp, 'gw.mjs'));
  const o = execFileSync(process.execPath, [path.join(tmp, 'chay.mjs')], { cwd: tmp, env: Object.assign({
    N8N_WEBHOOK_URL: 'http://n8n:5678/webhook/zalo-in', API_KEY: 'k', DATA_DIR: tmp, MIN_SEND_DELAY_MS: '0', GW_FILE: path.join(tmp, 'gw.mjs'), PATH: process.env.PATH }, env) }).toString();
  return JSON.parse(o.split('@@')[1]);
}
const BAT = { TICHMA_ON: '1', TICHMA_GROUP: NHOM, TICHMA_APPROVERS: CHU + ',' + NV };

// 1. Bản gốc vs bản vá khi TICHMA_ON không đặt / =0 / =1 nhưng thiếu cấu hình: y hệt
const goc = chay(path.join(GW, 'index-ketban-dang-chay.js'), {}); // 11/11: so với bản ĐANG CHẠY (có kết bạn)
[{}, { TICHMA_ON: '0' }, Object.assign({}, BAT, { TICHMA_ON: '0' })].forEach(env => {
  const vá = chay(path.join(GW, 'index.js'), env);
  assert.deepStrictEqual(vá.post, goc.post, 'đường đi phải y hệt bản gốc');
  assert.deepStrictEqual(vá.sent, goc.sent, 'tin gửi phải y hệt bản gốc');
  assert.deepStrictEqual(vá.s1.j.results, goc.s1.j.results);
});
assert.ok(goc.post.every(u => u === 'zalo-in'));
console.log('OK  TICHMA_ON tắt → y hệt bản gốc (đường đi + tin gửi)');

// 2. Bật: đúng sự kiện sang tich-ma, còn lại vẫn zalo-in
const b = chay(path.join(GW, 'index.js'), BAT);
assert.deepStrictEqual(b.post, ['tich-ma', 'zalo-in', 'zalo-in', 'tich-ma', 'tich-ma', 'zalo-in', 'zalo-in']);
console.log('OK  TICHMA_ON=1 → chỉ "tích mã/đổi quà" + tim người duyệt trong nhóm khách sang tich-ma');

// 3. /send: mentions chỉ dùng cho tin nhóm; trả msgId
assert.deepStrictEqual(b.sent[1].c, { msg: 'Cảm ơn @Lan nhé', mentions: [{ pos: 7, len: 4, uid: '111' }] });
assert.deepStrictEqual(b.sent[0].c, { msg: 'xin chào' });
assert.deepStrictEqual(b.sent[2].c, { msg: 'chat riêng' });
assert.strictEqual(b.s2.j.msgId, String(b.s2.j.results[0].message.msgId));
assert.ok(b.s1.j.ok && b.s1.j.parts === 1);
console.log('OK  /send: tag trong nhóm, trả msgId; không mentions → như cũ');

// 4. Quy tắc trong gateway trùng logic.js
const src = fs.readFileSync(path.join(GW, 'tichma-snippet.js'), 'utf8');
const T = new Function('process', src + '\nreturn TICHMA;')({ env: BAT });
const tinM = (text, type) => ({ event: 'message', threadId: '1', threadType: type || 'user', text });
const timM = (uid, nhom, g) => ({ event: 'reaction', raw: { threadId: nhom, isGroup: g, data: { uidFrom: uid } } });
[tinM('Tích mã'), tinM('tich ma nha'), tinM('Đổi quà'), tinM('mã của tôi'), tinM('tích mã', 'group'), tinM('OK'), tinM('tích mãi'), tinM(null),
  timM(CHU, NHOM, true), timM(NV, NHOM, true), timM('9', NHOM, true), timM(CHU, '1', true), timM(CHU, NHOM, false), { event: 'reaction', raw: {} }, { event: 'x' }]
  .forEach(s => assert.strictEqual(T.nenChuyen(s), TM.nenChuyenTichMa(s, { bat: true, nhomKhachId: NHOM, nguoiDuyet: [CHU, NV] }), JSON.stringify(s)));
console.log('OK  quy tắc chuyển đường trùng logic.js');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('GATEWAY TICH MA: KIỂM TRA OK');
