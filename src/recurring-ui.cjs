const R=require('./recurrence.cjs');
function mount(host,api,{compact=false}={}){
  const doc=host.ownerDocument;
  const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
  const root=el('section',undefined,'recurring-dashboard');host.replaceChildren(root);
  const heading=el('h2','Recurring tasks'),toolbar=el('div',undefined,'recurring-toolbar'),status=el('p','', 'recurring-status'),body=el('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  root.append(heading,toolbar,status,body);let snapshot, busy=false, sequence=0;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const id=()=>api.id?api.id():crypto.randomUUID();
  const button=(label,fn,parent)=>{const b=el('button',label);b.type='button';b.onclick=()=>run(()=>fn());(parent||toolbar).append(b);return b;};
  async function run(fn){if(busy)return;busy=true;root.setAttribute('aria-busy','true');root.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);status.textContent='Working…';try{const message=await fn();if(message)status.textContent=message;else status.textContent='';}catch(e){status.textContent=e.message||String(e);}finally{busy=false;root.removeAttribute('aria-busy');root.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);}}
  async function load(){const generation=++sequence;const data=await api.list();if(generation!==sequence)return;snapshot=data;render();}
  button('Refresh',()=>load());button('New recurring task',()=>editor());
  if(api.install)button('Install Obsidian dashboard',async()=>{const r=await api.install();return `${r.created.length} files installed. ${r.conflicts.length?'Existing customised files kept: '+r.conflicts.join(', '):'Open 0. Home/Recurring Tasks in Obsidian.'}`;});
  const picker=el('select');picker.setAttribute('aria-label','Choose an existing task to repeat');toolbar.append(picker);button('Edit selected task',()=>{const task=snapshot?.tasks.find(t=>t.path===picker.value);if(!task)throw new Error('Choose an existing task.');editor(task);});
  const field=(parent,label,type,value)=>{const wrap=el('label',label),input=el('input');input.type=type;input.value=value??'';wrap.append(input);parent.append(wrap);return input;};
  const select=(parent,label,values,value)=>{const wrap=el('label',label),input=el('select');for(const [v,t]of values){const o=el('option',t);o.value=v;input.append(o);}input.value=value;wrap.append(input);parent.append(wrap);return input;};
  function render(){
    body.replaceChildren();picker.replaceChildren();picker.append(el('option','Choose a task…'));picker.firstChild.value='';
    for(const t of snapshot.tasks.filter(t=>!t.completed||t.recurrence)){const o=el('option',t.title+' · '+t.list);o.value=t.path;picker.append(o);}
    for(const w of snapshot.warnings||[])body.append(el('p',(w.path?w.path+': ':'')+w.error,'recurring-warning'));
    const tasks=snapshot.tasks.filter(t=>t.recurrence||(Array.isArray(t.recurrence_history)&&t.recurrence_history.length));
    if(!tasks.length)body.append(el('p','No recurring tasks yet. Create one or choose an existing task.'));
    for(const t of tasks){
      if(compact&&t.recurrence&&!t.advance_needed&&!t.recurrence_error&&!(t.planned&&t.planned<=today())&&!(t.due&&t.due<=today()))continue;
      const card=el('article',undefined,'recurring-card'),top=el('div',undefined,'recurring-toolbar');card.append(top);body.append(card);
      button(t.title,()=>api.open(t.path),top).className='recurring-title';
      card.append(el('p',t.recurrence_error||t.repeat_label||'Repetition stopped',t.recurrence_error?'recurring-warning':'recurring-muted'));
      card.append(el('p',[t.planned?'Planned '+t.planned:null,t.due?'Deadline '+t.due:null,t.earlier_planned?'Earlier planned occurrence':null].filter(Boolean).join(' · ')));
      if(t.advance_needed)card.append(el('p','Marked complete outside the recurring controls. Choose when it was completed, then advance, or cancel that mark.','recurring-warning'));
      const actions=el('div',undefined,'recurring-toolbar');card.append(actions);
      const date=field(actions,'Completed / skipped on','date',today());date.max=today();
      const apply=async action=>{const result=await api.write({path:t.path,version:t.version,action,occurrence:t.recurrence?.occurrence??null,date:date.value,operation_id:id()});await load();return `${action==='complete'?'Completed':action==='skip'?'Skipped':action==='undo'?'Occurrence restored':action==='stop'?'Repetition stopped':'Saved'}${result.next?' · Next '+result.next:''}.`;};
      if(t.recurrence&&!t.recurrence_error){button(t.advance_needed?'Advance using date':'Complete',()=>apply('complete'),actions);if(!t.advance_needed)button('Skip',()=>apply('skip'),actions);else button('Cancel completion',()=>apply('cancel'),actions);}
      if(!t.advance_needed)button('Edit repeat / dates',()=>editor(t),actions);
      if(t.recurrence)button('Stop repeating',()=>apply('stop'),actions);
      const h=Array.isArray(t.recurrence_history)?t.recurrence_history:[];
      const reversed=new Set(h.filter(e=>e.action==='undo').map(e=>e.reverses)),last=h.findLast(e=>['complete','skip'].includes(e.action)&&!reversed.has(e.id));
      if(last&&JSON.stringify(R.state(t))===JSON.stringify(last.after))button('Undo last occurrence',()=>apply('undo'),actions);
      const details=el('details'),summary=el('summary','History ('+h.length+' changes)');details.append(summary);card.append(details);
      for(const entry of [...h].reverse())details.append(el('p',`${entry.date} · ${entry.action}${entry.before?.recurrence?.occurrence?' · occurrence '+entry.before.recurrence.occurrence:''}${entry.after?.recurrence?' → '+entry.after[entry.after.recurrence.date_field]:''}${entry.reverses?' · reverses earlier completion/skip':''}`));
    }
  }
  function editor(task){
    body.querySelector('.recurring-editor')?.remove();
    const form=el('form',undefined,'recurring-editor');body.prepend(form);form.append(el('h3',task?'Edit '+task.title:'New recurring task'));
    const title=field(form,'Task title','text',task?.title||'');title.maxLength=180;title.readOnly=!!task;
    const list=select(form,'List',[['life','Life'],['business','Business']],task?.list||'life');if(task)list.disabled=true;
    const planned=field(form,'Planned','date',task?.planned||''),due=field(form,'Deadline','date',task?.due||'');
    const existing=task?.recurrence||{};
    const mode=select(form,'Repeat from',[['fixed','Fixed schedule'],['completion','Completion date']],existing.mode||'fixed');
    const interval=field(form,'Every','number',existing.interval||1);interval.min='1';interval.max='1000';interval.step='1';
    const unit=select(form,'Unit',[['day','Days'],['week','Weeks'],['month','Months'],['year','Years']],existing.unit||'week');
    const anchor=select(form,'Advance',[['planned','Planned'],['due','Deadline']],existing.date_field||'planned');
    const days=el('fieldset'),legend=el('legend','Weekdays (fixed weekly schedules)');days.append(legend);form.append(days);
    const checks=R.DAYS.map(d=>{const l=el('label',d.slice(0,3)),c=el('input');c.type='checkbox';c.checked=(existing.weekdays||['monday']).includes(d);l.prepend(c);days.append(l);return c;});
    const preview=el('p','', 'recurring-preview');preview.setAttribute('aria-live','polite');form.append(preview);
    const makeRule=()=>{const date=anchor.value==='due'?due.value:planned.value;return R.rule({version:1,mode:mode.value,unit:unit.value,interval:Number(interval.value),date_field:anchor.value,anchor:date,occurrence:date,weekdays:mode.value==='fixed'&&unit.value==='week'?R.DAYS.filter((_,i)=>checks[i].checked):[]});};
    const update=()=>{days.hidden=mode.value!=='fixed'||unit.value!=='week';try{const r=makeRule();if(r.mode==='fixed'&&r.unit==='week'&&!r.weekdays.includes(R.DAYS[R.weekday(r.anchor)]))throw new Error('Choose a first date on a selected weekday.');const next=R.next(r,r.occurrence);preview.textContent=R.summary(r)+` · First ${r.occurrence} · Next ${next}${r.mode==='completion'?' if completed on the first date':''}. Both dates move together; empty dates stay empty.`;}catch(e){preview.textContent=e.message;}};
    form.oninput=update;form.onchange=update;update();
    const controls=el('div',undefined,'recurring-toolbar');form.append(controls);
    button('Save repeat',async()=>{const r=makeRule();if(task)await api.write({path:task.path,version:task.version,action:'configure',rule:r,planned:planned.value,due:due.value,operation_id:id()});else await api.create({title:title.value,list:list.value,planned:planned.value||null,due:due.value||null,recurrence:r});await load();return 'Repeat schedule saved.';},controls);
    if(task?.recurrence)button('Change dates only',async()=>{await api.write({path:task.path,version:task.version,action:'reschedule',occurrence:task.recurrence.occurrence,planned:planned.value,due:due.value,operation_id:id()});await load();return 'Dates changed; repeat pattern preserved.';},controls);
    button('Cancel',()=>{form.remove();},controls);form.onsubmit=e=>e.preventDefault();title.focus();
  }
  load().catch(e=>{status.textContent=e.message;});return {refresh:load};
}
module.exports={mount};
