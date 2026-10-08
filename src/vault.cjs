const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const YAML = require('yaml');
const recurrence=require('./recurrence.cjs');
const {acquire}=require('./task-lock.cjs');

const FOLDERS = { life: '0. Home/Life Tasks', business: '0. Home/Business Tasks' };
const RULES_PATH = '0. Home/Task Rules.md';
const GOALS_FOLDER = '0. Home/Goals';
const HABIT_FOLDER = '0. Home/Habit Log';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function estimatedMinutes(value) {
  if(value===null||value===undefined)return null;
  if(!Number.isSafeInteger(value)||value<1||value>10080)throw new Error('Estimated minutes must be a whole number from 1 to 10080.');
  return value;
}
function string(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must be nonempty text (up to ${max} characters).`);
  return value.trim();
}
function vaultPath(value, name, {note=false}={}) {
  const relative=string(value,name,500);
  if(path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p=>!p || p==='..' || p.startsWith('.'))) throw new Error(`${name} must be a visible path relative to the vault.`);
  if(note && !relative.endsWith('.md')) throw new Error(`${name} must be a Markdown note.`);
  return relative;
}
function dateValue(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/.test(value)) throw new Error('Use a local date YYYY-MM-DD, or YYYY-MM-DDTHH:mm:ss.');
  const [y,m,d,h=0,min=0,s=0] = value.split(/[-T:]/).map(Number);
  const check = new Date(y,m-1,d,h,min,s);
  if (check.getFullYear()!==y || check.getMonth()!==m-1 || check.getDate()!==d || check.getHours()!==h || check.getMinutes()!==min || check.getSeconds()!==s) throw new Error('Invalid calendar date or local time.');
  return value;
}
function parseNote(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { doc: new YAML.Document({}), data: {}, body: text, hasFrontmatter: false };
  const doc = YAML.parseDocument(match[1]);
  if (doc.errors.length || !YAML.isMap(doc.contents)) throw new Error('Invalid YAML properties; fix this note in Obsidian first.');
  return { doc, data: doc.toJSON(), body: text.slice(match[0].length), hasFrontmatter: true };
}
function atomicWrite(file, text) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp,text,{mode:0o600,flag:'wx'});
    const fd=fs.openSync(temp,'r'); try {fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    fs.renameSync(temp,file);
  } finally { if(fs.existsSync(temp)) fs.unlinkSync(temp); }
}

class Vault {
  constructor(root, stateDir, {folders=FOLDERS,rulesPath=RULES_PATH,goalsFolder,habitFolder,habitScript='99. System/99.4 Scripts/habits/view.js'}={}) {
    this.root = fs.realpathSync(root);
    if (!fs.statSync(this.root).isDirectory()) throw new Error('Choose a vault folder.');
    this.folders={life:vaultPath(folders.life,'Life tasks folder'),business:vaultPath(folders.business,'Business tasks folder')};
    if(this.folders.life===this.folders.business || this.folders.life.startsWith(this.folders.business+'/') || this.folders.business.startsWith(this.folders.life+'/')) throw new Error('Life and business task folders must be separate.');
    this.rulesPath=rulesPath===''?'':vaultPath(rulesPath,'Task rules note',{note:true});
    // An older custom task layout may contain the default Goals path. Keep
    // that installation usable until the user chooses a separate goal folder.
    const overlaps=folder=>Object.values(this.folders).some(f=>f===folder || f.startsWith(folder+'/') || folder.startsWith(f+'/'));
    const configuredGoals=goalsFolder===undefined?(overlaps(GOALS_FOLDER)?'':GOALS_FOLDER):goalsFolder;
    this.goalsFolder=configuredGoals===''?'':vaultPath(configuredGoals,'Goals folder');
    if(this.goalsFolder && Object.values(this.folders).some(f=>f===this.goalsFolder || f.startsWith(this.goalsFolder+'/') || this.goalsFolder.startsWith(f+'/'))) throw new Error('Goals and task folders must be separate.');
    const habitOverlaps=f=>overlaps(f)||(this.goalsFolder&&(f===this.goalsFolder||f.startsWith(this.goalsFolder+'/')||this.goalsFolder.startsWith(f+'/')));
    const configuredHabits=habitFolder===undefined?(habitOverlaps(HABIT_FOLDER)?'':HABIT_FOLDER):habitFolder;
    this.habitFolder=configuredHabits===''?'':vaultPath(configuredHabits,'Habit log folder');
    if(this.habitFolder&&habitOverlaps(this.habitFolder))throw new Error('Habit log, goals and task folders must be separate.');
    this.habitScript=vaultPath(habitScript,'Habit dashboard script');
    if(!this.habitScript.endsWith('.js'))throw new Error('Habit dashboard script must end in .js.');
    this.stateDir = stateDir;
    fs.mkdirSync(stateDir,{recursive:true,mode:0o700});
    this.journalFile = path.join(stateDir,`history-${hash(this.root).slice(0,16)}.json`);
  }
  withTaskLock(fn) {
    if(this.taskLockHeld) return fn();
    const release=acquire(fs,this.root);
    this.taskLockHeld=true;
    try {return fn();}
    finally {this.taskLockHeld=false;release();}
  }
  validateTaskFolders() {
    for(const [list,folder] of Object.entries(this.folders)) {
      const file=this.resolve(folder,{note:false});
      if(!fs.statSync(file).isDirectory()) throw new Error(`${list} tasks path must be a folder.`);
    }
    if(this.rulesPath) this.read(this.rulesPath);
    for(const optionalFolder of [this.goalsFolder,this.habitFolder].filter(Boolean)) {
      // Missing goals folders are allowed for existing installations. Validate
      // each existing ancestor, including symlinks, without creating anything.
      const parts=optionalFolder.split('/');
      for(let i=1;i<=parts.length;i++) {
        const relative=parts.slice(0,i).join('/');
        const file=this.resolve(relative,{note:false,missing:true});
        if(!fs.existsSync(file)) break;
        if(!fs.statSync(file).isDirectory()) throw new Error('Goals and habit log paths must be folders.');
      }
    }
  }
  resolve(relative, {missing=false, note=true}={}) {
    string(relative,'Note path',2000);
    if(path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p=>!p || p==='..' || p.startsWith('.'))) throw new Error('Only visible files inside the selected vault are accessible.');
    if(note && !relative.endsWith('.md')) throw new Error('Only Markdown notes are supported.');
    const target=path.join(this.root,relative);
    let current=this.root;
    const parts=relative.split('/');
    for(let i=0;i<parts.length;i++) {
      current=path.join(current,parts[i]);
      if(!fs.existsSync(current)) {
        // lstat also detects dangling symlinks.
        try { if(fs.lstatSync(current).isSymbolicLink()) throw new Error('Symbolic links are not supported.'); } catch(e) {if(e.code!=='ENOENT') throw e;}
        if(missing && i===parts.length-1) return target;
        throw new Error(`Not found: ${relative}`);
      }
      if(fs.lstatSync(current).isSymbolicLink()) throw new Error('Symbolic links are not supported.');
      const real=fs.realpathSync(current);
      if(!real.startsWith(this.root+path.sep)) throw new Error('Path is outside the vault.');
    }
    return target;
  }
  read(relative) {
    const file=this.resolve(relative,{note:false});
    if(!['.md','.txt'].includes(path.extname(file).toLowerCase()))throw new Error('Only Markdown and plain text notes are supported.');
    if(fs.statSync(file).size>512*1024) throw new Error('This note is too large (maximum 512 KB).');
    const content=fs.readFileSync(file,'utf8');
    return {path:relative,content,version:hash(content)};
  }
  readHabitScript(relative=this.habitScript) {
    if(relative!==this.habitScript||!relative.endsWith('.js'))throw new Error('Only the configured habit dashboard can be edited.');
    const file=this.resolve(relative,{note:false});
    if(!fs.statSync(file).isFile()||fs.statSync(file).size>128*1024)throw new Error('Habit definitions must be a .js file up to 128 KB.');
    const content=fs.readFileSync(file,'utf8');
    return {path:relative,content,version:hash(content)};
  }
  readChange(entry) {return entry.habitDefinitions?this.readHabitScript(entry.path):this.read(entry.path);}
  walk(folder='',extensions=['.md']) {
    const base=folder ? this.resolve(folder,{note:false}) : this.root;
    const result=[];
    const visit=(dir,depth=0)=> {
      if(depth>24) return;
      for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
        if(entry.name.startsWith('.') || entry.isSymbolicLink() || ['node_modules','dist'].includes(entry.name)) continue;
        const file=path.join(dir,entry.name);
        if(entry.isDirectory()) visit(file,depth+1);
        else if(entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) result.push(path.relative(this.root,file));
      }
    };
    visit(base); return result.sort();
  }
  findFiles(query) {
    const terms=string(query,'Search query',300).toLowerCase().split(/\s+/);
    return {files:this.walk('',['.md','.txt','.csv','.tsv','.xlsx']).map(p=>({path:p,score:terms.reduce((s,t)=>s+(p.toLowerCase().includes(t)?1:0),0)})).filter(f=>f.score).sort((a,b)=>b.score-a.score).slice(0,40)};
  }
  search(query,limit=12) {
    const terms=string(query,'Search query',300).toLowerCase().split(/\s+/);
    const results=[]; let skipped=0;
    for(const relative of this.walk()) {
      try {
        const note=this.read(relative), lower=note.content.toLowerCase(), title=relative.toLowerCase();
        const score=terms.reduce((s,t)=>s+(title.includes(t)?8:0)+(lower.includes(t)?1:0),0);
        if(score) {
          const index=Math.max(0,lower.indexOf(terms.find(t=>lower.includes(t)) || terms[0]));
          results.push({path:relative,version:note.version,score,excerpt:note.content.slice(Math.max(0,index-100),index+600)});
        }
      } catch {skipped++;}
    }
    results.sort((a,b)=>b.score-a.score);
    return {results:results.slice(0,Math.min(30,limit)),total:results.length,skipped};
  }
  tasks({scope='all',date=localDate(),include_completed=false}={}) {
    if(!['all','today','overdue','life','business'].includes(scope)) throw new Error('Unknown task scope.');
    dateValue(date); const day=date.slice(0,10), tasks=[], warnings=[];
    for(const [list,folder] of Object.entries(this.folders)) {
      if(!fs.existsSync(path.join(this.root,folder))) continue;
      for(const relative of this.walk(folder)) {
        try {
          const note=this.read(relative), {data}=parseNote(note.content);
          if(data.type!=='task' || (!include_completed && data.completed===true&&!data.recurrence)) continue;
          let repeat={};if(data.recurrence||data.recurrence_history){repeat=recurrence.inspect(note.content,day);if(repeat.recurrence_error)warnings.push({path:relative,error:repeat.recurrence_error});}
          const planned=typeof data.planned==='string'?data.planned:null, due=typeof data.due==='string'?data.due:null;
          const today=planned?.slice(0,10)===day || due?.slice(0,10)===day;
          const overdue=!!due && due.slice(0,10)<day;
          if(scope==='today'&&!today || scope==='overdue'&&!overdue || ['life','business'].includes(scope)&&scope!==list) continue;
          let estimate=null;try{estimate=estimatedMinutes(data.estimated_minutes);}catch(e){warnings.push({path:relative,error:e.message});}
          tasks.push({task_id:data.task_id||null,calendar_block:data.calendar_block||null,path:relative,title:path.basename(relative,'.md'),list,category:data.category||'Inbox',venture:data.venture||null,planned,due,completed:data.completed===true,today,overdue,version:note.version,estimated_minutes:estimate,...repeat});
        } catch(e) {warnings.push({path:relative,error:e.message});}
      }
    }
    tasks.sort((a,b)=>(a.due||a.planned||'9999').localeCompare(b.due||b.planned||'9999'));
    return {date:day,tasks,warnings};
  }
  history() {
    if(!fs.existsSync(this.journalFile)) return [];
    const entries=JSON.parse(fs.readFileSync(this.journalFile,'utf8'));
    if(!Array.isArray(entries)) throw new Error('Change history is damaged. Restore it before making changes.');
    // Recover a crash between applying a change and marking its journal entry.
    for(const e of entries) if(e.status==='pending') {
      try {e.status=this.readChange(e).version===e.afterHash?'applied':'uncertain';} catch {e.status='uncertain';}
    }
    return entries;
  }
  publicHistory() {return this.history().slice(-30).reverse().map(({id,path,action,at,status,calendar,reminders})=>({id,path,action,at,status,undoable:!calendar&&!reminders}));}
  commit(relative,before,after,action,options={}) {return this.withTaskLock(()=>this._commit(relative,before,after,action,options));}
  _commit(relative,before,after,action,{calendar=false,reminders=false,habitDefinitions=false}={}) {
    if(habitDefinitions){this.readHabitScript(relative);if(before===null||Buffer.byteLength(after)>128*1024)throw new Error('Habit dashboard edits require an existing file up to 128 KB.');}
    const file=this.resolve(relative,{missing:before===null,note:!habitDefinitions});
    if(before!==null && fs.readFileSync(file,'utf8')!==before) throw new Error('Note changed since it was read. Read it again before editing.');
    const entries=this.history();
    const entry={id:crypto.randomUUID(),path:relative,action,at:new Date().toISOString(),before,afterHash:hash(after),calendar,reminders,...(habitDefinitions?{habitDefinitions:true}:{}),status:'pending'};
    entries.push(entry); atomicWrite(this.journalFile,JSON.stringify(entries,null,2));
    try {
      if(before===null) fs.writeFileSync(file,after,{flag:'wx',mode:0o600});
      else atomicWrite(file,after);
    } catch(e) {entry.status='failed';atomicWrite(this.journalFile,JSON.stringify(entries,null,2));throw e;}
    entry.status='applied'; atomicWrite(this.journalFile,JSON.stringify(entries,null,2));
    return {path:relative,version:entry.afterHash,change_id:entry.id,action};
  }
  createTask(args) {return this.withTaskLock(()=>this._createTask(args));}
  _createTask(args) {
    const title=string(args.title,'Title',180);
    if(/[\r\n]/.test(title)) throw new Error('Title must be a single line.');
    const folder=this.folders[args.list]; if(!folder) throw new Error('Choose life or business.');
    this.resolve(folder,{note:false});
    const safe=title.replace(/[\/\\:*?"<>|\x00-\x1f]/g,'-').replace(/^\.+/,'').trim();
    if(!safe) throw new Error('Choose a valid title.');
    let relative=`${folder}/${safe}.md`, n=2;
    while(fs.existsSync(path.join(this.root,relative))) relative=`${folder}/${safe} (${n++}).md`;
    const data={type:'task',category:args.category ? string(args.category,'Category',100):'Inbox',planned:dateValue(args.planned??null),due:dateValue(args.due??null),completed:false};
    if(args.estimated_minutes!=null)data.estimated_minutes=estimatedMinutes(args.estimated_minutes);
    if(args.list==='business') data.venture=args.venture?string(args.venture,'Venture',100):null;
    const body=args.details ? string(args.details,'Details',20000) : '';
    let content=`---\n${YAML.stringify(data)}---\n\n# ${title}\n${body?'\n'+body+'\n':''}`;
    if(args.recurrence)content=recurrence.transform(content,{action:'configure',rule:args.recurrence,operation_id:crypto.randomUUID()},{today:localDate()}).text;
    return this.commit(relative,null,content,'Task added');
  }
  updateTask(args) {return this.withTaskLock(()=>this._updateTask(args));}
  _updateTask({path:relative,version,...changes}) {
    if(!Object.values(this.folders).some(f=>relative.startsWith(f+'/'))) throw new Error('Only task notes in the task folders can be updated.');
    const note=this.read(relative);
    if(version!==note.version) throw new Error('Task changed. Read it again before editing.');
    const parsed=parseNote(note.content); if(parsed.data.calendar_block&&changes.planned!=null)throw new Error('This task has a linked calendar block. Move or remove the block instead of editing Planned separately.'); if(parsed.data.type!=='task') throw new Error('This is not a task note.');
    if(parsed.data.recurrence&&changes.completed===true){
      if(Object.entries(changes).some(([k,v])=>k!=='completed'&&v!==null&&v!==undefined))throw new Error('Complete a recurring occurrence separately from other changes.');
      return this.recurringTask({path:relative,version,action:'complete',occurrence:parsed.data.recurrence.occurrence,operation_id:crypto.randomUUID()});
    }
    if(parsed.data.recurrence&&changes.completed===false)throw new Error('Use recurring cancel for an external completion or undo for the previous occurrence.');
    if(parsed.data.recurrence&&['planned','due'].some(k=>changes[k]!==null&&changes[k]!==undefined)){
      const r=recurrence.rule(parsed.data.recurrence);
      for(const k of ['planned','due'])if(changes[k])recurrence.day(changes[k]);
      if(changes[r.date_field]==='')throw new Error('Stop repeating before clearing the repeat date.');
    }
    let changed=false;
    for(const [key,value] of Object.entries(changes)) {
      if(!['planned','due','completed','category','venture','estimated_minutes'].includes(key)) throw new Error(`Unsupported task field: ${key}`);
      // Null means leave unchanged; empty date string clears a date.
      if(value===null || value===undefined) continue;
      if(key==='estimated_minutes'){if(value==='')parsed.doc.delete(key);else parsed.doc.set(key,estimatedMinutes(value));}
      else if(key==='completed') {if(typeof value!=='boolean') throw new Error('Completed must be true or false.');parsed.doc.set(key,value);}
      else if(['planned','due'].includes(key)) parsed.doc.set(key,dateValue(value));
      else parsed.doc.set(key,string(value,key,100));
      changed=true;
    }
    if(!changed) throw new Error('No fields to update.');
    return this.commit(relative,note.content,`---\n${parsed.doc.toString()}---\n${parsed.body}`,'Task updated');
  }
  recurringTask(args) {
    return this.withTaskLock(()=>{
      if(!Object.values(this.folders).some(f=>args.path?.startsWith(f+'/')))throw new Error('Choose a note in a task folder.');
      const note=this.read(args.path),result=recurrence.transform(note.content,args,{today:localDate()});
      if(result.duplicate)return {path:args.path,version:note.version,duplicate:true,action:result.action,next:result.next};
      if(args.version!==note.version)throw new Error('Task changed. Refresh before editing.');
      const saved=this.commit(args.path,note.content,result.text,'Recurring task '+args.action);
      return {...saved,next:result.next,occurrence:result.entry?.after.recurrence?.occurrence||null};
    });
  }
  appendNote({path:relative,version,text}) {
    const note=this.read(relative); if(version!==note.version) throw new Error('Note changed. Read it again before appending.');
    return this.commit(relative,note.content,note.content.trimEnd()+'\n\n'+string(text,'Text',20000)+'\n','Note appended');
  }
  // One line per focus session under the task's own "## Focus log" heading.
  logFocus({path:relative,version,minutes,note=null,at=new Date()}) {
    return this.withTaskLock(()=>{
      if(!Object.values(this.folders).some(f=>relative?.startsWith(f+'/'))) throw new Error('Focus can only be logged on a note in a task folder.');
      const current=this.read(relative);
      if(version!==undefined&&version!==null&&version!==current.version) throw new Error('Task changed. Read it again before logging focus.');
      if(parseNote(current.content).data.type!=='task') throw new Error('This is not a task note.');
      if(!Number.isSafeInteger(minutes)||minutes<1||minutes>1440) throw new Error('Focus minutes must be a whole number from 1 to 1440.');
      const text=note===null||note===undefined||note.trim()===''?'':string(note,'Progress note',500);
      if(/[\r\n]/.test(text)) throw new Error('Progress note must be a single line.');
      const line=`- ${localDate(at)} ${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')} · ${minutes} min${text?' — '+text:''}`;
      const lines=current.content.split('\n'),heading=lines.findIndex(l=>/^##\s+Focus log\s*$/i.test(l));
      let after;
      if(heading<0) after=`${current.content.trimEnd()}\n\n## Focus log\n\n${line}\n`;
      else {
        let end=lines.findIndex((l,i)=>i>heading&&/^#{1,6}\s/.test(l));if(end<0)end=lines.length;
        let insert=end;while(insert>heading+1&&lines[insert-1].trim()==='')insert--;
        lines.splice(insert,0,...(insert===heading+1?['',line]:[line]));
        after=lines.join('\n');if(!after.endsWith('\n'))after+='\n';
      }
      return {...this.commit(relative,current.content,after,'Focus logged'),entry:line};
    });
  }
  undo(id) {return this.withTaskLock(()=>this._undo(id));}
  _undo(id) {
    const entries=this.history(), entry=id?entries.find(e=>e.id===id):entries.findLast(e=>e.status==='applied');
    if(!entry || entry.status!=='applied') throw new Error('No change available to undo.');
    const current=this.readChange(entry), file=this.resolve(entry.path,{note:!entry.habitDefinitions});
    if(entry.calendar)throw new Error('This change is linked to a calendar write. Move the block back, remove it, or repair its link instead of note undo.');
    if(entry.reminders)throw new Error('This change establishes a Reminders link. Pause sync and manage the linked copies explicitly instead of note undo.');
    const nowData=entry.habitDefinitions?{}:parseNote(current.content).data,oldData=entry.habitDefinitions?{}:entry.before?parseNote(entry.before).data:{};
    if((nowData.calendar_block||oldData.calendar_block)&&(JSON.stringify(nowData.calendar_block)!==JSON.stringify(oldData.calendar_block)||nowData.planned!==oldData.planned))throw new Error('Undo would disconnect the calendar block. Repair the link first.');
    if(current.version!==entry.afterHash) throw new Error('This note has changed since that action. Undo newer edits first, or review it in Obsidian.');
    if(entry.before===null) fs.unlinkSync(file); else atomicWrite(file,entry.before);
    entry.status='undone'; atomicWrite(this.journalFile,JSON.stringify(entries,null,2));
    return {path:entry.path,action:'Change undone',change_id:entry.id};
  }
}
module.exports={Vault,FOLDERS,RULES_PATH,GOALS_FOLDER,HABIT_FOLDER,parseNote,localDate,dateValue,hash,atomicWrite,estimatedMinutes};
