const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),YAML=require('yaml');
const {parseNote,dateValue,hash,atomicWrite}=require('./vault.cjs');
const KEY=/^[a-f0-9-]{36}$/;
const fields=task=>({title:task.title,due:dateValue(task.due??null),completed:task.completed===true});
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const marker=(scope,key)=>`[Vault Orb ${scope}:${key}]`;
function identity(notes){const matches=[...notes.matchAll(/^\[Vault Orb ([a-f0-9]{16}):([a-f0-9-]{36})\]$/gm)];if(matches.length>1)throw new Error('Multiple Orb links in reminder notes. Keep the original link only.');return matches[0]?{scope:matches[0][1],key:matches[0][2]}:null;}
function notesFor(notes,scope,key,task){
  const start=marker(scope,key),end='[/Vault Orb]',at=notes.indexOf(start);
  const block=`${start}\nCategory: ${String(task.category||'Inbox').replace(/[\r\n]/g,' ')}${task.venture?'\nVenture: '+String(task.venture).replace(/[\r\n]/g,' '):''}\n${end}`;
  if(at<0)return notes.trimEnd()+(notes.trim()?'\n\n':'')+block;
  const tail=notes.indexOf('\n'+end,at);if(tail<0)throw new Error('Orb category block is incomplete. Restore its [/Vault Orb] closing line.');
  return notes.slice(0,at)+block+notes.slice(tail+1+end.length);
}
function nativeAdapter({packaged=false,resourcesPath=process.resourcesPath}={}){
  let native;
  const call=async input=>{
    if(process.platform!=='darwin')throw new Error('Apple Reminders sync is available on macOS only.');
    try{native??=require(packaged?path.join(resourcesPath,'orb-reminders.node'):path.join(__dirname,'../native/orb-reminders.node'));}
    catch{throw new Error('Reminders support is missing from this build. Build the native modules and package Orb again.');}
    return JSON.parse(await native.request(JSON.stringify(input)));
  };
  return {connect:()=>call({operation:'connect'}),lists:()=>call({operation:'lists'}),read:listIds=>call({operation:'read',listIds}),save:input=>call({operation:'save',...input})};
}

class RemindersSync {
  constructor({directory,getVault,getConfig,saveConfig,adapter,onChange=()=>{},isBusy=()=>false}){
    Object.assign(this,{directory,getVault,getConfig,saveConfig,adapter,onChange,isBusy});this.running=null;this.report={issues:[],lastSync:null};
  }
  settings(){const v=this.getVault(),saved=this.getConfig().reminders;return {...(saved?.vault===v?.root?saved:{enabled:false}),...this.report,busy:!!this.running};}
  async connect(){await this.adapter.connect();return this.adapter.lists();}
  state(vault){
    const scope=hash(vault.root).slice(0,16),file=path.join(this.directory,scope+'.json');
    let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('Reminders sync history could not be read. Restore it before syncing.');}
    if(data&&(data.version!==1||data.scope!==scope||!Array.isArray(data.entries)))throw new Error('Reminders sync history is invalid. Restore it before syncing.');
    if(data){
      const keys=new Set(),ids=new Set();
      for(const entry of data.entries){
        if(!entry||!KEY.test(entry.key)||keys.has(entry.key)||!entry.base||typeof entry.base.title!=='string'||typeof entry.base.completed!=='boolean'||(entry.remoteId&&ids.has(entry.remoteId)))throw new Error('Reminders sync history contains invalid or duplicate links. Restore it before syncing.');
        dateValue(entry.base.due);keys.add(entry.key);if(entry.remoteId)ids.add(entry.remoteId);
      }
    }
    return {file,data:data||{version:1,scope,entries:[]}};
  }
  persist(state){fs.mkdirSync(this.directory,{recursive:true,mode:0o700});atomicWrite(state.file,JSON.stringify(state.data,null,2));}
  async configure(input){
    if(this.running)throw new Error('Wait for Reminders sync to finish.');
    const vault=this.getVault();if(!vault)throw new Error('Choose and save a vault first.');
    if(input?.enabled===false){this.saveConfig({...this.getConfig(),reminders:{...this.getConfig().reminders,enabled:false}});return this.settings();}
    const {life,business}=input||{};
    if(typeof life!=='string'||typeof business!=='string'||!life||!business||life===business)throw new Error('Choose a different reminder list for Life and Business.');
    const lists=await this.adapter.lists();for(const id of [life,business])if(!lists.some(l=>l.id===id))throw new Error('Choose available, writable reminder lists.');
    if(this.getVault()!==vault)throw new Error('Vault changed during setup. Reopen Settings.');
    const state=this.state(vault),mapping={life,business};
    if(state.data.mapping&&!equal(state.data.mapping,mapping)&&state.data.entries.length)throw new Error('This vault already has linked tasks. Reconnect the original Life and Business lists to preserve those links.');
    state.data.mapping=mapping;this.persist(state);
    this.saveConfig({...this.getConfig(),reminders:{enabled:true,vault:vault.root,...mapping}});this.report={issues:[],lastSync:null};
    return this.sync();
  }
  sync(){
    if(this.running)return this.running;
    const settings=this.settings();if(!settings.enabled)return Promise.resolve(settings);
    if(this.isBusy())return Promise.resolve({...settings,deferred:true});
    this.running=this.run().then(report=>{this.report=report;return {...this.settings(),busy:false};}).catch(e=>{this.report={...this.report,error:e.message};return {...this.settings(),busy:false};}).finally(()=>{this.running=null;});
    return this.running;
  }
  async run(){
    const vault=this.getVault(),config=this.getConfig().reminders,state=this.state(vault),scope=state.data.scope;
    const mapping={life:config.life,business:config.business};
    if(!equal(mapping,state.data.mapping))throw new Error('Reconnect the original reminder lists before syncing.');
    vault.validateTaskFolders();
    const snapshot=vault.tasks({include_completed:true});
    const issues=[],changes=[];let exported=0,imported=0,updated=0;
    const warn=(title,message)=>issues.push({title,message});
    // Unreadable notes must never be mistaken for deleted or newly imported tasks.
    if(snapshot.warnings.length)throw new Error('Fix task warnings in Orb before syncing Reminders: '+snapshot.warnings[0].error);
    const tasks=snapshot.tasks.map(t=>({...t,key:parseNote(vault.read(t.path).content).data.reminders_key||null}));
    const rows=await this.adapter.read(Object.values(mapping));
    if(!Array.isArray(rows)||rows.length>10000)throw new Error('Reminders returned an incomplete or oversized result. No changes were made.');
    if(this.getVault()!==vault)throw new Error('Vault changed during sync.');
    const byKey=new Map(),byId=new Map(),taskKeys=new Map();
    for(const task of tasks)if(task.key){if(!KEY.test(task.key))throw new Error('Invalid reminders_key in '+task.path);taskKeys.set(task.key,[...(taskKeys.get(task.key)||[]),task]);}
    for(const row of rows){
      if(typeof row.id!=='string'||typeof row.title!=='string'||typeof row.notes!=='string'||!Object.values(mapping).includes(row.listId)||typeof row.version!=='string')throw new Error('Invalid reminder data. No changes were made.');
      if(byId.has(row.id))throw new Error('Reminders returned duplicate identities. Try again later.');
      row.link=identity(row.notes);byId.set(row.id,row);
      if(row.link?.scope===scope)byKey.set(row.link.key,[...(byKey.get(row.link.key)||[]),row]);
    }
    const seen=new Set();let missingRemote=false;
    for(const task of tasks){
      try{
        if(task.recurrence){warn(task.title,'Repeating tasks are not synced yet.');continue;}
        if(task.completed&&!task.key)continue; // Do not export completed history on first connection.
        if(task.key&&taskKeys.get(task.key).length>1){warn(task.title,'Duplicate reminders_key in vault notes. Remove the copied key from the duplicate note.');continue;}
        let entry=state.data.entries.find(e=>e.key===task.key);const hadKey=!!task.key;
        if(!task.key){
          if(state.data.entries.some(e=>e.path===task.path))throw new Error('This note lost its reminders_key. Restore the original key to reconnect its existing reminder.');
          task.key=crypto.randomUUID();const note=vault.read(task.path),parsed=parseNote(note.content);
          if(note.version!==task.version)throw new Error('Task changed during sync. Try again.');
          parsed.doc.set('reminders_key',task.key);
          const change=vault.commit(task.path,note.content,`---\n${parsed.doc.toString()}---\n${parsed.body}`,'Linked to Reminders',{reminders:true});task.version=change.version;
        }
        if(!entry){
          // A preserved note identity with missing history must not guess which side won.
          const existing=byKey.get(task.key)||[];
          if(hadKey&&!existing.length){warn(task.title,'Sync history and the linked reminder are missing. Restore them before syncing this task.');continue;}
          entry={key:task.key,path:task.path,base:fields(task),remoteId:null};
          if(existing.length===1){
            if(!equal(fields(existing[0]),entry.base)){warn(task.title,'Sync history is missing and the two copies differ. Make their title, deadline and completion agree to relink.');continue;}
            entry.remoteId=existing[0].id;
          }
          state.data.entries.push(entry);this.persist(state);
        }
        seen.add(entry.key);entry.path=task.path;
        const matches=byKey.get(task.key)||[];
        if(matches.length>1)throw new Error('Multiple reminders have this Orb link. Remove the duplicate reminder before syncing.');
        let remote=matches[0]||byId.get(entry.remoteId);
        if(remote?.link&&(remote.link.scope!==scope||remote.link.key!==task.key))throw new Error('Reminder identity was changed. Restore its original Orb link.');
        if(remote&&remote.listId!==mapping[task.list])throw new Error('Task was moved to a different list. Move it back before syncing.');
        if(!remote){
          if(entry.remoteId){missingRemote=true;throw new Error('Linked reminder is missing or moved outside the connected lists. Restore it in Reminders; Orb will not recreate or delete it automatically.');}
          if(entry.pendingCreate)throw new Error('Reminder creation is unconfirmed. Refresh after iCloud catches up; Orb will not risk creating a duplicate.');
          entry.pendingCreate=true;this.persist(state);
          const local=fields(task);
          remote=await this.adapter.save({listId:mapping[task.list],fields:{...local,notes:notesFor('',scope,task.key,task)}});
          entry.remoteId=remote.id;entry.pendingCreate=false;entry.base=local;this.persist(state);exported++;continue;
        }
        if(remote.recurring)throw new Error('Repeating reminders are not synced yet. Remove the repeat rule to resume syncing this task.');
        entry.remoteId=remote.id;entry.pendingCreate=false;
        const local=fields(task),other=fields(remote),next={...local};let conflict=false;
        for(const key of ['title','due','completed']){
          if(equal(local[key],other[key]))continue;
          const localChanged=!equal(local[key],entry.base[key]),remoteChanged=!equal(other[key],entry.base[key]);
          if(localChanged&&remoteChanged){warn(task.title,`${key==='due'?'Deadline':key} changed in both apps. Make both copies agree to resume syncing.`);conflict=true;}
          else if(remoteChanged&&key==='title'){warn(task.title,'Title changed in Reminders. Rename the task note in Obsidian to match, or restore the reminder title.');conflict=true;}
          else if(remoteChanged)next[key]=other[key];
        }
        if(conflict)continue;
        const notes=notesFor(remote.notes,scope,task.key,task);
        const patch={};for(const key of ['title','due','completed'])if(!equal(next[key],other[key]))patch[key]=next[key];
        if(notes!==remote.notes)patch.notes=notes;
        // Recheck before either write. Native save separately checks the reminder version.
        if(vault.read(task.path).version!==task.version)throw new Error('Task changed during sync. Try again.');
        if(Object.keys(patch).length)remote=await this.adapter.save({id:remote.id,listId:remote.listId,expected:remote.version,fields:patch});
        if(!equal(next,local)){
          const change=vault.updateTask({path:task.path,version:task.version,due:next.due??'',completed:next.completed});changes.push(change);
        }
        if(Object.keys(patch).length||!equal(next,local))updated++;
        entry.base=next;this.persist(state);
      }catch(e){warn(task.title,e.message);}
    }
    for(const entry of state.data.entries)if(!seen.has(entry.key)&&!taskKeys.has(entry.key))warn(entry.path,'Linked vault task is missing or moved outside the task folders. Restore it; deletions are not mirrored.');
    for(const remote of rows){
      try{
        if(remote.link?.scope===scope&&!tasks.some(t=>t.key===remote.link.key)&&!state.data.entries.some(e=>e.key===remote.link.key))warn(remote.title,'This reminder has an Orb link but its vault note and sync history are missing. Restore them to reconnect.');
        if(remote.link||state.data.entries.some(e=>e.remoteId===remote.id&&tasks.some(t=>t.key===e.key)))continue;
        if(remote.completed)continue;
        if(missingRemote){warn(remote.title,'New imports are paused while a linked reminder is missing, to avoid duplicating an item whose Apple identity changed.');continue;}
        if(remote.recurring){warn(remote.title,'Repeating reminders are not imported yet.');continue;}
        let entry=state.data.entries.find(e=>e.remoteId===remote.id);
        if(entry&&!entry.pendingImport)continue; // A deleted note must stay deleted.
        if(!remote.title.trim()||remote.title.length>180||/[\r\n]/.test(remote.title))throw new Error('Use a single-line title of 1–180 characters to import this reminder.');
        const local=fields(remote),list=Object.keys(mapping).find(k=>mapping[k]===remote.listId);
        if(!entry){entry={key:crypto.randomUUID(),remoteId:remote.id,base:local,pendingImport:true};state.data.entries.push(entry);this.persist(state);}
        const safe=remote.title.replace(/[\/\\:*?"<>|\x00-\x1f]/g,'-').replace(/^\.+/,'').trim();if(!safe)throw new Error('Choose a valid reminder title.');
        let relative=`${vault.folders[list]}/${safe}.md`,n=2;while(fs.existsSync(path.join(vault.root,relative)))relative=`${vault.folders[list]}/${safe} (${n++}).md`;
        // The actual filename is canonical in Orb; retain colliding/invalid original titles in the body.
        const canonical=path.basename(relative,'.md');
        const data={type:'task',category:'Inbox',planned:null,due:local.due,completed:false,reminders_key:entry.key};
        const details=remote.notes.length<=20000?remote.notes:remote.notes.slice(0,20000)+'\n[Full notes remain in Apple Reminders.]';
        entry.path=relative;this.persist(state);
        const change=vault.commit(relative,null,`---\n${YAML.stringify(data)}---\n\n# ${remote.title}\n${details?'\n'+details+'\n':''}`,'Imported from Reminders',{reminders:true});
        changes.push(change);entry.pendingImport=false;entry.base={...local,title:canonical};this.persist(state);imported++;
        // Preserve the original reminder's notes and alarm, adding only identity/category metadata.
        await this.adapter.save({id:remote.id,listId:remote.listId,expected:remote.version,fields:{title:canonical,notes:notesFor(remote.notes,scope,entry.key,{category:'Inbox'})}});
      }catch(e){warn(remote.title,e.message);}
    }
    this.persist(state);
    for(const change of changes)this.onChange(change);
    return {lastSync:new Date().toISOString(),exported,imported,updated,issues,error:null};
  }
}
module.exports={RemindersSync,nativeAdapter,identity,notesFor};
