const crypto=require('node:crypto');
function text(value,name,max=500){if(typeof value!=='string'||value.length>max)throw new Error(`Invalid ${name}.`);return value;}
function validateVisual(v,allowedSources=new Set()) {
  if(!v||!['table','line','bar','area'].includes(v.kind))throw new Error('Use table, line, bar or area.');
  const title=text(v.title,'title',120).trim();if(!title)throw new Error('A visual needs a title.');
  const sources=v.sources;
  if(!Array.isArray(sources)||!sources.length||sources.length>12)throw new Error('Include at least one source that you have read.');
  const checked=sources.map(s=>{if(!allowedSources.has(s.path))throw new Error(`Read the source before presenting it: ${s.path}`);return {path:s.path,detail:text(s.detail||'','source detail',250)};});
  const base={id:crypto.randomUUID(),kind:v.kind,title,subtitle:text(v.subtitle||'','subtitle'),sources:checked,createdAt:new Date().toISOString()};
  if(v.kind==='table'){
    if(!Array.isArray(v.columns)||v.columns.length<1||v.columns.length>8)throw new Error('Use 1–8 table columns.');
    if(!Array.isArray(v.rows)||v.rows.length>200)throw new Error('Use at most 200 table rows.');
    return {...base,columns:v.columns.map(c=>text(c,'column',80)),rows:v.rows.map(row=>{
      if(!Array.isArray(row)||row.length!==v.columns.length)throw new Error('Table row does not match the columns.');
      return row.map(cell=>{if(cell===null)return null;if(typeof cell==='number'&&Number.isFinite(cell))return cell;return text(cell,'cell',1000);});
    })};
  }
  if(!Array.isArray(v.series)||!v.series.length||v.series.length>4)throw new Error('Use 1–4 chart series.');
  if(!Array.isArray(v.points)||v.points.length<1||v.points.length>150)throw new Error('Use 1–150 chart points.');
  let count=0;
  const points=v.points.map(p=>{
    if(!Array.isArray(p.values)||p.values.length!==v.series.length)throw new Error('Chart values do not match the series.');
    return {label:text(p.label,'point label',100),values:p.values.map(n=>{if(n===null)return null;if(typeof n!=='number'||!Number.isFinite(n))throw new Error('Chart values must be numbers or null for missing data.');count++;return n;})};
  });
  if(!count)throw new Error('No numeric observations to chart.');
  return {...base,series:v.series.map(s=>text(s,'series',80)),points,x_label:text(v.x_label||'','x label',100),y_label:text(v.y_label||'','y label',100),unit:text(v.unit||'','unit',30)};
}
function tasksVisual(result,scope,includeCompleted=false){
  const dateLabel=value=>{if(!value)return null;const day=value.slice(0,10),time=value.includes('T')?value.slice(11,16):'';if(day===result.date)return time||'Today';const date=new Date(day+'T12:00:00');if(!Number.isFinite(date.getTime()))return value;return date.toLocaleDateString('en-GB',{day:'numeric',month:'short',...(day.slice(0,4)!==result.date.slice(0,4)?{year:'numeric'}:{})})+(time?' · '+time:'');};
  const subtitleDate=result.date?new Date(result.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long'}):'';
  const titles=includeCompleted
    ?{today:'All today’s tasks',overdue:'All past-deadline tasks',life:'All life tasks',business:'All business tasks',all:'All tasks'}
    :{today:'Today’s tasks',overdue:'Past deadlines',life:'Life tasks',business:'Business tasks',all:'Your tasks'};
  const completed=result.tasks.filter(t=>t.completed===true).length;
  return {id:crypto.randomUUID(),kind:'table',taskScope:scope,title:titles[scope]||(includeCompleted?'All tasks':'Your tasks'),subtitle:`${subtitleDate} · ${result.tasks.length} ${result.tasks.length===1?'task':'tasks'}${includeCompleted?` · ${completed} completed`:''}${result.warnings?.length?' · Some notes could not be read':''}`,columns:['Task','Area','Planned','Deadline'],rows:result.tasks.map(t=>[t.title,t.venture||t.list,dateLabel(t.planned),dateLabel(t.due)]),rowPaths:result.tasks.map(t=>t.path),taskBlocks:result.tasks.map(t=>t.calendar_block),taskWarnings:result.warnings,taskRepeat:result.tasks.map(t=>t.recurrence_error||t.repeat_label||null),taskCompleted:result.tasks.map(t=>t.completed===true),sources:[],createdAt:new Date().toISOString(),emptyText:'Nothing here. A little breathing room.'};
}
function calendarVisual(result){
  const days=[];
  const addDays=(day,count)=>{const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);};
  for(let day=result.start;day<=result.end;day=addDays(day,1)) days.push({date:day,items:[]});
  for(const item of result.items){
    const first=item.start.slice(0,10);
    // iCal end dates are exclusive. A timed event ending at midnight does not occupy the next day.
    const last=item.kind==='event'&&item.end
      ?(item.allDay||item.end.slice(11,19)==='00:00:00'?addDays(item.end.slice(0,10),-1):item.end.slice(0,10))
      :first;
    for(const day of days) if(day.date>=first&&day.date<=last) day.items.push(item);
  }
  const count=result.items.length;
  return {id:crypto.randomUUID(),kind:'calendar',title:'Your calendar',subtitle:`${count} ${count===1?'entry':'entries'} · ${result.timezone}`,start:result.start,end:result.end,days,warnings:result.warnings,truncated:result.truncated,total:result.total,shown:count,calendars:result.calendars,sources:[],createdAt:new Date().toISOString()};
}
function goalsVisual(result){
  return {id:crypto.randomUUID(),kind:'goals',title:'Your goals',subtitle:`${result.active_count} active · One next action at a time`,
    date:result.date,scope:result.scope,goals:result.goals,warnings:result.warnings,setup:result.setup||null,active_count:result.active_count,sources:[],createdAt:new Date().toISOString()};
}
function habitsVisual(result){return {id:crypto.randomUUID(),kind:'habits',title:'Your habits',subtitle:'Small actions, a little more often.',...result,sources:[],createdAt:new Date().toISOString()};}
module.exports={habitsVisual,validateVisual,tasksVisual,calendarVisual,goalsVisual};
