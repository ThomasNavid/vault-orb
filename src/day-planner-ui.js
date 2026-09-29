(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(label,fn,cls='dp-button')=>{const n=el('button',cls,label);n.type='button';n.onclick=fn;return n;};
 const field=(label,input)=>{const n=el('label','dp-field');n.append(el('span',null,label),input);return n;};
 const input=(type,value,label)=>{const n=el('input');n.type=type;n.value=value??'';if(label)n.setAttribute('aria-label',label);return n;};
 const select=(values,value)=>{const n=el('select');for(const [v,label] of values)n.add(new Option(label,v));n.value=value;return n;};
 const bindEdit=(n,fn)=>{let value=n.value,timer;const commit=()=>{clearTimeout(timer);if(n.value===value)return;value=n.value;fn();};n.onchange=commit;n.onblur=commit;n.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(n.isConnected)commit();},400);};};
 const fmt=m=>m>=60?`${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}`:`${m}m`;
 const origins={user:'Your estimate',saved:'Saved estimate',ai:'AI suggestion',missing:'Estimate needed'};
 const kinds={event:'Commitment',booked:'Booked',break:'Break',proposed:'Proposed',held:'Earlier / started'};
 let api,preview=false;
 function init(options){api=options.api;preview=options.preview;if(preview&&!api.dayPlanner)api.dayPlanner=previewAPI();}
 function render(host,visual={}){
  const state={host,date:visual.date||null,draft:null,message:'',failure:false,selecting:false,choices:new Map(),busy:false};
  const root=el('section','day-planner');root.setAttribute('aria-label','Daily planner');host.replaceChildren(root);state.root=root;
  const alive=()=>host.contains(root);
  async function send(action,extra={}){
   if(state.busy)return;state.busy=true;state.message='';state.failure=false;
   const scroll=host.scrollTop;
   root.setAttribute('aria-busy','true');root.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);
   const pending=el('div','dp-status',action==='generate'||action==='replan'?'Considering your priorities…':action==='apply'||action==='resume'?'Applying reviewed changes…':'Updating your day…');pending.setAttribute('role','status');
   pending.append(button('Cancel',()=>api.dayPlanner({action:'cancel'}).catch(()=>{})));root.prepend(pending);
   try{
    const d=state.draft,result=await api.dayPlanner({action,date:state.date,...(d?{id:d.id,revision:d.revision}:{}),...extra});
    if(!alive())return;
    if(result.discarded){state.draft=null;state.busy=false;return send('open');}
    state.draft=result;state.date=result.date;state.message=result.notice||'';
    if(action==='review')state.selecting=false;
    if(['edit','generate','replan','refresh'].includes(action))state.choices.clear();
   }catch(e){if(alive()){state.message=e.message||String(e);state.failure=true;}}
   finally{state.busy=false;if(alive()){draw();if(action==='review')root.querySelector('.dp-review')?.scrollIntoView({block:'nearest'});else host.scrollTop=scroll;}}
  }
  const edit=patch=>send('edit',{patch});
  function draw(){
   const expansion=new Map([...root.querySelectorAll('details')].map(n=>[n.className,n.open]));
   const focused=document.activeElement?.getAttribute('aria-label');
   root.replaceChildren();root.setAttribute('aria-busy','false');
   const d=state.draft,heading=el('header','dp-heading'),titles=el('div');titles.append(el('p','dp-eyebrow',preview?'FICTIONAL PREVIEW':'A LITTLE SPACE TO THINK'),el('h1',null,'Plan my day'));
   heading.append(titles);root.append(heading);
   if(state.message){const status=el('p',state.failure?'dp-status dp-error':'dp-status',state.message);status.setAttribute('role',state.failure?'alert':'status');root.append(status);}
   if(!d){root.append(button('Load planner',()=>send('open')));return;}
   const date=input('date',d.date,'Planning date');date.onchange=()=>{state.date=date.value;state.draft=null;state.choices.clear();send('open');};heading.append(date,button('Refresh',()=>send('refresh')));
   root.append(el('p','dp-subtitle',`${d.timezone} · ${d.snapshot.checkedAt?`Checked ${new Date(d.snapshot.checkedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:'Draft'} · ${d.capacity.complete?'Calendar coverage checked':'Provisional availability'}`));
   const settings=el('details','dp-options'),settingsTitle=el('summary',null,'Shape your day');settings.append(settingsTitle);const grid=el('div','dp-settings');
   for(const [key,label,type] of [['start','Start','time'],['end','Finish','time'],['buffer','Leave free (%)','number']]){const n=input(type,d.preferences[key]);if(type==='number'){n.min=0;n.max=80;}bindEdit(n,()=>edit({preferences:{[key]:type==='number'?Number(n.value):n.value}}));grid.append(field(label,n));}
   const scope=select([['all','Life + Business'],['life','Life'],['business','Business']],d.preferences.scope);scope.onchange=()=>{state.choices.clear();edit({preferences:{scope:scope.value}});};grid.append(field('Tasks',scope));
   const energy=select([['low','Low energy'],['usual','Usual energy'],['high','High energy']],d.preferences.energy);energy.onchange=()=>edit({preferences:{energy:energy.value}});grid.append(field('Today feels like',energy));
   const override=input('checkbox','');override.checked=d.preferences.overrideDay;override.onchange=()=>edit({preferences:{overrideDay:override.checked}});grid.append(field('Use these hours on a non-working day',override));settings.append(grid);
   for(const [key,label] of [['breaks','Breaks'],['manual','Other commitments']]){
    const group=el('div','dp-breaks');group.append(el('strong',null,label));
    d.preferences[key].forEach((b,i)=>{const row=el('div','dp-inline');row.append(el('span',null,`${b.start}–${b.end} ${b.label}`),button('Remove',()=>edit({preferences:{[key]:d.preferences[key].filter((_,j)=>j!==i)}})));group.append(row);});
    const name=input('text',key==='breaks'?'Lunch':'Personal commitment',label+' name'),start=input('time','12:30',label+' start'),end=input('time','13:00',label+' end');const add=el('div','dp-add-break');add.append(name,start,end,button('Add',()=>edit({preferences:{[key]:[...d.preferences[key],{label:name.value,start:start.value,end:end.value}]}})));group.append(add);settings.append(group);
   }
   root.append(settings);
   const capacity=el('section','dp-capacity');capacity.append(el('div','dp-eyebrow',d.capacity.complete?'ROOM FOR NEW WORK':'PROVISIONAL ROOM FOR WORK'));
   const total=el('div','dp-capacity-total');total.append(el('strong',null,fmt(d.capacity.free)),el('span',null,'available'));capacity.append(total);
   const meter=el('meter','dp-meter');meter.min=0;meter.max=Math.max(1,d.capacity.free);meter.value=d.capacity.proposed;meter.setAttribute('aria-label',`${d.capacity.proposed} of ${d.capacity.free} available minutes proposed`);capacity.append(meter,el('p',null,`${fmt(d.capacity.proposed)} proposed · ${fmt(d.capacity.remaining)} left free · ${d.preferences.buffer}% reserve`));
   if(!d.capacity.working)capacity.append(el('p','dp-error','This is outside your working days. Adjust Shape your day to plan work.'));
   root.append(capacity);
   const ai=el('form','dp-ai'),prompt=el('textarea');prompt.rows=2;prompt.maxLength=6000;prompt.placeholder='What matters today? “Finish by three and protect time for the proposal.”';prompt.setAttribute('aria-label','Instructions for AI planner');
   const ask=el('button','dp-primary',d.summary?'Refine with AI':'Plan with AI');ask.type='submit';ask.disabled=!d.aiReady;
   ai.append(prompt,ask);ai.onsubmit=e=>{e.preventDefault();send('generate',{request:prompt.value||'Help me make a realistic plan for this day.'});};root.append(ai);
   if(!d.aiReady)root.append(el('p','dp-note','Configure a chat model in Settings for AI planning. You can edit estimates and build this plan manually.'));
   if(d.summary)root.append(el('p','dp-summary',d.summary));
   if(d.questions?.length){const qs=el('div','dp-questions');qs.append(el('strong',null,'A little context would help'));for(const q of d.questions)qs.append(el('p',null,q));root.append(qs);}
   if(d.aiCoverage?.omitted)root.append(el('p','dp-note',`AI considered ${d.aiCoverage.included} tasks; ${d.aiCoverage.omitted} more remain available below.`));
   const columns=el('div','dp-columns'),priorities=el('section','dp-priorities');priorities.append(el('h2',null,'Worth making time for'));
   d.priorities.forEach((path,i)=>{const r=d.rows.find(r=>r.path===path),card=el('div','dp-priority');card.append(el('span','dp-number',String(i+1)),el('strong',null,r.title),el('p',null,r.reason));const sources=el('div','dp-reason-sources');for(const source of r.sources?.length?r.sources:[r.path]){const goal=d.snapshot.goals?.find(g=>g.path===source);sources.append(button(goal?goal.title:'Task ↗',()=>api.openNote(source).catch(()=>{}),'dp-reason-source'));}card.append(sources);priorities.append(card);});
   if(!d.priorities.length)priorities.append(el('p','dp-note','Add estimates below or ask AI to suggest a starting plan.'));
   const timeline=el('section','dp-timeline');timeline.append(el('h2',null,'A possible day'));
   if(!d.timeline.length)timeline.append(el('p','dp-note','Your timeline will appear as work is placed.'));
   for(const t of d.timeline){const row=el('div','dp-slot');row.dataset.kind=t.kind;row.append(el('span','dp-time',`${t.start.slice(11,16)}–${t.end.slice(11,16)}`));const desc=el('div');desc.append(el('strong',null,t.title),el('small',null,`${kinds[t.kind]}${t.origin==='ai'?' · AI estimate':''}${t.recurring?' · plan only':''}`));row.append(desc);timeline.append(row);}
   columns.append(priorities,timeline);root.append(columns);
   const tasks=el('details','dp-tasks');tasks.open=!d.priorities.length;tasks.append(el('summary',null,`Tasks and estimates (${d.rows.length})`));
   for(const r of d.rows){const row=el('div','dp-task'),top=el('div','dp-task-top'),include=input('checkbox','',`Include ${r.title}`);include.checked=r.included;include.disabled=!!r.history;include.onchange=()=>edit({row:{path:r.path,included:include.checked}});
    top.append(include,button(r.title,()=>api.openNote(r.path).catch(e=>{state.message=e.message;state.failure=true;draw();}),'dp-source'),el('small',null,r.list));row.append(top);
    row.append(el('p','dp-task-reason',r.exclusion||r.reason));const controls=el('div','dp-task-controls');
    const minutes=input('number',r.minutes,`Minutes for ${r.title}`);minutes.min=1;minutes.max=10080;bindEdit(minutes,()=>edit({row:{path:r.path,minutes:minutes.value?Number(minutes.value):null}}));controls.append(field(`Minutes · ${origins[r.origin]}`,minutes));
    const pin=input('checkbox','',`Pin ${r.title}`);pin.checked=r.pinned;pin.onchange=()=>edit({row:{path:r.path,pinned:pin.checked}});controls.append(field('Pin',pin));
    if(r.pinned){const time=input('time',r.pinTime||r.session?.start.slice(11,16)||'',`Pinned time for ${r.title}`);bindEdit(time,()=>edit({row:{path:r.path,pinTime:time.value||null}}));controls.append(field('At (optional)',time));}
    const up=button('↑',()=>edit({move:{path:r.path,direction:-1}}));up.setAttribute('aria-label',`Move ${r.title} earlier`);const down=button('↓',()=>edit({move:{path:r.path,direction:1}}));down.setAttribute('aria-label',`Move ${r.title} later`);controls.append(up,down);
    if(r.heldSession)controls.append(button('Release session',()=>edit({row:{path:r.path,release:true}})));else if(r.session)controls.append(button('Started',()=>edit({row:{path:r.path,started:true}})));
    row.append(controls);tasks.append(row);
   }root.append(tasks);
   const outside=d.rows.filter(r=>r.exclusion&&!r.session);if(outside.length){const group=el('details','dp-outside');group.append(el('summary',null,`Not in this timeline (${outside.length})`));for(const r of outside)group.append(el('p',null,`${r.title} — ${r.exclusion}`));root.append(group);}
   if(d.changes?.length){const changes=el('details','dp-outside');changes.append(el('summary',null,'What changed'));for(const c of d.changes)changes.append(el('p',null,c));root.append(changes);}
   if(d.warnings?.length){const warnings=el('details','dp-warnings');warnings.append(el('summary',null,'Source notes and limitations'));for(const w of d.warnings)warnings.append(el('p',null,w));root.append(warnings);}
   const actions=el('footer','dp-actions');actions.append(button('Save plan',()=>send('save'),'dp-primary'),button('Apply to tasks…',()=>{state.selecting=!state.selecting;draw();if(state.selecting)root.querySelector('.dp-review')?.scrollIntoView({block:'nearest'});}),button('Replan remaining day',()=>send('replan',{request:'Replan the remaining day. Preserve started work, past sessions and pinned commitments.'})));
   if(d.saved)actions.append(button('Open saved plan',()=>api.openNote(d.saved.path).catch(()=>{})));root.append(actions,el('p','dp-note','Save plan writes a Markdown note. Task dates and calendar bookings are separate choices.'));
   if(state.selecting)drawChoices(d);
   if(d.review&&!d.operation)drawReview(d);
   if(d.operation)drawOperation(d);
   root.append(button('Discard cached draft',()=>send('discard'),'dp-quiet'));
   for(const details of root.querySelectorAll('details'))if(expansion.has(details.className))details.open=expansion.get(details.className);
   if(focused)[...root.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
  }
  function drawChoices(d){
   const box=el('section','dp-review');box.append(el('h2',null,'Choose what to apply'),el('p','dp-note','Date-only planning leaves timeline times in this plan. Booking accepts the displayed duration and creates a linked calendar event.'));
   const eligible=d.rows.filter(r=>{const t=d.snapshot.tasks.find(t=>t.path===r.path);return t&&!t.completed&&!t.recurrence&&!t.calendar_block&&!r.history;});
   for(const r of eligible){let c=state.choices.get(r.path);if(!c){c={path:r.path,planDate:!!r.included,estimate:false,book:false};state.choices.set(r.path,c);}if(!r.bookable)c.book=false;if(!r.minutes)c.estimate=false;const row=el('div','dp-choice');row.setAttribute('role','group');row.setAttribute('aria-label','Changes for '+r.title);row.append(el('strong',null,r.title));
    for(const [key,label] of [['planDate',`Planned ${d.date} (date only)`],['estimate',`Save ${r.minutes||'?'} min · ${origins[r.origin]}`],['book',r.bookable?`Book ${r.session.start.slice(11,16)}–${r.session.end.slice(11,16)}`:'Calendar booking unavailable']]){const cb=input('checkbox','');cb.dataset.choice=key;cb.checked=c[key];cb.disabled=key==='book'&&!r.bookable||key==='estimate'&&!r.minutes||key==='planDate'&&c.book;cb.onchange=()=>{c[key]=cb.checked;if(key==='book'){if(cb.checked)c.planDate=false;const dateBox=row.querySelector('[data-choice=planDate]');dateBox.checked=c.planDate;dateBox.disabled=cb.checked;}};row.append(field(label,cb));}box.append(row);
   }
   if(!eligible.length)box.append(el('p',null,'No eligible one-off tasks. Recurring tasks and existing bookings remain in the plan only.'));
   box.append(button('Review selected changes',()=>send('review',{choices:[...state.choices.values()].filter(c=>eligible.some(r=>r.path===c.path)&&(c.planDate||c.estimate||c.book))}),'dp-primary'));rootAppend(box);
  }
  function rootAppend(n){root.append(n);}
  function drawReview(d){const box=el('section','dp-review');box.append(el('h2',null,'Review before applying'));for(const a of d.review.actions)box.append(el('p',null,`${a.title} — ${a.label}`));box.append(button('Apply these changes',()=>send('apply',{reviewId:d.review.id}),'dp-primary'),button('Back to draft',()=>edit({})));rootAppend(box);}
  function drawOperation(d){const box=el('section','dp-review');box.append(el('h2',null,d.operation.status==='complete'?'Changes applied':d.operation.status==='closed'?'Review closed':'Apply needs attention'));for(const a of d.operation.actions)box.append(el('p',null,`${a.title} — ${a.label}: ${a.status}${a.error?` · ${a.error}`:''}`));if(d.operation.noteError)box.append(el('p','dp-error',d.operation.noteError));if(!['complete','closed'].includes(d.operation.status))box.append(button('Resume remaining changes',()=>send('resume'),'dp-primary'),button('Keep changes and close review',()=>send('close-operation')));rootAppend(box);}
  send('open');
 }
 function previewAPI(){
  const drafts=new Map();let current;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function create(date){const rows=[['Draft the proposal',90,'Next action for your launch goal','business'],['Send the invoice',30,'Due today','business'],['Book the dentist',15,'A small life-admin task','life'],['Tidy the website',120,'Can wait until a quieter day','business']].map(([title,minutes,reason,list],i)=>({path:`Example/${title}.md`,title,minutes,reason,list,origin:i===0?'ai':'saved',included:true,pinned:false,pinTime:null}));return {id:'preview-'+date,revision:1,date,timezone:'Europe/London',preferences:{start:'09:00',end:'17:00',buffer:20,scope:'all',energy:'usual',overrideDay:false,breaks:[{start:'12:30',end:'13:00',label:'Lunch'}],manual:[]},snapshot:{checkedAt:new Date().toISOString(),tasks:rows.map(r=>({path:r.path,completed:false}))},rows,summary:'Protect a focused morning for the proposal, then clear the invoice and one small admin task.',questions:[],warnings:['Fictional preview. AI, vault changes and calendar writes are simulated.'],aiReady:true};}
  function calculate(d){let at=10*60+30;const asTime=m=>`${d.date}T${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:00`,end=Number(d.preferences.end.slice(0,2))*60+Number(d.preferences.end.slice(3)),free=Math.max(0,end-at-30),budget=free*(1-d.preferences.buffer/100);let used=0;d.timeline=[{kind:'event',title:'Team check-in',start:asTime(9*60+30),end:asTime(at)}];for(const b of [...d.preferences.breaks,...d.preferences.manual])d.timeline.push({kind:'break',title:b.label,start:`${d.date}T${b.start}:00`,end:`${d.date}T${b.end}:00`});for(const r of d.rows){delete r.session;delete r.exclusion;r.bookable=false;if(!r.included){r.exclusion='Excluded from this day';continue;}if(!r.minutes||used+r.minutes>budget){r.exclusion=r.minutes?'Does not fit with the current reserve':'Add an estimate';continue;}if(at<13*60&&at+r.minutes>12*60+30)at=13*60;r.session={start:asTime(at),end:asTime(at+r.minutes)};r.bookable=true;d.timeline.push({...r.session,title:r.title,kind:'proposed',path:r.path,origin:r.origin});at+=r.minutes;used+=r.minutes;}d.timeline.sort((a,b)=>a.start.localeCompare(b.start));d.capacity={free,proposed:used,remaining:free-used,reserve:Math.ceil(free*d.preferences.buffer/100),complete:true,working:true};d.priorities=d.rows.filter(r=>r.session).slice(0,3).map(r=>r.path);return d;}
  return async args=>{if(args.action==='cancel')return {cancelled:true};const date=args.date||today();current=drafts.get(date)||create(date);drafts.set(date,current);
   if(args.action==='discard'){drafts.delete(date);return {discarded:true};}
   if(args.action==='edit'){if(args.patch.preferences)Object.assign(current.preferences,args.patch.preferences);if(args.patch.row){const r=current.rows.find(r=>r.path===args.patch.row.path);Object.assign(r,args.patch.row);if(Object.hasOwn(args.patch.row,'minutes'))r.origin='user';if(args.patch.row.started)r.heldSession=r.session;if(args.patch.row.release)delete r.heldSession;}if(args.patch.move){const i=current.rows.findIndex(r=>r.path===args.patch.move.path),j=i+args.patch.move.direction;if(j>=0&&j<current.rows.length)[current.rows[i],current.rows[j]]=[current.rows[j],current.rows[i]];}current.review=null;current.operation=null;}
   if(['generate','replan'].includes(args.action)){current.summary='Fictional AI suggestion: protect the proposal first, then complete the invoice. Refine estimates to fit the rest of your day.';if(/three|3pm|15:00/i.test(args.request||''))current.preferences.end='15:00';}
   if(args.action==='save'){current.saved={path:'Example/Daily plan.md'};current.notice='Preview: a Markdown day plan would be saved.';}
   if(args.action==='review'){current.operation=null;current.review={id:'preview-review',actions:args.choices.flatMap(c=>{const r=current.rows.find(r=>r.path===c.path);return [c.estimate?{title:r.title,label:`Save ${r.minutes}-minute estimate (${r.origin})`,status:'not applied'}:null,c.book?{title:r.title,label:`Book ${r.session.start.slice(11,16)}–${r.session.end.slice(11,16)} Europe/London in Fictional calendar`,status:'not applied'}:c.planDate?{title:r.title,label:`Set date-only Planned to ${date}`,status:'not applied'}:null].filter(Boolean);})};}
   if(args.action==='apply')current.operation={status:'complete',actions:current.review.actions.map(a=>({...a,status:'applied'}))};current.revision++;return structuredClone(calculate(current));
  };
 }
 window.dayPlannerUI={init,render};
})();
