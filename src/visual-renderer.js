(() => {
 const palette=['#4d9bff','#ffb340','#30d158','#bf5af2'];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const icon=id=>{const s=svg('svg',{class:'icon','aria-hidden':'true'});s.append(svg('use',{href:'#'+id}));return s;};
 const stagger=(node,i)=>{node.style.setProperty('--i',String(Math.min(i,12)));return node;};
 function fmt(n,unit='',compact=false){if(n===null)return '—';const currency={GBP:'GBP','£':'GBP',USD:'USD','$':'USD',EUR:'EUR','€':'EUR'}[unit];if(currency)return new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:compact?0:2,...(Number.isInteger(n)?{minimumFractionDigits:0}:{}),...(compact?{notation:'compact'}:{})}).format(n);return new Intl.NumberFormat('en-GB',{maximumFractionDigits:2,...(compact?{notation:'compact'}:{})}).format(n)+(unit==='%'?'%':unit?' '+unit:'');}
 function table(columns,rows,paths,open){const wrap=el('div','table-scroll'),t=el('table'),head=el('thead'),tr=el('tr');columns.forEach((col,j)=>tr.append(el('th',rows.some(r=>typeof r[j]==='number')?'numeric':null,col)));head.append(tr);const body=el('tbody');rows.forEach((row,i)=>{const r=stagger(el('tr'),i);row.forEach((value,j)=>{const c=el('td',typeof value==='number'?'numeric':'');if(j===0&&paths?.[i]){const b=el('button','source-link',value??'—');b.onclick=()=>open(paths[i]);c.append(b);}else c.textContent=value??'—';r.append(c);});body.append(r);});t.append(head,body);wrap.append(t);return wrap;}
 // Task tables read better as a list: title, area tag, and when.
 const isTaskTable=v=>v.columns[0]==='Task'&&v.columns.includes('Area');
 function taskList(v,open){
  const col=name=>v.columns.indexOf(name),area=col('Area'),planned=col('Planned'),due=col('Deadline');
  const tags=new Map(),list=el('ul','task-list');
  v.rows.forEach((row,i)=>{
   const completed=v.taskCompleted?.[i]===true,item=stagger(el('li',`task${completed?' is-completed':''}`),i),main=el('div','task-main');
   item.append(el('span','task-ring'));
   const title=v.rowPaths?.[i]?el('button','source-link task-title',row[0]??'—'):el('span','task-title',row[0]??'—');if(v.rowPaths?.[i])title.onclick=()=>open(v.rowPaths[i]);main.append(title);
   if(area>=0&&row[area]){if(!tags.has(row[area]))tags.set(row[area],tags.size%palette.length);main.append(el('span',`tag tag-${tags.get(row[area])}`,row[area]));}
   if(v.taskRepeat?.[i])main.append(el('span','tag',v.taskRepeat[i]));
   const when=el('div','task-when');if(completed)when.append(el('span','task-status','Completed'));if(v.taskBlocks?.[i])when.append(el('span','task-status',v.taskBlocks[i].state==='linked'&&!v.taskWarnings?.some(w=>w.path===v.rowPaths?.[i])?'Calendar linked':'Calendar needs repair'));if(planned>=0&&row[planned])when.append(el('span',null,row[planned]));if(due>=0&&row[due])when.append(el('span','due','Due '+row[due]));
   item.append(main,when);list.append(item);
  });
  for(const w of v.taskWarnings||[])list.append(el('li','calendar-warning',`${w.path?w.path.split('/').pop()+': ':''}${w.error||'Task data needs attention.'}`));
  return list;
 }
 function calendar(v,open,selectedDate){
  const months=new Map();for(const day of v.days){const month=day.date.slice(0,7);if(!months.has(month))months.set(month,[]);months.get(month).push(day);}
  const keys=[...months.keys()],wrap=el('div','calendar-view'),warningCount=v.warnings?.length||0;
  if(warningCount){
   const names=v.warnings.map(w=>w.calendar||w.path?.split('/').pop()).filter(Boolean);
   const warning=el('div','calendar-warning',`Calendar needs attention${names.length?': '+names.join(', '):''}. ${v.warnings.map(w=>w.error).filter(Boolean).join(' ')}`);
   warning.setAttribute('role','status');wrap.append(warning);
  }
  if(v.truncated)wrap.append(el('div','calendar-warning',`Showing the first ${v.shown} of ${v.total} results. Try a shorter date range.`));
  const controls=el('div','calendar-controls'),prev=el('button','calendar-nav','‹'),label=el('strong','calendar-month-label'),next=el('button','calendar-nav','›');
  prev.type=next.type='button';prev.setAttribute('aria-label','Previous month');next.setAttribute('aria-label','Next month');controls.append(prev,label,next);
  const grid=el('div','calendar-grid'),agenda=el('section','calendar-agenda');wrap.append(controls,grid,agenda);
  if(!keys.length){wrap.append(el('p','empty','No dates in this range.'));return wrap;}
  let monthIndex=selectedDate?keys.indexOf(selectedDate.slice(0,7)):-1;
  if(monthIndex<0)monthIndex=0;
  let selected=selectedDate&&v.days.some(day=>day.date===selectedDate)?selectedDate:months.get(keys[0]).find(day=>day.items.length)?.date||v.start;
  const dateLabel=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const timeLabel=item=>{
   if(item.kind==='task')return (item.dateType==='due'?'Deadline':'Planned')+(item.allDay?' · all day':' · '+item.start.slice(11,16));
   if(item.allDay)return 'All day';
   if(item.start.slice(0,10)<selected)return item.end?.slice(0,10)===selected?'Until '+item.end.slice(11,16):'Continues';
   const start=item.start.slice(11,16),end=item.end?.slice(0,10)===item.start.slice(0,10)?item.end.slice(11,16):null;
   return end?`${start}–${end}`:item.end?.slice(0,10)>selected?'From '+start:start;
  };
  const showAgenda=()=>{
   const day=v.days.find(day=>day.date===selected);agenda.replaceChildren(el('h2',null,dateLabel(selected)));
   if(!day?.items.length){agenda.append(el('p','calendar-empty','Nothing scheduled for this day.'));return;}
   const list=el('ul','calendar-entries');
   day.items.forEach((item,i)=>{
    const row=stagger(el('li',`calendar-entry calendar-${item.kind}${item.taskCompleted?' is-completed':''}`),i),body=el('div','calendar-entry-body');
    const title=(item.taskPath||item.kind==='task'&&item.path)?el('button','source-link calendar-entry-title',item.title):el('strong','calendar-entry-title',item.title);
    if(item.taskPath||item.kind==='task'&&item.path)title.onclick=()=>open(item.taskPath||item.path);
    body.append(title);
    const detail=[timeLabel(item),item.kind==='event'?item.calendar:item.list,item.kind==='event'?item.location:null,item.taskPath?(item.taskCompleted?'Task completed':item.linkState==='linked'?'Linked task':'Task link needs repair'):null].filter(Boolean).join(' · ');
    body.append(el('span','calendar-entry-detail',detail));row.append(el('span','calendar-entry-mark'),body);list.append(row);
   });agenda.append(list);
  };
  const showMonth=()=>{
   const key=keys[monthIndex],days=months.get(key);label.textContent=new Date(key+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
   prev.disabled=monthIndex===0;next.disabled=monthIndex===keys.length-1;grid.replaceChildren();
   for(const name of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])grid.append(el('span','calendar-weekday',name));
   const offset=(new Date(key+'-01T12:00:00Z').getUTCDay()+6)%7;
   for(let i=0;i<offset;i++)grid.append(el('span','calendar-blank'));
   const dayMap=new Map(days.map(day=>[day.date,day]));
   const daysInMonth=new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),0).getDate();
   for(let dayNumber=1;dayNumber<=daysInMonth;dayNumber++){
    const date=`${key}-${String(dayNumber).padStart(2,'0')}`,day=dayMap.get(date);
    if(!day){grid.append(el('span','calendar-blank'));continue;}
    const button=el('button','calendar-day',String(dayNumber));button.type='button';button.dataset.date=date;
    button.setAttribute('aria-label',`${dateLabel(date)}, ${day.items.length} ${day.items.length===1?'entry':'entries'}`);
    button.setAttribute('aria-pressed',String(date===selected));
    if(day.items.length){button.classList.add('has-entries');const dots=el('span','calendar-dots');
      for(const kind of [...new Set(day.items.map(item=>item.kind))])dots.append(el('i',`calendar-${kind}`));button.append(dots);}
    button.onclick=()=>{selected=date;grid.querySelectorAll('.calendar-day').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));showAgenda();};
    grid.append(button);
   }
   showAgenda();
  };
  prev.onclick=()=>{monthIndex--;selected=months.get(keys[monthIndex]).find(day=>day.items.length)?.date||months.get(keys[monthIndex])[0].date;showMonth();};
  next.onclick=()=>{monthIndex++;selected=months.get(keys[monthIndex]).find(day=>day.items.length)?.date||months.get(keys[monthIndex])[0].date;showMonth();};
  showMonth();return wrap;
 }
 function goals(v,open,actions){
  const wrap=el('div','goals-view'),filters=el('div','goal-filters');filters.setAttribute('aria-label','Filter goals');
  for(const [scope,label]of [['active','Active'],['review_due','Review due'],['other','Other'],['all','All']]) {
   const button=el('button','goal-filter',label);button.type='button';button.setAttribute('aria-pressed',String(v.scope===scope));
   button.onclick=()=>actions.filterGoals?.(scope);filters.append(button);
  }
  wrap.append(filters);
  if(v.setup)wrap.append(el('p','empty',v.setup));
  if(v.active_count>3)wrap.append(el('p','goal-notice','More than three active goals. Consider pausing one to make room for your priorities.'));
  if(v.warnings?.length){const details=el('details','goal-warning');details.append(el('summary',null,'Some notes could not be read. This view may be incomplete.'));for(const warning of v.warnings)details.append(el('p',null,`${warning.path}: ${warning.error}`));wrap.append(details);}
  const controls=el('div','goal-actions');
  for(const [label,request]of [['New goal','Help me create a goal with an observable finish line and a next action.'],['Review goals','Let’s review my goals, one at a time.']]) {
   const button=el('button','secondary',label);button.type='button';button.onclick=()=>actions.request?.(request);controls.append(button);
  }
  if(!v.setup)wrap.append(controls);
  if(!v.goals.length&&!v.setup)wrap.append(el('p','empty',v.scope==='review_due'?'No active goals need a review.':v.scope==='active'?'No active goals yet. Choose an outcome you want to work towards.':'No goals in this view.'));
  const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not set';
  v.goals.forEach((goal,i)=>{
   const card=stagger(el('article','goal-card'),i),header=el('div','goal-heading'),title=el('button','source-link goal-title',goal.title);
   title.onclick=()=>open(goal.path);header.append(title,el('span','tag tag-0',goal.status));card.append(header);
   card.append(el('p','goal-finish',goal.finish_line||'Define an observable finish line in this goal note.'));
   const dates=el('div','goal-dates');dates.append(el('span',null,'Target · '+dateLabel(goal.target)));
   if(goal.status==='Active')dates.append(el('span',null,'Review · '+dateLabel(goal.review)));card.append(dates);
   const notices=[];
   if(goal.needs_review)notices.push(goal.review?'Review due':'Choose a review date');
   if(goal.target_passed)notices.push('Target passed · reassess the plan');
   const nextLabels={missing:'Choose a next action',broken:'Next task not found · repair the link',ambiguous:'Next task is ambiguous · choose the exact note',completed:'Next task finished · choose another action'};
   if(nextLabels[goal.next_task_state])notices.push(nextLabels[goal.next_task_state]);
   for(const notice of notices)card.append(el('p','goal-notice',notice));
   if(goal.task){const next=el('div','goal-next');next.append(el('span','goal-label','Next action'));
    const task=el('button','source-link',goal.task.title);task.onclick=()=>open(goal.task.path);next.append(task);
    const timing=[goal.task.completed?'Completed':null,goal.task.planned?'Planned '+goal.task.planned.replace('T',' · '):'Unscheduled',goal.task.due?'Deadline '+goal.task.due.replace('T',' · '):null].filter(Boolean);
    next.append(el('span','goal-task-dates',timing.join(' · ')));if(goal.task.repeat_label)next.append(el('span','goal-task-dates',goal.task.repeat_label));const last=goal.task.last_completion;if(last)next.append(el('span','goal-task-dates','Last recorded completion '+last.date+' · recurring series'));card.append(next);
   }
   if(goal.check_ins){const history=el('details','goal-check-ins');history.append(el('summary',null,'Recorded check-ins'),el('p',null,goal.check_ins));card.append(history);}
   const review=el('button','data-toggle','Review this goal');review.type='button';review.onclick=()=>actions.request?.(`Help me review the goal note at this exact vault path: ${JSON.stringify(goal.path)}. Read its current state and ask about progress, obstacles and the next action.`);card.append(review);
   wrap.append(card);
  });
  return wrap;
 }
 function habits(v,open,actions){
  const wrap=el('div','habits-view'),status=el('p','habit-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  let busy=false;
  if(v.setup){wrap.append(el('p','empty',v.setup));const retry=el('button','secondary','Refresh');retry.onclick=()=>run(()=>actions.habits?.({date:v.date,year:v.year}));wrap.append(retry,status);return wrap;}
  async function run(action){
   if(busy)return;busy=true;status.textContent='Working…';
   const controls=[...wrap.querySelectorAll('button,input')].filter(n=>!n.disabled);controls.forEach(n=>n.disabled=true);
   try{await action();status.textContent='Saved.';}catch(e){status.textContent=(e.message||String(e)).replace(/^Error invoking remote method '[^']+': Error: /,'');}
   finally{busy=false;controls.forEach(n=>n.disabled=false);}
  }
  const select=(date,year=Number(date.slice(0,4)))=>run(()=>actions.habits?.({date,year}));
  const toolbar=el('div','habit-toolbar'),label=el('label',null,'Log a day'),picker=el('input');picker.type='date';picker.value=v.date;picker.max=v.today;picker.min='1900-01-01';picker.setAttribute('aria-label','Log a day');picker.dataset.focus='habit-date';label.append(picker);
  picker.onchange=()=>{if(picker.value&&picker.checkValidity())select(picker.value);else {picker.value=v.date;status.textContent='Choose a valid date from 1900 through today.';}};
  const today=el('button','secondary','Today');today.dataset.focus='habit-today';today.onclick=()=>select(v.today);
  const refresh=el('button','data-toggle','Refresh');refresh.onclick=()=>select(v.date,v.year);refresh.dataset.focus='habit-refresh';toolbar.append(label,today,refresh);wrap.append(toolbar);
  const checkArea=el('div','habit-checks');
  for(const h of v.habits){const label=el('label','habit-check'),check=el('input');check.type='checkbox';check.checked=v.selected.values?.[h.key]===true;check.disabled=!!v.selected.error;check.dataset.focus='habit-'+h.key;
   check.onchange=()=>{const completed=check.checked;check.checked=!completed;run(()=>actions.setHabit?.({date:v.date,key:h.key,completed,version:v.selected.version,definitions_version:v.definitions_version}));};label.append(check,el('span',null,h.label));checkArea.append(label);}
  const openButton=el('button','data-toggle',v.selected.version?'Open daily record':'Create / open daily record');openButton.disabled=!!v.selected.error;
  openButton.onclick=()=>run(()=>actions.openHabitRecord?.({date:v.date,version:v.selected.version,definitions_version:v.definitions_version}));checkArea.append(openButton);wrap.append(checkArea,status);
  if(v.selected.error)status.textContent=v.selected.error;
  if(v.warnings?.length){const warning=el('details','goal-warning');warning.append(el('summary',null,'Some habit data needs attention. Totals may be incomplete.'));for(const w of v.warnings)warning.append(el('p',null,`${w.path}: ${w.error}`));wrap.append(warning);}
  const dateLabel=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
  const plus=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  wrap.append(el('h2','habit-section-title',`This week · ${dateLabel(v.week_start)} – ${dateLabel(plus(v.week_start,6))}`));
  const cards=el('div','habit-cards');
  for(const h of v.habits){const card=el('article','habit-card');card.style.setProperty('--habit-color',h.color);const heading=el('div','habit-card-heading');heading.append(el('strong',null,h.label),el('span',null,h.cadence));card.append(heading);
   const count=el('div','habit-count');count.append(el('strong',null,String(h.week_count)),el('span',null,` / ${h.target} days`));card.append(count);
   const progress=el('progress');progress.max=h.target;progress.value=Math.min(h.week_count,h.target);progress.setAttribute('aria-label',`${h.label}: ${h.week_count} of ${h.target} days recorded this week`);card.append(progress,el('span','habit-caption',h.week_count>=h.target?'Weekly target reached':`${h.target-h.week_count} more ${h.target-h.week_count===1?'day':'days'} to your target`));cards.append(card);}
  wrap.append(cards);
  const annual=el('div','habit-year-controls'),prev=el('button','calendar-nav','‹'),next=el('button','calendar-nav','›');prev.setAttribute('aria-label','Previous habit year');next.setAttribute('aria-label','Next habit year');prev.disabled=v.year<=1900;next.disabled=v.year>=Number(v.today.slice(0,4));prev.dataset.focus='habit-prev';next.dataset.focus='habit-next';
  prev.onclick=()=>select(v.date,v.year-1);next.onclick=()=>select(v.date,v.year+1);annual.append(el('h2','habit-section-title','A year of showing up'),prev,el('strong',null,String(v.year)),next);wrap.append(annual,el('p','habit-caption','Select a square to view that day. Only a checked habit records completion.'));
  const records=new Map(v.records.map(r=>[r.date,r.values])),bad=new Set(v.bad_dates||[]),first=`${v.year}-01-01`,last=`${v.year}-12-31`,offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
  for(const h of v.habits){
   const section=el('section','habit-map');section.style.setProperty('--habit-color',h.color);const heading=el('div','habit-map-heading');heading.append(el('h3',null,h.label),el('span','habit-caption',`${h.year_count} ${h.year_count===1?'day':'days'} recorded in ${v.year}`));section.append(heading);
   const scroll=el('div','habit-map-scroll'),plot=el('div','habit-plot'),months=el('div','habit-months'),grid=el('div','habit-grid'),weekdays=el('div','habit-weekdays');
   ['M','','W','','F','','S'].forEach(d=>weekdays.append(el('span',null,d)));grid.setAttribute('aria-label',`${h.label} daily history for ${v.year}`);
   for(let i=0;i<offset;i++)grid.append(el('span','habit-cell habit-blank'));
   let i=0;const cells=[];
   for(let d=first;d<=last;d=plus(d,1),i++){
    if(d.endsWith('-01')){const month=el('span',null,new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'}));month.style.gridColumn=String(Math.floor((offset+i)/7)+1);months.append(month);}
    const done=records.get(d)?.[h.key]===true,unknown=bad.has(d),future=d>v.today,cell=el('button','habit-cell'+(done?' is-done':'')+(unknown?' is-unknown':'')+(d===v.today?' is-today':''));cell.type='button';cell.dataset.date=d;cell.dataset.focus=`${h.key}-${d}`;cell.disabled=future;cell.tabIndex=d===(v.date.startsWith(String(v.year))?v.date:v.today.startsWith(String(v.year))?v.today:first)?0:-1;
    const label=`${d} · ${h.label}: ${future?'future date':unknown?'unreadable record':done?'recorded':'not recorded'}`;cell.title=label;cell.setAttribute('aria-label',label);cell.setAttribute('aria-pressed',String(d===v.date));
    cell.onclick=()=>select(d,v.year);cell.onkeydown=e=>{const delta={ArrowUp:-1,ArrowDown:1,ArrowLeft:-7,ArrowRight:7}[e.key];if(delta===undefined)return;e.preventDefault();const target=cells.find(c=>c.dataset.date===plus(d,delta));if(target&&!target.disabled){cells.forEach(c=>c.tabIndex=-1);target.tabIndex=0;target.focus();}};grid.append(cell);cells.push(cell);
   }
   plot.append(months,weekdays,grid);scroll.append(plot);section.append(scroll);
   const legend=el('div','habit-legend');for(const [cls,text]of [['','Not recorded'],['is-done','Recorded'],['is-today','Today']]){const item=el('span');item.append(el('i','habit-cell '+cls),document.createTextNode(text));legend.append(item);}section.append(legend);wrap.append(section);
  }
  wrap.append(el('h2','habit-section-title','Recent weeks'));
  wrap.append(table(['Week',...v.habits.map(h=>h.label)],v.weeks.map(w=>[`${dateLabel(w.start)} – ${dateLabel(w.end)}${w.current?' · current':''}${w.incomplete?' · incomplete':''}`,...v.habits.map(h=>`${w.counts[h.key]} / ${h.target}${w.counts[h.key]>=h.target?' ✓':''}`)]),null,open));
  wrap.append(el('p','habit-caption habit-footnote','A colored square means one recorded day. Empty means not recorded. Targets apply to all weeks; they do not automatically complete goals.'));
  return wrap;
 }
 window.renderVisual=(host,v,openSource,actions={})=>{
  if(v?.kind==='recurring'){const api=window.orb||window.orbRecurringPreview;window.OrbRecurring.ui.mount(host,{list:()=>api.recurring(),...(api.recurringInstall?{install:()=>api.recurringInstall()}:{}),write:args=>api.recurringWrite(args),create:args=>api.recurringCreate(args),open:path=>api.openNote(path)});return;}
  if(v?.kind==='trading212'){window.trading212UI.render(host,v,actions);return;}
  const habitFocus=document.activeElement?.dataset.focus,habitScroll=host.scrollTop;
  const selectedDate=host.querySelector('.calendar-day[aria-pressed="true"]')?.dataset.date;
  host.replaceChildren();host.append(el('h1',null,v.title),el('p','subtitle',v.subtitle||''));
  if(v.kind==='habits'){host.append(habits(v,openSource,actions));host.scrollTop=habitScroll;if(habitFocus)[...host.querySelectorAll('[data-focus]')].find(n=>n.dataset.focus===habitFocus)?.focus({preventScroll:true});}
  else if(v.kind==='goals')host.append(goals(v,openSource,actions));
  else if(v.kind==='calendar')host.append(calendar(v,openSource,selectedDate));
  else if(v.kind==='table'){
   if(!v.rows.length)host.append(el('p','empty',v.emptyText||'No rows to show.'));else host.append(isTaskTable(v)?taskList(v,openSource):table(v.columns,v.rows,v.rowPaths,openSource));
  }else{
   const series=v.series,points=v.points,values=points.flatMap(p=>p.values).filter(n=>n!==null),unit=v.unit||'';
   if(series.length===1){
    const known=points.filter(p=>p.values[0]!==null),last=known.at(-1),first=known[0];
    if(last){
     const summary=el('div','chart-summary');summary.append(el('strong',null,fmt(last.values[0],unit)),el('span','summary-label',last.label));
     if(known.length>1&&first.values[0]!==last.values[0]){const change=last.values[0]-first.values[0];summary.append(el('span',`delta ${change>0?'up':'down'}`,`${change>0?'+':'−'}${fmt(Math.abs(change),unit)} since ${first.label}`));}
     host.append(summary);
    }
   }
   if(series.length>1){const legend=el('div','legend');series.forEach((name,i)=>{const span=el('span');const dot=el('i');dot.style.backgroundColor=palette[i%palette.length];span.append(dot,document.createTextNode(name));legend.append(span);});host.append(legend);}
   const W=474,H=v.x_label?262:246;
   const wrap=el('div','chart-wrap'),chart=svg('svg',{viewBox:`0 0 ${W} ${H}`,class:`chart chart-${v.kind}`,role:'img','aria-label':`${v.title}. ${series.join(', ')}. Data table available below.`});
   const defs=svg('defs');chart.append(defs);
   const left=46,right=462,top=22,bottom=212;
   // Round tick values (1, 2, 2.5, 5 × 10ⁿ) so gridlines land on readable numbers.
   const nice=n=>{const e=10**Math.floor(Math.log10(n)),f=n/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;};
   let min=Math.min(0,...values),max=Math.max(0,...values);if(max===min)max=min+1;const tick=nice((max-min)/4);min=Math.floor(min/tick)*tick;max=Math.ceil(max/tick)*tick;const tickCount=Math.round((max-min)/tick);
   const y=n=>bottom-(n-min)/(max-min)*(bottom-top),x=i=>v.kind==='bar'?left+(right-left)*(i+.5)/points.length:points.length===1?(left+right)/2:left+i/(points.length-1)*(right-left);
   if(v.y_label){const t=svg('text',{x:0,y:9,class:'axis-title'});t.textContent=v.y_label;chart.append(t);}
   for(let i=0;i<=tickCount;i++){const val=min+tick*i,yy=y(val);chart.append(svg('line',{x1:left,y1:yy,x2:right,y2:yy,class:i===0||val===0?'grid base':'grid'}));const label=svg('text',{x:left-10,y:yy+3.5,'text-anchor':'end'});label.textContent=fmt(val,unit,true);chart.append(label);}
   // Evenly spaced x labels, always including the first and last.
   const count=Math.min(points.length,points.length>7?6:7),ticks=new Set(Array.from({length:count},(_,k)=>count===1?0:Math.round(k*(points.length-1)/(count-1))));
   const maxChars=points.length>5?10:16;
   ticks.forEach(i=>{const p=points[i];const label=svg('text',{x:x(i),y:233,'text-anchor':v.kind==='bar'?'middle':i===0&&points.length>1?'start':i===points.length-1&&points.length>1?'end':'middle'});label.textContent=p.label.length>maxChars?p.label.slice(0,maxChars-1)+'…':p.label;chart.append(label);});
   if(v.x_label){const t=svg('text',{x:(left+right)/2,y:H-2,'text-anchor':'middle',class:'axis-title'});t.textContent=v.x_label;chart.append(t);}
   const guide=svg('line',{x1:0,y1:top,x2:0,y2:bottom,class:'guide'});
   const marks=[];// marks[i] = elements to highlight at index i
   points.forEach(()=>marks.push([]));
   series.forEach((name,s)=>{
    const color=palette[s%palette.length];
    if(v.kind==='bar'){
     const group=(right-left)/points.length,barW=Math.min(30,group*.7/series.length);
     points.forEach((p,i)=>{const n=p.values[s];if(n===null)return;const xx=left+group*(i+.5)+(s-series.length/2)*barW;const rect=svg('rect',{x:xx+1,y:Math.min(y(n),y(0)),width:Math.max(2,barW-3),height:Math.max(1,Math.abs(y(n)-y(0))),rx:3.5,fill:color,class:n<0?'bar neg':'bar'});stagger(rect,i);chart.append(rect);marks[i].push(rect);});
    }else{
     const segments=[];let segment=[];points.forEach((p,i)=>{if(p.values[s]===null){if(segment.length)segments.push(segment);segment=[];}else segment.push({p,i});});if(segment.length)segments.push(segment);
     if(v.kind==='area'){const gradient=svg('linearGradient',{id:`fill-${v.id}-${s}`,x1:0,y1:0,x2:0,y2:1});gradient.append(svg('stop',{offset:'0%','stop-color':color,'stop-opacity':.28}),svg('stop',{offset:'70%','stop-color':color,'stop-opacity':.06}),svg('stop',{offset:'100%','stop-color':color,'stop-opacity':0}));defs.append(gradient);}
     for(const segment of segments){const line=segment.map(({p,i},j)=>`${j?'L':'M'}${x(i)},${y(p.values[s])}`).join(' ');if(v.kind==='area'&&segment.length>1){const first=segment[0],last=segment[segment.length-1];chart.append(svg('path',{d:`${line} L${x(last.i)},${y(0)} L${x(first.i)},${y(0)} Z`,fill:`url(#fill-${v.id}-${s})`,class:'area-fill'}));}chart.append(svg('path',{d:line,fill:'none',stroke:color,'stroke-width':2.2,'stroke-linejoin':'round','stroke-linecap':'round',pathLength:1,class:'line'}));}
     const lastIndex=points.findLastIndex(p=>p.values[s]!==null);
     points.forEach((p,i)=>{if(p.values[s]===null)return;const cx=x(i),cy=y(p.values[s]);if(i===lastIndex)chart.append(svg('circle',{cx,cy,r:7,fill:color,class:'end-halo'}));const dot=svg('circle',{cx,cy,r:3.6,fill:color,class:i===lastIndex?'chart-dot end':'chart-dot'});chart.append(dot);marks[i].push(dot);});
    }
   });
   // One focusable hit column per point: hover or focus shows a crosshair and every series' value.
   chart.insertBefore(guide,chart.querySelector('.chart-dot,.bar'));
   const tip=el('div','chart-tooltip');tip.hidden=true;
   const activate=i=>{
    marks.flat().forEach(n=>n.classList.remove('active'));chart.classList.toggle('hovering',i!==null);
    if(i===null){tip.hidden=true;guide.classList.remove('on');return;}
    const p=points[i];marks[i].forEach(n=>n.classList.add('active'));
    guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.classList.toggle('on',v.kind!=='bar');
    tip.replaceChildren(el('strong',null,p.label));series.forEach((name,s)=>{const row=el('span','tip-row'),sw=el('i');sw.style.backgroundColor=palette[s%palette.length];row.append(sw,el('span',null,series.length>1?name:v.y_label||name),el('b',null,fmt(p.values[s],unit)));tip.append(row);});
    const top=Math.min(...p.values.filter(n=>n!==null).map(y),bottom);
    tip.style.left=`${x(i)/W*100}%`;tip.style.top=`${top/H*100}%`;tip.dataset.align=x(i)<W*.22?'start':x(i)>W*.78?'end':'middle';tip.hidden=false;
   };
   points.forEach((p,i)=>{
    const span=(right-left)/Math.max(1,v.kind==='bar'?points.length:points.length-1),cx=x(i);
    const hit=svg('rect',{x:Math.max(left-6,cx-span/2),y:top,width:span,height:bottom-top,class:'hit',tabindex:0,'aria-label':`${p.label}: `+series.map((name,s)=>`${name} ${fmt(p.values[s],unit)}`).join(', ')});
    hit.onpointerenter=()=>activate(i);hit.onfocus=()=>activate(i);hit.onblur=()=>activate(null);chart.append(hit);
   });
   chart.onpointerleave=()=>activate(null);
   wrap.append(chart,tip);host.append(wrap);
   const toggle=el('button','data-toggle','View data');toggle.setAttribute('aria-expanded','false');const data=table([v.x_label||'Period',...series],points.map(p=>[p.label,...p.values]),null,openSource);data.hidden=true;toggle.onclick=()=>{data.hidden=!data.hidden;toggle.textContent=data.hidden?'View data':'Hide data';toggle.setAttribute('aria-expanded',String(!data.hidden));};host.append(toggle,data);
  }
  if(v.sources?.length){const footer=el('div','sources');for(const source of v.sources){const b=el('button',null);b.append(icon('i-external'),document.createTextNode(source.path.split('/').pop()+(source.detail?' · '+source.detail:'')));b.title=source.path;b.onclick=()=>openSource(source.path);footer.append(b);}host.append(footer);}
 };
})();
