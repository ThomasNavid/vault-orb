const fs=require('node:fs');
const YAML=require('yaml');
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
function definitions(vault) {
  const source=vault.habitScript??HABIT_SCRIPT;
  const file=vault.resolve(source,{note:false});
  if(!source.endsWith('.js')||fs.statSync(file).size>128*1024)throw new Error('Habit definitions must be a .js file up to 128 KB.');
  const script=fs.readFileSync(file,'utf8');
  // Read the existing Dataview literal as data. Never evaluate vault JavaScript.
  const literal=script.match(/^\s*const habits\s*=\s*(\[[\s\S]*?\]);\s*$/m)?.[1];
  if(!literal)throw new Error('Use a literal const habits = [...]; array in the habit dashboard script.');
  const parsed=YAML.parseDocument(literal,{uniqueKeys:true});
  if(parsed.errors.length)throw new Error('Habit definitions must contain plain literal data.');
  const data=parsed.toJS({maxAliasCount:0}),keys=new Set();
  if(!Array.isArray(data)||data.length>12)throw new Error('Define up to 12 habits.');
  const habits=data.map(h=>{
    if(!h||typeof h.key!=='string'||! /^[a-z][a-z0-9_]{0,63}$/.test(h.key)||['type','date','constructor','prototype','__proto__'].includes(h.key)||keys.has(h.key))throw new Error('Habit keys must be unique lowercase property names, excluding reserved fields.');
    keys.add(h.key);
    if(typeof h.label!=='string'||!h.label.trim()||h.label.length>80||!Number.isInteger(h.target)||h.target<1||h.target>7)throw new Error('Each habit needs a label and a weekly target from 1 to 7 days.');
    if(typeof h.color!=='string'||!/^#[a-f0-9]{6}$/i.test(h.color))throw new Error('Use six-digit hex habit colors.');
    if(typeof h.cadence!=='string'||h.cadence.length>80)throw new Error('Each habit needs a short cadence label.');
    return {key:h.key,label:h.label.trim(),target:h.target,cadence:h.cadence,color:h.color};
  });
  return {habits,definitions_version:hash(JSON.stringify(habits)),definitions_path:source};
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
  const base={today,date,year,range,week_start:weekStart(today),habits:[],weeks:[],records:[],warnings:[],selected:null};
  if(!vault.habitFolder)return {...base,setup:'Habits are disabled. Set a Habit log folder in Settings.'};
  let config;
  try {config=definitions(vault);folder(vault);} catch(e) {return {...base,setup:e.message};}
  if(!config.habits.length)return {...base,...config,setup:"Choose your habits using 99. System/Habit Setup.md. No activity has been recorded."};
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
  return {...base,...config,habits:config.habits.map(h=>({...h,week_count:weeks[0].counts[h.key],year_count:count(first,last,h.key),range_count:count(range.start,range.end,h.key)})),selected,weeks,records:[...records.values()],warnings,bad_dates:[...badDates]};
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
module.exports={HABIT_SCRIPT,definitions,listHabits,setHabit,ensureHabitRecord,addDays,weekStart};
