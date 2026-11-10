/**
 * Kiểm tra phần KẾT BẠN của zalo-gateway: chạy THẬT bản gốc và bản vá với zca-js/express giả.
 *   node tich-ma-zalo/test/kiem-tra-ketban.js
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const GW = path.join(__dirname, '..', 'gateway');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwkb-'));
const VA_GOC = path.join(tmp, 'ketban-tu-goc.js'), VA_TM = path.join(tmp, 'ketban-tu-tichma.js');
execFileSync(process.execPath, [path.join(GW, 'va-ketban.js'), path.join(GW, 'goc', 'index.js'), VA_GOC]);
execFileSync(process.execPath, [path.join(GW, 'va-ketban.js'), path.join(GW, 'index.js'), VA_TM]);

const mod = (ten, code) => { const d = path.join(tmp, 'node_modules', ten); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: ten, type: 'module', main: 'index.js' })); fs.writeFileSync(path.join(d, 'index.js'), code); };
mod('express', `export default function express(){ const app={ routes:{}, use(){}, get(p,...h){app.routes['GET '+p]=h[h.length-1]}, post(p,...h){app.routes['POST '+p]=h[h.length-1]}, listen(){ globalThis.__APP=app } }; return app; }
express.json=()=>null; express.raw=()=>null;`);
mod('image-size', 'export default function(){ return {width:1,height:1} }');
mod('zca-js', `export const ThreadType={User:0,Group:1}; export const LoginQRCallbackEventType={};
export const FriendEventType={ADD:0,REMOVE:1,REQUEST:2,UNDO_REQUEST:3,REJECT_REQUEST:4,SEEN_FRIEND_REQUEST:5,UNKNOWN:12};
export class Zalo{ async login(){ const h={}; let n=0; globalThis.__CALL=[]; const api={ listener:{ on(e,f){h[e]=f}, start(){ globalThis.__L=h } },
  async sendMessage(c,t,ty){ globalThis.__SENT.push({c,t,ty}); return {message:{msgId:900+(++n)},attachment:[]} },
  async getUserInfo(u){ globalThis.__CALL.push('getUserInfo '+u); if(u==='loi') throw new Error('x'); return {changed_profiles:{[u+'_0']:{displayName:'Chị Lan',zaloName:'lan'}}} },
  async getGroupInfo(g){ globalThis.__CALL.push('getGroupInfo '+g); if(g==='hong') throw new Error('mạng lỗi');
    return {gridInfoMap: g==='555' ? {'555':{name:'Nhóm khách',totalMember:4,memVerList:['11_3','22_0'],memberIds:['22','33'],currentMems:[{id:'44'}]}} : {}} },
  async acceptFriendRequest(u){ globalThis.__CALL.push('accept '+u); if(u==='hong') throw new Error('không có lời mời'); return '' },
  async getFriendRecommendations(){ return {recommItems:[
    {dataInfo:{userId:'77',displayName:'An',recommType:2,recommTime:123,recommInfo:{message:'kết bạn nha'}}},
    {dataInfo:{userId:'88',displayName:'Gợi ý',recommType:1,recommTime:1,recommInfo:{message:''}}}]} } }; return api; } }`);
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));
fs.writeFileSync(path.join(tmp, 'credentials.json'), '{}');

const KICH_BAN = `
globalThis.__SENT=[]; globalThis.__POST=[];
globalThis.fetch=async(url,o)=>{ globalThis.__POST.push({url, body:JSON.parse(o.body)}); return {ok:true,status:200} };
setInterval=()=>0;
await import('./gw.mjs');
for (let i=0;i<50 && !globalThis.__L;i++) await new Promise(r=>setTimeout(r,10));
const L=globalThis.__L, app=globalThis.__APP, out={};
const req=async(m,p,o)=>{ let kq; const res={ status(c){this.c=c;return this}, json(j){kq={c:this.c||200,j}} }; await app.routes[m+' '+p](o,res); return kq; };
// sự kiện cũ
await L.message({ isSelf:false, threadId:'111', type:0, data:{ msgId:'a1', uidFrom:'111', dName:'Lan', content:'hi', ts:1 } });
await L.message({ isSelf:false, threadId:'555', type:1, data:{ msgId:'a2', uidFrom:'111', dName:'Lan', content:'@bot hi', ts:1 } });
await L.reaction({ threadId:'111', isSelf:false, isGroup:false, data:{ uidFrom:'111', content:{ rIcon:'/-heart' } } });
out.s1=await req('POST','/send',{body:{threadId:'111',threadType:'user',text:'xin chào'}});
out.health=await req('GET','/health',{});
out.coKetBan=!!L.friend_event;
if (L.friend_event) {
  await L.friend_event({ type:2, isSelf:false, threadId:'BOT', data:{ toUid:'BOT', fromUid:'321', src:30, message:'cho mình kết bạn' } });
  await L.friend_event({ type:2, isSelf:true, threadId:'999', data:{ toUid:'999', fromUid:'BOT', message:'' } });
  await L.friend_event({ type:0, isSelf:false, threadId:'321', data:'321' });
  await L.friend_event({ type:3, isSelf:false, threadId:'BOT', data:{ toUid:'BOT', fromUid:'321' } });
  await L.friend_event({ type:2, isSelf:false, threadId:'BOT', data:{ toUid:'BOT', fromUid:'loi', message:'' } });
  await L.friend_event(null);
  out.gm=await req('GET','/group-members',{query:{groupId:'555'}});
  out.gm2=await req('GET','/group-members',{query:{groupId:'555'}});
  out.gmKhong=await req('GET','/group-members',{query:{groupId:'666'}});
  out.gmHong=await req('GET','/group-members',{query:{groupId:'hong'}});
  out.gmThieu=await req('GET','/group-members',{query:{}});
  out.ac=await req('POST','/accept-friend',{body:{userId:'321'}});
  out.acHong=await req('POST','/accept-friend',{body:{userId:'hong'}});
  out.acThieu=await req('POST','/accept-friend',{body:{}});
  out.fr=await req('GET','/friend-requests',{});
}
out.post=globalThis.__POST; out.sent=globalThis.__SENT; out.call=globalThis.__CALL;
console.log('@@'+JSON.stringify(out));
process.exit(0);
`;
fs.writeFileSync(path.join(tmp, 'chay.mjs'), KICH_BAN);
function chay(file) {
  fs.copyFileSync(file, path.join(tmp, 'gw.mjs'));
  const o = execFileSync(process.execPath, [path.join(tmp, 'chay.mjs')], { cwd: tmp, env: {
    N8N_WEBHOOK_URL: 'http://n8n:5678/webhook/zalo-in', API_KEY: 'k', DATA_DIR: tmp, MIN_SEND_DELAY_MS: '0', GW_FILE: path.join(tmp, 'gw.mjs'), PATH: process.env.PATH } }).toString();
  return JSON.parse(o.split('@@')[1]);
}

const goc = chay(path.join(GW, 'goc', 'index.js'));
const kb = chay(VA_GOC);

// 1. Phần cũ y hệt
const cu = r => r.post.filter(p => !p.url.endsWith('/ket-ban'));
assert.deepStrictEqual(cu(kb), goc.post, 'sự kiện cũ phải đi y hệt bản gốc');
assert.deepStrictEqual(kb.sent, goc.sent);
assert.deepStrictEqual(kb.s1, goc.s1);
assert.deepStrictEqual(kb.health, goc.health);
assert.ok(goc.post.every(p => p.url.endsWith('/zalo-in')) && goc.post.length === 3);
assert.ok(!goc.coKetBan && kb.coKetBan);
console.log('OK  tin nhắn, thả tim, /send, /health: y hệt bản gốc');

// 2. Lời mời kết bạn
const kbPost = kb.post.filter(p => p.url.endsWith('/ket-ban'));
assert.strictEqual(kbPost.length, 2, 'chỉ 2 lời mời REQUEST không isSelf');
assert.strictEqual(kbPost[0].url, 'http://n8n:5678/webhook/ket-ban');
const b0 = kbPost[0].body;
assert.deepStrictEqual(Object.keys(b0).sort(), ['event', 'fromId', 'fromName', 'message', 'raw', 'ts']);
assert.strictEqual(b0.event, 'friend_request'); assert.strictEqual(b0.fromId, '321'); assert.strictEqual(b0.fromName, 'Chị Lan');
assert.strictEqual(b0.message, 'cho mình kết bạn'); assert.ok(typeof b0.ts === 'number' && b0.raw.data.fromUid === '321');
assert.strictEqual(kbPost[1].body.fromName, '', 'không lấy được tên → ""');
assert.ok(!kb.post.some(p => p.body.event === 'friend_request' && !p.url.endsWith('/ket-ban')), 'không gửi sang zalo-in/tich-ma');
console.log('OK  lời mời kết bạn → /webhook/ket-ban đúng định dạng; loại khác, isSelf, null: bỏ qua');

// 3. /group-members
assert.deepStrictEqual(kb.gm, { c: 200, j: { ok: true, groupId: '555', name: 'Nhóm khách', total: 4, members: ['11', '22', '33', '44'], complete: true } });
assert.deepStrictEqual(kb.gm2, kb.gm);
assert.strictEqual(kb.call.filter(c => c === 'getGroupInfo 555').length, 1, 'cache 2 phút');
assert.strictEqual(kb.gmKhong.c, 404); assert.strictEqual(kb.gmKhong.j.ok, false);
assert.deepStrictEqual(kb.gmHong, { c: 502, j: { ok: false, error: 'mạng lỗi' } });
assert.strictEqual(kb.gmThieu.c, 400);
console.log('OK  /group-members: bỏ _version, gộp danh sách, cache, báo lỗi');

// 4. /accept-friend, /friend-requests
assert.deepStrictEqual(kb.ac, { c: 200, j: { ok: true } });
assert.deepStrictEqual(kb.acHong, { c: 502, j: { ok: false, error: 'không có lời mời' } });
assert.strictEqual(kb.acThieu.c, 400);
assert.deepStrictEqual(kb.fr, { c: 200, j: { ok: true, requests: [{ fromId: '77', fromName: 'An', message: 'kết bạn nha', ts: 123 }] } });
console.log('OK  /accept-friend, /friend-requests');

// 5. Áp được lên bản đã vá tích mã (để sau này lắp tích mã không xung đột)
const tm = fs.readFileSync(VA_TM, 'utf8');
assert.ok(tm.includes('TICHMA.url(payload, N8N_WEBHOOK_URL)') && tm.includes('KẾT BẠN (thêm'));
console.log('OK  áp được lên bản gateway đã vá tích mã');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('GATEWAY KET BAN: KIỂM TRA OK');
