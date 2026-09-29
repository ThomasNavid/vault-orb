const fs=require('node:fs');
const path=require('node:path');
const YAML=require('yaml');
const {parseNote,localDate,dateValue}=require('./vault.cjs');
const STATUSES=['Active','Paused','Someday','Achieved'];
function text(value,name,max=12000) {
  if(typeof value!=='string'||!value.trim()||value.length>max) throw new Error(`${name} must be nonempty text (up to ${max} characters).`);
  return value.trim();
}
function day(value) {
  if(value===null||value==='')return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Goal dates must use YYYY-MM-DD.');
  return dateValue(value);
}
function nextWeek(date=localDate()) {
  day(date);const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+7);return localDate(d);
}
function status(value) {if(!STATUSES.includes(value))throw new Error('Use Active, Paused, Someday, or Achieved.');return value;}
function folder(vault) {
  if(!vault.goalsFolder)throw new Error('Goals are disabled. Set a Goals folder in Settings first.');
  try {const file=vault.resolve(vault.goalsFolder,{note:false});if(!fs.statSync(file).isDirectory())throw new Error('Goals path must be a folder.');return file;}
  catch(e) {if(e.message.startsWith('Not found:'))return null;throw e;}
}
// Locate level-two sections outside fenced code. Other sections and their text
// are preserved when a named section is replaced or a check-in is appended.
function sections(body) {
  const found=[];let offset=0,fence=null;
  for(const line of body.split(/(?<=\n)/)) {
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);
    if(marker) {if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;}
    if(!fence) {const heading=line.match(/^## (.+?)\s*\r?\n?$/);if(heading)found.push({name:heading[1],start:offset,content:offset+line.length});}
    offset+=line.length;
  }
  return found.map((s,i)=>({...s,end:found[i+1]?.start??body.length}));
}
function section(body,name) {const s=sections(body).find(s=>s.name===name);return s?body.slice(s.content,s.end).trim():'';}
function setSection(body,name,value) {
  const matches=sections(body).filter(s=>s.name===name);
  if(matches.length>1)throw new Error(`Multiple ${name} sections. Resolve these in Obsidian before editing.`);
  const s=matches[0],replacement=`## ${name}\n\n${value}\n\n`;
  return s?body.slice(0,s.start)+replacement+body.slice(s.end):body.trimEnd()+'\n\n'+replacement;
}
function linkTarget(value) {
  if(typeof value!=='string')return null;
  const wiki=value.trim().match(/^\[\[([^\]]+)\]\]$/);
  return (wiki?wiki[1].split('|')[0].split('#')[0]:value.trim()).replace(/\.md$/,'');
}
function linkedTask(value,tasks) {
  if(value===null||value===undefined||value==='')return {state:'missing',task:null};
  const target=linkTarget(value);
  if(!target)return {state:'broken',task:null};
  const exact=tasks.filter(t=>t.path.replace(/\.md$/,'')===target);
  const matches=exact.length?exact:tasks.filter(t=>t.path.replace(/\.md$/,'').endsWith('/'+target));
  if(matches.length!==1)return {state:matches.length?'ambiguous':'broken',task:null};
  return {state:matches[0].completed?'completed':'ready',task:matches[0]};
}
function taskLink(vault,value) {
  if(value===null||value==='')return null;
  // Writes always take the exact vault-relative task path, so duplicate titles
  // cannot silently link a different task. Existing Obsidian short links work.
  text(value,'Next task path',2000);
  if(!value.endsWith('.md'))throw new Error('Next task must be a Markdown task note ending in .md.');
  if(!Object.values(vault.folders).some(f=>value.startsWith(f+'/')))throw new Error('Next task must be an exact path in a configured task folder.');
  if(/[\[\]|#\r\n]/.test(value))throw new Error('This task path cannot be represented as an unambiguous Obsidian link. Rename it in Obsidian first.');
  const {data}=parseNote(vault.read(value).content);
  if(data.type!=='task')throw new Error('Next task must link to a task note.');
  if(data.completed===true)throw new Error('Choose an unfinished next task.');
  return `[[${value.slice(0,-3)}]]`;
}
function listGoals(vault,{scope='active',date=localDate()}={}) {
  if(!['active','review_due','other','all'].includes(scope))throw new Error('Unknown goals scope.');
  date=day(date||localDate());if(!date)throw new Error('A query date is required.');
  if(!vault.goalsFolder)return {date,scope,goals:[],warnings:[],active_count:0,setup:'Goals are disabled. Set a Goals folder in Settings to enable them.'};
  if(!folder(vault))return {date,scope,goals:[],warnings:[],active_count:0,setup:`Create ${vault.goalsFolder} in Obsidian to start using goals.`};
  const tasks=vault.tasks({include_completed:true,date}),warnings=[...tasks.warnings],goals=[];
  for(const relative of vault.walk(vault.goalsFolder)) {
    try {
      const note=vault.read(relative),{data,body}=parseNote(note.content);
      if(data.type!=='goal')continue;
      const state=status(data.status),target=day(data.target??null),review=day(data.review??null);
      const next=linkedTask(data.next_task,tasks.tasks),active=state==='Active';
      goals.push({path:relative,title:path.basename(relative,'.md'),version:note.version,status:state,target,review,
        next_task:data.next_task??null,next_task_state:next.state,task:next.task,
        finish_line:section(body,'Finish line'),why:section(body,'Why it matters'),milestones:section(body,'Starting point and milestones'),
        check_ins:section(body,'Weekly check-ins'),review_due:active&&!!review&&review<=date,
        needs_review:active&&(!review||review<=date),target_passed:active&&!!target&&target<date});
    } catch(e) {warnings.push({path:relative,error:e.message});}
  }
  const active_count=goals.filter(g=>g.status==='Active').length;
  const selected=goals.filter(g=>scope==='all'||scope==='active'&&g.status==='Active'||scope==='other'&&g.status!=='Active'||scope==='review_due'&&g.needs_review);
  selected.sort((a,b)=>Number(b.needs_review)-Number(a.needs_review)||(a.review||'9999').localeCompare(b.review||'9999')||a.title.localeCompare(b.title));
  return {date,scope,goals:selected,warnings,active_count};
}
function loadGoal(vault,relative,version) {
  if(!vault.goalsFolder||typeof relative!=='string'||!relative.startsWith(vault.goalsFolder+'/'))throw new Error('Only notes in the configured Goals folder can be updated.');
  const note=vault.read(relative);
  if(note.version!==version)throw new Error('Goal changed. Read it again before editing.');
  const parsed=parseNote(note.content);
  if(parsed.data.type!=='goal')throw new Error('This is not a goal note.');
  return {note,parsed};
}
function metadata(vault,parsed,changes) {
  let changed=false;
  for(const [key,value]of Object.entries(changes)) {
    if(!['status','target','review','next_task','finish_line','why','milestones'].includes(key))throw new Error(`Unsupported goal field: ${key}`);
    if(value===null||value===undefined)continue;
    if(key==='status')parsed.doc.set(key,status(value));
    else if(key==='target'||key==='review')parsed.doc.set(key,day(value));
    else if(key==='next_task')parsed.doc.set(key,taskLink(vault,value));
    else parsed.body=setSection(parsed.body,{finish_line:'Finish line',why:'Why it matters',milestones:'Starting point and milestones'}[key],key==='finish_line'?text(value,'Finish line'):value===''?'':text(value,key));
    changed=true;
  }
  const finalStatus=status(parsed.doc.get('status'));
  if(finalStatus!=='Active')parsed.doc.set('review',null);
  else if(changes.status==='Active'&&parsed.data.status!=='Active'&&!parsed.doc.get('review')&&changes.review!=='')parsed.doc.set('review',nextWeek());
  return changed;
}
function createGoal(vault,args) {
  if(!folder(vault))throw new Error(`Create ${vault.goalsFolder} in Obsidian first, then retry.`);
  const title=text(args.title,'Title',180);
  if(/[\r\n]/.test(title))throw new Error('Title must be a single line.');
  const safe=title.replace(/[\/\\:*?"<>|\x00-\x1f]/g,'-').replace(/^\.+/,'').trim();
  if(!safe)throw new Error('Choose a valid title.');
  const state=status(args.status??'Active');
  const data={type:'goal',status:state,target:day(args.target??null),review:state==='Active'?day(args.review??nextWeek()):null,next_task:taskLink(vault,args.next_task??null)};
  const body=`# ${title}\n\n## Finish line\n\n${text(args.finish_line,'Finish line')}\n\n## Why it matters\n\n${args.why?text(args.why,'Why it matters'):''}\n\n## Starting point and milestones\n\n${args.milestones?text(args.milestones,'Milestones'):''}\n\n## Weekly check-ins\n`;
  let relative=`${vault.goalsFolder}/${safe}.md`,n=2;
  while(fs.existsSync(path.join(vault.root,relative)))relative=`${vault.goalsFolder}/${safe} (${n++}).md`;
  return vault.commit(relative,null,`---\n${YAML.stringify(data)}---\n\n${body}`,'Goal added');
}
function updateGoal(vault,{path:relative,version,...changes}) {
  const {note,parsed}=loadGoal(vault,relative,version);
  if(!metadata(vault,parsed,changes))throw new Error('No fields to update.');
  return vault.commit(relative,note.content,`---\n${parsed.doc.toString()}---\n${parsed.body}`,'Goal updated');
}
function reviewGoal(vault,{path:relative,version,progress,obstacle,decision,next_task=null,status:state=null,target=null,review=null}) {
  const {note,parsed}=loadGoal(vault,relative,version),date=localDate();
  metadata(vault,parsed,{status:state,target,next_task});
  // Persist the check-in and review date in one journaled write. Starting or
  // abandoning a conversation never changes the note or its review date.
  const entry=`### ${date}\n\n- Progress: ${text(progress,'Progress')}\n- Obstacle: ${text(obstacle,'Obstacle')}\n- Decision and next action: ${text(decision,'Decision and next action')}`;
  const previous=section(parsed.body,'Weekly check-ins');
  parsed.body=setSection(parsed.body,'Weekly check-ins',previous?previous+'\n\n'+entry:entry);
  parsed.doc.set('review',parsed.doc.get('status')==='Active'?day(review??nextWeek(date)):null);
  return vault.commit(relative,note.content,`---\n${parsed.doc.toString()}---\n${parsed.body}`,'Goal reviewed');
}
module.exports={STATUSES,listGoals,createGoal,updateGoal,reviewGoal,nextWeek};
