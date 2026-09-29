const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Vault,parseNote,localDate}=require('../src/vault.cjs');
const {listGoals,createGoal,updateGoal,reviewGoal,nextWeek}=require('../src/goals.cjs');
const {Agent,tools,instructions}=require('../src/agent.cjs');
function fixture(t,options={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orb-goals-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const folder of ['0. Home/Life Tasks','0. Home/Business Tasks',options.goalsFolder||'0. Home/Goals'])fs.mkdirSync(path.join(root,'vault',folder),{recursive:true});
  return new Vault(path.join(root,'vault'),path.join(root,'state'),{rulesPath:'',...options});
}
const goalArgs={title:'Publish portfolio',finish_line:'Publish three case studies and a contact page.'};
function editRaw(vault,note,transform) {fs.writeFileSync(path.join(vault.root,note.path),transform(vault.read(note.path).content));return vault.read(note.path);}
test('goals use configured paths and the existing schema; fourth active goal is allowed',t=>{
  const vault=fixture(t,{goalsFolder:'Outcomes'});vault.validateTaskFolders();
  const task=vault.createTask({title:'Draft case study',list:'business',planned:'2026-09-29'});
  const created=createGoal(vault,{...goalArgs,next_task:task.path,target:'2026-11-20'});
  assert.equal(created.path,'Outcomes/Publish portfolio.md');
  const parsed=parseNote(vault.read(created.path).content);
  assert.deepEqual(parsed.data,{type:'goal',status:'Active',target:'2026-11-20',review:nextWeek(),next_task:'[[0. Home/Business Tasks/Draft case study]]'});
  for(let i=0;i<3;i++)createGoal(vault,goalArgs);
  const result=listGoals(vault);assert.equal(result.active_count,4);assert.equal(result.goals[0].finish_line,goalArgs.finish_line);
  const linked=result.goals.find(g=>g.path===created.path);assert.equal(linked.task.planned,'2026-09-29');assert.equal(linked.next_task_state,'ready');
  assert.equal(new Set(result.goals.map(g=>g.path)).size,4);
});
test('review filters include today, overdue, and missing dates but exclude inactive goals',t=>{
  const vault=fixture(t);
  for(const [title,review,state]of [['Today','2026-09-28','Active'],['Past','2026-09-27','Active'],['Future','2026-09-29','Active'],['Missing','','Active'],['Paused','2026-09-01','Paused']])createGoal(vault,{...goalArgs,title,review,status:state,target:'2026-09-27'});
  const before=vault.publicHistory().length,result=listGoals(vault,{scope:'review_due',date:'2026-09-28'});
  assert.deepEqual(result.goals.map(g=>g.title).sort(),['Missing','Past','Today']);assert.ok(result.goals.every(g=>g.target_passed));
  assert.equal(vault.publicHistory().length,before);assert.equal(listGoals(vault,{scope:'other'}).goals[0].review,null);
  assert.equal(nextWeek('2026-12-28'),'2027-01-04');assert.throws(()=>listGoals(vault,{date:'2026-02-30'}));
});
test('goal dates, links, status and finish lines reject invalid writes before journaling',t=>{
  const vault=fixture(t),task=vault.createTask({title:'Done',list:'life'});vault.updateTask({path:task.path,version:task.version,completed:true});
  fs.writeFileSync(path.join(vault.root,'0. Home/Life Tasks/Hidden.txt'),'---\ntype: task\n---\n');
  const before=vault.publicHistory().length;
  for(const changes of [{target:'2026-02-30'},{review:'2026-09-28T12:00:00'},{status:'Done'},{finish_line:''},{next_task:task.path},{next_task:'../../secret.md'},{next_task:'[[Done]]'},{next_task:'0. Home/Life Tasks/Hidden.txt'}])assert.throws(()=>createGoal(vault,{...goalArgs,...changes}));
  assert.equal(vault.publicHistory().length,before);
});
test('existing short and aliased links resolve; duplicate task titles never choose silently',t=>{
  const vault=fixture(t),a=vault.createTask({title:'Draft',list:'life'}),goal=createGoal(vault,goalArgs);
  editRaw(vault,goal,s=>s.replace('next_task: null','next_task: "[[Draft|Start here]]"'));
  assert.equal(listGoals(vault).goals[0].task.path,a.path);
  vault.createTask({title:'Draft',list:'business'});
  assert.equal(listGoals(vault).goals[0].next_task_state,'ambiguous');assert.equal(listGoals(vault).goals[0].task,null);
  updateGoal(vault,{path:goal.path,version:vault.read(goal.path).version,next_task:a.path});
  assert.equal(listGoals(vault).goals[0].task.path,a.path);
  fs.unlinkSync(path.join(vault.root,a.path));assert.equal(listGoals(vault).goals[0].next_task_state,'broken');
});
test('goal edits preserve unknown YAML, comments, other sections and support exact undo',t=>{
  const vault=fixture(t),goal=createGoal(vault,{...goalArgs,target:'2026-11-20'});
  const before=editRaw(vault,goal,s=>s.replace('type: goal','type: goal # preserve\ncustom: keep')+'\n## Research\n\nKeep this content.\n');
  const result=updateGoal(vault,{path:goal.path,version:before.version,finish_line:'Launch one page.',target:'',why:'Share my work.'});
  const after=vault.read(goal.path).content;assert.match(after,/# preserve/);assert.match(after,/custom: keep/);assert.match(after,/Keep this content/);assert.match(after,/target: null/);assert.match(after,/Launch one page/);
  vault.undo(result.change_id);assert.equal(vault.read(goal.path).content,before.content);
  assert.throws(()=>updateGoal(vault,{path:goal.path,version:before.version,unknown:'x'}),/Unsupported/);
});
test('a review saves history and metadata as one edit; undo restores all original bytes',t=>{
  const vault=fixture(t),task=vault.createTask({title:'Write intro',list:'business'}),goal=createGoal(vault,goalArgs);
  const before=editRaw(vault,goal,s=>s+'\n## References\n\nKeep these.\n');
  const count=vault.publicHistory().length;
  const result=reviewGoal(vault,{path:goal.path,version:before.version,progress:'Chose three projects.',obstacle:'Time to write.',decision:'Write the introduction.',next_task:task.path});
  assert.equal(vault.publicHistory().length,count+1);
  const after=vault.read(goal.path).content,parsed=parseNote(after);
  assert.equal(parsed.data.review,nextWeek());assert.equal(parsed.data.next_task,'[[0. Home/Business Tasks/Write intro]]');
  assert.ok(after.indexOf('### '+localDate())<after.indexOf('## References'));assert.match(after,/Keep these/);
  assert.equal(listGoals(vault).goals[0].check_ins.includes('Chose three projects.'),true);
  vault.undo(result.change_id);assert.equal(vault.read(goal.path).content,before.content);
  assert.throws(()=>reviewGoal(vault,{path:goal.path,version:before.version,progress:'',obstacle:'None',decision:'Continue'}));
  assert.equal(vault.read(goal.path).content,before.content);
});
test('inactive status clears review, reactivation restores cadence, achievement is explicit',t=>{
  const vault=fixture(t),goal=createGoal(vault,goalArgs);
  const paused=updateGoal(vault,{path:goal.path,version:goal.version,status:'Paused'});assert.equal(listGoals(vault,{scope:'other'}).goals[0].review,null);
  const active=updateGoal(vault,{path:goal.path,version:paused.version,status:'Active'});assert.equal(listGoals(vault).goals[0].review,nextWeek());
  reviewGoal(vault,{path:goal.path,version:active.version,progress:'Published the site.',obstacle:'None.',decision:'Mark achieved.',status:'Achieved'});
  const achieved=listGoals(vault,{scope:'other'}).goals[0];assert.equal(achieved.status,'Achieved');assert.equal(achieved.review,null);
});
test('stale goal writes and undo cannot overwrite edits made in Obsidian',t=>{
  const vault=fixture(t),goal=createGoal(vault,goalArgs);
  editRaw(vault,goal,s=>s+'\nExternal edit.\n');
  assert.throws(()=>updateGoal(vault,{path:goal.path,version:goal.version,target:'2026-10-10'}),/changed/);
  assert.throws(()=>reviewGoal(vault,{path:goal.path,version:goal.version,progress:'x',obstacle:'x',decision:'x'}),/changed/);
  assert.throws(()=>vault.undo(goal.change_id),/changed/);
});
test('missing or disabled goals are optional; unsafe folder paths and symlinks are rejected',t=>{
  const vault=fixture(t,{goalsFolder:'Missing/Goals'});fs.rmSync(path.join(vault.root,'Missing'),{recursive:true});
  vault.validateTaskFolders();assert.match(listGoals(vault).setup,/Create Missing\/Goals/);
  assert.throws(()=>createGoal(vault,goalArgs),/Create Missing/);
  vault.goalsFolder='';assert.match(listGoals(vault).setup,/disabled/);
  for(const goalsFolder of ['../outside','.hidden','0. Home/Life Tasks','0. Home'])assert.throws(()=>new Vault(vault.root,vault.stateDir,{goalsFolder}));
  fs.symlinkSync(os.tmpdir(),path.join(vault.root,'Escape'));vault.goalsFolder='Escape/Goals';
  assert.throws(()=>vault.validateTaskFolders(),/Symbolic/);assert.throws(()=>listGoals(vault),/Symbolic/);
});
test('malformed goals are reported and non-goal notes are ignored',t=>{
  const vault=fixture(t);createGoal(vault,goalArgs);
  fs.writeFileSync(path.join(vault.root,vault.goalsFolder,'Bad.md'),'---\ntype: [\n---\n');
  fs.writeFileSync(path.join(vault.root,vault.goalsFolder,'Notes.md'),'# Notes\n- [ ] Not a goal');
  const result=listGoals(vault);assert.equal(result.goals.length,1);assert.equal(result.warnings.length,1);
});
test('task completion and undo refresh goal cards without achieving the goal',async t=>{
  const vault=fixture(t),task=vault.createTask({title:'Draft',list:'business'}),goal=createGoal(vault,{...goalArgs,next_task:task.path}),events=[];
  const agent=new Agent({vault,getKey:()=>'',onActivity:e=>events.push(e)});
  await agent.execute('list_goals',{scope:'active',date:null});
  const result=await agent.execute('update_task',{path:task.path,version:task.version,completed:true});
  let last=events.filter(e=>e.kind==='visual').at(-1).visual;assert.equal(last.kind,'goals');assert.equal(last.goals[0].next_task_state,'completed');assert.equal(last.goals[0].status,'Active');
  await agent.execute('undo_change',{change_id:result.change_id});last=events.filter(e=>e.kind==='visual').at(-1).visual;assert.equal(last.goals[0].next_task_state,'ready');
  assert.equal(vault.read(goal.path).version,goal.version);
  await agent.execute('review_goal',{path:goal.path,version:goal.version,progress:'Started.',obstacle:'None.',decision:'Continue.'});assert.equal(events.filter(e=>e.kind==='visual').at(-1).visual.kind,'goals');
  assert.ok(agent.readSources.has(task.path));assert.ok(agent.readSources.has(goal.path));
});
test('creating an inactive goal makes it visible and switching panels clears goal view state',async t=>{
  const vault=fixture(t),events=[],agent=new Agent({vault,getKey:()=>'',onActivity:e=>events.push(e)});
  await agent.execute('list_goals',{scope:'active',date:null});
  const created=await agent.execute('create_goal',{...goalArgs,status:'Someday'});
  const last=events.filter(e=>e.kind==='visual').at(-1).visual;assert.equal(last.scope,'all');assert.equal(last.goals[0].path,created.path);
  await agent.execute('list_tasks',{scope:'today',date:null});assert.equal(agent.goalView,null);
  await agent.execute('list_goals',{scope:'all',date:null});await agent.execute('dismiss_visual',{});assert.equal(agent.goalView,null);
});
test('goal tools are exposed to both models with explicit completion and review boundaries',t=>{
  const vault=fixture(t);
  for(const name of ['list_goals','create_goal','update_goal','review_goal'])assert.ok(tools.some(tool=>tool.name===name));
  for(const deep of [false,true]) {const prompt=instructions(vault,{deep});assert.match(prompt,/abandoning the review must not write/);assert.match(prompt,/never automatically mark the goal Achieved/);assert.match(prompt,/Goal Target is adjustable/);}
});
test('public examples are parseable, linked, fictional and inactive by default',t=>{
  const state=fs.mkdtempSync(path.join(os.tmpdir(),'orb-goal-template-'));t.after(()=>fs.rmSync(state,{recursive:true,force:true}));
  const vault=new Vault(path.join(__dirname,'../vault-template'),state);vault.validateTaskFolders();
  const result=listGoals(vault,{scope:'all'});assert.deepEqual(result.warnings,[]);assert.equal(result.goals.length,1);assert.equal(result.active_count,0);assert.equal(result.goals[0].next_task_state,'ready');
  assert.match(vault.read(result.goals[0].path).content,/fictional sample content/);
  const YAML=require('yaml'),base=YAML.parse(fs.readFileSync(path.join(vault.root,'0. Home/Goals.base'),'utf8'));
  assert.deepEqual(base.views.map(v=>v.name),['Active','Review due','Other']);
});
test('section edits ignore fenced headings and reject duplicate managed headings',t=>{
  const vault=fixture(t),goal=createGoal(vault,goalArgs);
  const before=editRaw(vault,goal,s=>s.replace('## Why it matters','```md\n## Why it matters\nExample only\n```\n\n## Why it matters'));
  updateGoal(vault,{path:goal.path,version:before.version,why:'Real reason.'});
  assert.match(vault.read(goal.path).content,/Example only\n```/);assert.equal(listGoals(vault).goals[0].why,'Real reason.');
  const duplicate=editRaw(vault,goal,s=>s+'\n## Weekly check-ins\n');
  assert.throws(()=>reviewGoal(vault,{path:goal.path,version:duplicate.version,progress:'Some',obstacle:'None',decision:'Continue'}),/Multiple Weekly check-ins/);
  assert.equal(vault.read(goal.path).content,duplicate.content);
});
test('legacy task layouts overlapping the default goal folder can still start',t=>{
  const vault=fixture(t),folders={life:'0. Home',business:'Work'};
  fs.mkdirSync(path.join(vault.root,'Work'));
  const legacy=new Vault(vault.root,vault.stateDir,{folders,rulesPath:''});legacy.validateTaskFolders();assert.equal(legacy.goalsFolder,'');
  assert.throws(()=>new Vault(vault.root,vault.stateDir,{folders,goalsFolder:'0. Home/Goals'}),/separate/);
});
