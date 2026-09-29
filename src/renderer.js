const $=id=>document.getElementById(id);
const visual=window.orbVisual;
let api=window.orb,settings,connected=false,connecting=false,muted=false,busy=false,peer,channel,microphone,audioContext,analyser,outputAnalyser,outputAudio,sessionGeneration,epoch=0,responseActive=false,pendingContinuation=false,connectionTimer,idleTimer,toolDepth=0;
let speechClient;
let cardMode=null,currentVisual=null,homeGeneration=0,preview=!api,chatOpen=false,orbChatId=null;
const transcriptItems=new Map();
const steps=new Map();
if(preview){
 document.body.classList.add('preview');
 api={settings:async()=>({vaultPath:'/Preview/Main',taskFolders:{life:'0. Home/Life Tasks',business:'0. Home/Business Tasks'},rulesPath:'0. Home/Task Rules.md',goalsFolder:'0. Home/Goals',hasKey:true,chatReady:true,voiceReady:true,googleCalendars:[],hasCalendarToken:false,calendarId:'',fullCalendarServer:false,autoStart:false,shortcutActive:true}),history:async()=>[],chooseVault:async()=>'/Preview/Main',createVault:async()=>{throw new Error('Create a vault in the Mac app. This is a preview.');},saveSettings:async()=>{throw new Error('Preview only. Use Settings in the Mac app.');},openNote:async()=>{},stop:async()=>{},ready:async()=>{},resize:async()=>{},hide:async()=>{},onActivity:()=>{},onActivate:()=>{},onHide:()=>{},onSettings:()=>{},onShortcut:()=>{}};
 api.goals=async scope=>displayVisual(previewGoals(scope));
}
window.trading212UI.init();
// The panel keeps a short trail of views so the header's back button returns to where you came from.
let panelTrail=[];
const panelInfo={home:['i-sun','orange','Today'],welcome:['i-sparkle','blue','Explore'],transcript:['i-chat','blue','Conversation'],settings:['i-gear','gray','Settings'],history:['i-clock','purple','Recent changes'],steps:['i-steps','teal','Steps']};
const visualInfo={recurring:['i-sun','orange','Recurring tasks'],trading212:['i-chart','teal','Trading 212'],goals:['i-target','red','Goals'],habits:['i-flame','green','Habits'],calendar:['i-calendar','red','Calendar'],table:['i-list','orange','Results'],line:['i-chart','purple','Chart'],area:['i-chart','purple','Chart'],bar:['i-chart','purple','Chart']};
function showPanel(mode,{back=false}={}){
 if(mode!=='settings')window.trading212UI?.clearSecrets();
 window.knowledgeUI?.closeWorkspace();
 if(mode!=='home')homeGeneration++;
 if(!mode){panelTrail=[];$('ask-input').value='';}else if(!back&&cardMode&&cardMode!==mode){panelTrail=panelTrail.filter(m=>m!==mode&&m!==cardMode);panelTrail.push(cardMode);}
 const opening=mode&&!cardMode;cardMode=mode;$('companion').hidden=!mode;
 for(const name of ['visual','home','welcome','transcript','settings','history','steps'])$(name+'-view').hidden=name!==mode;
 $('home-button').setAttribute('aria-pressed',String(mode==='home'));$('discover-button').setAttribute('aria-pressed',String(mode==='welcome'));
 const titled=['settings','history'].includes(mode);$('ask-form').hidden=titled;$('card-eyebrow').hidden=!titled;$('card-eyebrow').textContent=panelInfo[mode]?.[2]||'';
 $('ask-input').placeholder=mode==='welcome'?'Ask Orb, or search views and suggestions…':'Ask Orb anything…';$('ask-input').setAttribute('aria-expanded',String(mode==='welcome'));
 const backLabel=panelTrail.length?`Back to ${panelInfo[panelTrail.at(-1)]?.[2]||'previous view'}`:'Close panel';$('close-card').setAttribute('aria-label',backLabel);$('close-card').title=backLabel;
 if(mode!=='settings')$('settings-error').hidden=true;
 if(mode==='welcome')renderCommands();
 updateFooter();
 if(opening&&mode==='welcome')setTimeout(()=>$('ask-input').focus(),60);
 if(!chatOpen)api.resize(['home','welcome'].includes(mode)?'visual':mode||'compact').catch(()=>{});
}
function panelBack(){const previous=panelTrail.pop();if(previous)showPanel(previous,{back:true});else showPanel(null);}
function updateFooter(){
 if(!cardMode)return;
 const [icon,tint,title]=cardMode==='visual'?visualInfo[currentVisual?.kind]||['i-sparkle','blue','In view']:panelInfo[cardMode];
 $('footer-icon').dataset.tint=tint;$('footer-icon').querySelector('use').setAttribute('href','#'+icon);$('footer-title').textContent=title;
 const selected=cardMode==='welcome'?commandItems[commandIndex]:null;
 const primary=cardMode==='settings'?'Save settings':cardMode==='history'?'':selected?.accessory==='Ask'?'Ask Orb':selected?'Open':'Ask Orb';
 $('footer-primary').hidden=!primary;$('footer-primary').firstChild.textContent=primary;
 $('card-footer').querySelector('.action-divider').hidden=!primary;
 $('footer-secondary').firstChild.textContent=cardMode!=='welcome'?'Explore':panelTrail.length?'Back':'Close';
}
function error(e){const message=(e?.message||String(e)).replace(/^Error invoking remote method '[^']+': Error: /,'');$('error-text').textContent=message;$('error').hidden=false;addMessage('tool',message);if(chatOpen)chatToast(message);else if(!cardMode)showPanel('transcript');}
function setStatus(state,text,detail=''){visual.setState(state);$('status-wrap').dataset.state=state;const node=$('status'),key=text+'\n'+detail;if((node.dataset.key??node.textContent)===key)return;node.dataset.key=key;node.textContent=text;if(detail){const d=document.createElement('span');d.className='status-detail';d.textContent=detail;node.append(' · ',d);}node.classList.remove('swap');void node.offsetWidth;node.classList.add('swap');}
const stepName=path=>path?path.split('/').pop().replace(/\.md$/i,''):'';
function clearToolActivity(){steps.clear();$('tool-orbit').replaceChildren();$('tool-orbit').classList.remove('active');$('moon-tip').hidden=true;updateStepsChip();if(cardMode==='steps')renderSteps();}
// Each tool call is a small moon orbiting the orb; the status line carries its words.
function updateToolActivity(data){
 let step=steps.get(data.id);
 if(!step){
  const moon=document.createElement('span');moon.className='moon';moon.append(document.createElement('i'));
  moon.style.setProperty('--a',`${-60+(steps.size%11)*30}deg`);
  moon.onpointerenter=()=>showMoonTip(step);moon.onpointerleave=()=>{$('moon-tip').hidden=true;$('tool-orbit').classList.remove('hover');};
  $('tool-orbit').append(moon);step={moon,started:performance.now()};steps.set(data.id,step);
 }
 Object.assign(step,{label:data.label,status:data.status,path:data.path||step.path});
 if(data.status!=='running')step.ended??=performance.now();
 step.moon.dataset.status=data.status;
 const working=[...steps.values()].some(s=>s.status==='running');$('tool-orbit').classList.toggle('active',working);
 if(data.status==='running')setStatus('thinking',data.label,stepName(data.path));else if(!working)setStatus('thinking','Putting it together…');
 const orbiting=[...steps.values()].filter(s=>s.moon.isConnected);
 for(const s of orbiting.slice(0,Math.max(0,orbiting.length-10)))if(s.status!=='running')s.moon.remove();
 updateStepsChip();if(cardMode==='steps')renderSteps();
}
function showMoonTip(step){
 const tip=$('moon-tip'),home=tip.parentElement.getBoundingClientRect(),moon=step.moon.getBoundingClientRect();
 tip.replaceChildren(document.createTextNode(step.label));
 if(step.path){const small=document.createElement('small');small.textContent=stepName(step.path);tip.append(small);}
 tip.hidden=false;$('tool-orbit').classList.add('hover');
 const half=tip.offsetWidth/2,x=moon.left+moon.width/2-home.left;
 tip.style.left=`${Math.max(half+4,Math.min(home.width-half-4,x))}px`;tip.style.top=`${moon.top-home.top}px`;
}
function updateStepsChip(){
 const all=[...steps.values()],failed=all.filter(s=>s.status==='failed').length,chip=$('steps-chip');
 chip.hidden=!all.length||all.some(s=>s.status==='running');
 chip.classList.toggle('failed',failed>0);chip.querySelector('use').setAttribute('href',failed?'#i-alert':'#i-check');
 chip.querySelector('span').textContent=(failed?`${failed} failed · `:'')+`${all.length} ${all.length===1?'step':'steps'}`;
 chip.setAttribute('aria-label',`Show ${chip.querySelector('span').textContent}`);
}
function renderSteps(){
 const list=$('steps-list');list.replaceChildren();
 if(!steps.size){const empty=document.createElement('li');empty.className='empty';empty.textContent='No steps yet.';list.append(empty);return;}
 [...steps.values()].forEach((s,i)=>{
  const item=document.createElement('li');item.className='step';item.dataset.status=s.status;item.style.setProperty('--i',String(Math.min(i,12)));
  const mark=document.createElement('span');mark.className='step-mark';mark.setAttribute('aria-hidden','true');
  const main=document.createElement('div');main.className='step-main';const title=document.createElement('strong');title.textContent=s.label;main.append(title);
  if(s.path){const link=/\.md$/i.test(s.path)?document.createElement('button'):document.createElement('span');link.className='source-link step-path';link.textContent=s.path;if(link.tagName==='BUTTON')link.onclick=()=>api.openNote(s.path).catch(error);main.append(link);}
  const time=document.createElement('span');time.className='step-time';time.textContent=s.status==='running'?'Running':s.status==='failed'?'Failed':`${((s.ended-s.started)/1000).toFixed(1)}s`;
  item.append(mark,main,time);list.append(item);
 });
}
function addMessage(role,text,id=crypto.randomUUID()){
 let item=transcriptItems.get(id);
 if(!item){item=document.createElement('div');item.className=`message ${role}`;const label=document.createElement('span');label.className='message-label';label.textContent={user:'You',assistant:'Orb',deep:'Deeper thinking',tool:'In your vault'}[role]||'Orb';const content=document.createElement('span');item.append(label,content);$('transcript').append(item);transcriptItems.set(id,item);}
 item.lastChild.textContent=text;$('transcript-view').scrollTop=$('transcript-view').scrollHeight;return item;
}
function liveUI(){
 $('voice-icon').setAttribute('href',connected||connecting?'#i-stop':'#i-mic');$('voice-button').classList.toggle('live',connected||connecting);$('mute-button').hidden=!connected;$('connection-dot').classList.toggle('live',connected);
 const label=connected||connecting?'End voice conversation':'Start voice conversation';$('orb-button').setAttribute('aria-label',label);$('voice-button').setAttribute('aria-label',label);$('voice-button').title=label;
}
function openRecurring(){currentVisual={kind:'recurring',title:'Recurring tasks'};window.renderVisual($('visual-view'),currentVisual,path=>api.openNote(path));showPanel('visual');}
function displayVisual(v){if(chatOpen){chatVisual(v);return;}currentVisual=v;if(!v){if(cardMode==='visual')panelBack();return;}window.renderVisual($('visual-view'),v,path=>api.openNote(path).catch(error),{trading212:args=>api.trading212(args),settings:()=>openSettings(),habits:args=>api.habits(args),setHabit:async args=>{await api.setHabit(args);const status=$('visual-view').querySelector('.habit-status');if(status)status.textContent='Saved to your vault.';},openHabitRecord:async args=>{const result=await api.openHabitRecord(args);await api.openNote(result.path);},filterGoals:scope=>api.goals(scope).catch(error),request:text=>submit(text).catch(error)});showPanel('visual');}
const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=String(text);return element;};
const dateText=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const date=new Date(value+'T12:00:00Z');return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});};
const entries=value=>Array.isArray(value)?value:Array.isArray(value?.tasks)?value.tasks:[];
function section(title,count,label){const section=node('section','home-section'),heading=node('div','home-section-heading');heading.append(node('h2',null,title));if(count!==undefined)heading.append(node('span','home-count',`${count} ${label}${count===1?'':'s'}`));section.append(heading);return section;}
function action(label,callback){const button=node('button','home-action',label);button.type='button';button.onclick=callback;return button;}
function notice(parent,message){parent.append(node('p','home-note',message));}
function warningMessages(value){if(!Array.isArray(value))return [];return value.map(item=>typeof item==='string'?item:[item?.message,item?.error,item?.path].filter(Boolean).join(' · ')).filter(Boolean);}
function renderHome(data){
 const content=$('home-content');content.replaceChildren();
 const shownNotices=new Set(),say=(parent,message)=>{if(!message||shownNotices.has(message))return;shownNotices.add(message);notice(parent,message);};
 const today=entries(data?.today),overdue=entries(data?.overdue),date=data?.date||data?.today?.date||data?.habits?.date||new Date().toISOString().slice(0,10);
 $('home-date').textContent=dateText(date)||'A quick look at what is ahead';
 const taskByKey=new Map(),tasks=[];
 for(const task of [...today.map(item=>({item,overdue:false})),...overdue.map(item=>({item,overdue:true}))]){const key=task.item?.path||[task.item?.title,task.item?.planned,task.item?.due].join('|'),existing=taskByKey.get(key);if(existing){existing.overdue||=task.overdue;continue;}taskByKey.set(key,task);tasks.push(task);}
 const taskSection=section('Tasks',tasks.length,'task');
 if(!tasks.length)say(taskSection,(data?.today?.warnings?.length||data?.overdue?.warnings?.length||data?.today?.error||data?.overdue?.error)?'Task data may be incomplete.':'Nothing due or planned today.');
 else {const list=node('ul','task-list home-task-list');for(const {item,overdue:isOverdue} of tasks.slice(0,8)){
  const row=node('li','task'),main=node('div','task-main');row.append(node('span','task-ring'));
  const title=item.path?node('button','source-link task-title',item.title||'Untitled task'):node('span','task-title',item.title||'Untitled task');if(item.path)title.onclick=()=>api.openNote(item.path).catch(error);main.append(title);
  if(item.venture||item.list)main.append(node('span','tag tag-0',item.venture||item.list));
  const when=node('div','task-when'),dueToday=item.due?.slice(0,10)===date;if(isOverdue)when.append(node('span','due','Past deadline'));else if(dueToday)when.append(node('span',null,'Due today'));else when.append(node('span',null,'Planned today'));
  row.append(main,when);list.append(row);
 }taskSection.append(list);if(tasks.length>8)say(taskSection,`${tasks.length-8} more tasks. Ask Orb to show all of them.`);}
 for(const message of [data?.today?.error,data?.overdue?.error,...warningMessages(data?.today?.warnings),...warningMessages(data?.overdue?.warnings)])say(taskSection,message);
 taskSection.append(action('Manage recurring tasks',()=>openRecurring()));
 taskSection.append(action('Ask about today’s tasks',()=>submit('Show all my tasks planned or due today, plus past deadlines.').catch(error)));content.append(taskSection);
 if(data?.recurring?.tasks?.length){const box=section('Recurring tasks to review',data.recurring.tasks.length,'task');for(const task of data.recurring.tasks){box.append(node('p','home-note',task.title+' · '+(task.recurrence_error|| (task.advance_needed?'Completion needs a date':'Earlier planned '+task.planned))));}box.append(action('Manage recurring tasks',()=>openRecurring()));content.append(box);}
 if(data?.goals!==undefined){const goals=Array.isArray(data.goals)?data.goals:Array.isArray(data.goals?.goals)?data.goals.goals:[],review=goals.filter(goal=>goal.needs_review);const box=section('Goals',goals.length,'active goal');
  if(data.goals?.error)say(box,data.goals.error);else if(data.goals?.setup)say(box,data.goals.setup);else if(!goals.length)say(box,data.goals?.warnings?.length?'Goal data may be incomplete.':'No active goals to show.');else {for(const goal of goals.slice(0,3)){const row=node('div','home-goal'),title=goal.path?node('button','source-link',goal.title||'Untitled goal'):node('span',null,goal.title||'Untitled goal');if(goal.path)title.onclick=()=>api.openNote(goal.path).catch(error);row.append(title);if(goal.needs_review)row.append(node('span','home-badge','Review due'));if(goal.task?.title)row.append(node('small',null,'Next: '+goal.task.title));box.append(row);}}
  for(const message of warningMessages(data.goals?.warnings))say(box,message);
  box.append(action(review.length?'Review goals':'See all goals',()=>api.goals(review.length?'review_due':'active').catch(error)));content.append(box);
 }
 if(data?.habits!==undefined){const habits=Array.isArray(data.habits)?data.habits:Array.isArray(data.habits?.habits)?data.habits.habits:[],values=data.habits?.selected?.values||{},box=section('Habits',habits.length,'habit');
  if(data.habits?.error)say(box,data.habits.error);else if(data.habits?.setup)say(box,data.habits.setup);else if(!habits.length)say(box,data.habits?.warnings?.length?'Habit data may be incomplete.':'No habits configured yet.');else {const list=node('div','home-habit-list');for(const habit of habits.slice(0,4)){const row=node('div','home-habit'),done=values[habit.key]===true;row.append(node('span',done?'home-habit-mark is-done':'home-habit-mark'),node('span',null,habit.label||habit.key||'Habit'),node('small',null,done?'Recorded today':`${habit.week_count??0} this week`));list.append(row);}box.append(list);}
  for(const message of warningMessages(data.habits?.warnings))say(box,message);
  box.append(action('Open habits',()=>api.habits({date:null,year:null}).catch(error)));content.append(box);
 }
 if(data?.calendar!==undefined){const calendar=data.calendar,items=Array.isArray(calendar?.items)?calendar.items:Array.isArray(calendar?.days)?calendar.days.flatMap(day=>day.items||[]):[],box=section('Calendar',items.length,'event');
  if(calendar?.error)say(box,calendar.error);else if(calendar?.setup)say(box,calendar.setup);else if(!items.length)say(box,calendar?.warnings?.length?'Calendar data may be incomplete.':'Nothing on your calendar today.');else {for(const item of items.slice(0,4)){const row=node('div','home-calendar-row');row.append(node('span','home-calendar-time',item.allDay?'All day':typeof item.start==='string'&&item.start.includes('T')?item.start.slice(11,16):''),node('span',null,item.title||'Untitled event'));if(item.taskPath){const link=node('button','source-link',item.taskCompleted?'Task completed':'Open task');link.onclick=()=>api.openNote(item.taskPath).catch(error);row.append(link);}box.append(row);}}
  for(const message of warningMessages(calendar?.warnings))say(box,message);
  box.append(action('Ask about my calendar',()=>submit('What is on my calendar today?').catch(error)));content.append(box);
 }
 if(data?.knowledge?.notes?.length){const box=section('Revisit your knowledge');for(const n of data.knowledge.notes.slice(0,5))box.append(action(n.title,()=>window.knowledgeUI.open(n.kind,n.path)));if(data.knowledge.notes.length>5)notice(box,`${data.knowledge.notes.length-5} more notes to revisit.`);content.append(box);}
 const warnings=warningMessages(data?.warnings).filter(message=>!shownNotices.has(message));if(warnings.length){const box=section('Needs attention');for(const message of warnings)say(box,message);content.append(box);}
}
async function openHome(){const generation=++homeGeneration;showPanel('home');$('home-content').replaceChildren(node('p','empty','Gathering your day…'));$('home-date').textContent='';$('refresh-home').disabled=true;try{const data=await api.today();if(generation===homeGeneration&&cardMode==='home')renderHome(data);}catch(e){if(generation===homeGeneration&&cardMode==='home')$('home-content').replaceChildren(node('p','home-note','Today could not be loaded. '+(e?.message||String(e))));}finally{if(generation===homeGeneration)$('refresh-home').disabled=false;}}
const prompts=[
 ['Plan','What needs my attention today?','Show what is planned or due today, plus anything past its deadline.','i-list','orange'],
 ['Goals','Move a goal forward','What can I do today to move my active goals forward?','i-target','red'],
 ['Knowledge','Browse my knowledge','Show my Hubs, Topics, Knowledge Library, and Portfolio notes.','i-sparkle','blue'],
 ['Habits','Check my habits','Show my habits and what I have recorded this week.','i-flame','green'],
 ['Calendar','See my schedule','What is on my calendar today?','i-calendar','red'],
 ['Notes','Find meeting notes','Find notes about meetings in my vault.','i-doc','yellow'],
 ['Numbers','Make sense of data','Find a spreadsheet in my vault and show a useful trend if the data supports one.','i-chart','purple']
];
// Explore is a command list: views open directly, suggestions submit their request exactly as if typed.
const commands=[
 {group:'Views',icon:'i-sun',tint:'orange',title:'Recurring tasks',subtitle:'Repeat schedules, completion and history',accessory:'View',run:()=>openRecurring()},
 {group:'Views',icon:'i-sun',tint:'orange',title:'Today',subtitle:'Tasks, goals, habits and calendar',accessory:'View',run:()=>openHome()},
 {group:'Views',icon:'i-chart',tint:'teal',title:'Trading 212',subtitle:'Investments, holdings, dividends and activity',accessory:'View',run:()=>window.trading212UI.open()},
 {group:'Views',icon:'i-doc',tint:'blue',title:'Knowledge',subtitle:'Capture, explore and create',accessory:'View',run:()=>window.knowledgeUI.open()},
 {group:'Views',icon:'i-compose',tint:'green',title:'Portfolio',subtitle:'Your ideas and working drafts',accessory:'View',run:()=>window.knowledgeUI.open('portfolio')},
 {group:'Views',icon:'i-steps',tint:'purple',title:'Knowledge graph',subtitle:'Explore connections between notes',accessory:'View',run:()=>window.knowledgeUI.expand()},
 {group:'Views',icon:'i-target',tint:'red',title:'Goals',subtitle:'Active goals and reviews',accessory:'View',run:()=>api.goals('active')},
 {group:'Views',icon:'i-flame',tint:'green',title:'Habits',subtitle:'Log a day and see your year',accessory:'View',run:()=>api.habits({date:null,year:null})},
 ...prompts.map(([category,label,request,icon,tint])=>({group:'Try asking',icon,tint,title:label,subtitle:category,accessory:'Ask',run:()=>submit(request)})),
 {group:'Orb',icon:'i-chat',tint:'blue',title:'Chats',subtitle:'Typed conversations and archive',accessory:'Open',run:()=>openChat()},
 {group:'Orb',icon:'i-steps',tint:'teal',title:'Conversation',subtitle:'This session’s voice transcript',accessory:'View',run:()=>showPanel('transcript')},
 {group:'Orb',icon:'i-clock',tint:'purple',title:'Recent changes',subtitle:'Review and undo Orb’s edits',accessory:'View',run:()=>{showPanel('history');return refreshHistory();}},
 {group:'Orb',icon:'i-gear',tint:'gray',title:'Settings',subtitle:'Vault, integrations and preferences',accessory:'View',run:()=>openSettings()}
];
let commandItems=[],commandIndex=0;
const appIcon=(icon,tint)=>{const box=node('span','app-icon');box.dataset.tint=tint;box.setAttribute('aria-hidden','true');const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('class','icon');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#'+icon);s.append(use);box.append(s);return box;};
function renderCommands(){
 const query=$('ask-input').value.trim(),words=query.toLowerCase().split(/\s+/).filter(Boolean),list=$('command-list');
 commandItems=commands.filter(c=>words.every(w=>`${c.title} ${c.subtitle} ${c.group}`.toLowerCase().includes(w)));
 if(query)commandItems.unshift({group:'Ask Orb',icon:'i-sparkle',tint:'blue',title:query,subtitle:'Ask Orb',accessory:'Ask',run:()=>submit(query)});
 commandIndex=Math.max(0,Math.min(commandIndex,commandItems.length-1));list.replaceChildren();let group=null;
 commandItems.forEach((c,i)=>{
  if(c.group!==group){group=c.group;const heading=node('li','command-group',group);heading.setAttribute('role','presentation');list.append(heading);}
  const row=node('li','command');row.id='command-'+i;row.setAttribute('role','option');row.append(appIcon(c.icon,c.tint),node('span','command-title',c.title),node('span','command-subtitle',c.subtitle),node('span','command-accessory',c.accessory));
  row.onpointermove=()=>{if(commandIndex!==i)selectCommand(i);};row.onclick=()=>runCommand(i);list.append(row);
 });
 selectCommand(commandIndex);
}
function selectCommand(i){
 commandIndex=i;const rows=$('command-list').querySelectorAll('.command');rows.forEach((row,j)=>row.setAttribute('aria-selected',String(j===i)));
 if(rows[i]){$('ask-input').setAttribute('aria-activedescendant',rows[i].id);rows[i].scrollIntoView({block:'nearest'});}else $('ask-input').removeAttribute('aria-activedescendant');
 updateFooter();
}
function runCommand(i=commandIndex){const command=commandItems[i];if(!command)return;Promise.resolve(command.run()).catch(error);}
function openWelcome(){showPanel('welcome');$('ask-input').focus();try{localStorage.setItem('orb-welcome-seen','1');}catch{};}
function updateShortcut(active){if(settings)settings.shortcutActive=active;$('shortcut-hint').querySelector('span').textContent=active?'summon Orb':'set up shortcut';$('shortcut-hint').classList.toggle('needs-setup',!active);$('shortcut-status').textContent=active?'Ready. Double-tap Control from any app.':'The shortcut listener could not start. Try restarting it below.';$('enable-shortcut').textContent=active?'Ready':'Retry';$('enable-shortcut').disabled=active;}
function touch(){clearTimeout(idleTimer);if(connected)idleTimer=setTimeout(()=>{endVoice();setStatus('idle','Conversation ended after five quiet minutes.');},5*60*1000);}
function send(event){if(channel?.readyState==='open')channel.send(JSON.stringify(event));}
function continueResponse(){if(pendingContinuation&&!responseActive&&connected&&!toolDepth){pendingContinuation=false;send({type:'response.create'});}}
function monitorAudio(stream){
  audioContext=new AudioContext();analyser=audioContext.createAnalyser();analyser.fftSize=256;audioContext.createMediaStreamSource(stream).connect(analyser);const data=new Uint8Array(analyser.frequencyBinCount);
  const loudness=node=>{node.getByteFrequencyData(data);return data.reduce((a,b)=>a+b,0)/data.length/110;};
  const token=epoch;function measure(){if(token!==epoch||!analyser)return;visual.setLevel(Math.max(loudness(analyser),outputAnalyser?loudness(outputAnalyser):0));requestAnimationFrame(measure);}measure();
}
function monitorOutput(stream){
  if(!audioContext)return;
  try{outputAnalyser=audioContext.createAnalyser();outputAnalyser.fftSize=256;audioContext.createMediaStreamSource(stream).connect(outputAnalyser);}catch{outputAnalyser=null;}
}
async function startVoice(){
  if(preview){error('This is an interface preview. Voice is available in the Mac app.');return;}
  if(busy){error('Wait for the typed answer to finish first.');return;}
  if(!settings?.voiceReady){openSettings();return;}
  connecting=true;const token=++epoch;liveUI();$('error').hidden=true;setStatus('thinking','Connecting…');
  connectionTimer=setTimeout(()=>{if(token===epoch){endVoice();error('The voice connection timed out. Check your connection and try again.');}},35000);
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(token!==epoch){stream.getTracks().forEach(t=>t.stop());return;}
    microphone=stream;monitorAudio(stream);
    if(settings.ai?.voice.mode==='pipeline'){
      speechClient=new window.OrbSpeechClient({api,stream,analyser,onStatus:(state,text)=>{if(token===epoch){setStatus(state,text);touch();}},onError:e=>{if(token===epoch)error(e);},onEnd:()=>{if(token===epoch)endVoice();}});
      await speechClient.start();if(token!==epoch)return;
      clearTimeout(connectionTimer);connecting=false;connected=true;liveUI();touch();return;
    }
    const connection=new RTCPeerConnection();peer=connection;outputAudio=new Audio();outputAudio.autoplay=true;
    peer.ontrack=e=>{if(token!==epoch)return;outputAudio.srcObject=e.streams[0]||new MediaStream([e.track]);monitorOutput(outputAudio.srcObject);outputAudio.play().catch(()=>error('Audio could not play. End the conversation and click Talk to Orb again.'));};
    microphone.getTracks().forEach(track=>peer.addTrack(track,microphone));
    channel=peer.createDataChannel('oai-events');
    channel.onopen=()=>{if(token!==epoch)return;clearTimeout(connectionTimer);connecting=false;connected=true;liveUI();setStatus('listening','Go ahead. I’m listening.');touch();};
    channel.onmessage=e=>{if(token!==epoch)return;try{onRealtime(JSON.parse(e.data),token).catch(error);}catch(err){error(err);}};
    channel.onclose=()=>{if(token===epoch){endVoice();setStatus('idle','Conversation ended. Click to reconnect.');}};
    peer.onconnectionstatechange=()=>{if(token===epoch&&['failed','disconnected'].includes(connection.connectionState)){endVoice();error('Voice disconnected. Click Talk to Orb to reconnect.');}};
    const offer=await peer.createOffer();await peer.setLocalDescription(offer);
    const result=await api.connect(offer.sdp);if(token!==epoch)return;
    sessionGeneration=result.generation;await peer.setRemoteDescription({type:'answer',sdp:result.sdp});
  }catch(e){if(token===epoch){endVoice();error(e);}}
}
function endVoice(){
  epoch++;speechClient?.close();speechClient=null;clearTimeout(connectionTimer);clearTimeout(idleTimer);connected=false;connecting=false;muted=false;responseActive=false;pendingContinuation=false;toolDepth=0;
  if(channel){channel.onclose=null;channel.close();}channel=null;
  peer?.close();peer=null;microphone?.getTracks().forEach(t=>t.stop());microphone=null;
  if(outputAudio){outputAudio.pause();outputAudio.srcObject=null;}outputAudio=null;
  audioContext?.close().catch(()=>{});audioContext=null;analyser=null;outputAnalyser=null;visual.setLevel(0);
  api.stop().catch(error);liveUI();$('mute-icon').setAttribute('href','#i-mic');$('mute-button').classList.remove('muted');setStatus('idle','Here when you need me.');
}
async function onRealtime(event,token){
  const type=event.type;
  if(type==='input_audio_buffer.speech_started'){clearToolActivity();touch();setStatus('listening','I’m listening.');}
  if(type==='input_audio_buffer.speech_stopped')setStatus('thinking','Let me take a look…');
  if(type==='conversation.item.input_audio_transcription.completed')addMessage('user',event.transcript,event.item_id);
  if(type==='response.created'){responseActive=true;touch();setStatus('thinking','One moment…');}
  if(type==='response.output_audio_transcript.delta'||type==='response.output_text.delta'){
    const id=event.item_id||event.response_id;const previous=transcriptItems.get(id)?.lastChild.textContent||'';addMessage('assistant',previous+(event.delta||''),id);
  }
  if(type==='output_audio_buffer.started')setStatus('speaking','Here’s what I’m thinking.');
  if(type==='output_audio_buffer.stopped'||type==='output_audio_buffer.cleared'){if(connected)setStatus('listening',muted?'Microphone muted. You can still type.':'I’m listening.');}
  if(type==='error'){error(event.error?.message||'Voice session error.');responseActive=false;}
  if(type==='response.done'){
    responseActive=false;
    if(event.response?.status==='failed')error(event.response.status_details?.error?.message||'The voice model could not finish.');
    const calls=(event.response?.output||[]).filter(i=>i.type==='function_call');
    if(calls.length){
      toolDepth++;
      try {
        for(const call of calls){
          if(token!==epoch)return;
          let result;try{result=await api.tool({name:call.name,args:JSON.parse(call.arguments),callId:call.call_id,generation:sessionGeneration});}catch(e){result={error:e.message};}
          if(token!==epoch)return;
          send({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)}});
        }
        pendingContinuation=true;
      }finally{if(token===epoch)toolDepth--;}
    }
    if(token===epoch){continueResponse();touch();}
  }
}
async function submit(text){
  if(!text.trim()||busy)return;
  if(preview){previewAnswer(text);return;}
  if(!settings?.chatReady){openSettings();return;}
  if(connecting){error('Wait for voice to connect, or cancel it first.');return;}
  if(connected&&(responseActive||toolDepth)){error('Wait for Orb to finish, or interrupt by speaking.');return;}
  $('ask-input').value='';$('error').hidden=true;clearToolActivity();if(!speechClient)addMessage('user',text);
  if(connected&&speechClient){speechClient.answer({text});touch();return;}
  if(connected){
    send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});send({type:'response.create'});touch();return;
  }
  // Typed requests from the orb panel become a chat too, so they can be continued in the chat window.
  orbChatId??=crypto.randomUUID();resumeChat(orbChatId);
  showPanel('transcript');busy=true;$('voice-button').disabled=true;setStatus('thinking','Thinking it through…');
  try{const result=await api.chat({chatId:orbChatId,text});addMessage('assistant',result.text);setStatus('idle','What else is on your mind?');}
  catch(e){error(e);setStatus('idle','Ready when you are.');}
  finally{busy=false;$('voice-button').disabled=false;}
}

async function refreshHistory(){
 const entries=await api.history();$('activity-list').replaceChildren();
 if(!entries.length){const p=document.createElement('p');p.className='empty';p.textContent='No changes yet.';$('activity-list').append(p);}
 for(const entry of entries){const item=document.createElement('div');item.className='activity';const title=document.createElement('strong');title.textContent=entry.action+(entry.status==='undone'?' · undone':'');const p=document.createElement('p');p.textContent=entry.path;const time=document.createElement('time');time.textContent=new Date(entry.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});item.append(title,p,time);
  if(entry.status==='applied'&&entry.undoable!==false){const undo=document.createElement('button');undo.textContent='Undo';undo.disabled=connected||busy;undo.onclick=async()=>{try{await api.undo(entry.id);await refreshHistory();}catch(e){error(e);}};item.append(undo);}else if(entry.status!=='undone'){const span=document.createElement('span');span.textContent=entry.undoable===false?'Use calendar actions':entry.status;item.append(span);}$('activity-list').append(item);
 }
}
async function openSettings(){if(connected||connecting)endVoice();settings=await api.settings();window.orbProviderSettings.load(settings,api,preview);window.trading212UI.loadSettings();$('vault-path').value=settings.vaultPath;$('life-folder').value=settings.taskFolders.life;$('business-folder').value=settings.taskFolders.business;$('rules-path').value=settings.rulesPath;$('goals-folder').value=settings.goalsFolder??'0. Home/Goals';$('habit-folder').value=settings.habitFolder??'0. Home/Habit Log';$('habit-script').value=settings.habitScript??'99. System/99.4 Scripts/habits/view.js';$('auto-start').checked=settings.autoStart;const hours=settings.workingHours||{start:'09:00',end:'17:00',days:[1,2,3,4,5]};$('work-start').value=hours.start;$('work-end').value=hours.end;document.querySelectorAll('[name=work-day]').forEach(input=>input.checked=hours.days.includes(Number(input.value)));$('calendar-token').value='';$('calendar-token').placeholder=settings.hasCalendarToken?'Token saved':'Paste token from Obsidian';const calendars=settings.googleCalendars||[],select=$('calendar-id');select.replaceChildren(new Option('Choose a Google calendar',''));for(const calendar of calendars)select.add(new Option(calendar.name,calendar.id));select.value=settings.calendarId||(calendars.length===1?calendars[0].id:'');const calendarConnected=calendars.length>0&&settings.fullCalendarServer&&settings.hasCalendarToken&&!!settings.calendarId,status=$('calendar-status'),integration=$('google-calendar-integration');status.textContent=calendarConnected?'Connected':calendars.length||settings.hasCalendarToken?'Finish setup':'Set up';status.className='integration-status '+(calendarConnected?'connected':calendars.length||settings.hasCalendarToken?'attention':'');integration.open=!calendarConnected;$('calendar-setup').textContent=!calendars.length?'Connect a Google calendar in Obsidian Full Calendar first. Then reopen Orb Settings.':!settings.fullCalendarServer?'Enable Local REST Server in Obsidian Full Calendar → Integrations. Generate a token with Read events, Write events and Read providers.':!settings.hasCalendarToken?'Paste a Full Calendar token with Read events, Write events and Read providers.':'Choose the default calendar Orb should use when creating events.';$('settings-error').hidden=true;updateShortcut(settings.shortcutActive);showPanel('settings');}
$('home-button').onclick=()=>{if(cardMode==='home')showPanel(null);else openHome().catch(error);};
$('discover-button').onclick=()=>toggleExplore();
$('refresh-home').onclick=()=>openHome().catch(error);
$('settings-button').onclick=()=>cardMode==='settings'?panelBack():openSettings().catch(error);
$('close-card').onclick=panelBack;
$('ask-input').oninput=()=>{if(cardMode==='welcome'){commandIndex=0;renderCommands();}};
$('ask-input').onkeydown=e=>{
 if(cardMode!=='welcome'||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
 e.preventDefault();const last=commandItems.length-1;selectCommand(e.key==='Home'?0:e.key==='End'?last:e.key==='ArrowDown'?Math.min(last,commandIndex+1):Math.max(0,commandIndex-1));
};
$('ask-form').onsubmit=e=>{e.preventDefault();if(cardMode==='welcome')runCommand();else submit($('ask-input').value).catch(error);};
$('footer-primary').onclick=()=>{if(cardMode==='settings')$('settings-form').requestSubmit();else if(cardMode==='welcome'||$('ask-input').value.trim())$('ask-form').requestSubmit();else $('ask-input').focus();};
const toggleExplore=()=>cardMode==='welcome'?panelBack():openWelcome();
$('footer-secondary').onclick=toggleExplore;
$('hide-button').onclick=()=>{endVoice();api.hide().catch(error);};
$('chat-button').onclick=()=>openChat();
$('shortcut-hint').onclick=()=>{if(!settings?.shortcutActive)openSettings().catch(error);};
$('enable-shortcut').onclick=async()=>{try{updateShortcut(await api.enableShortcut());}catch(e){$('settings-error').textContent=e.message;$('settings-error').hidden=false;}};
function applyVaultLayout(value){
 if(value.vaultPath!==$('vault-path').value){$('calendar-id').value='';$('calendar-token').value='';}
 $('vault-path').value=value.vaultPath;
 $('life-folder').value=value.taskFolders?.life||'0. Home/Life Tasks';$('business-folder').value=value.taskFolders?.business||'0. Home/Business Tasks';
 $('goals-folder').value=value.goalsFolder??'0. Home/Goals';$('habit-folder').value=value.habitFolder??'0. Home/Habit Log';
 $('habit-script').value=value.habitScript??'99. System/99.4 Scripts/habits/view.js';$('rules-path').value=value.rulesPath??'0. Home/Task Rules.md';
}
$('create-vault').onclick=async()=>{
 const button=$('create-vault');button.disabled=true;
 try{const created=await api.createVault();if(created){applyVaultLayout(created);$('vault-setup-status').textContent='Vault created with the complete system. Save settings to connect it. Open README.md in the vault for the Obsidian guide.';}}
 catch(e){$('settings-error').textContent=e.message;$('settings-error').hidden=false;}finally{button.disabled=false;}
};
$('choose-vault').onclick=async()=>{try{const folder=await api.chooseVault();if(folder){applyVaultLayout(folder===settings?.vaultPath?settings:{vaultPath:folder});$('vault-setup-status').textContent='Save to validate and connect this vault. It must contain the Orb structure; existing files will not be changed.';}}catch(e){error(e);}};
$('settings-form').onsubmit=async e=>{e.preventDefault();try{const wasSetup=!settings?.chatReady;settings=await api.saveSettings({vaultPath:$('vault-path').value,taskFolders:{life:$('life-folder').value.trim(),business:$('business-folder').value.trim()},rulesPath:$('rules-path').value.trim(),goalsFolder:$('goals-folder').value.trim(),habitFolder:$('habit-folder').value.trim(),habitScript:$('habit-script').value.trim(),...window.orbProviderSettings.read(),calendarToken:$('calendar-token').value.trim(),calendarId:$('calendar-id').value,workingHours:{start:$('work-start').value,end:$('work-end').value,days:[...document.querySelectorAll('[name=work-day]:checked')].map(input=>Number(input.value))},autoStart:$('auto-start').checked});window.orbProviderSettings.clear();$('calendar-token').value='';if(wasSetup&&settings.chatReady)openWelcome();else showPanel(null);}catch(err){$('settings-error').textContent=err.message;$('settings-error').hidden=false;}};
const toggleVoice=()=>connected||connecting?endVoice():startVoice();$('voice-button').onclick=toggleVoice;$('orb-button').onclick=toggleVoice;
$('mute-button').onclick=()=>{muted=!muted;speechClient?.setMuted(muted);microphone?.getAudioTracks().forEach(t=>t.enabled=!muted);$('mute-icon').setAttribute('href',muted?'#i-mic-off':'#i-mic');$('mute-button').classList.toggle('muted',muted);$('mute-button').setAttribute('aria-label',muted?'Unmute microphone':'Mute microphone');setStatus('listening',muted?'Microphone muted.':'I’m listening.');liveUI();};
$('steps-chip').onclick=()=>{if(cardMode==='steps')return showPanel(null);showPanel('steps');renderSteps();};
$('dismiss-error').onclick=()=>$('error').hidden=true;
$('history-button').onclick=()=>{showPanel('history');refreshHistory().catch(error);};$('transcript-button').onclick=()=>showPanel('transcript');
function routeActivity(data){
 // A chat window request draws its own steps and visuals; everything else belongs to the orb.
 if(data.chatId&&chatOwns(data)){chatActivity(data);return;}
 if(data.kind==='tool-state')updateToolActivity(data);
 if(data.kind==='change'){addMessage('tool',data.action+' · '+data.path);if(cardMode==='history')refreshHistory().catch(error);if(cardMode==='home')openHome().catch(error);}
 if(data.kind==='voice-transcript')addMessage(data.role,data.text);
 if(data.kind==='deep')addMessage('deep',data.text);
 if(data.kind==='visual')displayVisual(data.visual);
 if(data.kind==='visual-error')error(data.message);
}
api.onActivity(routeActivity);
api.onActivate(()=>{if(chatOpen){$('chat-input').focus();return;}if(settings&&!connected&&!connecting&&!busy&&cardMode!=='settings')startVoice();});
api.onHide(()=>{endVoice();clearToolActivity();showPanel(null);$('error').hidden=true;});
api.onSettings(()=>openSettings().catch(error));api.onShortcut(updateShortcut);
window.addEventListener('beforeunload',()=>{microphone?.getTracks().forEach(t=>t.stop());peer?.close();});
window.addEventListener('keydown',e=>{
 if(e.metaKey&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='j'){e.preventDefault();chatOpen?closeChat():openChat();return;}
 if(chatOpen){if(chatKeydown(e))return;}
 else if(e.metaKey&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();toggleExplore();return;}
 if(e.key!=='Escape')return;
 // Like a search field: the first Escape clears a typed query, the next hides Orb.
 if(document.activeElement===$('ask-input')&&$('ask-input').value){$('ask-input').value='';$('ask-input').dispatchEvent(new Event('input'));return;}
 endVoice();api.hide().catch(error);
});
async function previewSteps(){
 clearToolActivity();const wait=ms=>new Promise(r=>setTimeout(r,ms));
 for(const [id,label,path,done] of [['a','Searching vault',null,'Searching vault'],['b','Reading note','Notes/Weekly plan.md','Reading note'],['c','Reading sheet','Finance/Savings 2026.xlsx','Reading sheet']]){
  updateToolActivity({id,label,path,status:'running'});await wait(900);updateToolActivity({id,label:done,path,status:'done'});
 }
}
async function previewAnswer(text){
 $('ask-input').value='';addMessage('user',text);await previewSteps();
 if(/trading\s?212/i.test(text))displayVisual(await api.trading212({view:/dividend/i.test(text)?'dividends':/deposit|interest|cash movement/i.test(text)?'cash':/pending|order/i.test(text)?'pending':'overview'}));
 else if(/recurr|repeat/i.test(text))displayVisual({kind:'recurring',title:'Recurring tasks'});
 else if(/habit|pull.up|mandarin|heatmap/i.test(text))displayVisual(previewHabits());
 else if(/goal|review/i.test(text))displayVisual(previewGoals(/review/i.test(text)?'review_due':'active'));
 else if(/note/i.test(text))displayVisual({id:'preview',kind:'table',title:'Meeting notes',subtitle:'Fictional preview · 2 notes',columns:['Note','Folder'],rows:[['Example meeting','Notes'],['Example launch options','Notes']],rowPaths:['Notes/Example meeting.md','Notes/Example launch options.md'],sources:[]});
 else if(/calendar|schedule|meeting/i.test(text))displayVisual({id:'preview',kind:'calendar',title:'Your calendar',subtitle:'5 entries · Europe/London',start:'2026-09-26',end:'2026-09-29',days:[
  {date:'2026-09-26',items:[]},{date:'2026-09-27',items:[{kind:'event',title:'Time off',start:'2026-09-27',end:'2026-09-29',allDay:true,calendar:'Personal'}]},
  {date:'2026-09-28',items:[{kind:'event',title:'Time off',start:'2026-09-27',end:'2026-09-29',allDay:true,calendar:'Personal'},{kind:'event',title:'Team meeting',start:'2026-09-28T09:00:00',end:'2026-09-28T10:00:00',allDay:false,calendar:'Work',location:'Office'}]},
  {date:'2026-09-29',items:[{kind:'event',title:'Draft proposal',start:'2026-09-29T10:00:00',end:'2026-09-29T10:45:00',allDay:false,calendar:'Work',taskPath:'0. Home/Business Tasks/Draft proposal.md',taskCompleted:false,linkState:'linked'},{kind:'event',title:'Send outline',start:'2026-09-29T14:00:00',end:'2026-09-29T14:30:00',allDay:false,calendar:'Work',taskPath:'0. Home/Business Tasks/Send outline.md',taskCompleted:true,linkState:'linked'},{kind:'task',title:'File report',start:'2026-09-29',allDay:true,dateType:'due',list:'business',path:'0. Home/Business Tasks/File report.md'}]}],warnings:[],truncated:false,total:5,shown:5,sources:[]});
 else if(/chart|saving|graph|spreadsheet|trend/i.test(text))displayVisual({id:'preview',kind:'area',title:'A little more set aside.',subtitle:'Example data · savings balance, January–June',series:['Savings'],points:[{label:'Jan',values:[3200]},{label:'Feb',values:[3700]},{label:'Mar',values:[3550]},{label:'Apr',values:[4400]},{label:'May',values:[4900]},{label:'Jun',values:[5650]}],unit:'GBP',x_label:'2026',y_label:'Balance',sources:[{path:'Example savings.csv',detail:'Illustrative data'}]});
 else displayVisual({id:'preview',kind:'table',title:'Today’s tasks',subtitle:'Example data · 3 tasks',columns:['Task','Area','Planned'],rows:[['Call the dentist','Life','10:00'],['Finish launch notes','Studio','14:00'],['Take a long walk','Life','17:30']],sources:[]});
 setStatus('idle','Here’s the picture.');
}
function previewGoals(scope='active'){
 const goals=[
  {path:'0. Home/Goals/Launch a portfolio.md',title:'Launch a portfolio',status:'Active',finish_line:'Publish three case studies and a contact page on my own domain.',target:'2026-11-20',review:'2026-09-28',needs_review:true,target_passed:false,next_task_state:'ready',task:{path:'0. Home/Business Tasks/Draft first case study.md',title:'Draft the first case study',planned:'2026-09-29',due:null,completed:false},check_ins:'### 2026-09-21\n\n- Progress: Chose three projects to feature.\n- Obstacle: Finding time for writing.\n- Decision and next action: Draft one case study this week.'},
  {path:'0. Home/Goals/Run a comfortable 5K.md',title:'Run a comfortable 5K',status:'Active',finish_line:'Run 5 km without stopping, at a comfortable pace.',target:null,review:'2026-10-02',needs_review:false,target_passed:false,next_task_state:'completed',task:{path:'0. Home/Life Tasks/Choose a running route.md',title:'Choose a running route',planned:null,due:null,completed:true},check_ins:''},
  {path:'0. Home/Goals/Learn pottery.md',title:'Learn pottery',status:'Someday',finish_line:'Make and glaze a small bowl in a beginner class.',target:null,review:null,needs_review:false,target_passed:false,next_task_state:'missing',task:null,check_ins:''}
 ];
 return {id:'preview-goals',kind:'goals',title:'Your goals',subtitle:'Example data · 2 active · One next action at a time',date:'2026-09-28',scope,goals:goals.filter(g=>scope==='all'||scope==='active'&&g.status==='Active'||scope==='other'&&g.status!=='Active'||scope==='review_due'&&g.needs_review),active_count:2,warnings:[],sources:[]};
}
(async()=>{settings=await api.settings();liveUI();updateShortcut(settings.shortcutActive);await api.ready();if(!settings.chatReady&&!preview)await openSettings();else if(preview)openWelcome();else {let seen=true;try{seen=localStorage.getItem('orb-welcome-seen')==='1';}catch{}if(!seen)openWelcome();}})().catch(error);

// Fictional, in-memory preview. No vault or API calls are made here.
const previewHabitRecords=new Map();
function previewHabits({date='2026-09-28',year=Number(date.slice(0,4))}={}){
 const today='2026-09-28',plus=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const weekStart=date=>plus(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7)),start=weekStart(today);
 const habits=[{key:'pull_ups',label:'Pull-ups',target:7,cadence:'Daily',color:'#31995b'},{key:'study_mandarin',label:'Study Mandarin',target:2,cadence:'Twice a week',color:'#6387db'}];
 const count=(a,b,key)=>[...previewHabitRecords.values()].filter(r=>r.date>=a&&r.date<=b&&r.values[key]).length;
 return {id:'preview-habits',kind:'habits',title:'Your habits',subtitle:'Fictional preview · Small actions, a little more often.',today,date,year,week_start:start,definitions_version:'preview',habits:habits.map(h=>({...h,week_count:count(start,today,h.key),year_count:count(`${year}-01-01`,`${year}-12-31`,h.key)})),records:[...previewHabitRecords.values()],selected:previewHabitRecords.get(date)||{path:`0. Home/Habit Log/${date}.md`,date,version:null,values:{pull_ups:false,study_mandarin:false}},weeks:Array.from({length:8},(_,i)=>{const s=plus(start,-i*7),end=plus(s,6);return {start:s,end,current:i===0,counts:Object.fromEntries(habits.map(h=>[h.key,count(s,end,h.key)]))};}),warnings:[],sources:[]};
}
if(preview){
 const recurringNotes=new Map(),R=window.OrbRecurring.core;let recurringRevision=0;
 const recurringToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 api.recurring=async()=>({tasks:[...recurringNotes.entries()].map(([path,n])=>({...R.inspect(n.text,recurringToday()),path,title:n.title,list:n.list,version:String(n.version)})),warnings:[]});
 api.recurringCreate=async args=>{const n=R.create(args);if(args.recurrence)n.text=R.transform(n.text,{action:'configure',rule:args.recurrence,operation_id:crypto.randomUUID()},{today:recurringToday()}).text;const path=n.name+'-'+crypto.randomUUID()+'.md';recurringNotes.set(path,{...n,title:args.title,list:args.list,version:++recurringRevision});return {path};};
 api.recurringWrite=async args=>{const n=recurringNotes.get(args.path);if(!n||String(n.version)!==args.version)throw new Error('Task changed. Refresh first.');const result=R.transform(n.text,args,{today:recurringToday()});recurringNotes.set(args.path,{...n,text:result.text,version:++recurringRevision});return result;};
 window.orbRecurringPreview=api;
 api.today=async()=>({date:'2026-09-29',today:{date:'2026-09-29',tasks:[{path:'0. Home/Life Tasks/Call the dentist.md',title:'Call the dentist',list:'Life',planned:'2026-09-29T10:00:00',due:null},{path:'0. Home/Business Tasks/Finish launch notes.md',title:'Finish launch notes',list:'Business',planned:'2026-09-29T14:00:00',due:'2026-09-29'}],warnings:[]},overdue:{date:'2026-09-29',tasks:[{path:'0. Home/Life Tasks/Book train.md',title:'Book train',list:'Life',due:'2026-09-27'}],warnings:[]},goals:{goals:previewGoals('active').goals,warnings:[]},habits:{date:'2026-09-29',habits:[{key:'pull_ups',label:'Pull-ups',week_count:2},{key:'study_mandarin',label:'Study Mandarin',week_count:1}],selected:{values:{pull_ups:true,study_mandarin:false}},warnings:[]},calendar:{items:[{kind:'event',title:'Team meeting',start:'2026-09-29T09:00:00',allDay:false},{kind:'event',title:'Time off',start:'2026-09-29',allDay:true}],warnings:[]},warnings:[]});
 for(let i=0;i<270;i++){
  const d=new Date('2026-01-01T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);
  if(i%7!==0&&i%11!==0)previewHabitRecords.set(date,{path:`0. Home/Habit Log/${date}.md`,date,version:'preview',values:{pull_ups:i%5!==0,study_mandarin:i%3===0}});
 }
 api.habits=async args=>displayVisual(previewHabits({date:args?.date||'2026-09-28',year:args?.year??Number((args?.date||'2026-09-28').slice(0,4))}));
 api.setHabit=async args=>{const r=previewHabitRecords.get(args.date)||{path:`0. Home/Habit Log/${args.date}.md`,date:args.date,version:'preview',values:{pull_ups:false,study_mandarin:false}};r.values[args.key]=args.completed;previewHabitRecords.set(args.date,r);displayVisual(previewHabits({date:args.date,year:currentVisual.year}));};
 api.openHabitRecord=async args=>({path:`0. Home/Habit Log/${args.date}.md`});
}
