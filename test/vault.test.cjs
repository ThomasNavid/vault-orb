const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Vault,dateValue}=require('../src/vault.cjs');
const {Agent,instructions}=require('../src/agent.cjs');
test('public vault template has readable task folders and conventions',t=>{
  const state=fs.mkdtempSync(path.join(os.tmpdir(),'orb-template-state-'));
  t.after(()=>fs.rmSync(state,{recursive:true,force:true}));
  const vault=new Vault(path.join(__dirname,'../vault-template'),state);
  assert.deepEqual(vault.tasks().tasks,[]);vault.validateTaskFolders();
  assert.match(vault.read('0. Home/Task Rules.md').content,/planned/);
});
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-test-'));const notes=path.join(root,'vault');fs.mkdirSync(path.join(notes,'0. Home/Life Tasks'),{recursive:true});fs.mkdirSync(path.join(notes,'0. Home/Business Tasks'),{recursive:true});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new Vault(notes,path.join(root,'state'));}
test('custom vault paths drive task reads, writes, rules and task refresh',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-layout-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const notes=path.join(root,'vault');
  for(const folder of ['Tasks/Personal','Projects/Work','Guide']) fs.mkdirSync(path.join(notes,folder),{recursive:true});
  fs.writeFileSync(path.join(notes,'Guide/Conventions.md'),'Use short task titles.\n');
  const folders={life:'Tasks/Personal',business:'Projects/Work'};
  const vault=new Vault(notes,path.join(root,'state'),{folders,rulesPath:'Guide/Conventions.md'});
  vault.validateTaskFolders();
  assert.match(instructions(vault),/Use short task titles/);
  const events=[],agent=new Agent({vault,getKey:()=>'',onActivity:event=>events.push(event)});
  const added=await agent.execute('create_task',{title:'Submit draft',list:'business',planned:'2026-09-26'});
  assert.equal(added.path,'Projects/Work/Submit draft.md');
  assert.deepEqual(vault.tasks({scope:'today',date:'2026-09-26'}).tasks.map(task=>task.path),[added.path]);
  assert.equal(events.find(event=>event.kind==='visual').visual.rowPaths[0],added.path);
  const edited=vault.updateTask({path:added.path,version:added.version,completed:true});
  assert.equal(vault.tasks().tasks.length,0);
  vault.undo(edited.change_id);
  assert.equal(vault.tasks().tasks.length,1);
  assert.throws(()=>new Vault(notes,path.join(root,'other'),{folders:{life:'../outside',business:folders.business}}),/relative to the vault/);
  assert.throws(()=>new Vault(notes,path.join(root,'other'),{folders:{life:'Tasks',business:folders.life}}),/separate/);
});
test('task creation, duplicate names, updates and exact undo preserve Obsidian properties',t=>{
  const vault=fixture(t);const created=vault.createTask({title:'Dentist',list:'life',planned:'2026-09-28',details:'Ask about appointment.'});
  const original=vault.read(created.path).content;assert.match(original,/planned: 2026-09-28/);assert.match(original,/completed: false/);
  const second=vault.createTask({title:'Dentist',list:'life'});assert.notEqual(created.path,second.path);
  const edit=vault.updateTask({path:created.path,version:created.version,completed:true});assert.match(vault.read(created.path).content,/completed: true/);
  vault.undo(edit.change_id);assert.equal(vault.read(created.path).content,original);vault.undo(created.change_id);assert.throws(()=>vault.read(created.path),/Not found/);
});
test('task writes respect another editor lock and release the lock after errors and nested writes',t=>{
  const vault=fixture(t),{acquire,NAME}=require('../src/task-lock.cjs');
  const lock=path.join(vault.root,NAME),release=acquire(fs,vault.root);
  try {assert.throws(()=>vault.createTask({title:'Blocked',list:'life'}),/Another task edit/);}
  finally {release();}
  assert.equal(vault.tasks().tasks.length,0);
  assert.throws(()=>vault.createTask({title:'Invalid',list:'life',planned:'2026-02-30'}),/Invalid calendar/);
  assert.equal(fs.existsSync(lock),false);
  const other=new Vault(vault.root,path.join(vault.stateDir,'other'));
  vault.withTaskLock(()=>{
    vault.createTask({title:'Nested',list:'life'});
    assert.equal(fs.existsSync(lock),true);
    assert.throws(()=>other.createTask({title:'Blocked',list:'life'}),/Another task edit/);
  });
  assert.equal(fs.existsSync(lock),false);
  other.createTask({title:'After release',list:'life'});
  assert.equal(vault.tasks().tasks.length,2);
});
test('today matches planned OR due; overdue and completed are separate',t=>{
  const vault=fixture(t);
  vault.createTask({title:'Planned',list:'life',planned:'2026-09-26'});
  vault.createTask({title:'Due',list:'business',due:'2026-09-26T23:00:00',venture:'Studio'});
  vault.createTask({title:'Old',list:'life',due:'2026-09-25'});
  const done=vault.createTask({title:'Done',list:'life',planned:'2026-09-26'});vault.updateTask({path:done.path,version:done.version,completed:true});
  assert.deepEqual(vault.tasks({scope:'today',date:'2026-09-26'}).tasks.map(t=>t.title).sort(),['Due','Planned']);
  assert.deepEqual(vault.tasks({scope:'overdue',date:'2026-09-26'}).tasks.map(t=>t.title),['Old']);
  assert.equal(vault.tasks({include_completed:true}).tasks.length,4);
});
test('refuses traversal, symlinks, hidden files and non-Markdown',t=>{
  const vault=fixture(t);fs.symlinkSync(os.tmpdir(),path.join(vault.root,'escape'));
  for(const p of ['../secret.md','/tmp/secret.md','.obsidian/config.md','escape/secret.md','note.pdf','..\\secret.md'])assert.throws(()=>vault.read(p));
  fs.symlinkSync('/does-not-exist',path.join(vault.root,'0. Home/Life Tasks/Broken.md'));
  assert.throws(()=>vault.createTask({title:'Broken',list:'life'}),/Symbolic/);
});
test('refuses stale writes and undo after an external edit',t=>{
  const vault=fixture(t),task=vault.createTask({title:'Original',list:'life'});
  fs.appendFileSync(path.join(vault.root,task.path),'Changed in Obsidian\n');
  assert.throws(()=>vault.updateTask({path:task.path,version:task.version,completed:true}),/changed/);
  assert.throws(()=>vault.undo(task.change_id),/changed/);
  assert.match(vault.read(task.path).content,/Changed in Obsidian/);
});
test('rejects invalid dates and supports clearing dates without losing note body or comments',t=>{
  for(const date of ['tomorrow','2026-02-30','2026-13-01','2026-09-26T25:00:00'])assert.throws(()=>dateValue(date));
  const vault=fixture(t),task=vault.createTask({title:'Example',list:'life',due:'2026-10-01',details:'Keep this text'});
  const file=path.join(vault.root,task.path);fs.writeFileSync(file,vault.read(task.path).content.replace('type: task','type: task # keep comment'));
  const note=vault.read(task.path);vault.updateTask({path:task.path,version:note.version,due:'',planned:null,completed:null});
  const changed=vault.read(task.path).content;assert.match(changed,/# keep comment/);assert.match(changed,/Keep this text/);assert.match(changed,/due: null/);
});
test('malformed task notes are reported and hidden historical checkboxes are not imported',t=>{
  const vault=fixture(t);fs.writeFileSync(path.join(vault.root,'0. Home/Life Tasks/Bad.md'),'---\ntype: [\n---\n');fs.writeFileSync(path.join(vault.root,'Old.md'),'- [ ] Old commitment\n');
  const result=vault.tasks();assert.equal(result.tasks.length,0);assert.equal(result.warnings.length,1);assert.equal(vault.search('commitment').results.length,1);
});
test('append and undo preserve the original bytes',t=>{
  const vault=fixture(t);fs.writeFileSync(path.join(vault.root,'Note.md'),'# Note\n\nOriginal\n');const note=vault.read('Note.md');const edit=vault.appendNote({path:'Note.md',version:note.version,text:'New thought'});
  assert.match(vault.read('Note.md').content,/New thought/);vault.undo(edit.change_id);assert.equal(vault.read('Note.md').content,note.content);
});
