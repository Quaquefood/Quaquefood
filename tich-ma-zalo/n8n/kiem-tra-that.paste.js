// KIỂM TRA TÍCH MÃ TRÊN n8n THẬT – dán vào tab n8n (javascript_tool), chạy nền, poll window.__TM_KT.
// Điều kiện: đã tạo + activate "TICH MA - Nhan su kien"; Sheet cau_hinh: bat_chuc_nang=BAT, nhom_khach_id, nguoi_duyet đã điền.
// (Bật BAT khi gateway còn TICHMA_ON=0 là an toàn: khách thật chưa tới được workflow này.)
// Mọi sự kiện dùng id test- → workflow ghi Sheet nhưng KHÔNG gửi Zalo. Xong: xóa các dòng test- trong Sheet.
// Sửa 3 hằng dưới cho đúng trước khi chạy:
const WF_ID = '<ID workflow TICH MA - Nhan su kien>';
const NHOM = '<nhom_khach_id>';
const NGUOI_DUYET = '306769430050266425';

window.__TM_KT = { trang_thai: 'dang_chay', buoc: [] };
(async () => {
  const h = { 'browser-id': localStorage.getItem('n8n-browserId') || '', 'content-type': 'application/json' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Giải nén dữ liệu execution (định dạng flatted của n8n)
  function unflat(s) {
    const a = JSON.parse(s), seen = new Map();
    const rv = (v) => {
      if (typeof v === 'string' && /^\d+$/.test(v)) return get(+v);
      return v;
    };
    function get(i) {
      if (seen.has(i)) return seen.get(i);
      const v = a[i];
      if (v === null || typeof v !== 'object') { seen.set(i, v); return v; }
      const o = Array.isArray(v) ? [] : {}; seen.set(i, o);
      for (const k of Object.keys(v)) o[k] = rv(v[k]);
      return o;
    }
    return get(0);
  }
  async function guiVaDoc(body) {
    const t0 = Date.now();
    await fetch('/webhook/tich-ma', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const khoa = body.msgId || (body.raw && body.raw.data && body.raw.data.msgId);
    for (let lan = 0; lan < 30; lan++) {
      await sleep(2000);
      const ds = await (await fetch('/rest/executions?filter=' + encodeURIComponent(JSON.stringify({ workflowId: WF_ID })) + '&limit=10', { credentials: 'include', headers: h })).json();
      const list = (ds.data && (ds.data.results || ds.data)) || [];
      for (const e of list) {
        if (new Date(e.startedAt).getTime() < t0 - 5000) continue;
        if (['running', 'new', 'waiting'].indexOf(e.status) >= 0) continue;
        const d = (await (await fetch('/rest/executions/' + e.id, { credentials: 'include', headers: h })).json()).data;
        const run = unflat(d.data).resultData;
        const b = (((run.runData['Nhan tich ma'] || [])[0] || {}).data || {}).main;
        const bd = b && b[0] && b[0][0] && b[0][0].json.body;
        const k2 = bd && (bd.msgId || (bd.raw && bd.raw.data && bd.raw.data.msgId));
        if (k2 !== khoa) continue;
        const xl = (((run.runData['Xu ly'] || [])[0] || {}).data || {}).main;
        return { status: e.status, loi: run.error && run.error.message, xl: xl && xl[0] && xl[0][0] && xl[0][0].json };
      }
    }
    return { status: 'khong_thay_execution' };
  }
  const ts = Date.now(), uid = 'test-tm-' + ts;
  const tin = (text, i) => ({ event: 'message', threadId: uid, threadType: 'user', msgId: uid + '-m' + i, fromId: uid, fromName: 'Khach thu', text });
  const tim = (ai, gMsg, i) => ({ event: 'reaction', raw: { threadId: NHOM, isSelf: false, isGroup: true,
    data: { uidFrom: ai, dName: 'x', msgId: uid + '-r' + i, content: { rIcon: '/-heart', rMsg: [{ gMsgID: gMsg }] } } } });
  const KQ = window.__TM_KT.buoc;
  const buoc = async (ten, body, kiem) => {
    const r = await guiVaDoc(body);
    let ok = r.status === 'success' && !!r.xl, ly = r.loi || r.status;
    if (ok) { try { const m = kiem(r.xl); if (m !== true) { ok = false; ly = m; } } catch (e) { ok = false; ly = e.message; } }
    KQ.push({ ten, ok, ly: ok ? '' : ly, ket_qua: r.xl && r.xl.ket_qua, tin: r.xl && (r.xl.tin || []).map(t => t.den + ': ' + String(t.text).slice(0, 90)) });
    return r.xl || {};
  };
  const x1 = await buoc('tích mã → tin nhóm có tag + ghi yeu_cau', tin('tích mã', 1), x =>
    (x.tin.length === 2 && x.tin[0].den === 'group' && x.tin[0].threadId === NHOM && x.tin[0].mentions[0].uid === uid &&
     /Quán xác nhận ❤️ là mã sẽ được gửi riêng/.test(x.tin[0].text) && x.ghi.some(g => g.tab === 'yeu_cau' && g.kieu === 'them')) || 'sai nội dung');
  const maYc = ((x1.ghi || []).find(g => g.tab === 'yeu_cau') || { dong: {} }).dong.ma_yc;
  await sleep(3000);
  await buoc('tim của người duyệt → cấp mã', tim(NGUOI_DUYET, 'test-msg-' + maYc, 1), x =>
    (x.ket_qua === 'da_duyet' && x.ghi.some(g => g.tab === 'ma_tich' && g.kieu === 'them') && /M-[A-Z0-9]{5}/.test(x.tin[0].text)) || 'không cấp mã');
  await buoc('tim lần 2 → bỏ qua', tim(NGUOI_DUYET, 'test-msg-' + maYc, 2), x => (x.ket_qua === 'da_xu_ly' && !x.tin.length) || 'cấp trùng');
  await buoc('tim người lạ → bỏ qua', tim('999999', 'test-msg-' + maYc, 3), x => (x.ket_qua === 'khong_phai_nguoi_duyet') || 'nhận tim người lạ');
  await buoc('tích mã lần 2 trong ngày → từ chối', tin('tich ma', 2), x => (/hôm nay/.test(x.tin[0].text) && !x.ghi.length) || 'không chặn 1 mã/ngày');
  await buoc('mã của tôi → 1/3', tin('mã của tôi', 3), x => /1\/3/.test(x.tin[0].text) || 'sai số mã');
  await buoc('đổi quà khi chưa đủ → từ chối', tin('đổi quà', 4), x => (/chưa đủ/.test(x.tin[0].text) && !x.ghi.length) || 'cho đổi sai');
  window.__TM_KT.trang_thai = 'xong';
  window.__TM_KT.tong = KQ.filter(b => b.ok).length + '/' + KQ.length + ' OK';
  window.__TM_KT.zalo_id_thu = uid;
})().catch(e => { window.__TM_KT.trang_thai = 'loi'; window.__TM_KT.loi = String(e && e.message || e); });
