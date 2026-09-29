const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Vault,parseNote,localDate}=require('../src/vault.cjs');
const {definitions,listHabits,setHabit,ensureHabitRecord,addDays,weekStart,HABIT_SCRIPT}=require('../src/habits.cjs');
const {Agent,tools,instructions}=require('../src/agent.cjs');
const script=`const habits = [
 { key: "pull_ups", label: "Pull-ups", target: 7, cadence: "Daily", color: "#31995b" },
 { key: "study_mandarin", label: "Study Mandarin", target: 2, cadence: "Twice a week", color: "#6387db" }
];\nthrow new Error('Must never run');`;
function fixture(t,options={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-habits-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const folder of ['Life','Work','Goals','Habit Log','99. System/99.4 Scripts/habits'])fs.mkdirSync(path.join(root,folder),{recursive:true});
 fs.writeFileSync(path.join(root,HABIT_SCRIPT),script);
 return new Vault(root,path.join(root,'.state'),{folders:{life:'Life',business:'Work'},goalsFolder:'Goals',habitFolder:'Habit Log',rulesPath:'',...options});
}
function raw(v,date,content){fs.writeFileSync(path.join(v.root,v.habitFolder,`${date}.md`),content);}
function args(v,date,key='pull_ups',completed=true){const r=listHabits(v,{date});return {date,key,completed,version:r.selected.version,definitions_version:r.definitions_version};}
test('reads current literal definitions as data; viewing an empty year never writes',t=>{
 const v=fixture(t),r=listHabits(v);assert.deepEqual(r.habits.map(h=>h.key),['pull_ups','study_mandarin']);assert.equal(r.selected.version,null);assert.equal(r.habits[0].week_count,0);assert.equal(r.weeks.length,8);assert.equal(v.publicHistory().length,0);assert.deepEqual(fs.readdirSync(path.join(v.root,v.habitFolder)),[]);
});
test('record once per day, backfill, remove and undo exact original content',t=>{
 const v=fixture(t),date=addDays(localDate(),-1);
 raw(v,date,`---\ntype: habit-log # keep\ndate: ${date}\ncustom: untouched\npull_ups: false\nstudy_mandarin: true\n---\n\n## Notes\nMy own notes.\n`);
 const before=v.read(`Habit Log/${date}.md`).content;
 const change=setHabit(v,args(v,date));let r=listHabits(v,{date});assert.equal(r.selected.values.pull_ups,true);assert.equal(r.selected.values.study_mandarin,true);assert.equal(r.habits[0].year_count,1);
 setHabit(v,args(v,date));assert.equal(listHabits(v,{date}).habits[0].year_count,1);
 const removed=setHabit(v,args(v,date,'pull_ups',false));assert.equal(listHabits(v,{date}).selected.values.pull_ups,false);v.undo(removed.change_id);assert.equal(listHabits(v,{date}).selected.values.pull_ups,true);
 // Undo the repeated true write before the initial write.
 v.undo();v.undo(change.change_id);assert.equal(v.read(`Habit Log/${date}.md`).content,before);
});
test('new record uses current keys, preserves existing unknown keys and creation can be undone',t=>{
 const v=fixture(t),date=localDate(),result=setHabit(v,args(v,date,'study_mandarin'));
 const data=parseNote(v.read(result.path).content).data;assert.equal(data.study_mandarin,true);assert.equal(data.pull_ups,false);assert.equal(data.gym,undefined);assert.equal(data.date,date);
 v.undo(result.change_id);assert.equal(listHabits(v).selected.version,null);
 const opened=ensureHabitRecord(v,args(v,date));assert.equal(listHabits(v).selected.values.study_mandarin,false);assert.equal(v.publicHistory().filter(x=>x.status==='applied').length,1);
 assert.equal(ensureHabitRecord(v,args(v,date)).change_id,undefined);v.undo(opened.change_id);assert.equal(listHabits(v).records.length,0);
});
test('stale records, missing-record races and changed definitions cannot overwrite data',t=>{
 const v=fixture(t),date=localDate(),old=args(v,date);raw(v,date,'# Created in Obsidian\n');assert.throws(()=>setHabit(v,old),/changed/);
 const current=args(v,date);raw(v,date,'# External edit\n');assert.throws(()=>setHabit(v,current),/changed/);
 const latest=args(v,date);fs.writeFileSync(path.join(v.root,HABIT_SCRIPT),script.replace('target: 2','target: 3'));assert.throws(()=>setHabit(v,latest),/definitions changed/);assert.equal(v.publicHistory().length,0);
});
test('strict booleans, warnings and filename identity match the vault dashboard',t=>{
 const v=fixture(t),date=localDate();raw(v,date,`---\ntype: other\ndate: 2000-01-01\npull_ups: "true"\nstudy_mandarin: true\n---\n`);
 let r=listHabits(v);assert.equal(r.habits[0].week_count,0);assert.equal(r.habits[1].week_count,1);assert.equal(r.warnings.length,2);
 raw(v,date,'---\npull_ups: [\n---\n');r=listHabits(v);assert.ok(r.selected.error);assert.equal(r.weeks[0].incomplete,true);assert.deepEqual(r.bad_dates,[date]);assert.throws(()=>setHabit(v,{...argsSafe(r),date,key:'pull_ups',completed:true}));
 function argsSafe(r){return {version:r.selected.version,definitions_version:r.definitions_version};}
});
test('Monday weeks, leap days, year boundaries and daylight-saving transitions use calendar days',t=>{
 assert.equal(weekStart('2026-09-27'),'2026-09-21');assert.equal(weekStart('2026-09-28'),'2026-09-28');assert.equal(weekStart('2026-01-01'),'2025-12-29');
 assert.equal(addDays('2024-02-28',1),'2024-02-29');assert.equal(addDays('2024-02-29',1),'2024-03-01');assert.equal(addDays('2026-03-29',1),'2026-03-30');assert.equal(addDays('2025-12-31',1),'2026-01-01');
 const v=fixture(t),monday=weekStart(localDate()),sunday=addDays(monday,-1);raw(v,sunday,'---\npull_ups: true\n---\n');raw(v,monday,'---\npull_ups: true\n---\n');
 const r=listHabits(v,{date:'2024-02-29',year:2024});assert.equal(r.habits[0].week_count,1);assert.equal(r.weeks[1].counts.pull_ups,1);assert.equal(r.habits[0].year_count,0);assert.equal(r.date,'2024-02-29');
});
test('heatmap window covers 13 Monday weeks, crosses year boundaries and never runs past today',t=>{
 const v=fixture(t);raw(v,'2025-12-30','---\npull_ups: true\n---\n');raw(v,'2026-01-02','---\npull_ups: true\n---\n');
 const r=listHabits(v,{date:'2026-01-02',end:'2026-01-02'});assert.deepEqual(r.range,{start:'2025-10-06',end:'2026-01-04'});assert.equal(r.habits[0].range_count,2);assert.equal(r.habits[0].year_count,1);
 const today=localDate(),latest=listHabits(v,{end:addDays(today,400)});assert.equal(latest.range.end,addDays(weekStart(today),6));assert.equal(latest.range.start,addDays(weekStart(today),-84));
 assert.equal(listHabits(v,{date:'2026-01-02'}).range.end,'2026-01-04');
 assert.equal(listHabits(v,{date:'2026-01-02',year:2025}).range.end,'2026-01-04');
});
test('future dates, invalid dates, unknown keys and non-boolean writes are rejected before journaling',t=>{
 const v=fixture(t),date=localDate(),base=args(v,date);
 for(const change of [{date:addDays(date,1)},{date:'2026-02-30'},{date:'2026-01-01T00:00:00'},{key:'gym'},{completed:'true'},{key:'date'}])assert.throws(()=>setHabit(v,{...base,...change}));
 for(const query of [{date:addDays(date,1)},{year:1800},{year:2026.5},{year:9999}])assert.throws(()=>listHabits(v,query));assert.equal(v.publicHistory().length,0);
});
test('unsafe definitions fail closed without executing code or choosing fallback habits',t=>{
 const v=fixture(t);
 for(const bad of [script.replace('target: 2','target: 8'),script.replace('study_mandarin','pull_ups'),script.replace('"#31995b"','"url(evil)"'),script.replace('"pull_ups"','"date"'),'const habits = getHabits();']){
  fs.writeFileSync(path.join(v.root,HABIT_SCRIPT),bad);assert.throws(()=>definitions(v));assert.ok(listHabits(v).setup);
 }
});
test('optional setup, custom paths, folder separation and symlink boundary',t=>{
 const v=fixture(t);fs.rmSync(path.join(v.root,v.habitFolder),{recursive:true});v.validateTaskFolders();assert.match(listHabits(v).setup,/Not found/);
 v.habitFolder='';assert.match(listHabits(v).setup,/disabled/);
 for(const habitFolder of ['../escape','.hidden','Life','Goals/Sub'])assert.throws(()=>new Vault(v.root,v.stateDir,{folders:v.folders,goalsFolder:'Goals',habitFolder,rulesPath:''}));
 fs.symlinkSync(os.tmpdir(),path.join(v.root,'Escape'));v.habitFolder='Escape';assert.match(listHabits(v).setup,/Symbolic/);assert.throws(()=>v.validateTaskFolders(),/Symbolic/);
});
test('agent routes habit writes and undo to the native panel and clears state on other views',async t=>{
 const v=fixture(t),events=[],agent=new Agent({vault:v,getKey:()=>'',onActivity:e=>events.push(e)});
 await agent.execute('list_habits',{date:null,year:null});const change=await agent.execute('set_habit',args(v,localDate()));
 let last=events.filter(e=>e.kind==='visual').at(-1).visual;assert.equal(last.kind,'habits');assert.equal(last.selected.values.pull_ups,true);
 await agent.execute('undo_change',{change_id:change.change_id});last=events.filter(e=>e.kind==='visual').at(-1).visual;assert.equal(last.selected.version,null);
 await agent.execute('list_tasks',{scope:'today',date:null});assert.equal(agent.habitView,null);
 await agent.execute('list_habits',{});await agent.execute('dismiss_visual',{});assert.equal(agent.habitView,null);
 for(const name of ['list_habits','set_habit'])assert.ok(tools.some(t=>t.name===name));
 for(const deep of [false,true])assert.match(instructions(v,{deep}),/never assume fixed names/);
});
test('sample vault shares parseable definitions and starts without any habit completions',t=>{
 const state=fs.mkdtempSync(path.join(os.tmpdir(),'orb-habit-sample-'));t.after(()=>fs.rmSync(state,{recursive:true,force:true}));
 const v=new Vault(path.join(__dirname,'../vault-template'),state);v.validateTaskFolders();const r=listHabits(v);
 assert.match(r.setup,/Choose your habits/);assert.deepEqual(r.warnings,[]);assert.equal(r.records.length,0);assert.equal(r.habits.length,0);assert.equal(r.selected,null);
});
test('habit record symlinks, oversized notes and definition scripts cannot bypass vault boundaries',t=>{
 const v=fixture(t),date=localDate();fs.symlinkSync(path.join(v.root,HABIT_SCRIPT),path.join(v.root,v.habitFolder,`${date}.md`));
 const r=listHabits(v);assert.ok(r.selected.error);assert.match(r.warnings[0].error,/Symbolic/);
 assert.throws(()=>setHabit(v,{date,key:'pull_ups',completed:true,version:null,definitions_version:r.definitions_version}),/Symbolic/);
 fs.unlinkSync(path.join(v.root,v.habitFolder,`${date}.md`));raw(v,date,'x'.repeat(513*1024));assert.ok(listHabits(v).selected.error);
 fs.unlinkSync(path.join(v.root,HABIT_SCRIPT));fs.symlinkSync(path.join(v.root,v.habitFolder,`${date}.md`),path.join(v.root,HABIT_SCRIPT));assert.match(listHabits(v).setup,/Symbolic/);assert.equal(v.publicHistory().length,0);
});
