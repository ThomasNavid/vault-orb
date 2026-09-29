const R=require('./recurrence.cjs');
const {acquire}=require('./task-lock.cjs');
function adapter(app,{fs,crypto,folders={life:'0. Home/Life Tasks',business:'0. Home/Business Tasks'}}){
  const root=app.vault.adapter.getBasePath?.();if(!root||!fs||!crypto)throw new Error('Recurring task controls currently require desktop Obsidian. Notes remain readable on mobile.');
  for(const f of Object.values(folders))if(typeof f!=='string'||!f||f.includes('\\')||f.split('/').some(p=>!p||p==='..'||p.startsWith('.')))throw new Error('Invalid task folder.');
  if(folders.life===folders.business||folders.life.startsWith(folders.business+'/')||folders.business.startsWith(folders.life+'/'))throw new Error('Task folders must be separate.');
  const version=text=>crypto.createHash('sha256').update(text).digest('hex');
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const listFor=p=>Object.keys(folders).find(k=>p.startsWith(folders[k]+'/'));
  function safe(relative){if(!listFor(relative)||!relative.endsWith('.md')||relative.includes('\\')||relative.split('/').some(p=>!p||p==='..'||p.startsWith('.')))throw new Error('Choose a Markdown task in a configured task folder.');let current=root;for(const p of relative.split('/')){current+='/'+p;if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error('Symbolic links are not supported.');}}
  async function locked(fn){const release=acquire(fs,root);try{return await fn();}finally{release();}}
  return {
    id:()=>crypto.randomUUID(),
    async list(){const tasks=[],warnings=[];for(const file of app.vault.getMarkdownFiles().filter(f=>listFor(f.path))){try{safe(file.path);const content=await app.vault.read(file);let info;try{info=R.inspect(content,today());}catch(e){if(!/^---[\s\S]*?\btype:\s*task\b/.test(content))continue;throw e;}if(info.completed&&!info.recurrence&&!info.recurrence_history.length)continue;tasks.push({...info,path:file.path,title:file.basename,list:listFor(file.path),version:version(content)});}catch(e){warnings.push({path:file.path,error:e.message});}}return {tasks,warnings};},
    async open(relative){safe(relative);const file=app.vault.getAbstractFileByPath(relative);if(!file)throw new Error('Task not found.');await app.workspace.getLeaf(false).openFile(file);},
    async write(args){return locked(async()=>{safe(args.path);const file=app.vault.getAbstractFileByPath(args.path);if(!file)throw new Error('Task not found.');let result;await app.vault.process(file,current=>{result=R.transform(current,args,{today:today()});if(!result.duplicate&&version(current)!==args.version)throw new Error('Task changed. Refresh before editing.');return result.text;});return {path:args.path,version:version(result.text),next:result.next,duplicate:result.duplicate};});},
    async create(args){return locked(async()=>{const created=R.create(args),folder=folders[args.list];if(!app.vault.getAbstractFileByPath(folder))throw new Error('Create the configured task folder first.');let relative=folder+'/'+created.name+'.md',n=2;while(app.vault.getAbstractFileByPath(relative))relative=folder+'/'+created.name+' ('+(n++)+').md';safe(relative);let text=created.text;if(args.recurrence)text=R.transform(text,{action:'configure',rule:args.recurrence,operation_id:crypto.randomUUID()},{today:today()}).text;await app.vault.create(relative,text);return {path:relative,version:version(text)};});}
  };
}
module.exports={adapter};
