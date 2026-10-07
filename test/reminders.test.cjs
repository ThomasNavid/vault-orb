const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Vault,FOLDERS,parseNote}=require('../src/vault.cjs');
const {RemindersSync,notesFor,identity}=require('../src/reminders.cjs');
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-reminders-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const root=path.join(dir,'vault');for(const folder of Object.values(FOLDERS))fs.mkdirSync(path.join(root,folder),{recursive:true});
  const vault=new Vault(root,path.join(dir,'history'),{rulesPath:''}),rows=[],writes=[],changes=[];let config={},revision=0,failAfterCreate=false,busy=false,beforeSave;
  const adapter={connect:async()=>({granted:true}),lists:async()=>[{id:'L',title:'Life',account:'iCloud'},{id:'B',title:'Business',account:'iCloud'}],read:async()=>structuredClone(rows),save:async input=>{
    if(beforeSave)await beforeSave(input);
    let row=rows.find(r=>r.id===input.id);
    if(input.id&&(!row||row.version!==input.expected))throw new Error('Reminder changed during sync.');
    if(!row){row={id:'R'+(++revision),listId:input.listId,title:'',notes:'',due:null,completed:false,recurring:false,version:String(++revision)};rows.push(row);}
    Object.assign(row,input.fields,{version:String(++revision)});writes.push(structuredClone(input));
    if(failAfterCreate&&!input.id){failAfterCreate=false;throw new Error('Connection lost after creation.');}
    return structuredClone(row);
  }};
  const make=()=>new RemindersSync({directory:path.join(dir,'state'),getVault:()=>vault,getConfig:()=>config,saveConfig:value=>{config=value;},adapter,onChange:change=>changes.push(change),isBusy:()=>busy});
  const sync=make();
  const add=(title='Phone task',extra={})=>{const row={id:'R'+(++revision),listId:'L',title,notes:'Phone notes',due:null,completed:false,recurring:false,version:String(++revision),...extra};rows.push(row);return row;};
  const edit=(row,patch)=>Object.assign(row,patch,{version:String(++revision)});
  return {dir,vault,rows,writes,changes,sync,make,add,edit,connect:()=>sync.configure({life:'L',business:'B'}),failCreate:()=>{failAfterCreate=true;},busy:v=>{busy=v;},beforeSave:fn=>{beforeSave=fn;}};
}
test('connect exports only unfinished tasks into the chosen lists with categories and a durable identity',async t=>{
  const f=fixture(t);f.vault.createTask({title:'Dentist',list:'life',category:'Health',due:'2026-11-02',planned:'2026-10-30'});
  f.vault.createTask({title:'Ship',list:'business',category:'Projects',venture:'Example Studio'});
  const done=f.vault.createTask({title:'Old',list:'life'});f.vault.updateTask({completed:true,path:done.path,version:done.version});
  const result=await f.connect();assert.equal(result.error,null);assert.equal(result.exported,2);assert.equal(result.busy,false);
  assert.deepEqual(f.rows.map(r=>r.listId).sort(),['B','L']);
  assert.match(f.rows.find(r=>r.title==='Dentist').notes,/Category: Health/);assert.equal(f.rows.find(r=>r.title==='Dentist').due,'2026-11-02');
  assert.match(f.rows.find(r=>r.title==='Ship').notes,/Venture: Example Studio/);
  await f.make().sync();assert.equal(f.rows.length,2);assert.equal(f.writes.length,2);
  assert.equal(f.vault.tasks().tasks.find(t=>t.title==='Dentist').planned,'2026-10-30');
});
test('phone creation imports once, retains notes, completion and date changes flow both ways',async t=>{
  const f=fixture(t),remote=f.add('Book visit',{due:'2026-11-02T14:30:00'});await f.connect();
  let task=f.vault.tasks().tasks[0];assert.match(f.vault.read(task.path).content,/Phone notes/);assert.equal(task.due,remote.due);
  f.edit(remote,{completed:true,due:null});await f.sync.sync();task=f.vault.tasks({include_completed:true}).tasks[0];assert.equal(task.completed,true);assert.equal(task.due,null);
  f.vault.updateTask({path:task.path,version:task.version,completed:false,due:'2026-11-04'});await f.sync.sync();assert.equal(remote.completed,false);assert.equal(remote.due,'2026-11-04');
  await f.make().sync();assert.equal(f.vault.tasks({include_completed:true}).tasks.length,1);assert.equal(f.rows.length,1);
});
test('independent edits merge; conflicting dates preserve both copies and remain visible after restart',async t=>{
  const f=fixture(t),created=f.vault.createTask({title:'Draft',list:'life',due:'2026-11-01'});await f.connect();
  let task=f.vault.tasks().tasks[0];f.vault.updateTask({path:task.path,version:task.version,completed:true});f.edit(f.rows[0],{due:'2026-11-02'});
  await f.sync.sync();task=f.vault.tasks({include_completed:true}).tasks[0];assert.equal(task.due,'2026-11-02');assert.equal(f.rows[0].completed,true);
  f.vault.updateTask({path:task.path,version:task.version,due:'2026-11-03'});f.edit(f.rows[0],{due:'2026-11-04'});
  let result=await f.sync.sync();assert.match(result.issues[0].message,/both apps/);assert.equal(f.rows[0].due,'2026-11-04');assert.equal(f.vault.tasks({include_completed:true}).tasks[0].due,'2026-11-03');
  result=await f.make().sync();assert.match(result.issues[0].message,/both apps/);
  f.edit(f.rows[0],{due:'2026-11-03'});result=await f.sync.sync();assert.equal(result.issues.length,0);
});
test('a failed response after creation recovers by marker without creating duplicates',async t=>{
  const f=fixture(t);f.vault.createTask({title:'Recover',list:'life'});f.failCreate();let result=await f.connect();assert.match(result.issues[0].message,/Connection lost/);assert.equal(f.rows.length,1);
  result=await f.make().sync();assert.equal(result.issues.length,0);assert.equal(f.rows.length,1);assert.equal(f.writes.length,1);
});
test('an uncertain creation absent from a later read is not retried',async t=>{
  const f=fixture(t);f.vault.createTask({title:'Recover',list:'life'});f.failCreate();await f.connect();f.rows.length=0;
  const result=await f.make().sync();assert.match(result.issues[0].message,/unconfirmed/);assert.equal(f.writes.length,1);
});
test('deletions on either side do not propagate or recreate the missing copy',async t=>{
  const f=fixture(t);f.vault.createTask({title:'Keep',list:'life'});await f.connect();const row=f.rows.pop();let result=await f.sync.sync();assert.match(result.issues[0].message,/missing/);assert.equal(f.rows.length,0);
  f.rows.push(row);const task=f.vault.tasks().tasks[0];fs.unlinkSync(path.join(f.vault.root,task.path));result=await f.sync.sync();assert.equal(f.vault.tasks().tasks.length,0);assert.equal(f.rows.length,1);assert.match(result.issues[0].message,/missing/);
});
test('renaming a vault note updates the same reminder; remote rename needs review',async t=>{
  const f=fixture(t);f.vault.createTask({title:'Before',list:'life'});await f.connect();const task=f.vault.tasks().tasks[0];fs.renameSync(path.join(f.vault.root,task.path),path.join(f.vault.root,FOLDERS.life,'After.md'));
  await f.sync.sync();assert.equal(f.rows[0].title,'After');assert.equal(f.rows.length,1);
  f.edit(f.rows[0],{title:'Phone title'});const result=await f.sync.sync();assert.match(result.issues[0].message,/Rename the task note/);assert.equal(f.vault.tasks().tasks[0].title,'After');
});
test('duplicate identities and moved lists block writes; recurring items are excluded',async t=>{
  const f=fixture(t);f.vault.createTask({title:'One',list:'life'});f.add('Repeated',{recurring:true});await f.connect();
  let task=f.vault.tasks().tasks[0];fs.copyFileSync(path.join(f.vault.root,task.path),path.join(f.vault.root,FOLDERS.life,'Copy.md'));
  let result=await f.sync.sync();assert.ok(result.issues.some(x=>/Duplicate/.test(x.message)));assert.equal(f.rows.length,2);
  fs.unlinkSync(path.join(f.vault.root,FOLDERS.life,'Copy.md'));f.edit(f.rows.find(r=>r.title==='One'),{listId:'B'});result=await f.sync.sync();assert.ok(result.issues.some(x=>/different list/.test(x.message)));
});
test('pause prevents reads and writes; busy sync defers; mappings cannot silently repoint linked data',async t=>{
  const f=fixture(t);f.vault.createTask({title:'One',list:'life'});f.busy(true);assert.equal((await f.connect()).deferred,true);assert.equal(f.rows.length,0);
  f.busy(false);await f.sync.sync();await assert.rejects(f.sync.configure({life:'L',business:'L'}),/different/);await assert.rejects(f.sync.configure({life:'B',business:'L'}),/original/);
  await f.sync.configure({enabled:false});f.add('Later');await f.sync.sync();assert.equal(f.vault.tasks().tasks.length,1);
});
test('stale note and remote edits are not overwritten',async t=>{
  const f=fixture(t);f.vault.createTask({title:'One',list:'life',due:'2026-11-01'});await f.connect();
  const task=f.vault.tasks().tasks[0];f.vault.updateTask({path:task.path,version:task.version,due:'2026-11-02'});
  f.beforeSave(()=>{f.edit(f.rows[0],{due:'2026-11-03'});});const result=await f.sync.sync();assert.match(result.issues[0].message,/changed during/);assert.equal(f.rows[0].due,'2026-11-03');
});
test('initial import handles duplicate filenames and recovery after metadata write failure',async t=>{
  const f=fixture(t);f.add('Same');f.add('Same');let fail=true;f.beforeSave(()=>{if(fail){fail=false;throw new Error('Save failed');}});
  await f.connect();assert.equal(f.vault.tasks().tasks.length,2);await f.make().sync();assert.equal(f.vault.tasks().tasks.length,2);assert.equal(f.rows.length,2);
});
test('link/import history is not undoable, normal synced completion can be undone and propagated',async t=>{
  const f=fixture(t);f.vault.createTask({title:'One',list:'life'});await f.connect();const history=f.vault.publicHistory();assert.equal(history[0].undoable,false);assert.throws(()=>f.vault.undo(history[0].id),/Reminders link/);
  f.edit(f.rows[0],{completed:true});await f.sync.sync();const update=f.changes.at(-1);f.vault.undo(update.change_id);await f.sync.sync();assert.equal(f.rows[0].completed,false);
});
test('category updates preserve user notes around the managed block',()=>{
  const scope='123456789abcdef0',key='12345678-1234-1234-1234-123456789abc';
  const notes=notesFor('Keep this',scope,key,{category:'Projects',venture:'Demo'});
  const updated=notesFor(notes+'\nMore notes',scope,key,{category:'Health'});assert.match(updated,/Keep this/);assert.match(updated,/More notes/);assert.match(updated,/Category: Health/);assert.doesNotMatch(updated,/Venture:/);assert.deepEqual(identity(updated),{scope,key});
});
test('lost identities are reported rather than duplicating linked tasks',async t=>{
  const f=fixture(t);f.vault.createTask({title:'One',list:'life'});await f.connect();
  const task=f.vault.tasks().tasks[0],file=path.join(f.vault.root,task.path),original=f.vault.read(task.path).content;
  fs.writeFileSync(file,original.replace(/^reminders_key:.*\n/m,''));let result=await f.sync.sync();assert.ok(result.issues.some(x=>/lost its reminders_key/.test(x.message)));assert.equal(f.rows.length,1);
  fs.writeFileSync(file,original);f.edit(f.rows[0],{id:'replacement-id',notes:'Marker lost during an external restore'});
  result=await f.sync.sync();assert.ok(result.issues.some(x=>/New imports are paused/.test(x.message)));assert.equal(f.vault.tasks().tasks.length,1);
});
