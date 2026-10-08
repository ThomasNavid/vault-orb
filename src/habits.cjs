const fs=require('node:fs');
const {parse}=require('acorn');
const {parseNote,localDate,dateValue,hash}=require('./vault.cjs');
const HABIT_SCRIPT='99. System/99.4 Scripts/habits/view.js';
function day(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Habit dates must use YYYY-MM-DD.');
  if(Number(value.slice(0,4))<1900)throw new Error('Choose a habit date from 1900 onwards.');
  return dateValue(value);
}
// Calendar arithmetic uses UTC noon on date-only strings, independent of DST.
function addDays(value,count) {const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
function weekStart(value) {return addDays(value,-((new Date(value+'T12:00:00Z').getUTCDay()+6)%7));}
const COLORS=['#31995b','#6387db','#d88b42','#ad78cb','#39a6a3','#ce708c'];
function parseDefinitions(script) {
  // Parse syntax only: vault JavaScript must never run in Orb.
  let ast;
  try {ast=parse(script,{ecmaVersion:'latest',allowAwaitOutsideFunction:true,allowReturnOutsideFunction:true});}
  catch {throw new Error('Habit dashboard syntax is unsupported. Use a literal const habits = [...]; array.');}
  const declarations=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations.map(d=>({kind:n.kind,...d}))).filter(n=>n.id.type==='Identifier'&&n.id.name==='habits');
  if(declarations.length!==1||declarations[0].kind!=='const'||declarations[0].init?.type!=='ArrayExpression')throw new Error('Use one top-level literal const habits = [...]; array in the habit dashboard script.');
  const array=declarations[0].init,keys=new Set();
  if(array.elements.length>12)throw new Error('Define up to 12 habits.');
  const habits=array.elements.map(node=>{
    if(node?.type!=='ObjectExpression')throw new Error('Habit definitions must contain plain literal data.');
    const h=Object.create(null);
    for(const p of node.properties) {
      const key=p.key?.type==='Identifier'?p.key.name:p.key?.value;
      if(p.type!=='Property'||p.computed||p.method||p.kind!=='init'||!['key','label','target','cadence','color'].includes(key)||Object.hasOwn(h,key)||p.value.type!=='Literal'||!['string','number'].includes(typeof p.value.value))throw new Error('Habit definitions must contain plain literal fields: key, label, target, cadence and color.');
      h[key]=p.value.value;
    }
    if(typeof h.key!=='string'||! /^[a-z][a-z0-9_]{0,63}$/.test(h.key)||['type','date','constructor','prototype','__proto__'].includes(h.key)||keys.has(h.key))throw new Error('Habit keys must be unique lowercase property names, excluding reserved fields.');
    keys.add(h.key);
    if(typeof h.label!=='string'||!h.label.trim()||h.label.length>80||!Number.isInteger(h.target)||h.target<1||h.target>7)throw new Error('Each habit needs a label and a weekly target from 1 to 7 days.');
    if(typeof h.color!=='string'||!/^#[a-f0-9]{6}$/i.test(h.color))throw new Error('Use six-digit hex habit colors.');
    if(typeof h.cadence!=='string'||h.cadence.length>80)throw new Error('Each habit needs a short cadence label.');
    return {key:h.key,label:h.label.trim(),target:h.target,cadence:h.cadence,color:h.color};
  });
  return {habits,array};
}
function definitions(vault) {
  const {content:script,version}=vault.readHabitScript();
  const {habits}=parseDefinitions(script);
  return {habits,definitions_version:hash(JSON.stringify(habits)),script_version:version,definitions_path:vault.habitScript};
}
function createHabit(vault,args) {
  return vault.withTaskLock(()=>{
    folder(vault);
    const source=vault.readHabitScript(),{habits,array}=parseDefinitions(source.content);
    if(args.script_version!==source.version)throw new Error('Habit dashboard changed. Refresh habits before adding.');
    if(typeof args.label!=='string'||!args.label.trim()||args.label.trim().length>80||/[\x00-\x1f\x7f]/.test(args.label))throw new Error('Choose a habit name of 1–80 characters on one line.');
    if(!Number.isInteger(args.target)||args.target<1||args.target>7)throw new Error('Choose a weekly target from 1 to 7 days.');
    const label=args.label.trim().replace(/\s+/g,' '),normal=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
    if(habits.some(h=>normal(h.label)===normal(label)))throw new Error('That habit already exists. Choose the existing habit or use a distinct name.');
    if(habits.length>=12)throw new Error('You can track up to 12 habits.');
    let stem=label.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    if(!/^[a-z]/.test(stem)||['type','date','constructor','prototype','__proto__'].includes(stem))stem='habit_'+stem;
    stem=stem.slice(0,56)||'habit';
    // Avoid reviving activity under an old property, including definitions removed externally.
    const used=new Set(habits.map(h=>h.key));
    for(const name of fs.readdirSync(folder(vault)))if(/^\d{4}-\d{2}-\d{2}\.md$/.test(name)) {
      try {
        const note=vault.read(`${vault.habitFolder}/${name}`);
        for(const key of Object.keys(parseNote(note.content).data))used.add(key);
      } catch(e) {throw new Error(`Could not check existing habit keys in ${name}. Fix this record before adding a habit: ${e.message}`);}
    }
    let key=stem;for(let n=2;used.has(key);n++)key=`${stem}_${n}`;
    const habit={key,label,target:args.target,cadence:args.target===7?'Daily':`${args.target} ${args.target===1?'day':'days'} a week`,color:COLORS.find(c=>!habits.some(h=>h.color.toLowerCase()===c))||COLORS[habits.length%COLORS.length]};
    const newline=source.content.includes('\r\n')?'\r\n':'\n';
    const at=array.elements.length?array.elements.at(-1).end:array.start+1;
    const literal='{ '+Object.entries(habit).map(([field,value])=>`${field}: ${JSON.stringify(value)}`).join(', ')+' }';
    const insertion=(array.elements.length?',':'')+newline+'  '+literal+newline;
    const after=source.content.slice(0,at)+insertion+source.content.slice(at);
    if(Buffer.byteLength(after)>128*1024)throw new Error('Habit dashboard would exceed 128 KB.');
    parseDefinitions(after);
    return {...vault.commit(vault.habitScript,source.content,after,'Habit added',{habitDefinitions:true}),habit};
  });
}
function folder(vault) {
  if(!vault.habitFolder)throw new Error('Habits are disabled. Set a Habit log folder in Settings.');
  const file=vault.resolve(vault.habitFolder,{note:false});
  if(!fs.statSync(file).isDirectory())throw new Error('Habit log path must be a folder.');
  return file;
}
function record(vault,date,habits) {
  const path=`${vault.habitFolder}/${date}.md`;
  const file=vault.resolve(path,{missing:true});
  if(!fs.existsSync(file))return {path,version:null,values:Object.fromEntries(habits.map(h=>[h.key,false])),note:null,parsed:null};
  const note=vault.read(path),parsed=parseNote(note.content);
  return {path,version:note.version,values:Object.fromEntries(habits.map(h=>[h.key,parsed.data[h.key]===true])),note,parsed};
}
function listHabits(vault,{date=null,year=null,end=null}={}) {
  const today=localDate();date=day(date||today);
  if(date>today)throw new Error('Future habit dates cannot be selected.');
  year=year??Number(date.slice(0,4));
  if(!Number.isInteger(year)||year<1900||year>Number(today.slice(0,4)))throw new Error('Choose a heatmap year between 1900 and the current year.');
  // The heatmap shows 13 Monday-aligned weeks ending with the week that contains `end`.
  // A year without an explicit window shows that year's final weeks.
  end=day(end||(String(year)===date.slice(0,4)?date:`${year}-12-31`));if(end>today)end=today;
  const rangeStart=addDays(weekStart(end),-7*12),range={start:rangeStart,end:addDays(weekStart(end),6)};
  const base={today,date,year,range,week_start:weekStart(today),habits:[],weeks:[],records:[],warnings:[],selected:null,can_create:false};
  if(!vault.habitFolder)return {...base,setup:'Habits are disabled. Set a Habit log folder in Settings.'};
  let config;
  try {config=definitions(vault);folder(vault);} catch(e) {return {...base,setup:e.message};}
  if(!config.habits.length)return {...base,...config,can_create:true,setup:'Choose your habits with Add habit. No activity has been recorded.'};
  const records=new Map(),warnings=[],badDates=new Set();
  const first=`${year}-01-01`,last=`${year}-12-31`,historyStart=addDays(base.week_start,-49),historyEnd=addDays(base.week_start,6);
  // Read only the selected year, heatmap window, recent weeks, and selected record, never bodies of unrelated notes.
  const needed=new Set([date]);
  for(const [from,to]of [[first,last],[historyStart,historyEnd],[range.start,range.end]])for(let d=from;d<=to&&d<=today;d=addDays(d,1))needed.add(d);
  for(const d of needed)try {
    const r=record(vault,d,config.habits);
    if(r.version) {
      records.set(d,{date:d,path:r.path,version:r.version,values:r.values});
      const {data}=r.parsed;
      if(data.date!==undefined&&data.date!==d||data.type!==undefined&&data.type!=='habit-log')warnings.push({path:r.path,error:'Filename determines the logged date; date/type metadata differs.'});
      for(const h of config.habits)if(data[h.key]!=null&&typeof data[h.key]!=='boolean')warnings.push({path:r.path,error:`${h.label} is not a YAML boolean; it does not count as complete.`});
    }
  }catch(e){badDates.add(d);warnings.push({path:`${vault.habitFolder}/${d}.md`,error:e.message});}
  const count=(start,end,key)=>[...records.values()].filter(r=>r.date>=start&&r.date<=end&&r.values[key]).length;
  const weeks=Array.from({length:8},(_,i)=>{const start=addDays(base.week_start,-7*i),end=addDays(start,6);return {start,end,current:i===0,counts:Object.fromEntries(config.habits.map(h=>[h.key,count(start,end,h.key)])),incomplete:[...badDates].some(d=>d>=start&&d<=end)};});
  const selected=badDates.has(date)?{path:`${vault.habitFolder}/${date}.md`,error:'This record could not be read. Fix it in Obsidian, then refresh.'}:records.get(date)||{date,path:`${vault.habitFolder}/${date}.md`,version:null,values:Object.fromEntries(config.habits.map(h=>[h.key,false]))};
  return {...base,...config,can_create:config.habits.length<12,habits:config.habits.map(h=>({...h,week_count:weeks[0].counts[h.key],year_count:count(first,last,h.key),range_count:count(range.start,range.end,h.key)})),selected,weeks,records:[...records.values()],warnings,bad_dates:[...badDates]};
}
function loadForWrite(vault,args) {
  const date=day(args.date);
  if(date>localDate())throw new Error('Future habit dates cannot be logged.');
  const config=definitions(vault);folder(vault);
  if(args.definitions_version!==config.definitions_version)throw new Error('Habit definitions changed. Refresh habits before editing.');
  const r=record(vault,date,config.habits);
  if(args.version!==r.version)throw new Error('Habit record changed. Refresh habits before editing.');
  return {date,config,r};
}
function contents(date,config,r,key,completed) {
  const parsed=r.parsed||parseNote(`---\ntype: habit-log\ndate: ${date}\n${config.habits.map(h=>`${h.key}: false`).join('\n')}\n---\n\n# ${date}\n\n[[Habits|Back to habits]]\n\n## Notes\n`);
  if(key)parsed.doc.set(key,completed);
  return `---\n${parsed.doc.toString()}---\n${parsed.body}`;
}
function setHabit(vault,args) {
  const {date,config,r}=loadForWrite(vault,args);
  if(!config.habits.some(h=>h.key===args.key))throw new Error('Unknown habit. Refresh habits and choose a listed key.');
  if(typeof args.completed!=='boolean')throw new Error('Completed must be true or false.');
  return vault.commit(r.path,r.note?.content??null,contents(date,config,r,args.key,args.completed),args.completed?'Habit recorded':'Habit completion removed');
}
function ensureHabitRecord(vault,args) {
  const {date,config,r}=loadForWrite(vault,args);
  if(r.note)return {path:r.path,version:r.version};
  return vault.commit(r.path,null,contents(date,config,r),'Habit record created');
}
module.exports={HABIT_SCRIPT,definitions,listHabits,createHabit,setHabit,ensureHabitRecord,addDays,weekStart};
