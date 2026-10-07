const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicWrite}=require('./vault.cjs');
const MAX_MINUTES=180,DEFAULT_MINUTES=25;
function wholeMinutes(value,name='Minutes',max=MAX_MINUTES){
  if(!Number.isSafeInteger(value)||value<1||value>max)throw new Error(`${name} must be a whole number from 1 to ${max}.`);
  return value;
}
// A plain timer needs nothing but a length. A title or an exact unfinished task note is optional.
function focusTarget(vault,{path:relative=null,title=null}={}){
  if(relative){
    if(!vault)throw new Error('Choose a valid vault in Settings.');
    if(!Object.values(vault.folders).some(folder=>relative.startsWith(folder+'/')))throw new Error('Focus sessions can only link to a note in a task folder.');
    const task=vault.tasks({include_completed:true}).tasks.find(t=>t.path===relative);
    if(!task)throw new Error(`Task not found: ${relative}`);
    if(task.completed)throw new Error('That task is already completed.');
    return {path:relative,title:task.title};
  }
  if(title===null||title===undefined||(typeof title==='string'&&!title.trim()))return {path:null,title:null};
  if(typeof title!=='string'||title.length>180||/[\r\n]/.test(title))throw new Error('Give the session a short single-line title, or leave it blank.');
  return {path:null,title:title.trim()};
}
// One focus session at a time. Times are absolute, so sleep and restarts do not drift.
class FocusTimer {
  constructor({file,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,onChange=()=>{}}={}){
    Object.assign(this,{file,now,setTimer,clearTimer,onChange});this.session=null;this.timer=null;
  }
  restore(){
    let saved=null;
    try {saved=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')saved=null;}
    const valid=saved&&typeof saved.id==='string'&&(saved.title===null||typeof saved.title==='string')&&['running','paused','completed'].includes(saved.status)&&Number.isSafeInteger(saved.minutes)&&Number.isFinite(saved.endsAt);
    this.session=valid?saved:null;
    // A session that ran out while the app was closed completes quietly; the card shows on launch.
    if(this.session?.status==='running'&&this.session.endsAt<=this.now())Object.assign(this.session,{status:'completed',completedAt:this.session.endsAt});
    this.save();this.arm();
    return this.status();
  }
  status(){
    const s=this.session;if(!s)return null;
    const remaining=s.status==='completed'?0:Math.max(0,s.endsAt-(s.pausedAt??this.now()));
    return {...s,durationMs:s.minutes*60000,remainingMs:remaining};
  }
  active(){return this.session&&this.session.status!=='completed'?this.session:null;}
  start({path:relative=null,title=null,minutes=DEFAULT_MINUTES,replace=false}){
    wholeMinutes(minutes);
    const current=this.active();
    if(current&&!replace)throw new Error(`A focus session is already running${current.title?`: ${current.title}`:''}, ${Math.ceil(this.status().remainingMs/60000)} min left. Stop it first or replace it.`);
    const now=this.now();
    this.session={id:crypto.randomUUID(),title,path:relative,minutes,startedAt:now,endsAt:now+minutes*60000,pausedAt:null,status:'running',completedAt:null};
    return this.changed('start');
  }
  pause(){const s=this.require('running');s.pausedAt=this.now();s.status='paused';return this.changed('pause');}
  resume(){const s=this.require('paused');s.endsAt=this.now()+(s.endsAt-s.pausedAt);s.pausedAt=null;s.status='running';return this.changed('resume');}
  // Extending a finished session starts it again for the extra minutes.
  extend(minutes){
    wholeMinutes(minutes);const s=this.session;if(!s)throw new Error('No focus session is running.');
    if(s.minutes+minutes>MAX_MINUTES*4)throw new Error('This session is already long enough. Start a new one instead.');
    if(s.status==='completed'){s.endsAt=this.now()+minutes*60000;s.status='running';s.completedAt=null;}
    else s.endsAt+=minutes*60000;
    s.minutes+=minutes;return this.changed('extend');
  }
  stop(){if(!this.active())throw new Error('No focus session is running.');this.session=null;return this.changed('stop');}
  dismiss(){if(this.session?.status!=='completed')throw new Error('No finished focus session to dismiss.');this.session=null;return this.changed('dismiss');}
  // Called on wake from sleep: a timeout may have been held back while the Mac slept.
  rearm(){this.arm();}
  complete(){
    const s=this.session;if(s?.status!=='running')return null;
    s.status='completed';s.completedAt=this.now();return this.changed('complete');
  }
  require(status){const s=this.session;if(s?.status!==status)throw new Error(status==='running'?'No running focus session to pause.':'No paused focus session to resume.');return s;}
  arm(){
    if(this.timer)this.clearTimer(this.timer);this.timer=null;
    const s=this.session;if(s?.status!=='running')return;
    const wait=s.endsAt-this.now();
    if(wait<=0){this.complete();return;}
    // Long timers are re-checked in steps so a clock change cannot strand them.
    this.timer=this.setTimer(()=>{this.timer=null;this.arm();},Math.min(wait,60000));
    this.timer?.unref?.();
  }
  save(){
    if(!this.file)return;
    if(this.session){fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});atomicWrite(this.file,JSON.stringify(this.session));}
    else fs.rmSync(this.file,{force:true});
  }
  changed(event){this.save();this.arm();const status=this.status();this.onChange(status,event);return status;}
}
module.exports={FocusTimer,focusTarget,wholeMinutes,MAX_MINUTES,DEFAULT_MINUTES};
