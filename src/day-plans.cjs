const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicWrite,hash,parseNote,localDate}=require('./vault.cjs');
const {instant,timestamp}=require('./calendar-time.cjs');
const {planningSnapshot,draftFromSnapshot,allocate,editDraft,day,text,preferences}=require('./day-planner.cjs');
// Hours, reserve, task list and breaks carry over to new days; energy and one-off commitments do not.
const REMEMBERED=['start','end','buffer','scope','breaks'];
const {suggestDay}=require('./day-planner-ai.cjs');
const {scheduleTask}=require('./scheduling.cjs');
const BEGIN='<!-- orb-day-plan:v1 -->',END='<!-- /orb-day-plan -->';
const clone=v=>structuredClone(v),line=s=>String(s).replace(/[\r\n|]/g,' ').replace(/<!--/g,'&lt;!--');
const link=r=>`[${line(r.title).replace(/[\[\]]/g,'')}](../../${r.path.split('/').map(p=>encodeURIComponent(p).replace(/[()]/g,c=>'%'+c.charCodeAt(0).toString(16))).join('/')})`;
function markdown(d,operation){
  const byPath=new Map(d.rows.map(r=>[r.path,r])),lines=[BEGIN,`## Plan for ${d.date}`,'',`Timezone: ${d.timezone}. ${d.capacity.complete?'Calendar coverage checked':'Provisional: calendar coverage incomplete'}.`,'',`${d.capacity.free} minutes available; ${d.capacity.proposed} minutes proposed; ${d.capacity.remaining} minutes left free.`,'',line(d.summary),'','### Priorities',''];
  for(const p of d.priorities){const r=byPath.get(p);lines.push(`- ${link(r)} — ${line(r.reason)}`);}
  lines.push('','### Timeline','','| Time | Activity | Status |','| --- | --- | --- |');
  for(const item of d.timeline){const r=byPath.get(item.path);lines.push(`| ${item.start.slice(11,16)}–${item.end.slice(11,16)} | ${r?link(r):line(item.title)} | ${{proposed:'Proposed in plan',held:'Earlier/started plan session',booked:'Calendar booking',event:'Calendar/commitment',break:'Break'}[item.kind]} |`);}
  lines.push('','### Outside this plan','');for(const r of d.rows.filter(r=>r.exclusion&&!r.session))lines.push(`- ${link(r)} — ${line(r.exclusion)}`);
  lines.push('','### Assumptions and questions','');for(const r of d.rows.filter(r=>r.origin==='ai'&&r.included))lines.push(`- ${line(r.title)}: AI-suggested ${r.minutes} minutes. ${line(r.reason)}`);
  for(const q of d.questions)lines.push(`- ${line(q)}`);
  for(const w of d.warnings)lines.push(`- ${line(w)}`);
  if(operation){lines.push('','### Applied changes','');for(const a of operation.actions)lines.push(`- ${line(a.title)}: ${line(a.label)} — ${a.status}${a.error?` (${line(a.error)})`:''}`);}
  lines.push('','Proposed times are part of this plan. Task dates and calendar events change only through the reviewed apply actions.',END);
  return lines.join('\n');
}
function savePlan(vault,d,operation){
  for(const folder of ['0. Home','0. Home/Daily Plans']){const target=vault.resolve(folder,{note:false,missing:true});if(!fs.existsSync(target))fs.mkdirSync(target,{mode:0o700});}
  let relative=d.saved?.path||`0. Home/Daily Plans/${d.date}.md`,before=null;
  const candidate=vault.resolve(relative,{missing:true});
  if(fs.existsSync(candidate)){
    const note=vault.read(relative),parsed=parseNote(note.content);
    if(!d.saved&&parsed.data.plan_id!==d.id){relative=`0. Home/Daily Plans/${d.date}-${d.id.slice(0,8)}.md`;if(fs.existsSync(vault.resolve(relative,{missing:true})))throw new Error('A plan already uses this filename. Refresh or rename it in Obsidian.');}
    else {if(d.saved?.version&&note.version!==d.saved.version)throw new Error('The saved day plan changed in Obsidian. Refresh before saving.');before=note.content;}
  }else if(d.saved)throw new Error('The saved day plan was moved or removed. Refresh before saving.');
  let after;
  if(before!==null){const parsed=parseNote(before),a=parsed.body.indexOf(BEGIN),b=parsed.body.indexOf(END);
    if(a<0||b<a||parsed.body.indexOf(BEGIN,a+1)>=0||parsed.body.indexOf(END,b+1)>=0)throw new Error('The managed day-plan section needs repair in Obsidian.');
    parsed.doc.set('timezone',d.timezone);parsed.doc.set('plan_revision',d.revision);
    after=`---\n${parsed.doc.toString()}---\n${parsed.body.slice(0,a)}${markdown(d,operation)}${parsed.body.slice(b+END.length)}`;
  }else after=`---\ntype: day-plan\nplan_schema: 1\nplan_id: ${d.id}\nplan_revision: ${d.revision}\ndate: ${d.date}\ntimezone: ${d.timezone}\n---\n\n# Daily plan\n\n${markdown(d,operation)}\n\n## My notes\n\n`;
  const result=before===after?{path:relative,version:hash(after)}:vault.commit(relative,before,after,'Daily plan saved');
  d.saved={path:result.path,version:result.version};return result;
}
class DayPlans {
  constructor(vault,options={}){
    this.vault=vault;this.options=options;this.now=options.now||(()=>Date.now());this.memory=new Map();this.busy=false;
    this.directory=path.join(options.stateDir||vault.stateDir,`day-plans-${hash(vault.root).slice(0,16)}`);fs.mkdirSync(this.directory,{recursive:true,mode:0o700});
    // Expire ordinary cached drafts after 30 days. Never discard an unfinished operation.
    for(const file of fs.readdirSync(this.directory).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n))){try{const p=path.join(this.directory,file);if(this.now()-fs.statSync(p).mtimeMs>30*86400000){const e=JSON.parse(fs.readFileSync(p,'utf8'));if(!e.operation||['complete','closed'].includes(e.operation.status))fs.unlinkSync(p);}}catch{}}
  }
  remembered(){try{const saved=JSON.parse(fs.readFileSync(path.join(this.directory,'preferences.json'),'utf8')),p=preferences(Object.fromEntries(REMEMBERED.filter(k=>k in saved).map(k=>[k,saved[k]])));return Object.fromEntries(REMEMBERED.filter(k=>k in saved).map(k=>[k,p[k]]));}catch{return {};}}
  remember(p){try{atomicWrite(path.join(this.directory,'preferences.json'),JSON.stringify(Object.fromEntries(REMEMBERED.map(k=>[k,p[k]]))));}catch{}}
  persist(e){atomicWrite(path.join(this.directory,day(e.draft.date)+'.json'),JSON.stringify(e));this.memory.set(e.draft.date,e);return this.public(e);}
  load(date){day(date);if(this.memory.has(date))return this.memory.get(date);const file=path.join(this.directory,date+'.json');if(!fs.existsSync(file))return null;
    if(fs.statSync(file).size>8*1024*1024)throw new Error('The saved planner cache is too large.');
    const e=JSON.parse(fs.readFileSync(file,'utf8'));if(e.schema!==1||e.draft?.date!==date)throw new Error('This planner cache cannot be read.');this.memory.set(date,e);return e;
  }
  public(e){return clone({...e.draft,review:e.review||null,operation:e.operation||null,notice:e.notice||'',aiReady:!!this.options.aiReady?.()});}
  bound(e,args){if(args.id!==e.draft.id||args.revision!==e.draft.revision)throw new Error('This draft changed. Reopen the planner before editing or applying.');}
  snapshot(date,signal){return (this.options.snapshot||planningSnapshot)(this.vault,date,{...this.options,now:this.now(),signal});}
  notify(result){if(result?.change_id)this.options.onChange?.(result);for(const c of result?.changes||[])this.options.onChange?.(c);}
  async command(args={},externalSignal){
    if(args.action==='cancel'){this.controller?.abort();return {cancelled:true};}
    if(this.busy)throw new Error('Wait for the current planner action or cancel it.');
    const action=args.action||'open',date=day(args.date||localDate(new Date(this.now())));
    this.busy=true;this.controller=new AbortController();const signal=externalSignal?AbortSignal.any([externalSignal,this.controller.signal]):this.controller.signal;
    try{
      let e=this.load(date);
      if(!e){if(!['open','generate','replan'].includes(action))throw new Error('Open the day planner first.');const snapshot=await this.snapshot(date,signal);signal.throwIfAborted();e={schema:1,draft:draftFromSnapshot(snapshot,{input:this.remembered()}),review:null,operation:null};this.persist(e);}
      if(action==='open')return this.public(e);
      if(action==='discard'){
        this.bound(e,args);if(e.operation&&!['complete','closed'].includes(e.operation.status))throw new Error('Resolve the unfinished apply operation before discarding.');
        fs.unlinkSync(path.join(this.directory,date+'.json'));this.memory.delete(date);return {discarded:true};
      }
      if(['edit','save','review','apply','refresh','resume','close-operation'].includes(action))this.bound(e,args);
      if(e.operation&&!['complete','closed'].includes(e.operation.status)&&!['resume','save','refresh','close-operation'].includes(action))throw new Error('An apply operation needs attention. Resume it or repair the affected task links first.');
      if(action==='edit'){
        const patch=args.patch||{};
        e.draft=patch.preferences?.scope&&patch.preferences.scope!==e.draft.preferences.scope?draftFromSnapshot(e.draft.snapshot,{previous:e.draft,input:{...e.draft.preferences,...patch.preferences}}):editDraft(e.draft,patch);
        if(patch.preferences)this.remember(e.draft.preferences);
        e.review=null;e.operation=null;e.notice='';return this.persist(e);
      }
      if(['refresh','generate','replan'].includes(action)){
        if(e.operation&&!['complete','closed'].includes(e.operation.status))throw new Error('Resume or repair the unfinished apply operation before replanning.');
        if(args.id)this.bound(e,args);
        const snapshot=await this.snapshot(date,signal);signal.throwIfAborted();let draft=draftFromSnapshot(snapshot,{previous:e.draft,input:e.draft.preferences});
        if(draft.saved){try{draft.saved.version=this.vault.read(draft.saved.path).version;}catch{draft.saved=null;}}
        if(action!=='refresh')draft=await (this.options.suggest||suggestDay)(this.vault,draft,text(args.request||'Help me plan this day.',6000),{...this.options,signal});
        signal.throwIfAborted();e.draft=draft;e.review=null;e.operation=null;e.notice=action==='refresh'?'Sources refreshed; review the updated plan.':'AI draft ready. Nothing has been booked.';return this.persist(e);
      }
      if(action==='close-operation'){if(!e.operation)throw new Error('There is no apply review to close.');e.operation.status='closed';e.notice='Applied changes kept. Remaining actions were not run. Inspect any pending bookings before making another plan.';return this.persist(e);}
      if(action==='save'){const result=savePlan(this.vault,e.draft,e.operation);this.notify(result);e.notice='Daily plan saved in Markdown. Task dates and bookings were not changed.';return this.persist(e);}
      if(action==='review'){e.review=this.prepare(e,args.choices);e.operation=null;e.notice='Review the exact changes below. Proposed times remain in the plan unless you select calendar booking.';return this.persist(e);}
      if(action==='apply'){
        if(e.operation?.reviewId===args.reviewId)return this.public(e);
        if(!e.review||args.reviewId!==e.review.id||e.review.revision!==e.draft.revision)throw new Error('Review this plan before applying.');
        const snapshot=await this.snapshot(date,signal);signal.throwIfAborted();
        if(snapshot.fingerprint!==e.draft.snapshot.fingerprint)throw new Error('Tasks, goals, calendar or settings changed. Refresh and review the plan again.');
        e.operation={id:crypto.randomUUID(),reviewId:e.review.id,status:'applying',actions:clone(e.review.actions),expected:Object.fromEntries(e.draft.snapshot.tasks.map(t=>[t.path,t.version]))};
        this.persist(e);
        try{const result=savePlan(this.vault,e.draft,e.operation);this.notify(result);}catch(error){e.operation=null;this.persist(e);throw error;}
        return await this.run(e,signal);
      }
      if(action==='resume'){if(!e.operation)throw new Error('There is no operation to resume.');if(['complete','closed'].includes(e.operation.status))return this.public(e);return await this.run(e,signal);}
      throw new Error('Unknown day-planner action.');
    }finally{this.busy=false;this.controller=null;}
  }
  prepare(e,choices){
    if(!Array.isArray(choices)||!choices.length||choices.length>e.draft.rows.length)throw new Error('Select at least one task change.');
    const actions=[],seen=new Set(),d=e.draft;
    for(const choice of choices){
      if(!choice||Object.keys(choice).some(k=>!['path','planDate','estimate','book'].includes(k))||['planDate','estimate','book'].some(k=>typeof choice[k]!=='boolean'))throw new Error('Invalid planner action choices.');
      const r=d.rows.find(r=>r.path===choice.path),t=d.snapshot.tasks.find(t=>t.path===choice.path);
      if(!r||!t||seen.has(r.path))throw new Error('Select each current task only once.');seen.add(r.path);
      if(!choice.planDate&&!choice.estimate&&!choice.book)continue;
      if(t.completed||t.recurrence||t.calendar_block||r.history)throw new Error('Only unfinished, unlinked one-off tasks can be applied here.');
      const changes={};if(choice.estimate){if(!r.minutes)throw new Error('Choose a duration before saving an estimate.');changes.estimated_minutes=r.minutes;}
      if(choice.planDate&&!choice.book)changes.planned=d.date;
      if(Object.keys(changes).length)actions.push({kind:'update',path:r.path,title:r.title,changes,label:[changes.planned?`Planned ${t.planned||'unscheduled'} → ${d.date} (date only)`:null,changes.estimated_minutes?`Save ${r.minutes}-minute estimate (${r.origin})`:null].filter(Boolean).join('; '),status:'not applied'});
      if(choice.book){
        if(!r.included||!r.session||!r.bookable||r.heldSession)throw new Error('This task has no eligible new calendar slot.');
        if(instant(r.session.start,d.timezone)<=this.now())throw new Error('A proposed time has passed. Replan before booking.');
        actions.push({kind:'book',path:r.path,title:r.title,start:r.session.start,end:r.session.end,timezone:d.timezone,calendar:d.snapshot.calendarId,blockId:crypto.randomUUID(),label:`Book ${r.session.start.slice(11,16)}–${r.session.end.slice(11,16)} ${d.timezone} in ${d.snapshot.calendarName||'selected calendar'} · ${r.minutes} minutes (${r.origin})${d.timezone!==d.snapshot.deviceTimezone?' · Planned on this Mac: '+timestamp(instant(r.session.start,d.timezone),d.snapshot.deviceTimezone):''}`,status:'not applied'});
      }
    }
    if(!actions.length)throw new Error('Select at least one task change.');return {id:crypto.randomUUID(),revision:d.revision,actions};
  }
  async run(e,signal){
    const op=e.operation,d=e.draft;op.status='applying';this.persist(e);
    try{
      for(const a of op.actions){
        if(a.status==='applied')continue;
        signal.throwIfAborted();let note=this.vault.read(a.path),data=parseNote(note.content).data;
        if(a.kind==='update'){
          if(a.afterVersion&&note.version===a.afterVersion){a.status='applied';op.expected[a.path]=note.version;this.persist(e);continue;}
          if(note.version!==op.expected[a.path])throw new Error(`${a.title} changed. Inspect it before resuming.`);
          const parsed=parseNote(note.content);for(const [key,value] of Object.entries(a.changes))parsed.doc.set(key,value);
          a.afterVersion=hash(`---\n${parsed.doc.toString()}---\n${parsed.body}`);a.status='applying';this.persist(e);
          const result=this.vault.updateTask({path:a.path,version:note.version,...a.changes});this.notify(result);op.expected[a.path]=result.version;a.status='applied';delete a.error;this.persist(e);
        }else{
          if(data.calendar_block&&data.calendar_block.id!==a.blockId)throw new Error(`${a.title} has a different calendar link. Inspect it before resuming.`);
          if(!data.calendar_block&&note.version!==op.expected[a.path])throw new Error(`${a.title} changed. Refresh before booking.`);
          // A recorded booking that disappeared must not be posted again on resume.
          if(a.status==='pending recovery'&&!data.calendar_block)throw new Error('The pending booking link was removed. Inspect the calendar before making another booking.');
          a.beforeJournalCount??=this.vault.history().length;a.status='pending recovery';this.persist(e);
          const result=await (this.options.schedule||scheduleTask)(this.vault,{path:a.path,version:note.version,start:a.start,end:a.end,calendar:a.calendar},{...this.options.getCalendarAccess?.(),fetchImpl:this.options.fetchImpl,signal,now:this.now(),blockId:a.blockId});
          this.notify(result);
          const current=this.vault.read(a.path),block=parseNote(current.content).data.calendar_block;
          if(result.pending||!block||block.id!==a.blockId||block.state!=='linked'||instant(block.start,block.timezone)!==instant(a.start,a.timezone)||instant(block.end,block.timezone)!==instant(a.end,a.timezone))throw new Error(result.warning||'The calendar booking needs recovery. Inspect its time before resuming.');
          op.expected[a.path]=current.version;a.status='applied';delete a.error;this.persist(e);
        }
      }
      op.status='complete';e.notice='Selected changes applied. Calendar bookings and date-only plans are listed separately below.';
    }catch(error){const failed=op.actions.find(a=>a.status!=='applied');if(failed){if(failed.status==='pending recovery'){try{const note=this.vault.read(failed.path),record=parseNote(note.content).data;const pendingWrite=this.vault.history().slice(failed.beforeJournalCount||0).some(change=>change.path===failed.path&&change.calendar);if(!record.calendar_block&&note.version===op.expected[failed.path]&&!pendingWrite)failed.status='not applied';}catch{}}else failed.status='not applied';failed.error=signal.aborted?'Stopped. Completed changes remain saved.':error.message;}op.status='needs attention';e.notice=signal.aborted?'Stopped. Review completed and remaining changes below.':error.message;
    }finally{
      this.persist(e);
      try{const result=savePlan(this.vault,d,op);this.notify(result);delete op.noteError;}catch(error){op.noteError='Changes are recorded locally; the Markdown plan could not be updated: '+error.message;}
      this.persist(e);
    }
    return this.public(e);
  }
}
module.exports={DayPlans,savePlan,markdown,BEGIN,END};
