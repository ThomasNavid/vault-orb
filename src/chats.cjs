const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicWrite}=require('./vault.cjs');
const {persistedPlaces}=require('./places-service.cjs');
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETENTION_MS=90*24*60*60*1000,MAX_VISUAL=200000;
// A chat is titled from its first request, the way a subject line would read.
const titleFrom=text=>{const line=text.replace(/\s+/g,' ').trim();const short=line.length>52?line.slice(0,50).replace(/\s+\S*$/,'')+'…':line;return short.charAt(0).toUpperCase()+short.slice(1)||'New chat';};
const summary=({id,title,createdAt,updatedAt,archived,messages})=>{const last=[...messages].reverse().find(m=>m.role==='assistant'||m.role==='user');return {id,title,createdAt,updatedAt,archived,count:messages.length,preview:(last?.text||'').replace(/\*\*|`|^#+\s*/gm,'').replace(/\s+/g,' ').slice(0,90)};};
class ChatStore {
  constructor(legacyFile,{now=()=>Date.now()}={}){
    this.legacyFile=legacyFile;this.dir=path.join(path.dirname(legacyFile),path.basename(legacyFile,'.json'));
    this.now=now;this.chats=[];
    fs.mkdirSync(this.dir,{recursive:true,mode:0o700});
    this.migrate();
    for(const entry of fs.readdirSync(this.dir,{withFileTypes:true})){
      if(!entry.name.endsWith('.json'))continue;
      const id=entry.name.slice(0,-5);if(!ID.test(id))continue;
      if(!entry.isFile())throw new Error(`Invalid chat file: ${entry.name}`);
      const chat=JSON.parse(fs.readFileSync(path.join(this.dir,entry.name),'utf8'));
      if(chat?.id!==id||!Array.isArray(chat.messages))throw new Error(`Invalid chat file: ${entry.name}`);
      this.chats.push(chat);
    }
    this.prune();
  }
  file(id){return path.join(this.dir,`${id}.json`);}
  persist(chat){atomicWrite(this.file(chat.id),JSON.stringify(chat));}
  // A crash during migration leaves the legacy source intact. The next launch
  // resumes any missing chat files before removing the old store.
  migrate(){
    let data;try{data=JSON.parse(fs.readFileSync(this.legacyFile,'utf8'));}catch(e){if(e.code==='ENOENT')return;throw e;}
    if(!Array.isArray(data?.chats)||data.chats.some(c=>!ID.test(c?.id)||!Array.isArray(c.messages)))throw new Error('Invalid legacy chat data.');
    for(const chat of data.chats){
      if(fs.existsSync(this.file(chat.id))){
        if(!fs.lstatSync(this.file(chat.id)).isFile())throw new Error(`Invalid chat file: ${chat.id}.json`);
        const saved=JSON.parse(fs.readFileSync(this.file(chat.id),'utf8'));
        if(saved?.id!==chat.id||!Array.isArray(saved.messages))throw new Error(`Invalid chat file: ${chat.id}.json`);
        continue;
      }
      const recent=Date.parse(chat.updatedAt);
      const expiresAt=chat.archived?null:new Date(Math.max(Number.isFinite(recent)?recent+RETENTION_MS:0,this.now()+RETENTION_MS)).toISOString();
      this.persist({...chat,expiresAt});
    }
    fs.unlinkSync(this.legacyFile);
  }
  prune(){
    const now=this.now();
    for(const chat of [...this.chats]){
      if(chat.archived)continue;
      const due=Date.parse(chat.expiresAt);
      if(!Number.isFinite(due)||due>now)continue;
      fs.unlinkSync(this.file(chat.id));this.chats=this.chats.filter(c=>c.id!==chat.id);
    }
  }
  find(id){const chat=this.chats.find(c=>c.id===id);if(!chat)throw new Error('That chat no longer exists.');return chat;}
  list(){this.prune();return [...this.chats].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(summary);}
  get(id){return structuredClone(this.find(id));}
  // Chats are created by their first message, so abandoned drafts never clutter the list.
  open(id,text){
    if(typeof id!=='string'||!ID.test(id))throw new Error('Invalid chat.');
    let chat=this.chats.find(c=>c.id===id);
    if(!chat){const at=new Date(this.now()).toISOString();chat={id,title:titleFrom(text),createdAt:at,updatedAt:at,archived:false,expiresAt:new Date(this.now()+RETENTION_MS).toISOString(),messages:[]};this.chats.push(chat);}
    return chat;
  }
  history(id,limit=20){return (this.chats.find(c=>c.id===id)?.messages||[]).filter(m=>(m.role==='user'||m.role==='assistant')&&m.text).slice(-limit).map(m=>({role:m.role,content:m.text}));}
  append(id,message){
    const chat=this.find(id),entry={id:crypto.randomUUID(),at:new Date(this.now()).toISOString(),...message};
    const livePlaces=entry.visual?.kind==='places'?entry.visual:null;
    if(entry.visual?.kind==='places')entry.visual=persistedPlaces(entry.visual);
    if(entry.visual&&JSON.stringify(entry.visual).length>MAX_VISUAL)delete entry.visual;
    chat.messages.push(entry);chat.updatedAt=entry.at;if(chat.archived&&message.role==='user')chat.archived=false;
    if(!chat.archived)chat.expiresAt=new Date(this.now()+RETENTION_MS).toISOString();
    this.persist(chat);return livePlaces?{...entry,visual:livePlaces}:entry;
  }
  setArchived(id,archived){const chat=this.find(id);chat.archived=!!archived;chat.updatedAt=new Date(this.now()).toISOString();chat.expiresAt=chat.archived?null:new Date(this.now()+RETENTION_MS).toISOString();this.persist(chat);return summary(chat);}
  rename(id,title){if(typeof title!=='string'||!title.trim()||title.length>120)throw new Error('Enter a title up to 120 characters.');const chat=this.find(id);chat.title=title.trim();chat.updatedAt=new Date(this.now()).toISOString();if(!chat.archived)chat.expiresAt=new Date(this.now()+RETENTION_MS).toISOString();this.persist(chat);return summary(chat);}
  remove(id){const chat=this.chats.find(c=>c.id===id);if(!chat)return true;fs.unlinkSync(this.file(id));this.chats=this.chats.filter(c=>c.id!==id);return true;}
}
module.exports={ChatStore,titleFrom};
