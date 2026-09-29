const fs=require('node:fs');
const path=require('node:path');
const {hash}=require('./vault.cjs');
const {wallDate,instant}=require('./calendar-time.cjs');
const dateValue=v=>v==null||v===''?null:wallDate(v);

const SETTINGS='.obsidian/plugins/full-calendar-remastered/data.json';
function addDays(day,count) {const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);}

function pluginSettings(vault) {
  const file=path.join(vault.root,SETTINGS);
  if(!fs.existsSync(file)) return {calendars:[],enabled:false,port:8540,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
  if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>128*1024) throw new Error('Full Calendar settings are invalid.');
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const port=Number(data.localServerPort??8540);
  if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('Full Calendar REST port is invalid.');
  const timezone=data.displayTimezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  new Intl.DateTimeFormat('en-GB',{timeZone:timezone});
  const calendars=(data.calendarSources||[]).filter(s=>s.type==='google'&&typeof s.id==='string').map(s=>({id:s.id,name:String(s.name||'Google Calendar').slice(0,100),remoteId:String(s.calendarId||'')}));
  return {calendars,enabled:data.enableLocalServer===true,port,timezone};
}

function selectedCalendar(config,calendarId,requested) {
  const choice=requested||calendarId||(config.calendars.length===1?config.calendars[0].id:null);
  const calendar=config.calendars.find(c=>c.id===choice||c.name.toLowerCase()===String(choice).toLowerCase());
  if(!calendar) throw new Error(config.calendars.length?'Select a Google calendar in Orb Settings before adding events.':'Connect a Google calendar in Obsidian Full Calendar before adding events.');
  return calendar;
}

async function request(config,token,endpoint,{method='GET',body,fetchImpl=fetch,signal}={}) {
  if(!config.enabled) throw new Error('Enable Local REST Server in Obsidian Full Calendar → Integrations, then keep Obsidian open.');
  if(!token) throw new Error('Add a Full Calendar access token in Orb Settings before adding events.');
  const url=`http://127.0.0.1:${config.port}/api/v1/${endpoint}`;
  let response;
  try {response=await fetchImpl(url,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),redirect:'error'});}
  catch(e) {if(signal?.aborted) throw e;throw new Error('Cannot reach Full Calendar in Obsidian. Open Obsidian and check its Local REST Server. If an event write timed out, check Google Calendar before retrying.');}
  let data;try {data=await response.json();}catch {throw new Error(`Full Calendar returned an invalid response (HTTP ${response.status}).`);}
  if(!response.ok||data.success!==true) throw Object.assign(new Error(`Full Calendar ${response.status}: ${String(data.message||data.error||'request failed').slice(0,300)}`),{status:response.status});
  return data;
}

function localTimestamp(ms,timezone) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

async function listGoogleEvents(vault,{token,calendarId,fetchImpl=fetch,signal,start,end}={}) {
  const config=pluginSettings(vault);
  const calendars=calendarId?[selectedCalendar(config,calendarId)]:config.calendars;
  const byId=new Map(calendars.map(calendar=>[calendar.id,calendar]));
  if(!calendars.length)return [];
  const params=new URLSearchParams();
  if(calendarId)params.set('calendar',calendarId);
  if(start)params.set('start',String(instant(start+'T00:00:00',config.timezone)));
  if(end)params.set('end',String(instant(addDays(end,1)+'T00:00:00',config.timezone)));
  const data=await request(config,token,`events?${params}`,{fetchImpl,signal});
  if(!Array.isArray(data.events))throw new Error('Full Calendar returned an incomplete event list.');
  if(data.events.some(e=>byId.has(e.calendarId)&&!e.isTask&&e.rawEvent?.event?.type==='single'&&!Number.isFinite(e.startMillis)))throw new Error('Full Calendar returned an event with invalid timing.');
  return data.events.filter(e=>byId.has(e.calendarId)&&e.title&&!e.isTask&&Number.isFinite(e.startMillis)).map(e=>({
    kind:'event',title:String(e.title).slice(0,300),start:e.allDay?e.date:localTimestamp(e.startMillis,config.timezone),
    end:e.allDay?addDays(e.endDate||e.date,1):Number.isFinite(e.endMillis)?localTimestamp(e.endMillis,config.timezone):null,
    allDay:!!e.allDay,location:String(e.rawEvent?.event?.location||'').slice(0,300),calendar:byId.get(e.calendarId).name,
    source:'Google Calendar',id:e.id,calendarId:e.calendarId,description:String(e.rawEvent?.event?.description||''),recurring:['rrule','recurring'].includes(e.rawEvent?.event?.type),_sort:e.startMillis
  }));
}

function eventInput(args,timezone) {
  const title=typeof args.title==='string'?args.title.trim():'';
  if(!title||title.length>180) throw new Error('Event title must be 1–180 characters.');
  const start=dateValue(args.start),end=args.end==null?null:dateValue(args.end);
  if(!start)throw new Error('An event needs a date or start time.');
  const allDay=start.length===10;
  if(allDay&&end&&end.length!==10||!allDay&&(!end||end.length!==19)) throw new Error('Use date-only start/end for all-day events, or start and end times for timed events.');
  if(!allDay&&instant(end,timezone)<=instant(start,timezone))throw new Error('Event end must be after its start.');
  if(!allDay&&(!start.endsWith(':00')||!end.endsWith(':00'))) throw new Error('Timed events use whole-minute start and end times.');
  if(end&&end<start||!allDay&&end===start)throw new Error('Event end must be after its start.');
  if(end&&end.slice(0,10)>addDays(start.slice(0,10),31)) throw new Error('Events may span at most 31 days.');
  const description=args.description==null?'':String(args.description).trim(),location=args.location==null?'':String(args.location).trim();
  if(description.length>10000||location.length>300)throw new Error('Event description or location is too long.');
  return {type:'single',title,allDay,date:start.slice(0,10),endDate:allDay?(end||null):(end.slice(0,10)===start.slice(0,10)?null:end.slice(0,10)),
    ...(!allDay?{startTime:start.slice(11,16),endTime:end.slice(11,16),timezone}:{}),description,location};
}

async function createGoogleEvent(vault,args,{token,calendarId,fetchImpl=fetch,signal}={}) {
  const config=pluginSettings(vault),calendar=selectedCalendar(config,calendarId,args.calendar);
  const event=eventInput(args,config.timezone);
  const providers=await request(config,token,'calendars',{fetchImpl,signal});
  if(!Array.isArray(providers.calendars)||!providers.calendars.some(source=>source.id===calendar.id&&source.type==='google'&&(!calendar.remoteId||source.calendarId===calendar.remoteId))) throw new Error('The open Obsidian vault does not match the Google calendar selected in Orb Settings.');
  const existing=await listGoogleEvents(vault,{token,calendarId:calendar.id,fetchImpl,signal,start:event.date,end:event.endDate||event.date});
  const duplicate=existing.find(e=>e.title.toLowerCase()===event.title.toLowerCase()&&e.start===(event.allDay?event.date:args.start)&&e.end===(event.allDay?addDays(event.endDate||event.date,1):args.end));
  if(duplicate)return {created:false,alreadyExists:true,title:event.title,calendar:calendar.name,start:args.start,end:args.end,id:duplicate.id};
  const data=await request(config,token,'events',{method:'POST',body:{calendarId:calendar.id,event},fetchImpl,signal});
  if(data.result!==true)throw new Error('Full Calendar did not confirm the event was saved to Google Calendar. Check the calendar before retrying.');
  return {created:true,title:event.title,calendar:calendar.name,start:args.start,end:args.end};
}


// The plugin REST API exposes its cached OFCEvent, not Google's wire format.
async function verifyCalendar(vault,calendarId,options={}) {
  const config=pluginSettings(vault),calendar=selectedCalendar(config,calendarId);
  const data=await request(config,options.token,'calendars',options);
  if(!Array.isArray(data.calendars)||!data.calendars.some(c=>c.id===calendar.id&&c.type==='google'&&(!calendar.remoteId||c.calendarId===calendar.remoteId)))throw new Error('The open Obsidian vault does not match the selected Google calendar.');
  return {config,calendar};
}
async function getGoogleEvent(vault,{id,calendarId},options={}) {
  if(typeof id!=='string'||!id||id.length>2000)throw new Error('Choose an event returned by the calendar tools.');
  const {config,calendar}=await verifyCalendar(vault,calendarId,options);
  const data=await request(config,options.token,`events/${encodeURIComponent(id)}`,options);
  if(data.details?.calendarId!==calendar.id||!data.details.event)throw new Error('Event belongs to another calendar or is unavailable.');
  const event=data.details.event;
  if(event.type!=='single'||event.isTask)throw new Error('Only single Google calendar events can be edited or linked.');
  const zone=event.timezone||config.timezone;
  const start=event.allDay?event.date:`${event.date}T${event.startTime}:00`;
  const end=event.allDay?addDays(event.endDate||event.date,1):`${event.endDate||event.date}T${event.endTime}:00`;
  wallDate(start);wallDate(end);
  return {id,calendarId:calendar.id,calendar:calendar.name,event,version:hash(JSON.stringify(event)),start,end,timezone:zone,allDay:!!event.allDay};
}
async function updateGoogleEvent(vault,args,options={}) {
  const old=await getGoogleEvent(vault,args,options);
  if(!options.linked&&vault.tasks({include_completed:true}).tasks.some(t=>t.calendar_block&&String(old.event.description||'').includes(`[Vault Orb block ${t.calendar_block.id}]`)))throw new Error('This event is linked to a task. Use move_task_block.');
  if(args.version!==old.version)throw new Error('Calendar event changed. Read it again before editing.');
  const input=eventInput({title:args.title??old.event.title,start:args.start??old.start,end:args.end??(old.allDay?addDays(old.end,-1):old.end),description:old.event.description,location:old.event.location},old.timezone);
  const event={...old.event,...input};
  const data=await request(pluginSettings(vault),options.token,`events/${encodeURIComponent(args.id)}`,{...options,method:'PUT',body:{event}});
  if(data.result!==true)throw new Error('Event update was not confirmed. Refresh before retrying.');
  return {...await getGoogleEvent(vault,args,options),updated:true};
}
async function deleteGoogleEvent(vault,args,options={}) {
  const old=await getGoogleEvent(vault,args,options);
  if(args.version!==old.version)throw new Error('Calendar event changed. Refresh before removing the block.');
  await request(pluginSettings(vault),options.token,`events/${encodeURIComponent(args.id)}`,{...options,method:'DELETE',body:{}});
  return {deleted:true};
}
async function createLinkedEvent(vault,{calendarId,event},options={}) {
  const {config}=await verifyCalendar(vault,calendarId,options);
  const data=await request(config,options.token,'events',{...options,method:'POST',body:{calendarId,event}});
  if(data.result!==true)throw new Error('Block creation was not confirmed. Refresh the linked task before retrying.');
}
module.exports={pluginSettings,selectedCalendar,listGoogleEvents,createGoogleEvent,eventInput,getGoogleEvent,updateGoogleEvent,deleteGoogleEvent,createLinkedEvent,verifyCalendar};
