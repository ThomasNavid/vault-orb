(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(label,fn,cls='dp-button')=>{const n=el('button',cls,label);n.type='button';n.onclick=fn;return n;};
 const field=(label,input)=>{const n=el('label','dp-field');n.append(el('span',null,label),input);return n;};
 const input=(type,value,label)=>{const n=el('input');n.type=type;n.value=value??'';if(label)n.setAttribute('aria-label',label);return n;};
 const bindEdit=(n,fn)=>{let value=n.value,timer;const commit=()=>{clearTimeout(timer);if(n.value===value)return;value=n.value;fn();};n.onchange=commit;n.onblur=commit;n.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(n.isConnected)commit();},400);};};
 const fmt=m=>m>=60?`${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}`:`${m}m`;
 const origins={user:'Your estimate',saved:'Saved estimate',ai:'AI suggestion',missing:'Estimate needed'};
 const kinds={event:'Commitment',booked:'Booked',break:'Break',proposed:'Proposed',held:'Earlier / started'};
 // One question per screen. The last step is the plan itself; applying to tasks opens over it.
 const STEPS=[['hours','Hours'],['scope','Tasks'],['energy','Energy'],['breaks','Breaks'],['room','Free time'],['ask','Priorities'],['tasks','Estimates'],['day','Your day']];
 const at=key=>STEPS.findIndex(s=>s[0]===key),DAY=at('day');
 let api,preview=false;
 function init(options){api=options.api;preview=options.preview;if(preview&&!api.dayPlanner)api.dayPlanner=previewAPI();}
 function render(host,visual={}){
  const state={host,date:visual.date||null,draft:null,message:'',failure:false,selecting:false,choices:new Map(),busy:false,step:0,shown:null,after:null,pending:{},request:'',adding:false};
  const root=el('section','day-planner');root.setAttribute('aria-label','Daily planner');host.replaceChildren(root);state.root=root;
  const alive=()=>host.contains(root);
  const firstStep=d=>d.summary||d.saved||d.review||d.operation?DAY:0;
  async function send(action,extra={}){
   if(state.busy)return false;state.busy=true;state.message='';state.failure=false;
   const scroll=host.scrollTop;
   root.setAttribute('aria-busy','true');root.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);
   const thinking=action==='generate'||action==='replan',pending=el('div',thinking?'dp-status dp-thinking':'dp-status',thinking?'Considering your priorities…':action==='apply'||action==='resume'?'Applying reviewed changes…':'Updating your day…');pending.setAttribute('role','status');
   pending.append(button('Cancel',()=>api.dayPlanner({action:'cancel'}).catch(()=>{})));
   // Quick edits finish before the banner would appear; only slower work announces itself.
   const where=root.querySelector('.dp-stage')||root,shown=setTimeout(()=>{if(state.busy&&alive())where.prepend(pending);},thinking?0:350);
   try{
    const d=state.draft,result=await api.dayPlanner({action,date:state.date,...(d?{id:d.id,revision:d.revision}:{}),...extra});
    if(!alive())return false;
    if(result.discarded){state.draft=null;state.busy=false;state.step=0;state.after=null;return send('open');}
    if(result.id!==d?.id){state.step=firstStep(result);state.pending={};}
    state.draft=result;state.date=result.date;state.message=result.notice||'';
    if(action==='review')state.selecting=false;
    if(['edit','generate','replan','refresh'].includes(action))state.choices.clear();
    if(action==='edit')state.pending={};
   }catch(e){if(alive()){state.message=e.message||String(e);state.failure=true;}}
   finally{clearTimeout(shown);state.busy=false;if(!state.failure&&state.after!==null)state.step=state.after;state.after=null;if(alive()){const moved=state.step!==state.shown;draw();if(!moved)host.scrollTop=scroll;}}
   return !state.failure;
  }
  const edit=patch=>send('edit',{patch});
  // Hours and free time are held locally until you move on, so typing never redraws under you.
  function go(target){
   const d=state.draft;if(!d||state.busy||target<0||target>=STEPS.length)return;
   const patch=Object.fromEntries(Object.entries(state.pending).filter(([k,v])=>v!==d.preferences[k]));
   if((patch.start||patch.end)&&(patch.end||d.preferences.end)<=(patch.start||d.preferences.start)){state.message='Finish time must be after start time.';state.failure=true;draw();return;}
   state.selecting=false;state.message='';state.failure=false;
   if(Object.keys(patch).length){state.after=target;edit({preferences:patch});return;}
   state.step=target;draw();
  }
  const choose=(key,value)=>{const d=state.draft,next=state.step+1;if(d.preferences[key]===value)return go(next);if(key==='scope')state.choices.clear();state.after=next;edit({preferences:{[key]:value}});};
  function draw(){
   const expansion=new Map([...root.querySelectorAll('details')].map(n=>[n.className,n.open]));
   const focused=document.activeElement?.getAttribute('aria-label');
   const moved=state.step!==state.shown,direction=state.shown===null||state.step>state.shown?'forward':'back';state.shown=state.step;
   root.replaceChildren();root.setAttribute('aria-busy','false');
   const d=state.draft,top=el('header','dp-top');top.append(el('p','dp-eyebrow',preview?'FICTIONAL PREVIEW':'PLAN MY DAY'));root.append(top);
   const stage=el('main','dp-stage');root.append(stage);
   if(state.message){const status=el('p',state.failure?'dp-status dp-error':'dp-status',state.message);status.setAttribute('role',state.failure?'alert':'status');stage.append(status);}
   if(!d){stage.append(button('Load planner',()=>send('open'),'dp-primary'));return;}
   const date=input('date',d.date,'Planning date');date.className='dp-date';date.onchange=()=>{if(!date.value)return;state.date=date.value;state.draft=null;state.choices.clear();send('open');};
   top.append(date,button('Refresh',()=>send('refresh'),'dp-quiet'));
   const key=STEPS[state.step][0],applying=key==='day'&&(state.selecting||d.review||d.operation);
   stage.dataset.step=applying?'apply':key;
   const nav=el('footer','dp-nav'),back=button('Back',()=>applying?closeApply(d):go(state.step-1),'dp-button dp-back');if(state.step===0&&!applying){back.classList.add('is-hidden');back.tabIndex=-1;back.setAttribute('aria-hidden','true');}
   const dots=el('nav','dp-dots');dots.setAttribute('aria-label','Planner steps');
   STEPS.forEach(([,label],i)=>{const dot=button('',()=>go(i),'dp-dot');dot.setAttribute('aria-label',`Step ${i+1} of ${STEPS.length}: ${label}`);dot.title=label;if(i===state.step)dot.setAttribute('aria-current','step');else if(i<state.step)dot.classList.add('is-done');dots.append(dot);});
   const next=el('div','dp-next');nav.append(back,dots,next);
   const views={hours,scope,energy,breaks,room,ask,tasks,day};
   (applying?apply:views[key])(stage,d,next);
   root.append(nav);
   for(const details of root.querySelectorAll('details'))if(expansion.has(details.className))details.open=expansion.get(details.className);
   if(moved){stage.classList.add('dp-enter-'+direction);host.scrollTop=0;(stage.querySelector('[data-autofocus]')||stage.querySelector('h1'))?.focus({preventScroll:true});}
   else if(focused)[...root.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
  }
  function heading(stage,title,lead){const h=el('h1','dp-question',title);h.tabIndex=-1;stage.append(el('p','dp-step',`Step ${state.step+1} of ${STEPS.length}`),h);if(lead)stage.append(el('p','dp-lead',lead));}
  const onward=(next,label='Continue')=>next.append(button(label,()=>go(state.step+1),'dp-primary'));
  const enterContinues=n=>{n.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go(state.step+1);}};return n;};
  function hours(stage,d,next){
   heading(stage,'When does your day run?','Saved for next time, so you only change it when your day is different.');
   const times=el('div','dp-times');
   for(const [key,label] of [['start','Start'],['end','Finish']]){const n=enterContinues(input('time',state.pending[key]??d.preferences[key],label+' time'));n.className='dp-big-time';if(key==='start')n.dataset.autofocus='';n.oninput=()=>{if(n.value)state.pending[key]=n.value;};const f=el('label','dp-time-field');f.append(el('span',null,label),n);times.append(f);if(key==='start')times.append(el('span','dp-times-arrow','→'));}
   stage.append(times);
   if(!d.capacity.working||d.preferences.overrideDay){const toggle=input('checkbox','','Plan this non-working day');toggle.checked=d.preferences.overrideDay;toggle.onchange=()=>edit({preferences:{overrideDay:toggle.checked}});const row=el('label','dp-toggle');row.append(toggle,el('span',null,'It’s not a working day — use these hours anyway'));stage.append(row);}
   onward(next);
  }
  function options(stage,key,values,d){const list=el('div','dp-options');list.setAttribute('role','radiogroup');for(const [value,title,hint] of values){const b=button('',()=>choose(key,value),'dp-option');b.setAttribute('role','radio');b.setAttribute('aria-checked',String(d.preferences[key]===value));b.setAttribute('aria-label',title);if(d.preferences[key]===value)b.dataset.autofocus='';b.append(el('strong',null,title),el('span',null,hint),el('i','dp-check'));list.append(b);}stage.append(list);}
  function scope(stage,d,next){
   heading(stage,'What are you planning?');
   options(stage,'scope',[['all','Everything','Life and Business tasks'],['life','Life','Personal tasks only'],['business','Business','Work tasks only']],d);onward(next);
  }
  function energy(stage,d,next){
   heading(stage,'How’s your energy today?','Orb matches the plan to how you feel.');
   options(stage,'energy',[['low','Low','Keep it light and forgiving'],['usual','Usual','A normal, steady day'],['high','High','Room for deep, demanding work']],d);onward(next);
  }
  function breaks(stage,d,next){
   heading(stage,'Anything fixed in your day?','Breaks carry over to tomorrow. Commitments are just for this day.');
   const list=el('div','dp-fixed');
   for(const [key,kind] of [['breaks','Break'],['manual','Commitment']])d.preferences[key].forEach((b,i)=>{const row=el('div','dp-fixed-row');row.dataset.kind=key;const text=el('div');text.append(el('strong',null,b.label),el('span',null,`${b.start}–${b.end} · ${kind}`));const remove=button('×',()=>edit({preferences:{[key]:d.preferences[key].filter((_,j)=>j!==i)}}),'dp-remove');remove.setAttribute('aria-label',`Remove ${b.label}`);row.append(text,remove);list.append(row);});
   if(!list.children.length)list.append(el('p','dp-empty','Nothing fixed yet.'));stage.append(list);
   if(!state.adding&&list.querySelector('.dp-fixed-row')){const add=button('+ Add a break or commitment',()=>{state.adding=true;draw();stage.querySelector('.dp-add input[type=text]')?.focus();},'dp-quiet dp-add-toggle');stage.append(add);onward(next);return;}
   const form=el('form','dp-add'),kind=el('div','dp-segment');let chosen='breaks';
   const name=input('text','Lunch','Break or commitment name');name.maxLength=150;
   for(const [value,label] of [['breaks','Break'],['manual','Commitment']]){const b=button(label,()=>{chosen=value;kind.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));if(name.value==='Lunch'||name.value==='Personal commitment')name.value=value==='breaks'?'Lunch':'Personal commitment';});b.setAttribute('aria-pressed',String(value===chosen));kind.append(b);}
   const start=input('time','12:30','Starts'),end=input('time','13:00','Ends'),times=el('div','dp-add-times');times.append(field('From',start),field('To',end));
   form.append(kind,field('Name',name),times,button('Add to day',()=>form.requestSubmit(),'dp-button dp-add-button'));
   form.onsubmit=e=>{e.preventDefault();if(!start.value||!end.value)return;state.adding=false;edit({preferences:{[chosen]:[...d.preferences[chosen],{label:name.value,start:start.value,end:end.value}]}});};
   stage.append(form);onward(next);
  }
  function room(stage,d,next){
   heading(stage,'How much should stay free?','Unplanned time absorbs overruns, messages and surprises.');
   const value=state.pending.buffer??d.preferences.buffer,big=el('div','dp-big-number'),number=el('strong',null,String(value));big.append(number,el('span',null,'%'));
   const slider=input('range',value,'Percent of the day to leave free');slider.className='dp-slider';slider.min=0;slider.max=80;slider.step=5;slider.dataset.autofocus='';
   const free=d.capacity.free,summary=el('p','dp-lead');
   const update=()=>{const v=Number(slider.value),kept=Math.ceil(free*v/100);number.textContent=String(v);summary.textContent=free?`About ${fmt(Math.max(0,free-kept))} for tasks · ${fmt(kept)} kept free of ${fmt(free)} available.`:'No open time yet — check your hours or commitments.';};
   slider.oninput=()=>{state.pending.buffer=Number(slider.value);update();};enterContinues(slider);update();
   stage.append(big,slider,summary);
   if(!d.capacity.complete)stage.append(el('p','dp-note','Calendar coverage is incomplete, so availability is provisional and booking is off. Manual planning still works.'));
   onward(next);
  }
  function ask(stage,d,next){
   heading(stage,d.summary?'Anything to change?':'What matters most today?',d.aiReady?'AI looks at your tasks, deadlines, goals and calendar, then suggests an order and durations. Nothing is booked.':'Configure a chat model in Settings to plan with AI. You can still build this plan yourself.');
   const prompt=el('textarea','dp-prompt');prompt.rows=4;prompt.maxLength=6000;prompt.value=state.request;prompt.placeholder=d.summary?'“The proposal needs 90 minutes; keep it first.”':'“Finish by three and protect time for the proposal.”';prompt.setAttribute('aria-label','Instructions for AI planner');prompt.dataset.autofocus='';prompt.disabled=!d.aiReady;
   prompt.oninput=()=>{state.request=prompt.value;};
   prompt.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();plan();}};
   const plan=()=>{if(!d.aiReady)return;state.after=DAY;send('generate',{request:prompt.value||'Help me make a realistic plan for this day.'});};
   stage.append(prompt);
   const ai=button(d.summary?'Refine with AI':'Plan with AI',plan,'dp-primary dp-wide');ai.disabled=!d.aiReady;stage.append(ai);
   next.append(button(d.summary?'Keep this plan':'Plan it myself',()=>go(d.summary?DAY:state.step+1),'dp-button'));
  }
  function tasks(stage,d,next){
   const included=d.rows.filter(r=>r.session).length;
   heading(stage,'Check your tasks',d.rows.length?`${included} of ${d.rows.length} fit today · ${fmt(d.capacity.proposed)} planned of ${fmt(d.capacity.free)} available.`:'No unfinished tasks for this list.');
   const list=el('div','dp-task-list');
   for(const r of d.rows){const row=el('div','dp-task');row.dataset.included=String(!!r.included);if(r.session)row.dataset.placed='';
    const include=input('checkbox','',`Include ${r.title}`);include.checked=r.included;include.disabled=!!r.history;include.onchange=()=>edit({row:{path:r.path,included:include.checked}});
    const body=el('div','dp-task-body'),title=el('div','dp-task-title');title.append(button(r.title,()=>api.openNote(r.path).catch(e=>{state.message=e.message;state.failure=true;draw();}),'dp-source'),el('small',null,r.list));
    body.append(title,el('p','dp-task-reason',r.exclusion||r.reason));
    const controls=el('div','dp-task-controls'),minutes=input('number',r.minutes,`Minutes for ${r.title}`);minutes.min=1;minutes.max=10080;minutes.placeholder='—';bindEdit(minutes,()=>edit({row:{path:r.path,minutes:minutes.value?Number(minutes.value):null}}));
    const duration=el('label','dp-minutes');duration.append(minutes,el('span',null,`min · ${origins[r.origin]}`));controls.append(duration);
    const pin=button(r.pinned?'Pinned':'Pin',()=>edit({row:{path:r.path,pinned:!r.pinned}}),'dp-chip');pin.setAttribute('aria-pressed',String(!!r.pinned));pin.setAttribute('aria-label',`Pin ${r.title}`);controls.append(pin);
    if(r.pinned){const time=input('time',r.pinTime||r.session?.start.slice(11,16)||'',`Pinned time for ${r.title}`);bindEdit(time,()=>{if(time.value||!time.validity.badInput)edit({row:{path:r.path,pinTime:time.value||null}});});controls.append(time);}
    const up=button('↑',()=>edit({move:{path:r.path,direction:-1}}),'dp-chip');up.setAttribute('aria-label',`Move ${r.title} earlier`);const down=button('↓',()=>edit({move:{path:r.path,direction:1}}),'dp-chip');down.setAttribute('aria-label',`Move ${r.title} later`);controls.append(up,down);
    if(r.heldSession)controls.append(button('Release session',()=>edit({row:{path:r.path,release:true}}),'dp-chip'));else if(r.session)controls.append(button('Started',()=>edit({row:{path:r.path,started:true}}),'dp-chip'));
    body.append(controls);row.append(include,body);list.append(row);
   }
   stage.append(list);onward(next,'See my day');
  }
  function day(stage,d,next){
   heading(stage,d.summary?'Here’s your day':'Your day',d.summary||(d.timeline.length?'':'Add estimates, or ask AI for a starting plan.'));
   if(d.questions?.length){const qs=el('div','dp-questions');qs.append(el('strong',null,'A little context would help'));for(const q of d.questions)qs.append(el('p',null,q));qs.append(button('Answer and refine',()=>go(at('ask')),'dp-quiet'));stage.append(qs);}
   const stats=el('div','dp-stats');for(const [value,label] of [[d.capacity.free,d.capacity.complete?'available':'available (provisional)'],[d.capacity.proposed,'planned'],[d.capacity.remaining,'kept free']]){const s=el('div');s.append(el('strong',null,fmt(value)),el('span',null,label));stats.append(s);}
   const meter=el('meter','dp-meter');meter.min=0;meter.max=Math.max(1,d.capacity.free);meter.value=d.capacity.proposed;meter.setAttribute('aria-label',`${d.capacity.proposed} of ${d.capacity.free} available minutes planned`);stage.append(stats,meter);
   if(!d.capacity.working)stage.append(el('p','dp-status dp-error','This is outside your working days. Go back to Hours to plan it anyway.'));
   if(d.aiCoverage?.omitted)stage.append(el('p','dp-note',`AI considered ${d.aiCoverage.included} tasks; ${d.aiCoverage.omitted} more are in Estimates.`));
   if(d.priorities.length){const priorities=el('section','dp-priorities');priorities.append(el('h2',null,'Worth making time for'));
    d.priorities.forEach((path,i)=>{const r=d.rows.find(r=>r.path===path),card=el('div','dp-priority');card.append(el('span','dp-number',String(i+1)),el('strong',null,r.title),el('p',null,r.reason));const sources=el('div','dp-reason-sources');for(const source of r.sources?.length?r.sources:[r.path]){const goal=d.snapshot.goals?.find(g=>g.path===source);sources.append(button(goal?goal.title:'Task ↗',()=>api.openNote(source).catch(()=>{}),'dp-reason-source'));}card.append(sources);priorities.append(card);});stage.append(priorities);}
   const timeline=el('section','dp-timeline');timeline.append(el('h2',null,'Timeline'));
   if(!d.timeline.length)timeline.append(el('p','dp-note','Your timeline will appear as work is placed.'));
   for(const t of d.timeline){const row=el('div','dp-slot');row.dataset.kind=t.kind;row.append(el('span','dp-time',`${t.start.slice(11,16)}–${t.end.slice(11,16)}`));const desc=el('div');desc.append(el('strong',null,t.title),el('small',null,`${kinds[t.kind]}${t.origin==='ai'?' · AI estimate':''}${t.recurring?' · plan only':''}`));row.append(desc);timeline.append(row);}
   stage.append(timeline);
   const outside=d.rows.filter(r=>r.exclusion&&!r.session);if(outside.length){const group=el('details','dp-outside');group.append(el('summary',null,`Not in this timeline (${outside.length})`));for(const r of outside)group.append(el('p',null,`${r.title} — ${r.exclusion}`));stage.append(group);}
   if(d.changes?.length){const changes=el('details','dp-changes');changes.append(el('summary',null,'What changed'));for(const c of d.changes)changes.append(el('p',null,c));stage.append(changes);}
   if(d.warnings?.length){const warnings=el('details','dp-warnings');warnings.append(el('summary',null,'Source notes and limitations'));for(const w of d.warnings)warnings.append(el('p',null,w));stage.append(warnings);}
   const actions=el('div','dp-actions');actions.append(button('Apply to tasks…',()=>{state.selecting=true;state.shown=null;state.message='';draw();}),button('Replan rest of day',()=>send('replan',{request:'Replan the remaining day. Preserve started work, past sessions and pinned commitments.'})),button(d.summary?'Refine with AI':'Plan with AI',()=>go(at('ask'))));
   if(d.saved)actions.append(button('Open saved plan',()=>api.openNote(d.saved.path).catch(()=>{})));
   stage.append(actions,el('p','dp-note','Save plan writes a Markdown note. Task dates and calendar bookings only change through Apply to tasks.'),button('Discard draft and start over',()=>send('discard'),'dp-quiet'));
   next.append(button(d.saved?'Save again':'Save plan',()=>send('save'),'dp-primary'));
  }
  function closeApply(d){state.selecting=false;state.shown=null;if(d.operation&&!['complete','closed'].includes(d.operation.status))return send('close-operation');if(d.review||d.operation)return edit({});draw();}
  function apply(stage,d,next){
   if(d.operation)return drawOperation(stage,d,next);if(d.review)return drawReview(stage,d,next);drawChoices(stage,d,next);
  }
  function drawChoices(stage,d,next){
   const h=el('h1','dp-question','Apply to tasks');h.tabIndex=-1;stage.append(el('p','dp-step','Optional'),h,el('p','dp-lead','Pick what should change in your vault. Date-only planning leaves times in this plan; booking creates a linked calendar event.'));
   const eligible=d.rows.filter(r=>{const t=d.snapshot.tasks.find(t=>t.path===r.path);return t&&!t.completed&&!t.recurrence&&!t.calendar_block&&!r.history;});
   for(const r of eligible){let c=state.choices.get(r.path);if(!c){c={path:r.path,planDate:!!r.included,estimate:false,book:false};state.choices.set(r.path,c);}if(!r.bookable)c.book=false;if(!r.minutes)c.estimate=false;const row=el('div','dp-choice');row.setAttribute('role','group');row.setAttribute('aria-label','Changes for '+r.title);row.append(el('strong',null,r.title));
    for(const [key,label] of [['planDate',`Plan for ${d.date}`],['estimate',`Save ${r.minutes||'?'} min estimate`],['book',r.bookable?`Book ${r.session.start.slice(11,16)}–${r.session.end.slice(11,16)}`:'Booking unavailable']]){const cb=input('checkbox','');cb.dataset.choice=key;cb.checked=c[key];cb.disabled=key==='book'&&!r.bookable||key==='estimate'&&!r.minutes||key==='planDate'&&c.book;cb.onchange=()=>{c[key]=cb.checked;if(key==='book'){if(cb.checked)c.planDate=false;const dateBox=row.querySelector('[data-choice=planDate]');dateBox.checked=c.planDate;dateBox.disabled=cb.checked;}};const option=el('label','dp-toggle');option.append(cb,el('span',null,label));row.append(option);}stage.append(row);
   }
   if(!eligible.length)stage.append(el('p','dp-empty','No eligible one-off tasks. Recurring tasks and existing bookings stay in the plan only.'));
   const review=button('Review changes',()=>send('review',{choices:[...state.choices.values()].filter(c=>eligible.some(r=>r.path===c.path)&&(c.planDate||c.estimate||c.book))}),'dp-primary');review.disabled=!eligible.length;next.append(review);
  }
  function drawReview(stage,d,next){const h=el('h1','dp-question','Look before applying');h.tabIndex=-1;stage.append(el('p','dp-step','Review'),h);const list=el('div','dp-review');for(const a of d.review.actions){const p=el('p');p.append(el('strong',null,a.title),document.createTextNode(` — ${a.label}`));list.append(p);}stage.append(list);next.append(button('Apply changes',()=>send('apply',{reviewId:d.review.id}),'dp-primary'));}
  function drawOperation(stage,d,next){const done=['complete','closed'].includes(d.operation.status),h=el('h1','dp-question',d.operation.status==='complete'?'Changes applied':d.operation.status==='closed'?'Review closed':'Apply needs attention');h.tabIndex=-1;stage.append(el('p','dp-step','Apply'),h);const list=el('div','dp-review');for(const a of d.operation.actions){const p=el('p');p.dataset.status=a.status;p.append(el('strong',null,a.title),document.createTextNode(` — ${a.label}: ${a.status}${a.error?` · ${a.error}`:''}`));list.append(p);}stage.append(list);if(d.operation.noteError)stage.append(el('p','dp-status dp-error',d.operation.noteError));
   if(done)next.append(button('Done',()=>closeApply(d),'dp-primary'));else{stage.append(button('Keep changes and close review',()=>send('close-operation'),'dp-quiet'));next.append(button('Resume changes',()=>send('resume'),'dp-primary'));}}
  send('open');
 }
 function previewAPI(){
  const drafts=new Map();let current,remembered={};
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function create(date){const rows=[['Draft the proposal',90,'Next action for your launch goal','business'],['Send the invoice',30,'Due today','business'],['Book the dentist',15,'A small life-admin task','life'],['Tidy the website',120,'Can wait until a quieter day','business']].map(([title,minutes,reason,list],i)=>({path:`Example/${title}.md`,title,minutes,reason,list,origin:i===0?'ai':'saved',included:true,pinned:false,pinTime:null}));return {id:'preview-'+date,revision:1,date,timezone:'Europe/London',preferences:{start:'09:00',end:'17:00',buffer:20,scope:'all',energy:'usual',overrideDay:false,breaks:[{start:'12:30',end:'13:00',label:'Lunch'}],manual:[],...structuredClone(remembered)},snapshot:{checkedAt:new Date().toISOString(),tasks:rows.map(r=>({path:r.path,completed:false}))},rows,summary:'',questions:[],warnings:['Fictional preview. AI, vault changes and calendar writes are simulated.'],aiReady:true};}
  const clock=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  function calculate(d){const p=d.preferences,asTime=m=>`${d.date}T${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:00`,fixed=[[clock(p.start)+30,clock(p.start)+60],...[...p.breaks,...p.manual].map(b=>[clock(b.start),clock(b.end)])].sort((a,b)=>a[0]-b[0]),end=clock(p.end);let at=clock(p.start),free=end-at-fixed.reduce((n,[a,b])=>n+Math.max(0,Math.min(b,end)-Math.max(a,at)),0),budget=free*(1-p.buffer/100),used=0;
   d.timeline=[{kind:'event',title:'Team check-in',start:asTime(fixed[0][0]),end:asTime(fixed[0][1])}];for(const b of p.breaks)d.timeline.push({kind:'break',title:b.label,start:`${d.date}T${b.start}:00`,end:`${d.date}T${b.end}:00`});for(const b of p.manual)d.timeline.push({kind:'event',title:b.label,start:`${d.date}T${b.start}:00`,end:`${d.date}T${b.end}:00`});
   for(const r of d.rows){delete r.session;delete r.exclusion;r.bookable=false;if(!r.included){r.exclusion='Excluded from this day';continue;}if(!r.minutes||used+r.minutes>budget){r.exclusion=r.minutes?'Does not fit with the current reserve':'Add an estimate';continue;}let moved=true;while(moved){moved=false;for(const [a,b] of fixed)if(at<b&&at+r.minutes>a){at=b;moved=true;}}if(at+r.minutes>end){r.exclusion='Needs one continuous gap';continue;}r.session={start:asTime(at),end:asTime(at+r.minutes)};r.bookable=true;d.timeline.push({...r.session,title:r.title,kind:'proposed',path:r.path,origin:r.origin});at+=r.minutes;used+=r.minutes;}
   d.timeline.sort((a,b)=>a.start.localeCompare(b.start));d.capacity={free,proposed:used,remaining:free-used,reserve:Math.ceil(free*p.buffer/100),complete:true,working:true};d.priorities=d.summary?d.rows.filter(r=>r.session).slice(0,3).map(r=>r.path):[];return d;}
  return async args=>{if(args.action==='cancel')return {cancelled:true};await new Promise(r=>setTimeout(r,['generate','replan'].includes(args.action)?900:120));const date=args.date||today();current=drafts.get(date)||create(date);drafts.set(date,current);
   if(args.action==='discard'){drafts.delete(date);return {discarded:true};}
   current.notice='';
   if(args.action==='edit'){if(args.patch.preferences){const next={...current.preferences,...args.patch.preferences};if(next.end<=next.start)throw new Error('Finish time must be after start time.');current.preferences=next;remembered=structuredClone({start:next.start,end:next.end,buffer:next.buffer,scope:next.scope,breaks:next.breaks});}if(args.patch.row){const r=current.rows.find(r=>r.path===args.patch.row.path);Object.assign(r,args.patch.row);if(Object.hasOwn(args.patch.row,'minutes'))r.origin='user';if(args.patch.row.started)r.heldSession=r.session;if(args.patch.row.release)delete r.heldSession;}if(args.patch.move){const i=current.rows.findIndex(r=>r.path===args.patch.move.path),j=i+args.patch.move.direction;if(j>=0&&j<current.rows.length)[current.rows[i],current.rows[j]]=[current.rows[j],current.rows[i]];}current.review=null;current.operation=null;}
   if(['generate','replan'].includes(args.action)){current.summary='Fictional AI suggestion: protect a focused morning for the proposal, then clear the invoice and one small admin task.';current.notice='AI draft ready. Nothing has been booked.';if(/three|3pm|15:00/i.test(args.request||''))current.preferences.end='15:00';}
   if(args.action==='save'){current.saved={path:'Example/Daily plan.md'};current.notice='Preview: a Markdown day plan would be saved.';}
   if(args.action==='review'){current.operation=null;current.review={id:'preview-review',actions:args.choices.flatMap(c=>{const r=current.rows.find(r=>r.path===c.path);return [c.estimate?{title:r.title,label:`Save ${r.minutes}-minute estimate (${r.origin})`,status:'not applied'}:null,c.book?{title:r.title,label:`Book ${r.session.start.slice(11,16)}–${r.session.end.slice(11,16)} Europe/London in Fictional calendar`,status:'not applied'}:c.planDate?{title:r.title,label:`Set date-only Planned to ${date}`,status:'not applied'}:null].filter(Boolean);})};}
   if(args.action==='apply')current.operation={status:'complete',actions:current.review.actions.map(a=>({...a,status:'applied'}))};current.revision++;return structuredClone(calculate(current));
  };
 }
 window.dayPlannerUI={init,render};
})();
