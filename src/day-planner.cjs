const crypto=require('node:crypto');
const {localDate,hash,parseNote,estimatedMinutes}=require('./vault.cjs');
const {instant,timestamp,wallDate,workingHours}=require('./calendar-time.cjs');
const {availability,occupied,overlaps}=require('./scheduling.cjs');
const {queryCalendar,addDays}=require('./calendar.cjs');
const {pluginSettings}=require('./google-calendar.cjs');
const {listGoals}=require('./goals.cjs');
const MINUTE=60000,MAX_CANDIDATES=60;
const clone=value=>structuredClone(value);
function day(value){wallDate(value);if(value.length!==10)throw new Error('Choose a planning date as YYYY-MM-DD.');return value;}
function clock(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Use a time such as 09:00.');return value;}
function text(value,max=2000){if(typeof value!=='string'||value.length>max)throw new Error(`Use text up to ${max} characters.`);return value.trim();}
function preferences(input={},defaults={}){
  const hours=workingHours(defaults.workingHours),p={start:hours.start,end:hours.end,overrideDay:false,buffer:20,scope:'all',energy:'usual',breaks:[],manual:[],...input};
  clock(p.start);clock(p.end);if(p.end<=p.start)throw new Error('Finish time must be after start time.');
  if(typeof p.overrideDay!=='boolean'||!Number.isInteger(p.buffer)||p.buffer<0||p.buffer>80)throw new Error('Choose a reserve from 0 to 80%.');
  if(!['all','life','business'].includes(p.scope)||!['low','usual','high'].includes(p.energy))throw new Error('Choose a valid task list and energy level.');
  for(const field of ['breaks','manual']){
    if(!Array.isArray(p[field])||p[field].length>20)throw new Error('Use up to 20 breaks or commitments.');
    p[field]=p[field].map(b=>{clock(b.start);clock(b.end);if(b.end<=b.start)throw new Error('A break or commitment must end after it starts.');return {start:b.start,end:b.end,label:text(b.label|| (field==='breaks'?'Break':'Commitment'),150)};});
  }
  return {start:p.start,end:p.end,overrideDay:p.overrideDay,buffer:p.buffer,scope:p.scope,energy:p.energy,breaks:p.breaks,manual:p.manual};
}
function mergeIntervals(intervals){
  const out=[];for(const [start,end] of intervals.filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0])){const last=out.at(-1);if(last&&start<=last[1])last[1]=Math.max(last[1],end);else out.push([start,end]);}return out;
}
function gaps(window,busy){const out=[];let at=window[0];for(const [a,b] of mergeIntervals(busy)){if(b<=at||a>=window[1])continue;if(a>at)out.push([at,Math.min(a,window[1])]);at=Math.max(at,b);}if(at<window[1])out.push([at,window[1]]);return out;}
function fingerprint(snapshot){return hash(JSON.stringify({date:snapshot.date,timezone:snapshot.timezone,tasks:snapshot.tasks.map(t=>[t.path,t.version]),goals:snapshot.goals.map(g=>[g.path,g.version]),calendar:snapshot.calendar.items.map(e=>[e.id,e.calendarId,e.start,e.end,e.allDay]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),coverage:snapshot.calendar.complete,workingHours:snapshot.workingHours,calendarId:snapshot.calendarId}));}
async function planningSnapshot(vault,date,{getCalendarAccess=()=>({}),fetchImpl,signal,now=Date.now(),readAvailability=availability,readCalendar=queryCalendar}={}){
  day(date);signal?.throwIfAborted();let access={},warnings=[];
  try{access=getCalendarAccess()||{};}catch(e){warnings.push(e.message);}
  const hours=workingHours(access.workingHours),all=vault.tasks({date,include_completed:true});
  warnings.push(...all.warnings.map(w=>`${w.path||'Tasks'}: ${w.error}`));
  let goals=[];try{const result=listGoals(vault,{scope:'active',date});goals=result.goals.map(g=>({path:g.path,version:g.version,title:g.title,finish_line:g.finish_line.slice(0,1800),taskPath:g.task?.path||null}));warnings.push(...result.warnings.map(w=>w.error||String(w)));}catch(e){warnings.push(e.message);}
  let calendar,complete=false;
  try{calendar=await readAvailability(vault,date,date,{...access,fetchImpl,signal});complete=true;}
  catch(e){signal?.throwIfAborted();warnings.push(e.message);try{calendar=await readCalendar(vault,{start:date,end:date,include_tasks:false},{google:access,fetchImpl,signal,skipSync:true,fresh:true,internal:true});}catch(err){signal?.throwIfAborted();warnings.push(err.message);}}
  let config;try{config=pluginSettings(vault);}catch{}
  const timezone=calendar?.timezone||config?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  const items=(calendar?.items||[]).map(e=>({id:e.id||null,calendarId:e.calendarId||null,title:e.title||'Calendar commitment',start:e.start,end:e.end,allDay:!!e.allDay,taskPath:e.taskPath||null,taskCompleted:!!e.taskCompleted}));
  warnings.push(...(calendar?.warnings||[]).map(w=>w.error||w.message||String(w)));
  const snapshot={id:crypto.randomUUID(),date,timezone,deviceTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone,now,checkedAt:new Date(now).toISOString(),workingHours:hours,calendarId:access.calendarId||'',calendarName:config?.calendars?.find(c=>c.id===access.calendarId)?.name||'',calendar:{complete,items},tasks:all.tasks,goals,warnings:[...new Set(warnings)]};
  snapshot.fingerprint=fingerprint(snapshot);return snapshot;
}
function candidates(snapshot,p){
  const goalPaths=new Set(snapshot.goals.map(g=>g.taskPath)),date=snapshot.date,horizon=addDays(date,7);
  return snapshot.tasks.filter(t=>!t.completed&& (p.scope==='all'||t.list===p.scope)).map(t=>{
    const future=t.planned?.slice(0,10)>date,essential=!!t.calendar_block||!!t.due&&t.due.slice(0,10)<=date;
    const reason=t.calendar_block?'Already booked':t.due&&t.due.slice(0,10)<date?'Past deadline':t.due?.slice(0,10)===date?'Due on this day':goalPaths.has(t.path)?'Next action for an active goal':t.planned?.slice(0,10)===date?'Already planned for this day':t.planned&&!future?'Earlier planned work':future?'Planned for another day':'Available from your task list';
    const rank=essential?0:t.planned?.slice(0,10)===date?1:goalPaths.has(t.path)?2:t.due&&t.due.slice(0,10)<=horizon?3:t.planned&&!future?4:5;
    return {...t,reason,rank,essential,future};
  }).sort((a,b)=>a.rank-b.rank||(a.due||'9999').localeCompare(b.due||'9999')||a.path.localeCompare(b.path));
}
function draftFromSnapshot(snapshot,{previous=null,input={}}={}){
  const p=preferences(input,snapshot),all=candidates(snapshot,p),old=new Map((previous?.rows||[]).map(r=>[r.path,r]));
  const rows=all.map(t=>{
    const prior=old.get(t.path),sameOccurrence=prior?.occurrence===(t.recurrence?.occurrence||null);
    const row={path:t.path,version:t.version,title:t.title,list:t.list,occurrence:t.recurrence?.occurrence||null,minutes:t.estimated_minutes,origin:t.estimated_minutes?'saved':'missing',included:!t.future,reason:t.reason,sources:[],pinned:false,pinTime:null,started:false,preference:'any',essential:t.essential,future:t.future,goal:snapshot.goals.find(g=>g.taskPath===t.path)?.title||null};
    if(prior&&sameOccurrence){for(const k of ['minutes','origin','included','reason','sources','pinned','pinTime','started','preference'])row[k]=clone(prior[k]);if(prior.session&&(prior.started||instant(prior.session.start,previous.timezone)<snapshot.now))row.heldSession=clone(prior.session);if(prior.heldSession)row.heldSession=clone(prior.heldSession);}
    return row;
  });
  // Retain earlier proposed sessions as history; elapsed time does not complete a task.
  for(const prior of previous?.rows||[]){if(rows.some(r=>r.path===prior.path))continue;if(prior.session||prior.heldSession)rows.push({...clone(prior),included:false,heldSession:clone(prior.heldSession||prior.session),history:true});}
  const draft={id:previous?.id||crypto.randomUUID(),revision:(previous?.revision||0)+1,date:snapshot.date,timezone:snapshot.timezone,snapshot,preferences:p,rows,questions:[],summary:previous?.summary||'',changes:[],saved:previous?.saved||null};
  return allocate(draft);
}
function allocate(input){
  const d=clone(input),s=d.snapshot,p=d.preferences,zone=s.timezone,dayStart=instant(s.date+'T00:00:00',zone);
  const start=instant(`${s.date}T${p.start}:00`,zone),end=instant(`${s.date}T${p.end}:00`,zone),from=Math.max(start,Math.ceil(s.now/MINUTE)*MINUTE);
  const weekday=new Date(s.date+'T12:00:00Z').getUTCDay(),working=p.overrideDay||s.workingHours.days.includes(weekday);
  const window=[Math.min(end,from),end],busy=[],timeline=[],issues=[];
  const add=(span,entry)=>{busy.push(span);if(span[1]>start&&span[0]<end)timeline.push({...entry,start:timestamp(span[0],zone),end:timestamp(span[1],zone)});};
  for(const item of s.calendar.items){let span;try{span=occupied(item,zone);}catch{span=[start,end];issues.push(`Unknown duration for ${item.title}; the working window is treated as busy.`);}add(span,{kind:item.taskPath?'booked':'event',title:item.title,path:item.taskPath,completed:item.taskCompleted});}
  for(const field of ['breaks','manual'])for(const b of p[field])add([instant(`${s.date}T${b.start}:00`,zone),instant(`${s.date}T${b.end}:00`,zone)],{kind:field==='breaks'?'break':'event',title:b.label});
  const taskMap=new Map(s.tasks.map(t=>[t.path,t]));
  for(const r of d.rows){delete r.session;delete r.exclusion;r.bookable=false;
    if(r.heldSession){const span=[instant(r.heldSession.start,zone),instant(r.heldSession.end,zone)];r.session=clone(r.heldSession);add(span,{kind:'held',title:r.title,path:r.path,completed:taskMap.get(r.path)?.completed||false});r.exclusion=r.history?'Earlier plan · check task for current status':r.started?'Started session preserved':'Earlier planned session preserved';}
  }
  const initialGaps=working?gaps(window,busy):[],free=Math.floor(initialGaps.reduce((n,[a,b])=>n+b-a,0)/MINUTE),reserve=Math.ceil(free*p.buffer/100),budget=free-reserve;
  let used=0;
  for(const r of [...d.rows].sort((a,b)=>Number(b.pinned)-Number(a.pinned))){
    const t=taskMap.get(r.path);if(r.heldSession)continue;
    if(!t){r.exclusion='Task is no longer available';continue;}
    if(t.calendar_block){r.exclusion=t.calendar_block.state==='linked'?'Already booked · fixed commitment':'Calendar link needs repair';continue;}
    if(!r.included){r.exclusion='Excluded from this day';continue;}
    if(t.recurrence_error||t.advance_needed){r.exclusion='Recurring occurrence needs repair';continue;}
    if(!working){r.exclusion='Outside working days · enable day override';continue;}
    if(!r.minutes){r.exclusion='Add an estimate';continue;}
    estimatedMinutes(r.minutes);
    if(r.minutes>480){r.exclusion='Break this into a smaller next action';continue;}
    if(used+r.minutes>budget){r.exclusion='Does not fit with the current reserve';continue;}
    let deadline=end;
    if(t.due?.length===19){try{const due=instant(t.due,s.deviceTimezone);if(due>=dayStart)deadline=Math.min(deadline,due);}catch{r.exclusion='Deadline time needs correction';continue;}}
    const slots=gaps(window,busy);let choice;
    if(r.pinned&&r.pinTime){const at=instant(`${s.date}T${clock(r.pinTime)}:00`,zone);if(at>=window[0]&&at+r.minutes*MINUTE<=Math.min(end,deadline)&&!busy.some(b=>overlaps([at,at+r.minutes*MINUTE],b)))choice=at;else{r.exclusion='Pinned time conflicts or no longer fits';continue;}}
    else {
      const choices=slots.map(([a,b])=>[Math.ceil(a/MINUTE)*MINUTE,Math.min(b,deadline)]).filter(([a,b])=>b-a>=r.minutes*MINUTE);
      const preferred=choices.filter(([a])=>r.preference==='afternoon'?timestamp(a,zone).slice(11,16)>='12:00':r.preference==='morning'?timestamp(a,zone).slice(11,16)<'12:00':true);
      choice=(preferred[0]||choices[0])?.[0];
    }
    if(choice===undefined){r.exclusion='No continuous gap before the deadline';continue;}
    const span=[choice,choice+r.minutes*MINUTE];used+=r.minutes;r.session={start:timestamp(span[0],zone),end:timestamp(span[1],zone)};
    r.bookable=s.calendar.complete&&!!s.calendarId&&!t.recurrence&&r.minutes>=5;
    add(span,{kind:'proposed',title:r.title,path:r.path,origin:r.origin,recurring:!!t.recurrence});
  }
  d.timeline=timeline.sort((a,b)=>a.start.localeCompare(b.start));
  d.capacity={free,proposed:used,reserve,remaining:free-used,complete:s.calendar.complete,working};
  d.priorities=d.rows.filter(r=>r.included&&r.session&&!r.heldSession).slice(0,3).map(r=>r.path);
  d.warnings=[...s.warnings,...issues];return d;
}
function editDraft(draft,patch){
  const next=clone(draft);next.revision++;next.questions=[];
  if(patch.preferences)next.preferences=preferences({...next.preferences,...patch.preferences},next.snapshot);
  if(patch.row){const r=next.rows.find(r=>r.path===patch.row.path);if(!r)throw new Error('Choose a task in this draft.');
    const edit=patch.row;
    for(const name of Object.keys(edit))if(!['path','minutes','included','pinned','pinTime','started','release'].includes(name))throw new Error('Unsupported planner edit.');
    if(Object.hasOwn(edit,'minutes')){r.minutes=estimatedMinutes(edit.minutes);r.origin=r.minutes?'user':'missing';}
    for(const key of ['included','pinned','started'])if(Object.hasOwn(edit,key)){if(typeof edit[key]!=='boolean')throw new Error('Invalid task choice.');r[key]=edit[key];}
    if(Object.hasOwn(edit,'pinTime'))r.pinTime=edit.pinTime?clock(edit.pinTime):null;
    if(edit.started){if(!r.session)throw new Error('Choose a scheduled session before marking it started.');r.heldSession=clone(r.session);}
    if(edit.release===true){delete r.heldSession;r.started=false;}
  }
  if(patch.move){const at=next.rows.findIndex(r=>r.path===patch.move.path),to=at+patch.move.direction;if(![-1,1].includes(patch.move.direction)||at<0)throw new Error('Invalid task order.');if(to>=0&&to<next.rows.length)[next.rows[at],next.rows[to]]=[next.rows[to],next.rows[at]];}
  return allocate(next);
}
function aiContext(vault,draft,request=''){
  const selectable=draft.rows.filter(r=>!r.history),essential=selectable.filter(r=>r.essential||r.pinned||r.started||(r.title.length>=4&&request.toLocaleLowerCase().includes(r.title.toLocaleLowerCase())));
  if(essential.length>MAX_CANDIDATES)throw new Error('More than 60 essential tasks need attention. Narrow the task list before asking AI.');
  const chosen=[...essential,...selectable.filter(r=>!essential.includes(r))].slice(0,MAX_CANDIDATES),taskMap=new Map(draft.snapshot.tasks.map(t=>[t.path,t]));
  const tasks=chosen.map((r,i)=>{const t=taskMap.get(r.path);let details='';if(i<20){try{details=parseNote(vault.read(r.path).content).body.slice(0,1200);}catch{}}return {id:r.path,title:r.title,list:r.list,planned:t.planned,due:t.due,goal:r.goal,minutes:r.minutes,origin:r.origin,included:r.included,pinned:r.pinned,pinTime:r.pinTime,preference:r.preference,reason:r.reason,details};});
  return {snapshotId:draft.snapshot.id,revision:draft.revision,date:draft.date,timezone:draft.timezone,preferences:draft.preferences,capacity:draft.capacity,tasks,goals:draft.snapshot.goals,omitted:selectable.length-chosen.length,busy:draft.timeline.filter(t=>['event','booked','break','held'].includes(t.kind)).map(t=>({start:t.start,end:t.end,kind:t.kind})),previousSummary:draft.summary};
}
module.exports={day,clock,text,preferences,mergeIntervals,gaps,fingerprint,planningSnapshot,draftFromSnapshot,allocate,editDraft,aiContext,MAX_CANDIDATES};
