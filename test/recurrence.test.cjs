const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const R=require('../src/recurrence.cjs'),{Vault}=require('../src/vault.cjs'),{adapter}=require('../src/recurring-obsidian.cjs'),{acquire}=require('../src/task-lock.cjs');
const today='2026-09-29';
const rule=(o={})=>({version:1,mode:'fixed',unit:'week',interval:1,weekdays:['monday'],date_field:'planned',anchor:'2026-09-07',occurrence:'2026-09-07',...o});
function text(r=rule(),planned=r.occurrence,due=null){let t=R.create({title:'Recurring action',list:'life',planned,due,details:'Keep **my notes**.'}).text;t=t.replace('type: task','type: task # preserve');return R.transform(t,{action:'configure',rule:r,operation_id:'setup'},{today}).text;}
function transition(t,args){return R.transform(t,{action:'complete',date:today,occurrence:R.parse(t).data.recurrence?.occurrence,operation_id:crypto.randomUUID(),...args},{today,recordedAt:today+'T12:00:00Z'});}
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-recurrence-')),root=path.join(dir,'vault');for(const f of ['0. Home/Life Tasks','0. Home/Business Tasks'])fs.mkdirSync(path.join(root,f),{recursive:true});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new Vault(root,path.join(dir,'state'));}
function obsidian(vault){const file=relative=>({path:relative,basename:path.basename(relative,'.md')});return {vault:{adapter:{getBasePath:()=>vault.root},getMarkdownFiles:()=>vault.walk().map(file),getAbstractFileByPath:relative=>fs.existsSync(path.join(vault.root,relative))?file(relative):null,read:async f=>fs.readFileSync(path.join(vault.root,f.path),'utf8'),process:async(f,fn)=>{const p=path.join(vault.root,f.path);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));},create:async(p,content)=>{fs.writeFileSync(path.join(vault.root,p),content,{flag:'wx'});return file(p);}},workspace:{getLeaf:()=>({openFile:async()=>{}})}};}
test('fixed recurrence preserves cadence after late/early completions and multi-week weekdays',()=>{
 assert.equal(R.next(rule(),today),'2026-10-05');assert.equal(R.next(rule({occurrence:'2026-10-05'}),today),'2026-10-12');
 const r=rule({interval:2,weekdays:['monday','friday']});assert.equal(R.next(r,'2026-09-07'),'2026-09-11');assert.equal(R.next(r,'2026-09-11'),'2026-09-21');
 assert.equal(R.next(rule({unit:'day',weekdays:[],interval:3}),'2026-09-08'),'2026-09-10');
});
test('month ends and leap years retain fixed anchors, completion-relative intervals use completion',()=>{
 const month=rule({unit:'month',weekdays:[],anchor:'2024-01-31',occurrence:'2024-01-31'});
 assert.equal(R.next(month,'2024-01-31'),'2024-02-29');assert.equal(R.next({...month,occurrence:'2024-02-29'},'2024-02-29'),'2024-03-31');
 const year={...month,unit:'year',anchor:'2024-02-29',occurrence:'2024-02-29'};assert.equal(R.next(year,'2024-02-29'),'2025-02-28');assert.equal(R.next({...year,occurrence:'2027-02-28'},'2027-02-28'),'2028-02-29');
 assert.equal(R.next(rule({mode:'completion',weekdays:[],unit:'month',interval:3}),'2026-09-29'),'2026-12-29');
 assert.equal(R.addDays('2026-03-28',2),'2026-03-30');assert.equal(R.addDays('2026-10-24',2),'2026-10-26');
});
test('completion moves dates together and portable reversal preserves notes and history',()=>{
 const initial=text(rule(),'2026-09-07','2026-09-09'),done=transition(initial,{date:'2026-09-08'}),data=R.parse(done.text).data;
 assert.equal(data.planned,'2026-09-14');assert.equal(data.due,'2026-09-16');assert.equal(data.completed,false);assert.equal(data.recurrence_history.length,2);assert.match(done.text,/# preserve/);assert.match(done.text,/Keep \*\*my notes\*\*/);
 const undone=transition(done.text,{action:'undo'}),restored=R.parse(undone.text).data;assert.equal(restored.planned,'2026-09-07');assert.equal(restored.due,'2026-09-09');assert.equal(restored.recurrence_history.at(-1).action,'undo');assert.equal(R.inspect(undone.text,today).last_completion,null);
 assert.equal(R.parse(transition(undone.text,{date:'2026-09-08'}).text).data.planned,'2026-09-14');
});
test('postponing one occurrence preserves fixed anchor; date null is unchanged',()=>{
 const moved=transition(text(),{action:'reschedule',planned:'2026-09-10',due:null});assert.equal(R.parse(moved.text).data.recurrence.anchor,'2026-09-07');assert.equal(transition(moved.text,{date:'2026-09-10'}).next,'2026-09-14');
 assert.throws(()=>transition(text(),{action:'reschedule',planned:''}),/Keep the repeat date/);
});
test('idempotency, future/backwards dates, missing dates and unsupported rules fail without edits',()=>{
 const initial=text(),args={action:'complete',occurrence:'2026-09-07',date:'2026-09-08',operation_id:'one'},done=R.transform(initial,args,{today});assert.equal(R.transform(done.text,args,{today}).duplicate,true);
 assert.throws(()=>R.transform(done.text,{...args,date:'2026-09-09'},{today}),/reused/);assert.throws(()=>transition(initial,{date:'2026-10-01'}),/Future/);assert.throws(()=>transition(done.text,{date:'2026-09-07'}),/precedes/);
 assert.throws(()=>R.rule(rule({interval:0})),/interval/);assert.throws(()=>R.rule(rule({version:2})),/version/);assert.throws(()=>R.day('2026-02-30'),/Invalid/);
 assert.throws(()=>transition(initial.replace('planned: 2026-09-07','planned: null')),/missing/);
 const bad=initial.replace('version: 1','version: 7');assert.match(R.inspect(bad,today).recurrence_error,/version/);assert.equal(R.parse(transition(bad,{action:'stop'}).text).data.recurrence,undefined);
});
test('external completion needs a date and can be cancelled; goal/calendar linked tasks are protected',()=>{
 const external=text().replace('completed: false','completed: true');assert.equal(R.inspect(external,today).advance_needed,true);
 assert.throws(()=>transition(external,{date:null}),/Choose the date/);assert.equal(R.parse(transition(external,{action:'cancel'}).text).data.completed,false);
 assert.equal(transition(external,{date:'2026-09-08'}).next,'2026-09-14');
 assert.throws(()=>transition(text().replace('category: Inbox','category: Inbox\ncalendar_block: {id: event}')),/linked calendar block/);
});
test('undo refuses a changed schedule or date; skips do not count as completions',()=>{
 const done=transition(text(),{date:'2026-09-08'}),moved=transition(done.text,{action:'reschedule',planned:'2026-09-16'});assert.throws(()=>transition(moved.text,{action:'undo'}),/cannot be undone/);
 const skip=transition(text(),{action:'skip',date:'2026-09-08'});assert.equal(R.inspect(skip.text,today).last_completion,null);assert.equal(skip.next,'2026-09-14');
});
test('vault completion uses same-note history, rejects stale writes, and Activity undo is exact',t=>{
 const v=fixture(t),made=v.createTask({title:'Bins',list:'life',planned:'2026-09-07',recurrence:rule()}),original=v.read(made.path);
 const done=v.updateTask({path:made.path,version:made.version,completed:true});assert.equal(v.tasks().tasks.length,1);assert.equal(v.tasks().tasks[0].completed,false);assert.ok(v.tasks().tasks[0].last_completion);
 assert.throws(()=>v.updateTask({path:made.path,version:made.version,completed:true}),/changed/);v.undo(done.change_id);assert.equal(v.read(made.path).content,original.content);
});
test('Obsidian alone creates, completes, skips, edits, stops and undoes; Orb reads the same records',async t=>{
 const v=fixture(t),api=adapter(obsidian(v),{fs,crypto}),made=await api.create({title:'Bins',list:'life',planned:'2026-09-07',recurrence:rule()});let task=(await api.list()).tasks[0];
 const done=await api.write({path:made.path,version:task.version,action:'complete',operation_id:'obsidian-complete',occurrence:task.recurrence.occurrence,date:'2026-09-08'});assert.equal(done.next,'2026-09-14');assert.equal(v.tasks().tasks[0].planned,'2026-09-14');assert.equal(v.publicHistory().length,0);
 task=v.tasks().tasks[0];v.recurringTask({path:task.path,version:task.version,action:'undo',operation_id:'orb-undo'});task=(await api.list()).tasks[0];assert.equal(task.planned,'2026-09-07');
 const done2=v.recurringTask({path:task.path,version:task.version,action:'complete',operation_id:'orb-complete',occurrence:task.recurrence.occurrence,date:'2026-09-08'});task=(await api.list()).tasks[0];await api.write({path:task.path,version:task.version,action:'undo',operation_id:'obsidian-undo'});assert.equal(v.tasks().tasks[0].planned,'2026-09-07');assert.ok(done2.change_id);
 task=(await api.list()).tasks[0];await api.write({path:task.path,version:task.version,action:'skip',operation_id:'obsidian-skip',occurrence:task.recurrence.occurrence,date:'2026-09-08'});task=(await api.list()).tasks[0];await api.write({path:task.path,version:task.version,action:'stop',operation_id:'obsidian-stop'});assert.equal(v.tasks().tasks[0].recurrence,null);
});
test('both adapters share an exclusive lock and release it after failures',async t=>{
 const v=fixture(t),api=adapter(obsidian(v),{fs,crypto}),release=acquire(fs,v.root);assert.throws(()=>v.createTask({title:'Blocked',list:'life'}),/in progress/);await assert.rejects(()=>api.create({title:'Blocked',list:'life'}),/in progress/);release();
 await assert.rejects(()=>api.create({title:'',list:'life'}),/title/);assert.ok(!fs.existsSync(path.join(v.root,'.orb-task-write.lock')));
 const created=await api.create({title:'Allowed',list:'life',planned:'2026-09-07',recurrence:rule()});assert.ok(created.path);
});
test('Obsidian catches stale reads inside process and does not lose concurrent supported completions',async t=>{
 const v=fixture(t),api=adapter(obsidian(v),{fs,crypto}),made=await api.create({title:'Bins',list:'life',planned:'2026-09-07',recurrence:rule()}),task=(await api.list()).tasks[0];
 const args={path:made.path,version:task.version,action:'complete',occurrence:task.recurrence.occurrence,date:'2026-09-08',operation_id:'race-a'};
 const results=await Promise.allSettled([api.write(args),api.write({...args,operation_id:'race-b'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(v.tasks().tasks[0].recurrence_history.filter(e=>e.action==='complete').length,1);
 assert.equal((await api.write(args)).duplicate,true);
 await assert.rejects(()=>api.write({...args,operation_id:'race-c'}),/Occurrence changed|changed/);
});
test('distributed bundle works without Node and shares identical date and mutation results',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/recurring-bundle.js'),'utf8'),context={window:{},TextEncoder,console};vm.runInNewContext(source,context);const bundled=context.window.OrbRecurring.core;
 for(const r of [rule(),rule({unit:'month',weekdays:[],anchor:'2024-01-31',occurrence:'2024-01-31'}),rule({mode:'completion',weekdays:[]})])assert.equal(bundled.next(r,today),R.next(r,today));
 const initial=text(),args={action:'complete',date:'2026-09-08',occurrence:'2026-09-07',operation_id:'same'},options={today,recordedAt:today+'T12:00:00Z'};assert.equal(bundled.transform(initial,args,options).text,R.transform(initial,args,options).text);
 assert.equal(fs.readFileSync(path.join(__dirname,'../vault-template/99. System/99.4 Scripts/recurring-tasks/bundle.js'),'utf8'),source);
 // Same loading expression used by the Dataview view; comments must not trigger return ASI.
 const loaded=vm.runInNewContext('(new Function('+JSON.stringify('return ('+source+');')+'))()',context);assert.equal(loaded.core.next(rule(),today),'2026-10-05');
});
test('installer is additive, preserves customised files and task folders, rejects symlinks',t=>{
 const v=fixture(t),{installRecurring}=require('../src/recurring-install.cjs');const first=installRecurring(v);assert.equal(first.created.length,6);assert.equal(installRecurring(v).created.length,0);
 const p=path.join(v.root,first.path);fs.writeFileSync(p,'My customised dashboard');assert.ok(installRecurring(v).conflicts.includes(first.path));assert.equal(fs.readFileSync(p,'utf8'),'My customised dashboard');
 fs.unlinkSync(p);fs.symlinkSync(path.join(v.root,'0. Home/Business Tasks'),p);assert.throws(()=>installRecurring(v),/Symbolic/);
});
test('malformed history stays visible, timed recurrence is rejected and read operations do not write',async t=>{
 const v=fixture(t),made=v.createTask({title:'Broken',list:'life',planned:'2026-09-07',recurrence:rule()}),file=path.join(v.root,made.path);let raw=v.read(made.path).content;const doc=R.parse(raw);doc.doc.set('recurrence_history','broken');raw='---\n'+doc.doc.toString()+'---\n'+doc.body;fs.writeFileSync(file,raw);
 const before=fs.readFileSync(file,'utf8');const task=v.tasks().tasks[0];assert.ok(task.recurrence_error);assert.equal(task.title,'Broken');const api=adapter(obsidian(v),{fs,crypto});assert.ok((await api.list()).tasks[0].recurrence_error);assert.equal(fs.readFileSync(file,'utf8'),before);
 assert.throws(()=>v.createTask({title:'Timed',list:'life',planned:'2026-09-07T09:00:00',recurrence:rule()}),/date-only/);assert.equal(v.tasks().tasks.length,1);
});
test('agent opens recurring controls and completes through the shared vault service without an API key',async t=>{
 const v=fixture(t),{Agent}=require('../src/agent.cjs'),events=[],agent=new Agent({vault:v,getKey:()=>'',onActivity:e=>events.push(e)});
 const made=await agent.execute('create_task',{title:'Weekly',list:'life',planned:'2026-09-07',recurrence:rule()});await agent.execute('list_recurring_tasks',{});assert.equal(events.filter(e=>e.kind==='visual').at(-1).visual.kind,'recurring');
 const result=await agent.execute('recurring_task',{path:made.path,version:made.version,action:'complete',operation_id:'agent-complete',occurrence:'2026-09-07',date:'2026-09-08',rule:null,planned:null,due:null});assert.equal(result.next,'2026-09-14');assert.equal(v.tasks().tasks[0].last_completion.date,'2026-09-08');
});
test('Today exposes earlier planned and externally completed recurrence without redefining today',async t=>{
 const v=fixture(t),{todaySnapshot}=require('../src/today.cjs'),a=v.createTask({title:'Earlier planned',list:'life',planned:'2026-09-07',recurrence:rule()}),b=v.createTask({title:'External completion',list:'business',planned:'2026-09-07',recurrence:rule()});
 fs.writeFileSync(path.join(v.root,b.path),v.read(b.path).content.replace('completed: false','completed: true'));
 const result=await todaySnapshot(v,{date:today});assert.deepEqual(result.today.tasks,[]);assert.deepEqual(result.overdue.tasks,[]);assert.deepEqual(result.recurring.tasks.map(t=>t.title).sort(),['Earlier planned','External completion']);assert.equal(v.read(a.path).version,a.version);
});
test('custom folders travel in the Obsidian installer configuration and one-off notes remain untouched',async t=>{
 const v=fixture(t),{installRecurring}=require('../src/recurring-install.cjs');v.folders={life:'Personal/Actions',business:'Work/Actions'};for(const f of Object.values(v.folders))fs.mkdirSync(path.join(v.root,f),{recursive:true});
 installRecurring(v);const config=v.read('99. System/99.4 Scripts/recurring-tasks/config.md').content;assert.match(config,/Personal\/Actions/);const api=adapter(obsidian(v),{fs,crypto,folders:v.folders});const made=await api.create({title:'Repeat',list:'life',planned:'2026-09-07',recurrence:rule()});assert.match(made.path,/^Personal\/Actions\//);assert.equal(v.tasks().tasks.length,1);
 const once=v.createTask({title:'Once',list:'life'}),raw=v.read(once.path).content;await api.list();assert.equal(v.read(once.path).content,raw);
});
