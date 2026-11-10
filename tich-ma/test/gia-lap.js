// Giả lập Google Sheet / Apps Script để chạy Code.gs trong Node
const fs=require('fs'),vm=require('vm');
module.exports=function(){
const sheets={};const props={};
function mk(name){const rows=[];return {rows,getLastRow:()=>rows.length,appendRow:r=>rows.push(r.map(v=>typeof v==='string'&&v[0]==="'"?v.slice(1):v)),
 getDataRange:()=>({getValues:()=>rows.length?rows.map(r=>r.slice()):[[]]}),setFrozenRows(){},
 getRange:(a,c,nr,nc)=>({setFontWeight(){},setValues:v=>{for(let k=0;k<nc;k++)rows[a-1][c-1+k]=v[0][k];}})};}
const pad=n=>String(n).padStart(2,'0');
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=mk(n)),getUrl:()=>'https://docs.google.com/spreadsheets/d/TEST'})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Logger:{log(){}},
 ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/macros/s/TEST/exec'})},
 HtmlService:{createHtmlOutput:h=>({h,setTitle(){return this},addMetaTag(){return this}})},
 Utilities:{formatDate:(d,tz,f)=>{d=new Date(d.getTime()+7*3600e3);return f.replace('yyyy',d.getUTCFullYear()).replace('MM',pad(d.getUTCMonth()+1)).replace('dd',pad(d.getUTCDate())).replace('HH',pad(d.getUTCHours())).replace('mm',pad(d.getUTCMinutes()));}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../Code.gs'),'utf8'),ctx);
return {ctx,sheets,props};};
