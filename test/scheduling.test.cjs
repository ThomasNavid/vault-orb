const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Vault,parseNote}=require('../src/vault.cjs');
const {instant,timestamp,workingHours}=require('../src/calendar-time.cjs');
const {findTaskTime,scheduleTask,moveTaskBlock,removeTaskBlock,repairTaskBlock,syncTaskBlocks}=require('../src/scheduling.cjs');
const {getGoogleEvent,updateGoogleEvent}=require('../src/google-calendar.cjs');
const {queryCalendar}=require('../src/calendar.cjs');
const {todaySnapshot}=require('../src/today.cjs');
const {Agent,tools,instructions}=require('../src/agent.cjs');
const START='2030-01-07T10:00:00',END='2030-01-07T10:45:00';
function fixture(t,{zone='Europe/London'}={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-scheduling-')),vaultRoot=path.join(root,'vault');
  const plugin=path.join(vaultRoot,'.obsidian/plugins/full-calendar-remastered');fs.mkdirSync(plugin,{recursive:true});
  for(const name of ['Life','Business'])fs.mkdirSync(path.join(vaultRoot,`0. Home/${name} Tasks`),{recursive:true});
  const config={displayTimezone:zone,enableLocalServer:true,calendarSources:[{type:'google',id:'work',name:'Work',calendarId:'work@example.test'},{type:'ical',name:'Work feed',url:`https://calendar.google.com/calendar/ical/work%40example.test/private-${path.basename(root)}/basic.ics`}]};
  const writeConfig=()=>fs.writeFileSync(path.join(plugin,'data.json'),JSON.stringify(config));writeConfig();
  const vault=new Vault(vaultRoot,path.join(root,'state'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const created=vault.createTask({title:'Draft proposal',list:'business',planned:'2030-01-03',due:'2030-01-15',details:'Keep my notes.'});
  const events=new Map(),calls=[];let next=1;
  const state={feed:'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',failFeed:false,timeoutPost:false,failReadback:false,timeoutPut:false,timeoutDelete:false,onWrite:null};
  const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
  const fetchImpl=async(url,opts={})=>{
    const u=new URL(url),method=opts.method||'GET';calls.push({url:u,method,body:opts.body?JSON.parse(opts.body):null});
    if(u.protocol==='https:'){if(state.failFeed)throw new Error('Feed unavailable');return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>Buffer.from(state.feed)};}
    assert.equal(opts.headers.Authorization,'Bearer test-token');
    if(u.pathname.endsWith('/calendars'))return response({success:true,calendars:[{id:'work',type:'google',calendarId:'work@example.test'}]});
    if(u.pathname==='/api/v1/events'){
      if(method==='POST'){const b=JSON.parse(opts.body);events.set('google:'+next++,b.event);state.onWrite?.();if(state.timeoutPost)throw new Error('timeout');return response({success:true,result:true},201);}
      if(state.failReadback&&events.size)throw new Error('offline after write');
      return response({success:true,events:[...events].map(([id,e])=>({id,title:e.title,date:e.date,endDate:e.endDate,calendarId:'work',allDay:e.allDay,startMillis:e.allDay?instant(e.date+'T00:00:00',zone):instant(e.date+'T'+e.startTime+':00',e.timezone||zone),endMillis:e.allDay?undefined:instant((e.endDate||e.date)+'T'+e.endTime+':00',e.timezone||zone),rawEvent:{event:e}})).filter(e=>!u.searchParams.get('start')||e.startMillis<Number(u.searchParams.get('end'))&&(e.endMillis??e.startMillis+86400000)>Number(u.searchParams.get('start')))});
    }
    const id=decodeURIComponent(u.pathname.split('/').pop());
    if(!events.has(id))return response({message:'Not found'},404);
    if(method==='PUT'){events.set(id,JSON.parse(opts.body).event);state.onWrite?.();if(state.timeoutPut)throw new Error('timeout');return response({success:true,result:true});}
    if(method==='DELETE'){events.delete(id);if(state.timeoutDelete)throw new Error('timeout');return response({success:true});}
    return response({success:true,details:{event:events.get(id),calendarId:'work',location:null}});
  };
  const options={token:'test-token',calendarId:'work',fetchImpl,now:Date.parse('2030-01-07T08:00:00Z')};
  const read=()=>vault.tasks({include_completed:true}).tasks.find(t=>t.path===created.path);
  const book=()=>scheduleTask(vault,{path:created.path,version:read().version,start:START,end:END,calendar:null},options);
  return {vault,config,writeConfig,created,events,calls,state,options,read,book};
}
test('find returns working-hour slots around recurring and all-day events without writes',async t=>{
  const f=fixture(t);f.state.feed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:meeting\r\nDTSTART:20300107T090000Z\r\nDTEND:20300107T100000Z\r\nRRULE:FREQ=DAILY;COUNT=2\r\nSUMMARY:Meeting\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:away\r\nDTSTART;VALUE=DATE:20300108\r\nDTEND;VALUE=DATE:20300109\r\nSUMMARY:Away\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const before=f.vault.read(f.created.path).content;
  const result=await findTaskTime(f.vault,{path:f.created.path,start:'2030-01-07',end:'2030-01-08',minutes:45},f.options);
  assert.equal(result.slots[0].start,START);assert.ok(result.slots.every(s=>s.start.startsWith('2030-01-07')));
  assert.equal(f.vault.read(f.created.path).content,before);assert.equal(f.calls.filter(c=>c.method!=='GET').length,0);
});
test('booking links stable IDs, preserves deadline/body, and returns the confirmed event',async t=>{
  const f=fixture(t),r=await f.book();assert.equal(r.scheduled,true);assert.equal(f.events.size,1);
  const task=f.read();assert.ok(task.task_id);assert.equal(task.calendar_block.event_id,'google:1');assert.equal(task.calendar_block.state,'linked');
  assert.equal(task.planned,timestamp(instant(START,'Europe/London'),Intl.DateTimeFormat().resolvedOptions().timeZone));assert.equal(task.due,'2030-01-15');assert.match(f.vault.read(task.path).content,/Keep my notes/);
  assert.match(f.events.get('google:1').description,/Vault Orb block/);
  assert.throws(()=>f.vault.updateTask({path:task.path,version:task.version,planned:'2030-01-08'}),/linked calendar/);
  assert.throws(()=>f.vault.undo(r.changes.at(-1).change_id),/calendar write/);
});
test('rescheduling preserves duration and unrelated event data, updates Planned, and can reverse',async t=>{
  const f=fixture(t);await f.book();f.events.get('google:1').location='Office';f.events.get('google:1').custom='keep';
  const r=await moveTaskBlock(f.vault,{path:f.created.path,version:f.read().version,start:'2030-01-08T14:00:00',end:null},f.options);
  assert.equal(r.moved,true);assert.equal(f.read().calendar_block.end,'2030-01-08T14:45:00');assert.equal(f.events.get('google:1').location,'Office');assert.equal(f.events.get('google:1').custom,'keep');
  const back=await moveTaskBlock(f.vault,{path:f.created.path,version:f.read().version,start:START,end:null},f.options);assert.equal(back.moved,true);assert.equal(f.events.size,1);
});
test('external move outside visible range reconciles by identity; renamed task keeps its link',async t=>{
  const f=fixture(t);await f.book();const renamed=f.created.path.replace('Draft proposal','Renamed task');fs.renameSync(f.vault.resolve(f.created.path),f.vault.resolve(renamed,{missing:true}));
  f.events.get('google:1').date='2030-02-12';
  const view=await queryCalendar(f.vault,{start:'2030-01-07',end:'2030-01-08',include_tasks:false},{google:f.options,fetchImpl:f.options.fetchImpl});
  assert.deepEqual(view.warnings,[]);assert.equal(f.vault.tasks({include_completed:true}).tasks[0].calendar_block.start,'2030-02-12T10:00:00');assert.equal(view.items.length,0);
});
test('completion/reopening and undo update linked event status even in events-only calendar',async t=>{
  const f=fixture(t);await f.book();const activity=[],a=new Agent({vault:f.vault,getKey:()=>'',getCalendarAccess:()=>f.options,fetchImpl:f.options.fetchImpl,onActivity:e=>activity.push(e)});
  await a.execute('query_calendar',{start:'2030-01-07',end:'2030-01-07',include_tasks:false});
  const r=await a.execute('update_task',{path:f.created.path,version:f.read().version,completed:true});
  let v=activity.filter(e=>e.kind==='visual').at(-1).visual;assert.equal(v.days[0].items[0].taskCompleted,true);assert.equal(v.days[0].items[0].taskPath,f.created.path);
  await a.execute('undo_change',{change_id:r.change_id});v=activity.filter(e=>e.kind==='visual').at(-1).visual;assert.equal(v.days[0].items[0].taskCompleted,false);assert.equal(f.events.size,1);
});
test('linked Planned does not duplicate the calendar block while Deadline remains',async t=>{
  const f=fixture(t);await f.book();const v=await queryCalendar(f.vault,{start:'2030-01-07',end:'2030-01-15',include_tasks:true},{google:f.options,fetchImpl:f.options.fetchImpl});
  assert.equal(v.items.filter(i=>i.kind==='event').length,1);assert.deepEqual(v.items.filter(i=>i.kind==='task').map(i=>i.dateType),['due']);
});
test('Today reconciles before collecting tasks',async t=>{
  const f=fixture(t);await f.book();f.events.get('google:1').date='2030-01-09';
  const r=await todaySnapshot(f.vault,{date:'2030-01-09',getCalendarAccess:()=>f.options,fetchImpl:f.options.fetchImpl});assert.equal(r.today.tasks.length,1);assert.equal(r.calendar.items[0].taskPath,f.created.path);
});
test('timeout after creation recovers without another POST, including changed provider IDs',async t=>{
  const f=fixture(t);f.state.timeoutPost=true;const r=await f.book();assert.equal(r.pending,true);assert.equal(f.read().calendar_block.state,'creating');
  f.events.set('new-cache-id',f.events.get('google:1'));f.events.delete('google:1');
  const again=await f.book();assert.equal(again.alreadyLinked,true);assert.equal(f.read().calendar_block.event_id,'new-cache-id');assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('unconfirmed readback retains pending identity and does not blindly retry',async t=>{
  const f=fixture(t);f.state.failReadback=true;assert.equal((await f.book()).pending,true);
  await assert.rejects(()=>f.book(),/Cannot reach/);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  f.state.failReadback=false;await syncTaskBlocks(f.vault,f.options);assert.equal(f.read().calendar_block.state,'linked');
});
test('post-write note conflict retains recoverable event without overwriting the note',async t=>{
  const f=fixture(t);f.state.onWrite=()=>{const file=f.vault.resolve(f.created.path);fs.appendFileSync(file,'\nExternal note.\n');};
  const r=await f.book();assert.equal(r.scheduled,true);assert.match(f.vault.read(f.created.path).content,/External note/);
  // A separate Planned edit is a conflict even if the external event already exists.
  const text=f.vault.read(f.created.path).content.replace(/planned: .*\n/,'planned: 2030-01-10\n');fs.writeFileSync(f.vault.resolve(f.created.path),text);
  const sync=await syncTaskBlocks(f.vault,f.options);assert.match(sync.warnings[0].error,/edited separately/);assert.equal(f.read().planned,'2030-01-10');
  await repairTaskBlock(f.vault,{path:f.created.path,version:f.read().version,action:'use_calendar'},f.options);assert.equal(f.read().calendar_block.state,'linked');assert.equal(f.events.size,1);
});
test('missing event and duplicate task identity remain visible repair states',async t=>{
  const f=fixture(t);await f.book();f.events.clear();let sync=await syncTaskBlocks(f.vault,f.options);assert.match(sync.warnings[0].error,/missing/);assert.ok(f.read().calendar_block);
  const copy=f.created.path.replace('.md',' copy.md');fs.writeFileSync(f.vault.resolve(copy,{missing:true}),f.vault.read(f.created.path).content);
  sync=await syncTaskBlocks(f.vault,f.options);assert.ok(sync.warnings.every(w=>/Duplicate task identity/.test(w.error)));
});
test('removal deletes only the block and restores the original Planned date',async t=>{
  const f=fixture(t);await f.book();const r=await removeTaskBlock(f.vault,{path:f.created.path,version:f.read().version},f.options);
  assert.equal(r.removed,true);assert.equal(f.events.size,0);assert.equal(f.read().planned,'2030-01-03');assert.equal(f.read().calendar_block,null);assert.equal(f.read().completed,false);assert.equal(f.read().due,'2030-01-15');
});
test('uncertain deletion and explicit unlink do not silently recreate or delete events',async t=>{
  const f=fixture(t);await f.book();f.state.timeoutDelete=true;assert.equal((await removeTaskBlock(f.vault,{path:f.created.path,version:f.read().version},f.options)).pending,true);
  assert.equal(f.read().calendar_block.state,'removing');const r=await repairTaskBlock(f.vault,{path:f.created.path,version:f.read().version,action:'unlink'},f.options);assert.match(r.warning,/Any calendar event/);assert.equal(f.read().calendar_block,null);
});
test('uncertain move resolves to the confirmed calendar time on refresh',async t=>{
  const f=fixture(t);await f.book();f.state.timeoutPut=true;
  const r=await moveTaskBlock(f.vault,{path:f.created.path,version:f.read().version,start:'2030-01-08T14:00:00',end:null},f.options);assert.equal(r.pending,true);
  await syncTaskBlocks(f.vault,f.options);assert.equal(f.read().calendar_block.state,'linked');assert.equal(f.read().calendar_block.start,'2030-01-08T14:00:00');
});
test('stale task version, occupied time, past time and failed feed block all writes',async t=>{
  const f=fixture(t),args={path:f.created.path,version:f.read().version,start:START,end:END};
  await assert.rejects(()=>scheduleTask(f.vault,{...args,version:'stale'},f.options),/Task changed/);
  f.events.set('busy',{type:'single',title:'Meeting',date:'2030-01-07',startTime:'10:15',endTime:'11:00',timezone:'Europe/London',allDay:false});
  await assert.rejects(()=>scheduleTask(f.vault,args,f.options),/overlaps/);f.events.clear();
  await assert.rejects(()=>scheduleTask(f.vault,args,{...f.options,now:Date.parse('2030-01-08T00:00:00Z')}),/future/);
  f.state.failFeed=true;await assert.rejects(()=>scheduleTask(f.vault,args,f.options),/incomplete/);assert.equal(f.read().calendar_block,null);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});
test('availability requires recurring-feed coverage for every connected Google calendar',async t=>{
  const f=fixture(t);f.config.calendarSources.pop();f.writeConfig();
  await assert.rejects(()=>findTaskTime(f.vault,{path:f.created.path,start:'2030-01-07',end:'2030-01-07',minutes:45},f.options),/matching Google iCal/);
});
test('fresh availability bypasses feed cache and honours configurable hours/weekends',async t=>{
  const f=fixture(t);await queryCalendar(f.vault,{start:'2030-01-07',end:'2030-01-07'},{google:f.options,fetchImpl:f.options.fetchImpl});const count=f.calls.filter(c=>c.url.protocol==='https:').length;
  const r=await findTaskTime(f.vault,{path:f.created.path,start:'2030-01-12',end:'2030-01-12',minutes:45},{...f.options,workingHours:{start:'12:00',end:'13:00',days:[6]}});
  assert.equal(r.slots[0].start,'2030-01-12T12:00:00');assert.ok(f.calls.filter(c=>c.url.protocol==='https:').length>count);
});
test('calendar zone is independent of device zone and DST gaps/folds are rejected',()=>{
  assert.equal(new Date(instant('2030-07-01T09:00:00','America/New_York')).toISOString(),'2030-07-01T13:00:00.000Z');
  assert.throws(()=>instant('2030-03-31T01:30:00','Europe/London'),/ambiguous or does not exist/);
  assert.throws(()=>instant('2030-10-27T01:30:00','Europe/London'),/ambiguous or does not exist/);
  assert.throws(()=>workingHours({start:'17:00',end:'09:00',days:[1]}),/working hours/);
});
test('generic event edits require fresh versions and preserve unrelated fields',async t=>{
  const f=fixture(t);f.events.set('standalone',{type:'single',title:'Meeting',date:'2030-01-07',startTime:'12:00',endTime:'13:00',timezone:'Europe/London',allDay:false,description:'Keep',location:'Office',custom:'preserve'});
  const event=await getGoogleEvent(f.vault,{id:'standalone',calendarId:'work'},f.options);
  f.events.get('standalone').location='Elsewhere';await assert.rejects(()=>updateGoogleEvent(f.vault,{...event,title:'New'},f.options),/changed/);
  const current=await getGoogleEvent(f.vault,event,f.options);const updated=await updateGoogleEvent(f.vault,{...current,title:'New',start:null,end:null},f.options);
  assert.equal(updated.event.title,'New');assert.equal(updated.event.custom,'preserve');assert.equal(updated.event.description,'Keep');
});
test('assistant exposes linked workflow and prevents editing linked events through generic tool',async t=>{
  const f=fixture(t);await f.book();assert.ok(tools.some(t=>t.name==='find_task_time'));assert.match(instructions(f.vault),/find_task_time then schedule_task/);
  const a=new Agent({vault:f.vault,getKey:()=>'',getCalendarAccess:()=>f.options,fetchImpl:f.options.fetchImpl});
  await assert.rejects(()=>a.execute('update_calendar_event',{id:'google:1',calendarId:'work',version:'x',start:START,end:END}),/linked to a task/);
});

test('booking in another calendar timezone projects Planned into the device timezone',async t=>{
  const f=fixture(t,{zone:'America/New_York'});await f.book();assert.equal(f.read().calendar_block.timezone,'America/New_York');assert.equal(f.read().planned,timestamp(instant(START,'America/New_York'),Intl.DateTimeFormat().resolvedOptions().timeZone));
  const get=f.calls.find(c=>c.url.searchParams.has('start'));assert.equal(Number(get.url.searchParams.get('start')),instant('2030-01-07T00:00:00','America/New_York'));
});
test('slot suggestions skip ambiguous local times during a DST fold',async t=>{
  const f=fixture(t);const r=await findTaskTime(f.vault,{path:f.created.path,start:'2030-10-27',end:'2030-10-27',minutes:30},{...f.options,workingHours:{start:'00:00',end:'04:00',days:[0]}});
  assert.ok(r.slots.length);assert.ok(r.slots.every(s=>!s.start.includes('T01:')&&!s.end.includes('T01:')));
});
test('changed calendar identity does not silently retarget a stored link',async t=>{
  const f=fixture(t);await f.book();f.config.calendarSources[0].calendarId='different@example.test';f.writeConfig();
  const r=await syncTaskBlocks(f.vault,f.options);assert.match(r.warnings[0].error,/configuration changed/);assert.equal(f.events.size,1);
});
test('API list corruption and truncated calendars are never treated as free time',async t=>{
  const f=fixture(t),base=f.options.fetchImpl;
  const bad=async(url,opts)=>new URL(url).pathname==='/api/v1/events'?{ok:true,status:200,json:async()=>({success:true})}:base(url,opts);
  await assert.rejects(()=>scheduleTask(f.vault,{path:f.created.path,version:f.read().version,start:START,end:END},{...f.options,fetchImpl:bad}),/incomplete/);
  for(let i=0;i<301;i++)f.events.set('busy'+i,{type:'single',title:'Busy '+i,date:'2030-01-07',startTime:'14:00',endTime:'15:00',allDay:false,timezone:'Europe/London'});
  await assert.rejects(()=>f.book(),/incomplete/);assert.equal(f.read().calendar_block,null);
});
test('abort and a note edit during the final availability check prevent booking',async t=>{
  const f=fixture(t),base=f.options.fetchImpl,controller=new AbortController();
  const abort=async(url,opts)=>{const r=await base(url,opts);if(new URL(url).protocol==='https:')controller.abort();return r;};
  await assert.rejects(()=>scheduleTask(f.vault,{path:f.created.path,version:f.read().version,start:START,end:END},{...f.options,fetchImpl:abort,signal:controller.signal}));
  const version=f.read().version;
  const edit=async(url,opts)=>{const r=await base(url,opts);if(new URL(url).protocol==='https:')fs.appendFileSync(f.vault.resolve(f.created.path),'\nChanged during availability.');return r;};
  await assert.rejects(()=>scheduleTask(f.vault,{path:f.created.path,version,start:START,end:END},{...f.options,fetchImpl:edit}),/Task changed/);assert.equal(f.events.size,0);
});
test('calendar credential errors do not hide local task results',async t=>{
  const f=fixture(t),a=new Agent({vault:f.vault,getKey:()=>'',getCalendarAccess:()=>{throw new Error('Credential unavailable');}});
  const result=await a.execute('list_tasks',{scope:'all',date:null,include_completed:false});assert.equal(result.tasks[0].path,f.created.path);assert.match(result.warnings[0].error,/Credential unavailable/);
});
