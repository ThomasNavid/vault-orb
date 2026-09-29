const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {ChatStore,titleFrom}=require('../src/chats.cjs');
const temp=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'orb-chats-')),'chats.json');
const ID='3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
test('a chat is created by its first message, titled from it, and survives a restart',()=>{
  const file=temp(),store=new ChatStore(file);
  assert.deepEqual(store.list(),[]);
  store.open(ID,'setup a call with Tom tomorrow');store.append(ID,{role:'user',text:'setup a call with Tom tomorrow'});
  store.append(ID,{role:'assistant',text:'Done.',steps:[{id:'s',name:'create_calendar_event',label:'Added Google event',status:'done'}]});
  const reopened=new ChatStore(file),[chat]=reopened.list();
  assert.equal(chat.title,'Setup a call with Tom tomorrow');assert.equal(chat.count,2);assert.equal(chat.preview,'Done.');
  assert.equal(reopened.get(ID).messages[1].steps[0].name,'create_calendar_event');
  assert.deepEqual(reopened.history(ID),[{role:'user',content:'setup a call with Tom tomorrow'},{role:'assistant',content:'Done.'}]);
});
test('archiving, renaming and deleting only touch the chosen chat',()=>{
  const store=new ChatStore(temp()),other='9f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
  for(const id of [ID,other]){store.open(id,'hello');store.append(id,{role:'user',text:'hello'});}
  assert.equal(store.setArchived(ID,true).archived,true);assert.equal(store.list().find(c=>c.id===other).archived,false);
  assert.equal(store.rename(other,'  Weekly plan ').title,'Weekly plan');
  store.remove(ID);assert.deepEqual(store.list().map(c=>c.id),[other]);
  assert.throws(()=>store.get(ID),/no longer exists/);
});
test('a new message brings an archived chat back, and invalid ids are refused',()=>{
  const store=new ChatStore(temp());store.open(ID,'hi');store.append(ID,{role:'user',text:'hi'});store.setArchived(ID,true);
  store.append(ID,{role:'user',text:'again'});assert.equal(store.get(ID).archived,false);
  assert.throws(()=>store.open('../../etc','x'),/Invalid chat/);
  assert.equal(titleFrom('a '.repeat(60)).length<=51,true);
});
test('legacy chats migrate with a 90-day grace period and archived chats stay',()=>{
  const file=temp(),old='2020-01-01T00:00:00.000Z',start=Date.parse('2026-09-29T00:00:00.000Z');let now=start;
  const archived='9f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
  const legacyChat=(id,isArchived)=>({id,title:'Old chat',createdAt:old,updatedAt:old,archived:isArchived,messages:[{role:'user',text:'Remember this'}]});
  fs.writeFileSync(file,JSON.stringify({chats:[legacyChat(ID,false),legacyChat(archived,true)]}));
  const store=new ChatStore(file,{now:()=>now});
  assert.equal(fs.existsSync(file),false);
  assert.equal(fs.readdirSync(store.dir).length,2);
  assert.equal(store.list().length,2);
  now+=89*86400000;assert.equal(store.list().length,2);
  now+=2*86400000;assert.deepEqual(store.list().map(c=>c.id),[archived]);
  assert.deepEqual(new ChatStore(file,{now:()=>now}).list().map(c=>c.id),[archived]);
});
test('chat count has no silent cap and saving one chat leaves other files alone',()=>{
  const file=temp(),store=new ChatStore(file),ids=Array.from({length:301},()=>crypto.randomUUID());
  for(const id of ids){store.open(id,'hello');store.append(id,{role:'user',text:'hello'});}
  assert.equal(store.list().length,301);
  const otherFile=store.file(ids[1]),before=fs.readFileSync(otherFile,'utf8');
  store.append(ids[0],{role:'assistant',text:'Done.'});
  assert.equal(fs.readFileSync(otherFile,'utf8'),before);
  assert.equal(new ChatStore(file).list().length,301);
});
test('recent chats expire after inactivity while archived chats remain',()=>{
  const file=temp(),start=Date.parse('2026-09-29T00:00:00.000Z');let now=start;
  const store=new ChatStore(file,{now:()=>now}),other='9f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
  for(const id of [ID,other]){store.open(id,'hello');store.append(id,{role:'user',text:'hello'});}
  store.setArchived(other,true);
  now+=91*86400000;
  assert.deepEqual(store.list().map(c=>c.id),[other]);
  store.setArchived(other,false);
  now+=89*86400000;assert.equal(store.list().length,1);
  now+=2*86400000;assert.deepEqual(store.list(),[]);
  assert.equal(fs.readdirSync(store.dir).length,0);
});
