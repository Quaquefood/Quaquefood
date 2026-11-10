// Ghép src/server.gs + src/trang.html thành 1 file Code.gs để dán vào Apps Script.
// Chạy: node tich-ma/build.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const server = fs.readFileSync(path.join(dir, 'src/server.gs'), 'utf8');
const html = fs.readFileSync(path.join(dir, 'src/trang.html'), 'utf8');
if (html.includes('`') || html.includes('${')) throw new Error('trang.html không được chứa dấu ` hoặc ${');
if (!server.includes('__TRANG_HTML__')) throw new Error('Thiếu chỗ đặt __TRANG_HTML__ trong server.gs');
const out = '// FILE TỰ SINH từ tich-ma/src – sửa ở src rồi chạy: node tich-ma/build.js\n' +
  server.replace('__TRANG_HTML__', () => html);
fs.writeFileSync(path.join(dir, 'Code.gs'), out);
console.log('Đã tạo tich-ma/Code.gs (' + out.length + ' ký tự)');
