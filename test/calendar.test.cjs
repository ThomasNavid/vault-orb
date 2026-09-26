const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Vault}=require('../src/vault.cjs');
const {queryCalendar}=require('../src/calendar.cjs');
const {Agent,tools}=require('../src/agent.cjs');
const {calendarVisual}=require('../src/visuals.cjs');

const ics=`BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VTIMEZONE\r
TZID:Europe/London\r
BEGIN:DAYLIGHT\r
TZOFFSETFROM:+0000\r
TZOFFSETTO:+0100\r
TZNAME:BST\r
DTSTART:19700329T010000\r
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r
END:DAYLIGHT\r
BEGIN:STANDARD\r
TZOFFSETFROM:+0100\r
TZOFFSETTO:+0000\r
TZNAME:GMT\r
DTSTART:19701025T020000\r
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r
END:STANDARD\r
END:VTIMEZONE\r
BEGIN:VEVENT\r
UID:weekly@example.test\r
DTSTART;TZID=Europe/London:20260925T090000\r
DTEND;TZID=Europe/London:20260925T100000\r
RRULE:FREQ=WEEKLY;COUNT=4\r
EXDATE;TZID=Europe/London:20261002T090000\r
SUMMARY:Team meeting\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:weekly@example.test\r
RECURRENCE-ID;TZID=Europe/London:20261009T090000\r
DTSTART;TZID=Europe/London:20261009T110000\r
DTEND;TZID=Europe/London:20261009T120000\r
SUMMARY:Moved meeting\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:holiday@example.test\r
DTSTART;VALUE=DATE:20260927\r
DTEND;VALUE=DATE:20260929\r
SUMMARY:Time off\r
END:VEVENT\r
END:VCALENDAR\r
`;

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-calendar-'));
  const vaultRoot=path.join(root,'vault');
  fs.mkdirSync(path.join(vaultRoot,'.obsidian/plugins/full-calendar-remastered'),{recursive:true});
  fs.mkdirSync(path.join(vaultRoot,'0. Home/Life Tasks'),{recursive:true});
  fs.mkdirSync(path.join(vaultRoot,'0. Home/Business Tasks'),{recursive:true});
  fs.writeFileSync(path.join(vaultRoot,'.obsidian/plugins/full-calendar-remastered/data.json'),JSON.stringify({displayTimezone:'Europe/London',calendarSources:[{type:'ical',name:'Personal',url:`https://example.test/${path.basename(root)}.ics?private=secret`}]}));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return new Vault(vaultRoot,path.join(root,'state'));
}

test('calendar query combines recurring iCal events and task dates without exposing feed URL',async t=>{
  const vault=fixture(t);
  vault.createTask({title:'File report',list:'business',planned:'2026-09-27',due:'2026-09-29'});
  const fetchImpl=async(url,options)=>{
    assert.equal(new URL(url).protocol,'https:');
    assert.equal(options.redirect,'error');
    return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>Buffer.from(ics)};
  };
  const result=await queryCalendar(vault,{start:'2026-09-26',end:'2026-10-10',include_tasks:true},{fetchImpl});
  assert.equal(result.timezone,'Europe/London');
  assert.deepEqual(result.items.filter(x=>x.kind==='event').map(x=>x.title),['Time off','Moved meeting'],JSON.stringify(result.warnings));
  assert.equal(result.items.find(x=>x.title==='Moved meeting').start,'2026-10-09T11:00:00');
  assert.equal(result.items.find(x=>x.title==='Time off').end,'2026-09-29');
  assert.deepEqual(result.items.filter(x=>x.kind==='task').map(x=>x.dateType),['planned','due']);
  assert.ok(!JSON.stringify(result).includes('private=secret'));
  assert.deepEqual(result.warnings,[]);
});

test('calendar source failures are reported and cannot be mistaken for an empty calendar',async t=>{
  const vault=fixture(t);
  const result=await queryCalendar(vault,{start:'2026-09-26',end:'2026-09-26',include_tasks:false},{fetchImpl:async()=>{throw new Error('Network unavailable');}});
  assert.equal(result.items.length,0);
  assert.match(result.warnings[0].error,/Network unavailable/);
  await assert.rejects(()=>queryCalendar(vault,{start:'2026-09-26',end:'2027-01-01'}),/93 days/);
});

test('calendar tool is available to voice and deep queries',()=>{
  assert.ok(tools.some(tool=>tool.name==='query_calendar'));
  const agent=new Agent({vault:{read:()=>({content:''})},getKey:()=>''});
  assert.ok(agent);
});

test('calendar visual places multi-day events and task dates on the right days',()=>{
  const visual=calendarVisual({start:'2026-09-27',end:'2026-09-30',timezone:'Europe/London',items:[
    {kind:'event',title:'Time off',start:'2026-09-27',end:'2026-09-29',allDay:true},
    {kind:'event',title:'Late meeting',start:'2026-09-29T23:00:00',end:'2026-09-30T00:00:00',allDay:false},
    {kind:'task',title:'File report',start:'2026-09-30',dateType:'due',allDay:true,path:'Tasks/File report.md'}
  ],total:3,truncated:false,warnings:[],calendars:['Personal']});
  assert.equal(visual.kind,'calendar');
  assert.deepEqual(visual.days.map(day=>day.items.map(item=>item.title)),[
    ['Time off'],['Time off'],['Late meeting'],['File report']
  ]);
});

test('calendar query automatically publishes the companion view with source warnings',async t=>{
  const vault=fixture(t),events=[];
  const agent=new Agent({vault,getKey:()=>'',onActivity:event=>events.push(event),fetchImpl:async()=>{throw new Error('Network unavailable');}});
  const result=await agent.execute('query_calendar',{start:'2026-09-26',end:'2026-09-26',include_tasks:false});
  const view=events.find(event=>event.kind==='visual')?.visual;
  assert.equal(result.warnings.length,1);
  assert.equal(view.kind,'calendar');
  assert.equal(view.days.length,1);
  assert.equal(view.warnings.length,1);
});
