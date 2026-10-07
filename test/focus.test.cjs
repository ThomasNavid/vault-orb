const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Vault}=require('../src/vault.cjs');
const {Agent,tools}=require('../src/agent.cjs');
const {FocusTimer,focusTarget}=require('../src/focus.cjs');
const {validateArguments}=require('../src/providers.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-focus-'));const notes=path.join(root,'vault');fs.mkdirSync(path.join(notes,'0. Home/Life Tasks'),{recursive:true});fs.mkdirSync(path.join(notes,'0. Home/Business Tasks'),{recursive:true});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,vault:new Vault(notes,path.join(root,'state'))};}
// A hand-driven clock and timer queue, so sessions finish without waiting.
function clock(start=Date.parse('2026-09-29T09:00:00Z')){
  const c={now:start,timers:[]};
  c.setTimer=(fn,ms)=>{const t={fn,at:c.now+ms};c.timers.push(t);return t;};
  c.clearTimer=t=>{c.timers=c.timers.filter(x=>x!==t);};
  c.advance=ms=>{c.now+=ms;for(;;){const due=c.timers.filter(t=>t.at<=c.now).sort((a,b)=>a.at-b.at)[0];if(!due)break;c.clearTimer(due);due.fn();}};
  return c;
}
function timer(c,file,events=[]){return new FocusTimer({file,now:()=>c.now,setTimer:c.setTimer,clearTimer:c.clearTimer,onChange:(s,e)=>events.push([e,s?.status??null])});}

test('focus timer runs, pauses, resumes, extends and completes on absolute time',t=>{
  const {root}=fixture(t),c=clock(),events=[],focus=timer(c,path.join(root,'focus.json'),events);
  focus.start({title:'Email',path:null,minutes:25});
  assert.throws(()=>focus.start({title:'Other',path:null,minutes:10}),/already running: Email, 25 min left/);
  c.advance(10*60000);assert.equal(focus.status().remainingMs,15*60000);
  focus.pause();c.advance(30*60000);
  assert.equal(focus.status().status,'paused');assert.equal(focus.status().remainingMs,15*60000);
  focus.resume();focus.extend(5);
  c.advance(19*60000);assert.equal(focus.status().status,'running');
  c.advance(60000);
  assert.equal(focus.status().status,'completed');assert.equal(focus.status().minutes,30);
  assert.deepEqual(events.map(e=>e[0]),['start','pause','resume','extend','complete']);
  // +5 min on a finished session starts it running again.
  focus.extend(5);assert.equal(focus.status().status,'running');assert.equal(focus.status().remainingMs,5*60000);
  focus.stop();assert.equal(focus.status(),null);assert.ok(!fs.existsSync(path.join(root,'focus.json')));
  assert.throws(()=>focus.start({title:'Too long',path:null,minutes:181}),/1 to 180/);
  focus.start({title:'Replace me',path:null,minutes:5});
  assert.equal(focus.start({title:'Replacement',path:null,minutes:10,replace:true}).title,'Replacement');
});

test('focus sessions survive restarts and finish while the app is closed',t=>{
  const {root}=fixture(t),file=path.join(root,'focus.json'),c=clock();
  timer(c,file).start({title:'Reading',path:null,minutes:25});
  c.now+=5*60000;
  const events=[],resumed=timer(c,file,events);
  assert.equal(resumed.restore().remainingMs,20*60000);assert.deepEqual(events,[]);
  c.advance(20*60000);assert.equal(resumed.status().status,'completed');
  const later=timer(clock(c.now+60000),file);assert.equal(later.restore().status,'completed');
  later.dismiss();assert.equal(timer(c,file).restore(),null);
  // Ended while closed: completes quietly with no event, ready for the card.
  timer(c,file).start({title:'Draft',path:null,minutes:10});
  const quiet=[],relaunched=timer(clock(c.now+3600000),file,quiet);
  assert.equal(relaunched.restore().status,'completed');assert.deepEqual(quiet,[]);
  fs.writeFileSync(file,'{broken');assert.equal(timer(c,file).restore(),null);
});

test('a plain timer needs only a length; a task or title is optional',t=>{
  const {vault}=fixture(t);
  const task=vault.createTask({title:'Draft proposal',list:'business'});
  assert.deepEqual(focusTarget(vault,{path:task.path}),{path:task.path,title:'Draft proposal'});
  assert.deepEqual(focusTarget(vault,{title:'  Email  '}),{path:null,title:'Email'});
  assert.deepEqual(focusTarget(vault,{}),{path:null,title:null});
  assert.deepEqual(focusTarget(vault,{path:null,title:'  '}),{path:null,title:null});
  assert.throws(()=>focusTarget(vault,{title:'two\nlines'}),/single-line/);
  assert.throws(()=>focusTarget(vault,{path:'Notes/Other.md'}),/task folder/);
  assert.throws(()=>focusTarget(vault,{path:'0. Home/Life Tasks/Missing.md'}),/not found/);
  vault.updateTask({path:task.path,version:task.version,completed:true});
  assert.throws(()=>focusTarget(vault,{path:task.path}),/already completed/);
});

test('logging focus appends under the task Focus log and can be undone',t=>{
  const {vault}=fixture(t);
  const task=vault.createTask({title:'Draft proposal',list:'business',details:'Outline first.'});
  const at=new Date(2026,8,29,14,5);
  const first=vault.logFocus({path:task.path,version:task.version,minutes:25,note:'drafted the intro',at});
  assert.equal(first.entry,'- 2026-09-29 14:05 · 25 min — drafted the intro');
  assert.match(vault.read(task.path).content,/Outline first\.\n\n## Focus log\n\n- 2026-09-29 14:05 · 25 min — drafted the intro\n$/);
  // An existing section gets the next line, before any later heading.
  vault.appendNote({path:task.path,version:first.version,text:'## Links\n\nNone yet.'});
  vault.logFocus({path:task.path,minutes:10,note:'',at});
  const content=vault.read(task.path).content;
  assert.match(content,/## Focus log\n\n- 2026-09-29 14:05 · 25 min — drafted the intro\n- 2026-09-29 14:05 · 10 min\n\n## Links/);
  assert.throws(()=>vault.logFocus({path:task.path,version:task.version,minutes:5}),/Task changed/);
  assert.throws(()=>vault.logFocus({path:task.path,minutes:5,note:'two\nlines'}),/single line/);
  assert.throws(()=>vault.logFocus({path:task.path,minutes:0}),/Focus minutes/);
  assert.throws(()=>vault.logFocus({path:'Notes/Other.md',minutes:5}),/task folder/);
  const history=vault.publicHistory();assert.equal(history[0].action,'Focus logged');
  vault.undo(history[0].id);
  assert.doesNotMatch(vault.read(task.path).content,/10 min/);
});

test('agent focus tools start, control and log sessions',async t=>{
  const {root,vault}=fixture(t),c=clock(),focus=timer(c,path.join(root,'focus.json'));
  const agent=new Agent({vault,getKey:()=>'',getFocus:()=>focus});
  const schema=name=>tools.find(tool=>tool.name===name).parameters;
  assert.throws(()=>validateArguments(schema('start_focus'),{path:null,title:'x',minutes:25}),/replace/);
  validateArguments(schema('focus'),{action:'extend',minutes:5});
  const task=vault.createTask({title:'Draft proposal',list:'business'});
  const started=await agent.execute('start_focus',{path:task.path,title:null,minutes:null,replace:false});
  assert.equal(started.minutes,25);assert.equal(started.title,'Draft proposal');
  await assert.rejects(agent.execute('start_focus',{path:null,title:'Email',minutes:10,replace:false}),/already running/);
  assert.equal((await agent.execute('focus',{action:'pause',minutes:null})).status,'paused');
  await assert.rejects(agent.execute('focus',{action:'extend',minutes:null}),/how many minutes/);
  await agent.execute('focus',{action:'resume',minutes:null});
  c.advance(25*60000);
  const logged=await agent.execute('log_focus',{path:task.path,version:vault.read(task.path).version,minutes:null,note:'outlined sections'});
  assert.match(logged.entry,/25 min — outlined sections$/);
  assert.equal(vault.tasks().tasks[0].completed,false);
  focus.dismiss();
  await assert.rejects(agent.execute('log_focus',{path:task.path,version:logged.version,minutes:null,note:null}),/how many minutes/);
  assert.deepEqual(await agent.execute('focus',{action:'status',minutes:null}),{running:false});
  // "Give me 25 minutes" on its own: no task, no title.
  const plain=await agent.execute('start_focus',{path:null,title:null,minutes:25,replace:false});
  assert.equal(plain.title,null);assert.equal(plain.path,null);
  await assert.rejects(agent.execute('start_focus',{path:null,title:null,minutes:10,replace:false}),/already running, 25 min left/);
  c.advance(25*60000);assert.equal(focus.status().status,'completed');
  await assert.rejects(agent.execute('log_focus',{path:task.path,version:vault.read(task.path).version,minutes:null,note:null}),/how many minutes/);
  const restored=timer(c,path.join(root,'focus.json'));assert.equal(restored.restore().title,null);
  focus.dismiss();
  await assert.rejects(new Agent({vault,getKey:()=>''}).execute('start_focus',{path:null,title:'Email',minutes:5,replace:false}),/Mac app/);
});
