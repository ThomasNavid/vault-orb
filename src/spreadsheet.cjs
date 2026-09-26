const fs=require('node:fs'),path=require('node:path'),{parse}=require('csv-parse/sync');
const MAX_BYTES=20*1024*1024, MAX_CELLS=4000;
function columnIndex(s){let n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n;}
function parseRange(range){
  const m=(range||'A1:T100').toUpperCase().match(/^([A-Z]{1,3})([1-9]\d{0,6}):([A-Z]{1,3})([1-9]\d{0,6})$/);
  if(!m)throw new Error('Use an A1 range such as A1:D100.');
  const bounds={left:columnIndex(m[1]),top:+m[2],right:columnIndex(m[3]),bottom:+m[4]};
  if(bounds.left>bounds.right||bounds.top>bounds.bottom||(bounds.right-bounds.left+1)*(bounds.bottom-bounds.top+1)>MAX_CELLS)throw new Error('Read a smaller range, up to 4,000 cells.');
  return bounds;
}
function scalar(value){
  if(value===null||value===undefined)return null;
  if(value instanceof Date)return value.toISOString();
  if(typeof value==='object'){
    if('formula' in value||'sharedFormula' in value)return {formula:value.formula||value.sharedFormula,cached_result:scalar(value.result),note:'Cached value; formulas are not recalculated.'};
    if('richText'in value)return value.richText.map(r=>r.text).join('');
    if('text'in value)return value.text;
    if('error'in value)return {error:value.error};
    return String(value);
  }
  return typeof value==='string'?value.slice(0,4000):value;
}
async function readSpreadsheet(vault,{path:relative,sheet=null,range=null}){
  const file=vault.resolve(relative,{note:false}),ext=path.extname(file).toLowerCase();
  if(!['.xlsx','.csv','.tsv'].includes(ext))throw new Error('Supported spreadsheet formats: .xlsx, .csv and .tsv.');
  if(fs.statSync(file).size>MAX_BYTES)throw new Error('Spreadsheet exceeds the 20 MB limit.');
  if(ext!=='.xlsx'){
    const delimiter=ext==='.tsv'?'\t':',';
    const content=fs.readFileSync(file,'utf8');
    if(!range){const sample=parse(content,{delimiter,bom:true,relax_column_count:true,to:5,skip_empty_lines:false});return {path:relative,format:ext.slice(1),sheets:[{name:'Data'}],sample,advice:'Read a bounded range with read_spreadsheet, for example A1:D100. CSV values are returned as stored strings; do not assume currency or date formats.'};}
    const b=parseRange(range);
    const records=parse(content,{delimiter,bom:true,relax_column_count:true,to:b.bottom,skip_empty_lines:false,max_record_size:1000000});
    const rows=records.slice(b.top-1,b.bottom).map((row,i)=>({row:b.top+i,values:Array.from({length:b.right-b.left+1},(_,j)=>row[b.left-1+j]??null)}));
    return {path:relative,sheet:'Data',range,rows,returnedRows:rows.length,note:'CSV strings as stored. Blank cells are missing values, not zero.'};
  }
  const ExcelJS=require('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);
  const sheets=workbook.worksheets.map(w=>({name:w.name,rows:w.rowCount,columns:w.columnCount}));
  if(!range)return {path:relative,sheets,advice:'Choose a sheet name and read a bounded range (up to 4,000 cells).'};
  const ws=sheet?workbook.getWorksheet(sheet):workbook.worksheets[0];if(!ws)throw new Error('Sheet not found. Inspect the workbook first.');
  const b=parseRange(range),rows=[];
  for(let r=b.top;r<=Math.min(b.bottom,ws.rowCount);r++){
    const cells=[];for(let c=b.left;c<=b.right;c++){const cell=ws.getCell(r,c);cells.push({address:cell.address,value:scalar(cell.value),display:cell.text,numFmt:cell.numFmt||null});}
    rows.push({row:r,cells});
  }
  return {path:relative,sheet:ws.name,range,rows,sheets,note:'Formula results are cached and may be stale; this reader does not recalculate. Missing cells are null. Cite the sheet and range in a visual source.'};
}
module.exports={readSpreadsheet,parseRange};
