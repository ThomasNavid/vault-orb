// Calendar wall times must be resolved in the calendar zone, never the Mac's zone.
const formatters=new Map();
function timestamp(ms,zone) {
  let fmt=formatters.get(zone);
  if(!fmt){fmt=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});formatters.set(zone,fmt);}
  const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
function wallDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/.test(value))throw new Error('Use YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.');
  const full=value.length===10?value+'T00:00:00':value,ms=Date.parse(full+'Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==full)throw new Error('Invalid calendar date or time.');
  return value;
}
function instant(value,zone) {
  wallDate(value);if(value.length!==19)throw new Error('A timed block requires a start and end time.');
  const naive=Date.parse(value+'Z'),offsets=new Set();
  for(let h=-36;h<=36;h+=6){const probe=naive+h*3600000;offsets.add(Date.parse(timestamp(probe,zone)+'Z')-probe);}
  const matches=[...offsets].map(offset=>naive-offset).filter(ms=>timestamp(ms,zone)===value);
  if(matches.length!==1)throw new Error('This calendar time is ambiguous or does not exist during a daylight-saving change. Choose another time.');
  return matches[0];
}
function workingHours(value) {
  const v=value??{start:'09:00',end:'17:00',days:[1,2,3,4,5]};
  if(!v||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.end)||v.end<=v.start||!Array.isArray(v.days)||!v.days.length||v.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(v.days).size!==v.days.length)throw new Error('Choose working hours with end after start and at least one weekday (0–6).');
  return {start:v.start,end:v.end,days:[...v.days]};
}
module.exports={timestamp,wallDate,instant,workingHours};
