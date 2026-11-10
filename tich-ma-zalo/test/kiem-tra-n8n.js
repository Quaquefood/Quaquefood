/**
 * Chạy thử 2 workflow "TICH MA - ..." (workflows.json do build.js sinh) trên máy, không cần n8n:
 * bộ chạy mini mô phỏng executionOrder v1 (nhánh trên chạy hết rồi mới tới nhánh dưới),
 * node Google Sheets đọc/ghi Sheet giả trong bộ nhớ, node "Gui tin" ghi lại tin gửi và trả msgId.
 *   node tich-ma-zalo/n8n/build.js && node tich-ma-zalo/test/kiem-tra-n8n.js
 */
'use strict';
const assert = require('assert');
const path = require('path');
const WF = require(path.join(__dirname, '..', 'n8n', 'workflows.json'));

const COT = {
  cau_hinh: ['khoa', 'gia_tri', 'giai_thich'],
  khach_hang: ['zalo_id', 'ten_zalo', 'lan_dau', 'trang_thai', 'ghi_chu', 'so_ma_con'],
  yeu_cau: ['ma_yc', 'zalo_id', 'ten_zalo', 'thoi_gian', 'msg_id_nhom', 'trang_thai', 'nguoi_duyet', 'thoi_gian_duyet'],
  ma_tich: ['ma', 'zalo_id', 'ten_zalo', 'thoi_gian_duyet', 'nguoi_duyet', 'ma_yc', 'trang_thai', 'ma_doi_qua'],
  doi_qua: ['ma_doi_qua', 'zalo_id', 'ten_zalo', 'thoi_gian', 'ma_da_dung', 'gia_tri_giam']
};
const NHOM = '5000000000000000001', CHU = '306769430050266425', NV = '7000000000000000002';

function sheetMoi(nhom) {
  const cfg = { bat_chuc_nang: 'BAT', ten_quan: 'Bánh tráng Nhi Nhi', so_ma_doi: '3', qua_tang: 'Giảm 5.000đ khi mua Trà tắc',
    gia_tri_giam: '5000', han_duyet_phut: '30', so_lan_moi_ngay: '1', nhom_khach_id: nhom, nguoi_duyet: CHU + ';' + NV,
    ten_nguoi_duyet: 'Chủ quán;Nhân viên', tu_khoa_tich_ma: 'tích mã; tich ma' };
  return { cau_hinh: Object.keys(cfg).map(k => ({ khoa: k, gia_tri: cfg[k], giai_thich: '' })), khach_hang: [], yeu_cau: [], ma_tich: [], doi_qua: [] };
}

function chay(wf, sheet, body, gw) {
  const nodes = {}; wf.nodes.forEach(n => { nodes[n.name] = n; });
  const out = {}; const thuTu = [];
  const $ = name => ({ first: () => out[name][0], all: () => out[name] || [] });
  function runNode(n, input) {
    const p = n.parameters;
    if (n.type === 'n8n-nodes-base.webhook') return [{ json: { body } }];
    if (n.type === 'n8n-nodes-base.scheduleTrigger') return [{ json: {} }];
    if (n.type === 'n8n-nodes-base.code') {
      const f = new Function('$', '$input', p.jsCode);
      return f($, { all: () => input });
    }
    if (n.type === 'n8n-nodes-base.googleSheets') {
      const tab = p.sheetName.value, rows = sheet[tab];
      assert.ok(COT[tab], 'tab lạ ' + tab);
      if (!p.operation) {
        const r = rows.map((x, i) => ({ json: Object.assign({ row_number: i + 2 }, x) }));
        return r.length ? r : [{ json: {} }];
      }
      assert.strictEqual(p.options.cellFormat, 'RAW');
      input.forEach(it => {
        Object.keys(it.json).forEach(k => assert.ok(COT[tab].indexOf(k) >= 0, tab + ' không có cột ' + k));
        assert.ok(!('so_ma_con' in it.json), 'không được ghi cột công thức');
        if (p.operation === 'append') rows.push(Object.assign({}, it.json));
        else {
          const k = p.columns.matchingColumns[0];
          rows.filter(x => String(x[k]) === String(it.json[k])).forEach(x => Object.assign(x, it.json));
        }
      });
      return input;
    }
    if (n.type === 'n8n-nodes-base.httpRequest') {
      return input.map(it => {
        const t = it.json;
        if (gw.loi) throw new Error('gateway lỗi');
        const id = String(++gw.so);
        gw.gui.push({ threadId: t.threadId, threadType: t.threadType, text: t.text, mentions: t.mentions, msgId: id });
        return { json: { ok: true, msgId: id } };
      });
    }
    throw new Error('node lạ ' + n.type);
  }
  // executionOrder v1: chạy theo chiều sâu, các nhánh con xếp theo vị trí (y rồi x).
  function exec(name, input) {
    const n = nodes[name];
    const kq = runNode(n, input);
    out[name] = kq; thuTu.push(name);
    if (!kq.length) return;
    const con = ((wf.connections[name] || {}).main || [[]])[0].map(c => c.node)
      .sort((a, b) => nodes[a].position[1] - nodes[b].position[1] || nodes[a].position[0] - nodes[b].position[0]);
    con.forEach(c => exec(c, kq));
  }
  const goc = wf.nodes.find(n => /webhook|scheduleTrigger/.test(n.type)).name;
  try { exec(goc, []); } catch (e) { return { loi: e.message, out, thuTu }; }
  return { out, thuTu };
}

const W1 = WF.find(w => w.name === 'TICH MA - Nhan su kien'), W2 = WF.find(w => w.name === 'TICH MA - Quet qua han');
const tin = (uid, text, ten) => ({ event: 'message', threadId: uid, threadType: 'user', msgId: 'm' + Math.random(), fromId: uid, fromName: ten || 'Lan', text });
const tim = (uid, msgId, nhom) => ({ event: 'reaction', raw: { threadId: nhom || NHOM, isSelf: false, isGroup: true,
  data: { uidFrom: uid, dName: 'x', content: { rIcon: '/-heart', rMsg: [{ gMsgID: msgId }] } } } });

let so = 0; const ok = m => { so++; console.log('OK  ' + m); };

// 1. Tích mã → tin nhóm có tag + tin riêng; yêu cầu ghi kèm msgId thật của tin nhóm
let S = sheetMoi(NHOM), gw = { so: 100, gui: [] };
let r = chay(W1, S, tin('111', 'Tích mã'), gw);
assert.ok(!r.loi, r.loi);
assert.strictEqual(gw.gui.length, 2);
assert.strictEqual(gw.gui[0].threadType, 'group'); assert.strictEqual(gw.gui[0].threadId, NHOM);
assert.ok(/Quán xác nhận ❤️ là mã sẽ được gửi riêng/.test(gw.gui[0].text));
assert.strictEqual(gw.gui[0].mentions[0].uid, '111');
assert.strictEqual(gw.gui[1].threadId, '111');
assert.strictEqual(S.yeu_cau.length, 1); assert.strictEqual(S.yeu_cau[0].msg_id_nhom, gw.gui[0].msgId);
assert.strictEqual(S.khach_hang.length, 1);
assert.ok(r.thuTu.indexOf('Them yeu_cau') < r.thuTu.indexOf('Gui tin'), 'ghi Sheet phải trước gửi tin');
ok('tích mã: tag nhóm + báo riêng + ghi msgId');

// 2. Nhân viên thả tim → mã M-xxxxx nhắn riêng, yêu cầu da_duyet
const msgNhom = gw.gui[0].msgId;
r = chay(W1, S, tim(NV, msgNhom), gw);
assert.ok(!r.loi, r.loi);
assert.strictEqual(gw.gui.length, 3); assert.strictEqual(gw.gui[2].threadId, '111');
assert.ok(/M-[A-Z0-9]{5}/.test(gw.gui[2].text) && /1\/3/.test(gw.gui[2].text));
assert.strictEqual(S.yeu_cau[0].trang_thai, 'da_duyet'); assert.strictEqual(S.yeu_cau[0].nguoi_duyet, 'Nhân viên');
assert.strictEqual(S.ma_tich.length, 1);
ok('thả tim của nhân viên → gửi mã + ghi ma_tich');

// 3. Thả tim lần 2 → không cấp thêm
r = chay(W1, S, tim(CHU, msgNhom), gw);
assert.strictEqual(gw.gui.length, 3); assert.strictEqual(S.ma_tich.length, 1);
ok('thả tim lần 2 → bỏ qua');

// 4. Người lạ thả tim → bỏ qua
chay(W1, S, tin('222', 'tich ma', 'Hoa'), gw);
const msg2 = gw.gui[gw.gui.length - 2].msgId;
const truoc = gw.gui.length;
chay(W1, S, tim('999', msg2), gw);
assert.strictEqual(gw.gui.length, truoc); assert.strictEqual(S.ma_tich.length, 1);
ok('người không được duyệt thả tim → bỏ qua');

// 5. Cùng ngày tích lần 2 → từ chối, không ghi
const nYc = S.yeu_cau.length;
chay(W1, S, tin('111', 'tích mã'), gw);
assert.ok(/hôm nay anh\/chị đã được tích/.test(gw.gui[gw.gui.length - 1].text)); assert.strictEqual(S.yeu_cau.length, nYc);
ok('1 mã/ngày');

// 6. Ghi Sheet lỗi → KHÔNG gửi tin
const S6 = sheetMoi(NHOM); const gw6 = { so: 0, gui: [] };
const W1loi = JSON.parse(JSON.stringify(W1));
W1loi.nodes.find(n => n.name === 'Them yeu_cau').parameters.sheetName.value = 'khong_co_tab';
r = chay(W1loi, S6, tin('333', 'tích mã'), gw6);
assert.ok(r.loi); assert.strictEqual(gw6.gui.length, 0);
ok('ghi Sheet lỗi → không gửi tin nào');

// 7. Đủ 3 mã → chúc mừng; đổi quà → QUÀ HỢP LỆ, 3 mã da_doi, doi_qua 1 dòng
['A1', 'A2'].forEach((m, i) => S.ma_tich.push({ ma: 'M-' + m, zalo_id: '111', ten_zalo: 'Lan', thoi_gian_duyet: '2026-11-0' + (i + 1) + ' 10:00:00',
  nguoi_duyet: 'Chủ quán', ma_yc: 'YC-' + m, trang_thai: 'con', ma_doi_qua: '' }));
chay(W1, S, tin('111', 'mã của tôi'), gw);
assert.ok(/3 mã/.test(gw.gui[gw.gui.length - 1].text));
chay(W1, S, tin('111', 'Đổi quà'), gw);
const t7 = gw.gui[gw.gui.length - 1].text;
assert.ok(/QUÀ HỢP LỆ/.test(t7) && /QUA-[A-Z0-9]{5}/.test(t7));
assert.strictEqual(S.ma_tich.filter(x => x.zalo_id === '111' && x.trang_thai === 'da_doi').length, 3);
assert.strictEqual(S.doi_qua.length, 1); assert.strictEqual(S.doi_qua[0].gia_tri_giam, 5000);
ok('xem mã + đổi quà');

// 8. Tin thử test- : ghi Sheet, KHÔNG gửi Zalo, msgId giả để thử thả tim
const S8 = sheetMoi(NHOM), gw8 = { so: 0, gui: [] };
chay(W1, S8, tin('test-tm-1', 'tích mã'), gw8);
assert.strictEqual(gw8.gui.length, 0); assert.strictEqual(S8.yeu_cau[0].msg_id_nhom, 'test-msg-' + S8.yeu_cau[0].ma_yc);
chay(W1, S8, tim(CHU, S8.yeu_cau[0].msg_id_nhom), gw8);
assert.strictEqual(gw8.gui.length, 0); assert.strictEqual(S8.ma_tich.length, 1); assert.strictEqual(S8.yeu_cau[0].trang_thai, 'da_duyet');
ok('chế độ thử test-: ghi Sheet, không gửi Zalo');

// 9. Tắt chức năng → không làm gì
const S9 = sheetMoi(NHOM); S9.cau_hinh[0].gia_tri = 'TAT'; const gw9 = { so: 0, gui: [] };
chay(W1, S9, tin('444', 'tích mã'), gw9);
assert.strictEqual(gw9.gui.length, 0); assert.strictEqual(S9.yeu_cau.length, 0);
ok('bat_chuc_nang=TAT → im lặng');

// 10. Quét quá hạn: yêu cầu > 30 phút → het_han + báo khách; không có → không gửi gì
const S10 = sheetMoi(NHOM), gw10 = { so: 0, gui: [] };
S10.yeu_cau.push({ ma_yc: 'YC-OLD', zalo_id: '555', ten_zalo: 'Mai', thoi_gian: '2020-01-01 10:00:00', msg_id_nhom: '9', trang_thai: 'cho_duyet', nguoi_duyet: '', thoi_gian_duyet: '' });
r = chay(W2, S10, null, gw10);
assert.ok(!r.loi, r.loi);
assert.strictEqual(S10.yeu_cau[0].trang_thai, 'het_han'); assert.strictEqual(gw10.gui.length, 1); assert.strictEqual(gw10.gui[0].threadId, '555');
r = chay(W2, S10, null, gw10); assert.strictEqual(gw10.gui.length, 1);
ok('quét quá hạn');

// 11. Tin nhóm (không phải user) → bỏ qua
const gw11 = { so: 0, gui: [] };
chay(W1, sheetMoi(NHOM), { event: 'message', threadId: NHOM, threadType: 'group', fromId: '1', text: 'tích mã' }, gw11);
assert.strictEqual(gw11.gui.length, 0);
ok('tin trong nhóm → bỏ qua');


// 12. Tên khách dạng NFD (dấu tách rời) → tin + tag tính trên chữ NFC, tag trỏ đúng "@Tên"
const S12 = sheetMoi(NHOM), gw12 = { so: 0, gui: [] };
const tenNFD = 'Thảo Vy'.normalize('NFD');
chay(W1, S12, tin('666', 'tích mã', tenNFD), gw12);
const g12 = gw12.gui[0], m12 = g12.mentions[0];
assert.strictEqual(g12.text, g12.text.normalize('NFC'));
assert.strictEqual(g12.text.substr(m12.pos, m12.len), '@Thảo Vy'.normalize('NFC'));
ok('tag đúng vị trí khi tên có dấu dạng NFD');

console.log('\nTICH MA N8N: TẤT CẢ ' + so + ' NHÓM KIỂM TRA OK');
