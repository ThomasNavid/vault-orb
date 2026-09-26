const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateVisual,tasksVisual}=require('../src/visuals.cjs');
const {Agent}=require('../src/agent.cjs');
const chart={kind:'area',title:'Savings',subtitle:'Actual balance',series:['Savings'],points:[{label:'Jan',values:[1000]},{label:'Feb',values:[null]},{label:'Mar',values:[-100]}],unit:'GBP',x_label:'Month',y_label:'Balance',sources:[{path:'Savings.csv',detail:'A1:B4'}]};
test('charts require previously read sources and retain zero, negative and missing observations',()=>{
 assert.throws(()=>validateVisual(chart,new Set()),/Read the source/);const visual=validateVisual(chart,new Set(['Savings.csv']));assert.equal(visual.points[1].values[0],null);assert.equal(visual.points[2].values[0],-100);
 assert.throws(()=>validateVisual({...chart,points:[{label:'Jan',values:[Infinity]}]},new Set(['Savings.csv'])),/numbers/);
 assert.throws(()=>validateVisual({...chart,points:[{label:'Jan',values:[100,200]}]},new Set(['Savings.csv'])),/match/);
});
test('visual tables reject ragged rows and do not interpret markup',()=>{
 const v={kind:'table',title:'Compare',columns:['Name','Value'],rows:[['<script>not code</script>',1]],sources:[{path:'Note.md',detail:'Source note'}]};
 assert.equal(validateVisual(v,new Set(['Note.md'])).rows[0][0],'<script>not code</script>');
 assert.throws(()=>validateVisual({...v,rows:[[1]]},new Set(['Note.md'])),/match/);
});
test('task table is made directly from source task values',()=>{
 const v=tasksVisual({date:'2026-09-26',tasks:[{title:'Dentist',path:'Dentist.md',planned:'2026-09-26',due:null,list:'life'}],warnings:[]},'today');
 assert.equal(v.title,'Today’s tasks');assert.deepEqual(v.rows[0],['Dentist','life','Today',null]);assert.equal(v.rowPaths[0],'Dentist.md');assert.deepEqual(v.sources,[]);
});
test('deep-model show_visual emits a UI event and returns a compact tool result',async()=>{
 const events=[];const agent=new Agent({vault:{read:()=>({content:'January: 1000. March: -100.',version:'v'})},getKey:()=>'',onActivity:e=>events.push(e)});
 await agent.execute('read_note',{path:'Savings.csv'});const result=await agent.execute('show_visual',chart);
 assert.equal(result.displayed,true);assert.equal(events.find(e=>e.kind==='visual').visual.kind,'area');assert.equal(result.points,undefined);
});
