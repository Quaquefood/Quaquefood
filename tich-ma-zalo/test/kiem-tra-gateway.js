/** Kiểm tra phần thêm cho zalo-gateway: node tich-ma-zalo/test/kiem-tra-gateway.js */
'use strict';
const assert = require('assert');
const G = require('../gateway/tichma-gateway');
const TM = require('../logic');
const NHOM = '5000000000000000001', CHU = '306769430050266425', NV = '7000000000000000002';
const env = { TICHMA_ON: '1', TICHMA_GROUP: NHOM, TICHMA_APPROVERS: CHU + ',' + NV, TICHMA_WEBHOOK: 'http://n8n:5678/webhook/tich-ma' };
const ch = G.cauHinh(env);
const CU = 'http://n8n:5678/webhook/zalo-in';
const tin = (text, type) => ({ event: 'message', threadId: '1', threadType: type || 'user', text });
const tim = (uid, nhom, isGroup) => ({ event: 'reaction', raw: { threadId: nhom, isGroup, isSelf: false, data: { uidFrom: uid } } });
const mau = [tin('Tích mã'), tin('tich ma nha'), tin('Đổi quà'), tin('mã của tôi'), tin('tích mã', 'group'), tin('OK'), tin('1 phần M14'),
  tin('tích mãi'), tin(null), tim(CHU, NHOM, true), tim(NV, NHOM, true), tim('999', NHOM, true), tim(CHU, '123', true), tim(CHU, NHOM, false),
  { event: 'reaction', raw: {} }, { event: 'other' }];
// 1. Giống hệt logic.js
mau.forEach(s => assert.strictEqual(G.nenChuyen(s, ch), TM.nenChuyenTichMa(s, { bat: true, nhomKhachId: NHOM, nguoiDuyet: [CHU, NV] }), JSON.stringify(s)));
// 2. Đường đi
assert.strictEqual(G.webhookCho(tin('tích mã'), CU, ch), env.TICHMA_WEBHOOK);
assert.strictEqual(G.webhookCho(tin('OK'), CU, ch), CU);
assert.strictEqual(G.webhookCho(tim(CHU, '999999', false), CU, ch), CU, 'tim xác nhận ĐƠN HÀNG (chat riêng) vẫn đi bot cũ');
// 3. Công tắc TICHMA_ON=0 / không đặt → mọi sự kiện đi đường cũ
[G.cauHinh({}), G.cauHinh(Object.assign({}, env, { TICHMA_ON: '0' }))].forEach(c => mau.forEach(s => assert.strictEqual(G.webhookCho(s, CU, c), CU)));
assert.strictEqual(G.webhookCho(null, CU, ch), CU);
// 4. /send: không mentions → y như cũ (chuỗi); có mentions → object
assert.strictEqual(G.noiDungGui('xin chào'), 'xin chào');
assert.strictEqual(G.noiDungGui('xin chào', []), 'xin chào');
assert.deepStrictEqual(G.noiDungGui('Cảm ơn @Lan', [{ pos: 7, len: 4, uid: 111 }]), { msg: 'Cảm ơn @Lan', mentions: [{ pos: 7, len: 4, uid: '111' }] });
assert.strictEqual(G.layMsgId({ message: { msgId: 123 }, attachment: [] }), '123');
assert.strictEqual(G.layMsgId(undefined), null);
console.log('GATEWAY TICH MA: KIỂM TRA OK');
