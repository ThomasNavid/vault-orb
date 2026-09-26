const {test}=require('node:test'),assert=require('node:assert/strict');
const {Agent,instructions}=require('../src/agent.cjs');
test('advanced tool uses GPT-6 Sol Responses and carries reasoning through tool turns',async()=>{
  const requests=[],activity=[];
  const agent=new Agent({vault:{read:()=>({content:'Task rules'}),tasks:()=>({tasks:[{title:'Dentist'}]})},getKey:()=> 'test-key',onActivity:x=>activity.push(x),fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);requests.push({url,body});
    return {ok:true,json:async()=>requests.length===1?{status:'completed',output:[{type:'reasoning',id:'rs_test',summary:[],encrypted_content:'encrypted'},{type:'function_call',call_id:'call_1',name:'list_tasks',arguments:JSON.stringify({scope:'today',date:null,include_completed:false})}]}:{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'You have a dentist task.'}]}]}};
  }});
  const answer=await agent.execute('think_deeply',{request:'Plan my day',context:''});
  assert.equal(answer.text,'You have a dentist task.');assert.equal(requests.length,2);assert.equal(requests[0].body.model,'gpt-6-sol');assert.equal(requests[0].body.store,false);
  assert.ok(requests[1].body.input.some(i=>i.type==='reasoning'&&i.encrypted_content==='encrypted'));assert.ok(requests[1].body.input.some(i=>i.type==='function_call_output'));assert.ok(activity.some(i=>i.kind==='deep'));
  assert.ok(!requests[0].body.tools.some(t=>t.name==='think_deeply'));
});
test('Realtime connection keeps the permanent API key in the backend and includes the advanced tool',async()=>{
  let captured;
  const agent=new Agent({vault:{read:()=>({content:'Rules'})},getKey:()=> 'test-key',fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,text:async()=> 'sdp-answer'};}});
  const answer=await agent.connect('v=0\r\n');assert.equal(answer,'sdp-answer');assert.match(captured.url,/realtime\/calls$/);
  const session=JSON.parse(captured.options.body.get('session'));assert.equal(session.model,'gpt-realtime-2.1');assert.equal(session.audio.output.voice,'marin');assert.ok(session.tools.some(t=>t.name==='think_deeply'));
});
test('cancellation prevents a model tool response from making further edits',async()=>{
  const controller=new AbortController();let wrote=false;
  const agent=new Agent({vault:{read:()=>({content:''}),createTask:()=>{wrote=true;}},getKey:()=> 'test',fetchImpl:async()=>{controller.abort();return {ok:true,json:async()=>({output:[{type:'function_call',name:'create_task',call_id:'x',arguments:'{}'}]})};}});
  await assert.rejects(()=>agent.respond([{role:'user',content:'Add task'}],{signal:controller.signal}));assert.equal(wrote,false);
});
test('API failures are surfaced and never reported as success',async()=>{
  const agent=new Agent({vault:{read:()=>({content:''})},getKey:()=> 'test',fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:{message:'Invalid API key'}})})});
  await assert.rejects(()=>agent.respond([{role:'user',content:'Hello'}]),/401.*Invalid API key/);
});
test('a task created through a tool refreshes the displayed task list with the same scope and date',async()=>{
  const date='2026-09-26',tasks=[{title:'Existing',path:'0. Home/Life Tasks/Existing.md',planned:date,due:null,list:'life'}],queries=[],events=[];
  const vault={
    tasks:query=>{queries.push(query);return {date,tasks:[...tasks],warnings:[]};},
    createTask:()=>{tasks.push({title:'New task',path:'0. Home/Life Tasks/New task.md',planned:date,due:null,list:'life'});return {path:'0. Home/Life Tasks/New task.md',change_id:'change-1',action:'Task added'};}
  };
  const agent=new Agent({vault,getKey:()=>'',onActivity:event=>events.push(event)});
  const query={scope:'today',date,include_completed:false};
  await agent.execute('list_tasks',query);
  await agent.execute('create_task',{title:'New task',list:'life',planned:date});
  const visuals=events.filter(event=>event.kind==='visual').map(event=>event.visual);
  assert.equal(visuals.length,2);
  assert.deepEqual(visuals[1].rows.map(row=>row[0]),['Existing','New task']);
  assert.deepEqual(queries,[query,query]);
});
test('completing a task immediately removes it from the displayed list',async()=>{
  const date='2026-09-26',path='0. Home/Life Tasks/Submit draft.md',events=[];
  let completed=false;
  const agent=new Agent({vault:{
    tasks:()=>({date,tasks:completed?[]:[{path,title:'Submit draft',list:'life',planned:date,due:null}],warnings:[]}),
    updateTask:()=>{completed=true;return {path,change_id:'c1',action:'Task updated'};}
  },getKey:()=>'',onActivity:event=>events.push(event)});
  await agent.execute('list_tasks',{scope:'today',date,include_completed:false});
  await agent.execute('update_task',{path,version:'v1',planned:null,due:null,completed:true,category:null,venture:null});
  const views=events.filter(event=>event.kind==='visual').map(event=>event.visual);
  assert.deepEqual(views[0].rows.map(row=>row[0]),['Submit draft']);
  assert.deepEqual(views[1].rows,[]);
});
test('any successful edit refreshes a task list already in view',async()=>{
  const date='2026-09-26',events=[],queries=[];
  const agent=new Agent({vault:{
    tasks:query=>{queries.push(query);return {date,tasks:[],warnings:[]};},
    appendNote:()=>({path:'Notes/Meeting.md',change_id:'c1',action:'Note appended'})
  },getKey:()=>'',onActivity:event=>events.push(event)});
  const query={scope:'today',date,include_completed:false};
  await agent.execute('list_tasks',query);
  await agent.execute('append_note',{path:'Notes/Meeting.md',version:'v1',text:'Update'});
  assert.deepEqual(queries,[query,query]);
  assert.equal(events.filter(event=>event.kind==='visual').length,2);
});
test('adding a task opens a fresh task view even when no list was previously shown',async()=>{
  const events=[],path='0. Home/Life Tasks/New task.md';
  const agent=new Agent({vault:{
    createTask:()=>({path,change_id:'c1',action:'Task added'}),
    tasks:query=>({date:'2026-09-26',tasks:[{path,title:'New task',list:'life',planned:null,due:null}],warnings:[]})
  },getKey:()=>'',onActivity:event=>events.push(event)});
  await agent.execute('create_task',{title:'New task',list:'life'});
  const view=events.find(event=>event.kind==='visual')?.visual;
  assert.equal(view.title,'Your tasks');
  assert.deepEqual(view.rows.map(row=>row[0]),['New task']);
});
test('a new undated task switches a Today view to all tasks so the addition is visible',async()=>{
  const date='2026-09-26',path='0. Home/Life Tasks/New task.md',events=[];
  let created=false;
  const agent=new Agent({vault:{
    tasks:query=>({date,tasks:query.scope==='today'?[]:created?[{path,title:'New task',list:'life',planned:null,due:null}]:[],warnings:[]}),
    createTask:()=>{created=true;return {path,change_id:'c1',action:'Task added'};}
  },getKey:()=>'',onActivity:event=>events.push(event)});
  await agent.execute('list_tasks',{scope:'today',date,include_completed:false});
  await agent.execute('create_task',{title:'New task',list:'life'});
  const last=events.filter(event=>event.kind==='visual').at(-1).visual;
  assert.equal(last.title,'Your tasks');
  assert.deepEqual(last.rows.map(row=>row[0]),['New task']);
});
test('task note edits and undo refresh the task view',async()=>{
  const path='0. Home/Life Tasks/Task.md',events=[];
  let title='Task';
  const agent=new Agent({vault:{
    tasks:()=>({date:'2026-09-26',tasks:[{path,title,list:'life',planned:null,due:null}],warnings:[]}),
    appendNote:()=>{title='Task edited';return {path,change_id:'c1',action:'Note appended'};},
    undo:()=>{title='Task';return {path,change_id:'c1',action:'Change undone'};}
  },getKey:()=>'',onActivity:event=>events.push(event)});
  await agent.execute('append_note',{path,version:'v1',text:'Details'});
  await agent.execute('undo_change',{change_id:'c1'});
  assert.deepEqual(events.filter(event=>event.kind==='visual').map(event=>event.visual.rows[0][0]),['Task edited','Task']);
});
test('tool activity reports running and final states, including a failed edit',async()=>{
  const events=[];
  const agent=new Agent({vault:{createTask:()=>({path:'0. Home/Life Tasks/Done.md',change_id:'c1',action:'Task added'}),updateTask:()=>{throw new Error('Stale version');}},getKey:()=>'',onActivity:event=>events.push(event)});
  await agent.execute('create_task',{title:'Done',list:'life'});
  await assert.rejects(()=>agent.execute('update_task',{path:'0. Home/Life Tasks/Done.md'}),/Stale version/);
  const states=events.filter(event=>event.kind==='tool-state');
  assert.deepEqual(states.map(event=>event.status),['running','done','running','failed']);
  assert.equal(states[0].id,states[1].id);
  assert.equal(states[2].id,states[3].id);
  assert.notEqual(states[0].id,states[2].id);
  assert.equal(states[1].label,'Task added');
});
test('voice and deep instructions request sourced charts for comparable numeric answers',()=>{
  const vault={read:()=>({content:''})};
  assert.match(instructions(vault),/proactively call show_visual before the final answer/);
  assert.match(instructions(vault,{deep:true}),/at least two comparable values/);
});
