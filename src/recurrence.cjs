// Shared by Orb and the distributed Obsidian bundle. No host APIs here.
const YAML=require('yaml');
const DAYS=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const copy=x=>JSON.parse(JSON.stringify(x));
function day(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Recurring tasks use date-only YYYY-MM-DD values.');
  const [y,m,d]=value.split('-').map(Number),date=new Date(0);date.setUTCFullYear(y,m-1,d);date.setUTCHours(0,0,0,0);
  if(y<100||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw new Error('Invalid recurrence date.');
  return date;
}
function iso(date){const value=date.toISOString().slice(0,10);day(value);return value;}
function addDays(value,n){const date=day(value);date.setUTCDate(date.getUTCDate()+n);return iso(date);}
function distance(a,b){return Math.round((day(b)-day(a))/86400000);}
function weekday(value){return (day(value).getUTCDay()+6)%7;}
function monthDate(y,m,d){const date=new Date(0);date.setUTCFullYear(y,m+1,0);date.setUTCHours(0,0,0,0);date.setUTCDate(Math.min(d,date.getUTCDate()));return iso(date);}
function shift(value,unit,n){const date=day(value);if(unit==='day'||unit==='week')return addDays(value,n*(unit==='week'?7:1));return monthDate(date.getUTCFullYear()+(unit==='year'?n:0),date.getUTCMonth()+(unit==='month'?n:0),date.getUTCDate());}
function rule(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid repeat rule.');
  const keys=['version','mode','unit','interval','weekdays','date_field','anchor','occurrence'];
  if(Object.keys(value).some(k=>!keys.includes(k)))throw new Error('Unsupported repeat field.');
  if(value.version!==1)throw new Error('Unsupported repeat version. Update both Orb and the vault scripts.');
  if(!['fixed','completion'].includes(value.mode)||!['day','week','month','year'].includes(value.unit)||!['planned','due'].includes(value.date_field))throw new Error('Invalid repeat mode, unit, or date field.');
  if(!Number.isInteger(value.interval)||value.interval<1||value.interval>1000)throw new Error('Repeat interval must be an integer from 1 to 1000.');
  day(value.anchor);day(value.occurrence);
  if(value.occurrence<value.anchor)throw new Error('Occurrence cannot precede the repeat anchor.');
  const days=value.weekdays??[];
  if(!Array.isArray(days)||days.some(d=>!DAYS.includes(d))||new Set(days).size!==days.length)throw new Error('Invalid repeat weekdays.');
  if(value.mode==='fixed'&&value.unit==='week'&&!days.length)throw new Error('Choose at least one weekday.');
  if((value.mode!=='fixed'||value.unit!=='week')&&days.length)throw new Error('Weekdays apply only to fixed weekly schedules.');
  return {...value,weekdays:DAYS.filter(d=>days.includes(d))};
}
function next(value,effective){
  const r=rule(value);day(effective);
  if(r.mode==='completion')return shift(effective,r.unit,r.interval);
  const after=effective>r.occurrence?effective:r.occurrence;
  if(r.unit==='day')return addDays(r.anchor,(Math.floor(distance(r.anchor,after)/r.interval)+1)*r.interval);
  if(r.unit==='week'){
    const base=addDays(r.anchor,-weekday(r.anchor)),week=Math.max(0,Math.floor(distance(base,after)/7)),cycle=Math.floor(week/r.interval);
    for(let n=cycle;n<=cycle+1;n++)for(const name of r.weekdays){const value=addDays(base,n*r.interval*7+DAYS.indexOf(name));if(value>after&&value>=r.anchor)return value;}
  }else{
    const a=day(r.anchor),b=day(after),units=r.unit==='month'?(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth():b.getUTCFullYear()-a.getUTCFullYear();
    const cycle=Math.max(0,Math.floor(units/r.interval));
    for(let n=cycle;n<=cycle+1;n++){const value=shift(r.anchor,r.unit,n*r.interval);if(value>after)return value;}
  }
  throw new Error('Cannot calculate the next recurrence.');
}
function summary(value){const r=rule(value);return `Every ${r.interval===1?'':r.interval+' '}${r.unit}${r.interval===1?'':'s'}${r.weekdays.length?' on '+r.weekdays.map(d=>d.slice(0,3)).join(', '):''}${r.mode==='completion'?' after completion':''}`;}
function parse(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>512*1024)throw new Error('Task exceeds the 512 KB note limit.');
  const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!match)throw new Error('Task needs YAML properties.');
  const doc=YAML.parseDocument(match[1]);if(doc.errors.length||!YAML.isMap(doc.contents))throw new Error('Invalid task YAML. Repair the note first.');
  const data=doc.toJSON();if(data.type!=='task')throw new Error('This note is not a task.');return {doc,data,body:text.slice(match[0].length)};
}
function state(data){return {planned:data.planned??null,due:data.due??null,completed:data.completed===true,recurrence:data.recurrence??null};}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function history(data){const h=data.recurrence_history??[];if(!Array.isArray(h)||h.some(e=>!e||typeof e.id!=='string'||!['complete','skip','undo','configure','stop','reschedule','cancel'].includes(e.action)))throw new Error('Invalid recurring history. Repair it before editing.');return h;}
function lastCompletion(entries){const reversed=new Set(entries.filter(e=>e.action==='undo').map(e=>e.reverses));return entries.findLast(e=>e.action==='complete'&&!reversed.has(e.id))||null;}
function inspect(text,today){const {data}=parse(text);let error=null,label=null,entries=[];try{entries=history(data);if(data.recurrence)label=summary(data.recurrence);}catch(e){error=e.message;}
  return {...state(data),recurrence_history:entries,repeat_label:label,recurrence_error:error,last_completion:lastCompletion(entries),advance_needed:!!data.recurrence&&data.completed===true,earlier_planned:!!data.recurrence&&!!data.planned&&data.planned<today&&!data.completed};}
function transform(text,args,{today,recordedAt}={}){
  day(today);const {doc,data,body}=parse(text),before=state(data),entries=history(data);
  if(data.calendar_block)throw new Error('Remove the linked calendar block before configuring or changing recurrence.');
  const {action,operation_id:id}=args;if(typeof id!=='string'||!id||id.length>200)throw new Error('An operation ID is required.');
  const fingerprint=JSON.stringify({action,occurrence:args.occurrence??null,date:args.date??null,rule:args.rule??null,planned:args.planned??null,due:args.due??null});
  const prior=entries.find(e=>e.id===id);if(prior){if(prior.request!==fingerprint)throw new Error('Operation ID was reused for another change.');return {text,duplicate:true,action:prior.action,next:prior.after?.[prior.after?.recurrence?.date_field]??null};}
  let after=copy(before),effective=args.date||today,target=null;
  if(!['configure','stop','reschedule','cancel','complete','skip','undo'].includes(action))throw new Error('Unknown recurring task action.');
  if(action==='configure'){
    if(before.completed)throw new Error('Reopen or reconcile the completed task before configuring repetition.');
    for(const field of ['planned','due'])if(own(args,field)&&args[field]!==null&&args[field]!==undefined)after[field]=args[field]||null;
    const r=rule(args.rule);for(const value of [after.planned,after.due].filter(Boolean))day(value);
    if(!after[r.date_field])throw new Error('Set the first Planned or Deadline date before configuring repetition.');
    if(r.occurrence!==after[r.date_field]||r.anchor!==r.occurrence)throw new Error('A new repeat rule must start at the current selected date.');
    if(r.mode==='fixed'&&r.unit==='week'&&!r.weekdays.includes(DAYS[weekday(r.anchor)]))throw new Error('The first date must match a selected weekday.');
    after.recurrence=r;
  }else if(action==='stop'){
    if(!before.recurrence)throw new Error('This task is not repeating.');after.recurrence=null;
  }else if(action==='undo'){
    const reversed=new Set(entries.filter(e=>e.action==='undo').map(e=>e.reverses));
    target=entries.findLast(e=>['complete','skip'].includes(e.action)&&!reversed.has(e.id));
    if(!target||!equal(before,target.after))throw new Error('The last occurrence cannot be undone after another schedule/date change.');
    after=copy(target.before);
  }else{
    const r=rule(before.recurrence);if(args.occurrence!==r.occurrence)throw new Error('Occurrence changed. Refresh before editing.');
    for(const value of [before.planned,before.due].filter(Boolean))day(value);
    if(!before[r.date_field])throw new Error('The repeat date is missing. Repair it before advancing.');
    if(action==='cancel'){if(!before.completed)throw new Error('There is no external completion to cancel.');after.completed=false;}
    else if(action==='reschedule'){
      for(const field of ['planned','due'])if(own(args,field)&&args[field]!==null&&args[field]!==undefined){if(args[field])day(args[field]);after[field]=args[field]||null;}
      if(!after[r.date_field])throw new Error('Keep the repeat date, or stop repeating first.');
    }else{
      day(effective);if(effective>today)throw new Error('Future completion/skip dates are not allowed.');
      if(before.completed&&!args.date)throw new Error('Choose the date of the external completion before advancing.');
      const reversed=new Set(entries.filter(e=>e.action==='undo').map(e=>e.reverses)),last=entries.findLast(e=>['complete','skip'].includes(e.action)&&!reversed.has(e.id));
      if(last&&effective<last.date)throw new Error('Completion date precedes the previous resolved occurrence.');
      const following=next(r,effective),delta=distance(before[r.date_field],following);
      for(const field of ['planned','due'])if(before[field])after[field]=addDays(before[field],delta);
      after.recurrence={...r,occurrence:following,...(r.mode==='completion'?{anchor:following}:{})};after.completed=false;
    }
  }
  const entry={id,action,request:fingerprint,date:effective,recorded_at:recordedAt||new Date().toISOString(),before,after,...(target?{reverses:target.id}:{})};
  for(const key of ['planned','due','completed','recurrence']){if(key==='recurrence'&&!after[key])doc.delete(key);else doc.set(key,key==='recurrence'?doc.createNode(after[key]):after[key]);}
  // Append to the existing YAML sequence so historical comments remain intact.
  if(!doc.has('recurrence_history'))doc.set('recurrence_history',doc.createNode([]));
  doc.addIn(['recurrence_history'],doc.createNode(entry));
  const output=`---\n${doc.toString()}---\n${body}`;if(new TextEncoder().encode(output).length>512*1024)throw new Error('History reached the 512 KB note limit. Archive history before editing.');
  return {text:output,action,next:after[after.recurrence?.date_field]??null,entry};
}
function create({title,list,planned=null,due=null,details='',category='Inbox',venture=null}){
  if(typeof title!=='string'||!title.trim()||title.length>180||/[\r\n]/.test(title))throw new Error('Enter a task title up to 180 characters.');
  if(!['life','business'].includes(list))throw new Error('Choose a task list.');
  for(const value of [planned,due].filter(Boolean))day(value);
  const name=title.trim().replace(/[\/\\:*?"<>|\x00-\x1f]/g,'-').replace(/^\.+/,'').trim();if(!name)throw new Error('Choose a valid task title.');
  const data={type:'task',category:category||'Inbox',planned:planned||null,due:due||null,completed:false};if(list==='business')data.venture=venture;
  return {name,text:`---\n${YAML.stringify(data)}---\n\n# ${title.trim()}\n${details?'\n'+details+'\n':''}`};
}
module.exports={DAYS,day,iso,addDays,distance,weekday,shift,rule,next,summary,parse,state,history,inspect,lastCompletion,transform,create};
