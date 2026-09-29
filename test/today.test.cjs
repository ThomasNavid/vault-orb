const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Vault,localDate}=require('../src/vault.cjs');
const {todaySnapshot}=require('../src/today.cjs');

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-today-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const folder of ['1. Portfolio','2. Hubs','3. Topics','4. Knowledge Library','Life','Work','Goals','Habit Log','Scripts','.obsidian/plugins/full-calendar-remastered'])fs.mkdirSync(path.join(root,folder),{recursive:true});
  fs.writeFileSync(path.join(root,'Scripts/habits.js'),'const habits = [{ key: "study", label: "Study", target: 3, cadence: "Three days", color: "#6387db" }];\n');
  return new Vault(root,path.join(root,'.state'),{folders:{life:'Life',business:'Work'},goalsFolder:'Goals',habitFolder:'Habit Log',habitScript:'Scripts/habits.js',rulesPath:''});
}
function note(v,relative,content){fs.writeFileSync(path.join(v.root,relative),content);}

test('Today combines source-backed sections and never creates a change record',async t=>{
  const v=fixture(t),date=localDate();
  const yesterday=new Date(`${date}T12:00:00`);yesterday.setDate(yesterday.getDate()-1);
  const due=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  note(v,'Life/Carry forward.md',`---\ntype: task\nplanned: ${date}\ndue: ${due}\ncompleted: false\n---\n`);
  note(v,'Work/Today only.md',`---\ntype: task\ndue: ${date}\ncompleted: false\n---\n`);
  note(v,'Goals/Portfolio.md',`---\ntype: goal\nstatus: Active\nreview: ${due}\nnext_task: "[[Life/Carry forward]]"\n---\n\n## Finish line\n\nPublish a portfolio.\n`);
  note(v,'Habit Log/'+date+'.md',`---\ntype: habit-log\ndate: ${date}\nstudy: true\n---\n`);
  const settings='.obsidian/plugins/full-calendar-remastered/data.json';
  note(v,settings,JSON.stringify({displayTimezone:'Europe/London',calendarSources:[{type:'ical',name:'Personal',url:'https://example.test/today-feed.ics'}]}));
  const compact=date.replaceAll('-','');
  const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:today@example.test\r\nDTSTART;VALUE=DATE:${compact}\r\nDTEND;VALUE=DATE:${compact}\r\nSUMMARY:Morning meeting\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  // All-day DTEND is exclusive, so use tomorrow for a one-day event.
  const tomorrow=new Date(`${date}T12:00:00`);tomorrow.setDate(tomorrow.getDate()+1);
  const next=`${tomorrow.getFullYear()}${String(tomorrow.getMonth()+1).padStart(2,'0')}${String(tomorrow.getDate()).padStart(2,'0')}`;
  const fetchImpl=async()=>({ok:true,headers:{get:()=>null},arrayBuffer:async()=>Buffer.from(ics.replace(`DTEND;VALUE=DATE:${compact}`,`DTEND;VALUE=DATE:${next}`))});
  const first=await todaySnapshot(v,{date,fetchImpl});
  assert.deepEqual(first.today.tasks.map(x=>x.title),['Carry forward','Today only']);
  assert.deepEqual(first.overdue.tasks.map(x=>x.title),['Carry forward']);
  assert.equal(first.goals.goals[0].needs_review,true);
  assert.equal(first.goals.goals[0].task.path,'Life/Carry forward.md');
  assert.equal(first.habits.selected.values.study,true);
  assert.equal(first.habits.habits[0].week_count,1);
  assert.deepEqual(first.calendar.items.map(x=>x.title),['Morning meeting']);
  assert.deepEqual(first.warnings,[]);
  assert.deepEqual(JSON.parse(JSON.stringify(first)),first);
  const second=await todaySnapshot(v,{date,fetchImpl});
  assert.deepEqual(second,first);
  assert.equal(fs.existsSync(v.journalFile),false);
});

test('Today isolates section failures and distinguishes missing setup from no activity',async t=>{
  const v=fixture(t),date=localDate();
  note(v,'Life/Do this.md',`---\ntype: task\nplanned: ${date}\n---\n`);
  note(v,'Goals/Bad.md','---\ntype: [\n---\n');
  fs.unlinkSync(path.join(v.root,'Scripts/habits.js'));
  note(v,'.obsidian/plugins/full-calendar-remastered/data.json','{bad json');
  const brokenTasks=new Proxy(v,{get(target,key){if(key==='tasks')return args=>args.scope==='overdue'?(()=>{throw new Error('Overdue unavailable');})():target.tasks(args);return Reflect.get(target,key);}});
  const result=await todaySnapshot(brokenTasks,{date});
  assert.equal(result.today.tasks[0].title,'Do this');
  assert.match(result.overdue.error,/Overdue unavailable/);
  assert.equal(result.goals.goals.length,0);
  assert.equal(result.goals.warnings[0].path,'Goals/Bad.md');
  assert.ok(result.habits.setup);
  assert.ok(result.calendar.error);
  for(const section of ['overdue','goals','habits','calendar'])assert.ok(result.warnings.some(w=>w.section===section));
  assert.equal(fs.existsSync(v.journalFile),false);
});

test('Today reports unconfigured calendar as setup',async t=>{
  const v=fixture(t),result=await todaySnapshot(v);
  assert.equal(result.calendar.items.length,0);
  assert.match(result.calendar.setup,/Connect a calendar/);
  assert.ok(result.warnings.some(w=>w.section==='calendar'&&w.error===result.calendar.setup));
});

test('Today reports configured Google calendars without a readable token',async t=>{
  const v=fixture(t);
  note(v,'.obsidian/plugins/full-calendar-remastered/data.json',JSON.stringify({calendarSources:[{type:'google',id:'personal',name:'Personal'}]}));
  const result=await todaySnapshot(v);
  assert.equal(result.calendar.items.length,0);
  assert.match(result.calendar.setup,/access token/);
  assert.ok(result.calendar.warnings.some(w=>w.calendar==='Google Calendar'));
});

test('Today resurfaces only explicitly dated knowledge without advancing dates or editing notes',async t=>{
 const v=fixture(t);note(v,'1. Portfolio/Draft.md','---\ntags: [portfolio]\nrevisit: 2026-09-28\n---\nDraft.');note(v,'4. Knowledge Library/Later.md','---\ntags: [knowledge]\nrevisit: 2026-10-02\n---\nLater.');note(v,'4. Knowledge Library/Undated.md','---\ntags: [knowledge]\n---\n');
 const result=await todaySnapshot(v,{date:'2026-09-29'});assert.deepEqual(result.knowledge.notes.map(n=>n.title),['Draft']);assert.equal(fs.existsSync(v.journalFile),false);
});
