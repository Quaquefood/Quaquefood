// Chạy: node tich-ma/test/kiem-tra.js (sau khi node tich-ma/build.js)
const assert=require('assert');const {ctx,sheets,props}=require('./gia-lap')();
const msg=ctx.caiDat();assert.match(msg,/NHÂN VIÊN: \d{6}/);const NV=props.PIN_NHAN_VIEN,CHU=props.PIN_CHU_QUAN;assert.notEqual(NV,CHU);
// đăng ký
let r=ctx.apiDangKy('Chị Hoa','0907 754 132','','');assert.ok(r.ok,r.loi);const the=r.the;assert.match(r.url,/\?the=/);
assert.match(ctx.apiDangKy('Người khác','+84907754132','','').loi,/đã có thẻ/);           // khách không lấy được thẻ người khác bằng SĐT
assert.equal(ctx.apiDangKy('Xa','0907754132',NV,'Lan').the,the);                          // nhân viên tra lại được
assert.match(ctx.apiDangKy('An','123','','').loi,/Số điện thoại/);
assert.match(ctx.apiDangKy('','0911111111','','').loi,/tên/);
// cộng mã
assert.match(ctx.apiCongMa(the,'35000','sai','Lan').loi,/Sai mật khẩu/);
assert.match(ctx.apiCongMa(the,'35000',NV,'').loi,/tên nhân viên/);
assert.match(ctx.apiCongMa(the,'25.000',NV,'Lan').loi,/chưa đủ 30.000đ/);
r=ctx.apiCongMa(the,'30.000',NV,'Lan');assert.ok(r.ok,r.loi);assert.equal(r.so_ma,1);assert.match(r.tin_nhan,/1\/3 mã/);
r=ctx.apiCongMa(the,'40000',NV,'Lan');assert.ok(r.can_xac_nhan);                         // chống bấm 2 lần
r=ctx.apiCongMa(the,'40000',NV,'Lan',true);assert.equal(r.so_ma,2);assert.ok(!r.du_qua);
assert.match(ctx.apiDoiQua(the,'Trà tắc',NV,'Lan').loi,/2\/3/);
r=ctx.apiCongMa(the,'50000',CHU,'Chủ',true);assert.equal(r.so_ma,3);assert.ok(r.du_qua);assert.match(r.tin_nhan,/ĐỦ MÃ/);
// báo cáo
assert.match(ctx.apiBaoCao(NV).loi,/chủ quán/);
let bc=ctx.apiBaoCao(CHU);assert.ok(bc.ok,bc.loi);assert.equal(bc.tk.ma_hom_nay,3);assert.equal(bc.can_nhac.length,1);assert.match(bc.can_nhac[0].tin_nhac,/đủ 3\/3/);
assert.equal(bc.tk.doanh_so_bill_thang,120000);assert.deepEqual(Object.assign({},bc.nv_hom_nay),{Lan:2,'Chủ':1});
// đổi quà
assert.match(ctx.apiDoiQua(the,'',NV,'Lan').loi,/Chọn món/);
r=ctx.apiDoiQua(the,'Trà tắc',NV,'Lan');assert.ok(r.ok,r.loi);assert.equal(r.so_ma,0);assert.equal(r.lich_su_qua.length,1);assert.match(r.ma_qua,/^QUA-/);
assert.match(ctx.apiDoiQua(the,'Trà tắc',NV,'Lan').loi,/0\/3/);                          // không đổi 2 lần
bc=ctx.apiBaoCao(CHU);assert.equal(bc.can_nhac.length,0);assert.equal(bc.tk.qua_hom_nay,1);assert.equal(bc.tk.tien_giam_thang,5000);
// thẻ công khai che SĐT
const t=ctx.apiThe(the);assert.equal(t.sdt,'090****132');assert.match(ctx.apiThe('ZZZZ').loi,/Không tìm thấy/);
// tìm kiếm không dấu
assert.equal(ctx.apiTim('hoa',NV).ds.length,1);assert.equal(ctx.apiTim('754',NV).ds.length,1);assert.match(ctx.apiTim('hoa','').loi,/Sai/);
// khóa thẻ
sheets.khach_hang.rows[1][5]='khoa';assert.match(ctx.apiCongMa(the,'35000',NV,'Lan',true).loi,/khóa/);sheets.khach_hang.rows[1][5]='hoat_dong';
// hết hạn + đổi cấu hình trong Sheet
sheets.cau_hinh.rows.find(x=>x[0]==='han_ma_ngay')[1]=30;
ctx.apiCongMa(the,'35000',NV,'Lan',true);sheets.ma_tich.rows[sheets.ma_tich.rows.length-1][5]=new Date(Date.now()-40*864e5);
assert.equal(ctx.apiThe(the).so_ma,0);assert.equal(ctx.apiThe(the).so_ma_het_han,1);
sheets.cau_hinh.rows.find(x=>x[0]==='so_ma_doi')[1]=5;assert.equal(ctx.apiThe(the).so_ma_doi,5);
// doGet
assert.match(ctx.doGet({parameter:{the:the}}).h,/"view":"the"/);assert.match(ctx.doGet({parameter:{}}).h,/"view":"dk"/);
console.log('LOGIC: TAT CA OK');
