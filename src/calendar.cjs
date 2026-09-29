const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ICAL=require('ical.js');
const {dateValue,localDate}=require('./vault.cjs');
const {listGoogleEvents}=require('./google-calendar.cjs');

const SETTINGS='.obsidian/plugins/full-calendar-remastered/data.json';
const MAX_FEED_BYTES=5*1024*1024;
const MAX_EVENTS=300;
const cache=new Map();

function addDays(day,count) {
  const date=new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+count);
  return date.toISOString().slice(0,10);
}
function dayInZone(date,zone) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function localTimestamp(date,zone) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
function settings(vault) {
  const file=path.join(vault.root,SETTINGS);
  if(!fs.existsSync(file)) return {sources:[],zone:Intl.DateTimeFormat().resolvedOptions().timeZone};
  if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>128*1024) throw new Error('Full Calendar settings are invalid.');
  const config=JSON.parse(fs.readFileSync(file,'utf8'));
  const zone=config.displayTimezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  new Intl.DateTimeFormat('en-GB',{timeZone:zone});
  const sources=(config.calendarSources||[]).filter(s=>s.type==='ical'&&s.url).map(s=>({name:String(s.name||'iCal calendar').slice(0,100),url:s.url}));
  return {sources,zone};
}
async function feed(source,{fetchImpl=fetch,signal,fresh=false}={}) {
  const url=new URL(source.url);
  if(url.protocol!=='https:'||url.username||url.password) throw new Error(`Calendar source ${source.name} must use HTTPS.`);
  const key=crypto.createHash('sha256').update(source.url).digest('hex');
  const saved=cache.get(key);
  if(!fresh&&saved&&Date.now()-saved.at<5*60*1000) return saved.text;
  const timeout=AbortSignal.timeout(15000);
  const response=await fetchImpl(url.href,{signal:signal?AbortSignal.any([signal,timeout]):timeout,redirect:'error',headers:{Accept:'text/calendar'}});
  if(!response.ok) throw new Error(`Calendar source ${source.name} returned HTTP ${response.status}.`);
  const length=Number(response.headers?.get('content-length')||0);
  if(length>MAX_FEED_BYTES) throw new Error(`Calendar source ${source.name} is too large.`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>MAX_FEED_BYTES) throw new Error(`Calendar source ${source.name} is too large.`);
  const text=bytes.toString('utf8');
  if(!text.includes('BEGIN:VCALENDAR')) throw new Error(`Calendar source ${source.name} did not return an iCalendar feed.`);
  cache.set(key,{at:Date.now(),text});
  return text;
}
function parseEvents(ics,source,zone,start,end) {
  const root=new ICAL.Component(ICAL.parse(ics));
  if(root.name!=='vcalendar') throw new Error(`Calendar source ${source} is invalid.`);
  ICAL.TimezoneService.reset();
  for(const tz of root.getAllSubcomponents('vtimezone')) {
    const id=tz.getFirstPropertyValue('tzid');
    if(id) ICAL.TimezoneService.register(id,new ICAL.Timezone({component:tz,tzid:id}));
  }
  const entries=root.getAllSubcomponents('vevent');
  const exceptions=new Map();
  for(const component of entries) if(component.hasProperty('recurrence-id')) {
    const uid=component.getFirstPropertyValue('uid');
    if(uid) {if(!exceptions.has(uid))exceptions.set(uid,[]);exceptions.get(uid).push(component);}
  }
  const output=[];
  const last=Date.parse(`${addDays(end,32)}T00:00:00Z`);
  const add=(item,startTime,endTime)=>{
    if(item.component.getFirstPropertyValue('status')==='CANCELLED') return;
    const allDay=startTime.isDate;
    const startDate=startTime.toJSDate(),endDate=endTime.toJSDate();
    const first=allDay?startTime.toString().slice(0,10):dayInZone(startDate,zone);
    // DTEND is exclusive for all-day events.
    const lastDay=allDay?addDays(endTime.toString().slice(0,10),-1):dayInZone(new Date(endDate.getTime()-1),zone);
    if(first>end||lastDay<start) return;
    output.push({kind:'event',title:String(item.summary||'(untitled)').slice(0,300),start:allDay?first:localTimestamp(startDate,zone),end:allDay?endTime.toString().slice(0,10):localTimestamp(endDate,zone),allDay,location:String(item.location||'').slice(0,300),calendar:source,source:'Full Calendar iCal',_sort:startDate.getTime()});
  };
  for(const component of entries) {
    const event=new ICAL.Event(component);
    if(event.isRecurrenceException()||!event.startDate) continue;
    for(const exception of exceptions.get(event.uid)||[]) event.relateException(exception);
    if(!event.isRecurring()) {add(event,event.startDate,event.endDate);continue;}
    const iterator=event.iterator();
    let occurrence,count=0;
    while((occurrence=iterator.next())) {
      if(++count>30000) throw new Error(`Calendar source ${source} has too many recurrences to query safely.`);
      if(occurrence.toJSDate().getTime()>last) break;
      const details=event.getOccurrenceDetails(occurrence);
      add(details.item,details.startDate,details.endDate);
    }
  }
  return output;
}
async function queryCalendar(vault,{start=null,end=null,include_tasks=true}={},options={}) {
  const first=start||localDate(),last=end||addDays(first,13);
  dateValue(first);dateValue(last);
  if(first.length!==10||last.length!==10||last<first||last>addDays(first,92)) throw new Error('Choose an inclusive calendar range of at most 93 days using YYYY-MM-DD.');
  const {sources,zone}=settings(vault);
  const sync=options.skipSync?{warnings:[]}:await require('./scheduling.cjs').syncTaskBlocks(vault,{...options.google,fetchImpl:options.fetchImpl,signal:options.signal});
  const warnings=[...sync.warnings],items=[];
  for(const source of sources) {
    options.signal?.throwIfAborted();
    try {const u=new URL(source.url),match=u.hostname==='calendar.google.com'?decodeURIComponent(u.pathname).match(/\/ical\/([^/]+)\//):null;items.push(...parseEvents(await feed(source,options),source.name,zone,first,last).map(e=>({...e,googleCalendarId:match?.[1]||null})));}
    catch(e) {options.signal?.throwIfAborted();warnings.push({calendar:source.name,error:e.message});}
  }
  if(options.google?.token) {
    try {items.push(...await listGoogleEvents(vault,{...options.google,calendarId:null,start:first,end:last,fetchImpl:options.fetchImpl,signal:options.signal}));}
    catch(e) {options.signal?.throwIfAborted();warnings.push({calendar:'Google Calendar',error:e.message});}
  }
  if(include_tasks) {
    const result=vault.tasks({scope:'all',date:first});
    warnings.push(...result.warnings.map(w=>({path:w.path,error:w.error})));
    for(const task of result.tasks) for(const field of ['planned','due']) {
      if(field==='planned'&&task.calendar_block?.state==='linked'&&items.some(e=>e.calendarId===task.calendar_block.calendar_id&&e.id===task.calendar_block.event_id))continue;
      const value=task[field],day=value?.slice(0,10);
      if(!day||day<first||day>last) continue;
      items.push({kind:'task',title:task.title,dateType:field,start:value,end:null,allDay:value.length===10,list:task.list,path:task.path,source:'task note',_sort:Date.parse(`${day}T${value.length===10?'00:00:00':value.slice(11)}Z`)});
    }
  }
  let linked=[];try{const tasks=vault.tasks({include_completed:true});linked=tasks.tasks.filter(t=>t.calendar_block);for(const w of tasks.warnings||[])if(!warnings.some(old=>old.path===w.path&&old.error===w.error))warnings.push(w);}catch(e){warnings.push({error:'Task links could not be read: '+e.message});}
  for(const item of items){const t=linked.find(t=>t.calendar_block.event_id===item.id&&t.calendar_block.calendar_id===item.calendarId);if(t){item.taskPath=t.path;item.taskCompleted=t.completed;item.linkState=warnings.some(w=>w.path===t.path)?'repair':t.calendar_block.state;}}
  const googleKeys=new Set(items.filter(item=>item.source==='Google Calendar').map(item=>`${item.title.toLowerCase()}\0${item.start}\0${item.end}`));
  const visible=items.filter(item=>item.source!=='Full Calendar iCal'||!googleKeys.has(`${item.title.toLowerCase()}\0${item.start}\0${item.end}`));
  visible.sort((a,b)=>a._sort-b._sort||a.title.localeCompare(b.title));
  const total=visible.length;
  return {start:first,end:last,timezone:zone,items:visible.slice(0,MAX_EVENTS).map(({_sort,description,googleCalendarId,...item})=>options.internal?{...item,googleCalendarId}:item),total,truncated:total>MAX_EVENTS,warnings,calendars:sources.map(({name})=>name)};
}
module.exports={queryCalendar,parseEvents,settings,addDays};
