const crypto=require('node:crypto');
const path=require('node:path');
const {parseNote}=require('./vault.cjs');
const {timestamp,instant,wallDate,workingHours}=require('./calendar-time.cjs');
const {pluginSettings,selectedCalendar,listGoogleEvents,getGoogleEvent,updateGoogleEvent,deleteGoogleEvent,createLinkedEvent,eventInput}=require('./google-calendar.cjs');
const active=new Set();
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
const marker=block=>`[Vault Orb block ${block.id}]`;
function task(vault,relative,version) {
  if(!Object.values(vault.folders).some(folder=>relative.startsWith(folder+'/')))throw new Error('Choose a task in a configured task folder.');
  const note=vault.read(relative),parsed=parseNote(note.content);
  if(parsed.data.type!=='task')throw new Error('This note is not a task.');
  if(version!==undefined&&version!==note.version)throw new Error('Task changed. Read it again before editing.');
  if(parsed.data.task_id&&!uuid(parsed.data.task_id))throw new Error('Invalid task_id. Repair the task metadata in Obsidian.');
  const allTasks=vault.tasks({include_completed:true}).tasks;
  if(parsed.data.task_id&&allTasks.filter(t=>t.task_id===parsed.data.task_id).length>1)throw new Error('Duplicate task identity. Repair the copied task before scheduling.');
  const block=parsed.data.calendar_block;
  if(block&&(!uuid(block.id)||typeof block.calendar_id!=='string'||typeof block.timezone!=='string'||!['linked','creating','moving','removing'].includes(block.state)))throw new Error('Invalid calendar link. Repair its metadata in Obsidian.');
  if(block&&allTasks.filter(t=>t.calendar_block?.id===block.id).length>1)throw new Error('Duplicate calendar link. Repair the copied task before scheduling.');
  return {...note,parsed,block,title:path.basename(relative,'.md')};
}
function save(vault,note,block,planned,action) {
  if(!note.parsed.data.task_id)note.parsed.doc.set('task_id',crypto.randomUUID());
  if(block)note.parsed.doc.set('calendar_block',block);else note.parsed.doc.delete('calendar_block');
  note.parsed.doc.set('planned',planned??null);
  return vault.withTaskLock(()=>vault.commit(note.path,note.content,`---\n${note.parsed.doc.toString()}---\n${note.parsed.body}`,action,{calendar:true}));
}
function plannedFor(event){return timestamp(instant(event.start,event.timezone),Intl.DateTimeFormat().resolvedOptions().timeZone);}
function matches(event,start,end,zone){return !event.allDay&&instant(event.start,event.timezone)===instant(start,zone)&&instant(event.end,event.timezone)===instant(end,zone);}
async function exclusive(vault,fn){if(active.has(vault.root))throw new Error('Calendar synchronization is already running. Try again when it finishes.');active.add(vault.root);try{return await fn();}finally{active.delete(vault.root);}}
async function locate(vault,block,options) {
  const selected=selectedCalendar(pluginSettings(vault),block.calendar_id);
  if(block.remote_calendar_id&&selected.remoteId!==block.remote_calendar_id)throw new Error('The linked Google calendar configuration changed. Restore it or explicitly unlink the task.');
  if(block.event_id){
    try {const event=await getGoogleEvent(vault,{id:block.event_id,calendarId:block.calendar_id},options);if(!String(event.event.description||'').includes(marker(block)))throw new Error('The calendar event no longer carries this task link. Repair the link.');return event;}
    catch(e){if(e.status!==404)throw e;}
  }
  // Plugin IDs can change after a provider reload. Search the unique marker across
  // its entire cache, without the previous display range or mutable event title.
  const events=await listGoogleEvents(vault,{...options,calendarId:block.calendar_id});
  const found=events.filter(e=>e.description.includes(marker(block)));
  if(found.length!==1)throw new Error(found.length?'Multiple calendar blocks carry this link. Repair the duplicate events.':'Linked block is missing or not loaded in Obsidian. Refresh Full Calendar, then repair the link; do not book another copy.');
  return getGoogleEvent(vault,{id:found[0].id,calendarId:block.calendar_id},options);
}
async function reconcileOne(vault,note,options,{accept=false}={}) {
  const b=note.block;if(!b)return null;
  const event=await locate(vault,b,options);
  if(event.allDay)throw new Error('Linked block became all-day. Restore a timed event or unlink it.');
  if(b.state==='removing'&&!accept)throw new Error('Block removal is unfinished. Retry removing it or explicitly repair the link.');
  if(b.state==='moving'&&!accept&&!matches(event,b.target_start,b.target_end,b.timezone))throw new Error('Block move is unfinished or changed elsewhere. Ask to repair this link using the calendar time.');
  const expected=b.planned??b.previous_planned??null;
  if(!accept&&(note.parsed.data.planned??null)!==expected)throw new Error('Planned was edited separately from its linked block. Move the block or repair the link using calendar time.');
  const planned=plannedFor(event),next={...b,state:'linked',event_id:event.id,start:event.start,end:event.end,timezone:event.timezone,planned};
  delete next.target_start;delete next.target_end;
  if(JSON.stringify(next)===JSON.stringify(b)&&(note.parsed.data.planned??null)===planned)return null;
  return save(vault,note,next,planned,'Calendar block synchronized');
}
async function syncTaskBlocks(vault,options={}) {
  const result={changes:[],warnings:[]};
  // Avoid taking a lock or reading calendars for vaults with no linked tasks.
  let tasks;try{tasks=vault.tasks({include_completed:true}).tasks.filter(t=>t.calendar_block);}catch(e){return {changes:[],warnings:[{error:'Task links could not be read: '+e.message}]};}
  if(!tasks.length)return result;
  if(active.has(vault.root))return {changes:[],warnings:[{error:'Calendar synchronization is in progress.'}]};
  return exclusive(vault,async()=>{
    for(const t of tasks){options.signal?.throwIfAborted();try {const changed=await reconcileOne(vault,task(vault,t.path),options);if(changed)result.changes.push(changed);}catch(e){options.signal?.throwIfAborted();result.warnings.push({path:t.path,error:e.message});}}
    return result;
  });
}
function duration(value){if(!Number.isInteger(value)||value<5||value>480)throw new Error('Choose a duration from 5 to 480 whole minutes.');return value;}
async function availability(vault,start,end,options={}) {
  const {queryCalendar,settings}=require('./calendar.cjs');
  const config=pluginSettings(vault),feeds=settings(vault).sources;
  if(!config.calendars.length&&!feeds.length)throw new Error('Connect calendar sources before checking availability.');
  if(config.calendars.length&&!options.token)throw new Error('A Google calendar is configured but cannot be read. Add its token before finding time.');
  // The REST list does not expand Google recurrence. Require the corresponding
  // iCal source, whose recurrence and exceptions are expanded by calendar.cjs.
  for(const calendar of config.calendars){
    const covered=feeds.some(feed=>{try {const u=new URL(feed.url);return u.hostname==='calendar.google.com'&&decodeURIComponent(u.pathname).includes(`/ical/${calendar.remoteId}/`)&&!!calendar.remoteId;}catch{return false;}});
    if(!covered)throw new Error(`Add the matching Google iCal feed for ${calendar.name} in Full Calendar before finding or booking free time; the local Google API alone does not expand recurring events.`);
  }
  const result=await queryCalendar(vault,{start,end,include_tasks:false},{fetchImpl:options.fetchImpl,signal:options.signal,google:options,fresh:true,skipSync:true,internal:true});
  if(result.warnings.length||result.truncated)throw new Error('Calendar availability is incomplete. Resolve source warnings or use a shorter range before booking.');
  return result;
}
function occupied(item,zone) {
  if(item.allDay)return [instant(item.start.slice(0,10)+'T00:00:00',zone),instant(item.end.slice(0,10)+'T00:00:00',zone)];
  if(!item.end)throw new Error('A calendar event has no end time; availability cannot be confirmed.');
  return [instant(item.start,zone),instant(item.end,zone)];
}
function overlaps(a,b){return a[0]<b[1]&&b[0]<a[1];}
async function findTaskTime(vault,args,options={}) {
  const n=task(vault,args.path);if(n.parsed.data.recurrence)throw new Error('Calendar blocks currently support non-recurring tasks. Use a separate one-off task.');if(n.parsed.data.completed)throw new Error('Reopen the task before scheduling work.');
  const mins=duration(args.minutes),hours=workingHours(options.workingHours),{addDays}=require('./calendar.cjs');
  wallDate(args.start);wallDate(args.end);
  const result=await availability(vault,args.start,args.end,options),busy=result.items.map(e=>occupied(e,result.timezone));
  const now=options.now??Date.now(),slots=[];
  for(let day=args.start;day<=args.end&&slots.length<12;day=addDays(day,1)){
    if(!hours.days.includes(new Date(day+'T12:00:00Z').getUTCDay()))continue;
    let first,last;try{first=instant(`${day}T${hours.start}:00`,result.timezone);last=instant(`${day}T${hours.end}:00`,result.timezone);}catch{continue;}
    for(let at=first;at+mins*60000<=last&&slots.length<12;at+=15*60000){if(at<now||busy.some(b=>overlaps([at,at+mins*60000],b)))continue;const start=timestamp(at,result.timezone),end=timestamp(at+mins*60000,result.timezone);try{instant(start,result.timezone);instant(end,result.timezone);}catch{continue;}slots.push({start,end});at+=(Math.ceil(mins/15)-1)*15*60000;}
  }
  return {path:n.path,version:n.version,minutes:mins,timezone:result.timezone,working_hours:hours,slots,checked_at:new Date(now).toISOString(),note:'Availability reflects configured sources and the latest data loaded by Obsidian. Booking rechecks it.'};
}
async function checkSlot(vault,start,end,zone,options,ignore) {
  const span=[instant(start,zone),instant(end,zone)];duration((span[1]-span[0])/60000);
  if(span[0]<(options.now??Date.now()))throw new Error('Choose a future time for this block.');
  const result=await availability(vault,start.slice(0,10),end.slice(0,10),options);
  const ignored=ignore&&[instant(ignore.start,ignore.timezone),instant(ignore.end,ignore.timezone)];
  const busy=result.items.filter(e=>!(ignore&&(e.id===ignore.id&&e.calendarId===ignore.calendarId||e.source==='Full Calendar iCal'&&e.googleCalendarId===pluginSettings(vault).calendars.find(c=>c.id===ignore.calendarId)?.remoteId&&e.title===ignore.event.title&&occupied(e,result.timezone).every((v,i)=>v===ignored[i]))));
  if(busy.some(e=>overlaps(span,occupied(e,result.timezone))))throw new Error('That time now overlaps a calendar commitment. Find another slot.');
}
async function scheduleTask(vault,args,options={}) {return exclusive(vault,async()=>{
  if(options.blockId&&!uuid(options.blockId))throw new Error('Invalid booking operation identity.');
  let n=task(vault,args.path,args.version);
  if(n.parsed.data.recurrence)throw new Error('Calendar blocks currently support non-recurring tasks. Use a separate one-off task.');
  if(n.parsed.data.completed)throw new Error('Reopen the task before scheduling work.');
  if(n.block){const change=await reconcileOne(vault,n,options);return {path:n.path,alreadyLinked:true,changes:change?[change]:[],block:task(vault,n.path).block};}
  const config=pluginSettings(vault),calendar=selectedCalendar(config,options.calendarId,args.calendar),zone=config.timezone;
  const input=eventInput({title:n.title,start:args.start,end:args.end},zone);
  if(input.allDay)throw new Error('Task blocks must have a start and end time.');
  await checkSlot(vault,args.start,args.end,zone,options);
  options.signal?.throwIfAborted();n=task(vault,args.path,args.version);
  const block={id:options.blockId||crypto.randomUUID(),calendar_id:calendar.id,remote_calendar_id:calendar.remoteId,event_id:null,state:'creating',start:args.start,end:args.end,timezone:zone,previous_planned:n.parsed.data.planned??null,planned:n.parsed.data.planned??null};
  const changes=[save(vault,n,block,n.parsed.data.planned,'Calendar block pending')];
  try {
    await createLinkedEvent(vault,{calendarId:calendar.id,event:{...input,description:marker(block)}},options);
    const change=await reconcileOne(vault,task(vault,n.path),options);if(change)changes.push(change);
    return {path:n.path,scheduled:true,calendar:calendar.name,block:task(vault,n.path).block,changes};
  }catch(e){return {path:n.path,scheduled:false,pending:true,changes,warning:`Block creation or linking needs recovery: ${e.message} Refresh this task; do not create another event.`};}
});}
async function moveTaskBlock(vault,args,options={}) {return exclusive(vault,async()=>{
  let n=task(vault,args.path,args.version);if(!n.block)throw new Error('This task has no linked calendar block.');
  if(n.block.state!=='linked')throw new Error('Repair the pending calendar link before moving it.');
  const old=await locate(vault,n.block,options),zone=old.timezone;
  const end=args.end||timestamp(instant(args.start,zone)+instant(old.end,zone)-instant(old.start,zone),zone);
  eventInput({title:old.event.title,start:args.start,end},zone);
  await checkSlot(vault,args.start,end,zone,options,old);
  options.signal?.throwIfAborted();n=task(vault,args.path,args.version);
  const b={...n.block,state:'moving',planned:n.parsed.data.planned??null,target_start:args.start,target_end:end,timezone:zone},changes=[save(vault,n,b,n.parsed.data.planned,'Calendar move pending')];
  try {
    await updateGoogleEvent(vault,{id:old.id,calendarId:old.calendarId,version:old.version,start:args.start,end},{...options,linked:true});
    const changed=await reconcileOne(vault,task(vault,n.path),options);if(changed)changes.push(changed);
    return {path:n.path,moved:true,block:task(vault,n.path).block,changes};
  }catch(e){return {path:n.path,moved:false,pending:true,changes,warning:`Move needs recovery: ${e.message}`};}
});}
async function removeTaskBlock(vault,args,options={}) {return exclusive(vault,async()=>{
  let n=task(vault,args.path,args.version);if(!n.block)throw new Error('This task has no linked block.');
  const event=await locate(vault,n.block,options);options.signal?.throwIfAborted();n=task(vault,args.path,args.version);
  const b={...n.block,state:'removing'},changes=[save(vault,n,b,n.parsed.data.planned,'Calendar removal pending')];
  try{
    await deleteGoogleEvent(vault,{id:event.id,calendarId:event.calendarId,version:event.version},options);
    n=task(vault,n.path,changes[0].version);
    changes.push(save(vault,n,null,b.previous_planned,'Calendar block removed'));
    return {path:n.path,removed:true,changes};
  }catch(e){return {path:n.path,removed:false,pending:true,changes,warning:`Removal needs recovery: ${e.message} If deletion succeeded, explicitly unlink the task to finish.`};}
});}
async function repairTaskBlock(vault,args,options={}) {return exclusive(vault,async()=>{
  const n=task(vault,args.path,args.version);if(!n.block)throw new Error('This task has no calendar link to repair.');
  if(args.action==='unlink')return {path:n.path,changes:[save(vault,n,null,n.parsed.data.planned,'Calendar link detached')],warning:'Only the link was removed. Any calendar event still exists; inspect it before scheduling another block.'};
  if(args.action!=='use_calendar')throw new Error('Choose use_calendar or unlink.');
  const changed=await reconcileOne(vault,n,options,{accept:true});return {path:n.path,changes:changed?[changed]:[],block:task(vault,n.path).block};
});}
module.exports={findTaskTime,scheduleTask,moveTaskBlock,removeTaskBlock,repairTaskBlock,syncTaskBlocks,marker,availability,occupied,overlaps};
