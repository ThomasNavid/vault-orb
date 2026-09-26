const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Vault}=require('../src/vault.cjs');const {readSpreadsheet,parseRange}=require('../src/spreadsheet.cjs');const ExcelJS=require('exceljs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-sheet-'));fs.mkdirSync(path.join(root,'vault'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new Vault(path.join(root,'vault'),path.join(root,'state'));}
test('CSV preserves quoted commas, multiline cells, blanks and bounded row coordinates',async t=>{
 const v=fixture(t);fs.writeFileSync(path.join(v.root,'Savings.csv'),'Month,Amount,Note\nJan,1000,"First, month"\nFeb,,"two\nlines"\nMar,-100,Actual\n');
 const inspect=await readSpreadsheet(v,{path:'Savings.csv'});assert.equal(inspect.sample[2][2],'two\nlines');
 const read=await readSpreadsheet(v,{path:'Savings.csv',range:'A2:C4'});assert.equal(read.rows[0].row,2);assert.equal(read.rows[1].values[1],'');assert.equal(read.rows[2].values[1],'-100');
 assert.equal(v.findFiles('savings').files[0].path,'Savings.csv');
});
test('XLSX returns sheet metadata, addresses and explicit cached formula results',async t=>{
 const v=fixture(t),workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Balances');sheet.addRow(['Month','Savings']);sheet.addRow(['Jan',1000]);sheet.getCell('B3').value={formula:'B2+500',result:1500};sheet.getCell('B3').numFmt='£#,##0.00';
 await workbook.xlsx.writeFile(path.join(v.root,'Balances.xlsx'));
 const inspect=await readSpreadsheet(v,{path:'Balances.xlsx'});assert.equal(inspect.sheets[0].name,'Balances');
 const data=await readSpreadsheet(v,{path:'Balances.xlsx',sheet:'Balances',range:'A2:B3'});assert.equal(data.rows[1].cells[1].value.cached_result,1500);assert.equal(data.rows[1].cells[1].address,'B3');assert.match(data.note,/not recalculate/);
 await assert.rejects(()=>readSpreadsheet(v,{path:'Balances.xlsx',sheet:'Missing',range:'A1:B2'}),/Sheet not found/);
});
test('spreadsheet reads enforce range size, formats and vault boundaries',async t=>{
 const v=fixture(t);assert.throws(()=>parseRange('A1:ZZ1000'),/smaller/);assert.throws(()=>parseRange('B5:A1'),/smaller/);assert.throws(()=>parseRange('A0:A1'));
 await assert.rejects(()=>readSpreadsheet(v,{path:'../private.csv',range:'A1:B2'}),/inside/);
 fs.symlinkSync('/private/tmp',path.join(v.root,'outside'));await assert.rejects(()=>readSpreadsheet(v,{path:'outside/secret.csv'}),/Symbolic/);
});
