// Chat window: the orb steps aside for a full conversation view with saved chats, an archive and live tool activity.
const chat={list:[],filter:'recent',query:'',currentId:null,current:null,pending:null,menu:null,unread:new Set(),load:0,moving:false};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const stillMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const cleanError=e=>(e?.message||String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
const svgIcon=id=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('class','icon');s.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#'+id);s.append(use);return s;};
const chatTitle=text=>{const line=text.replace(/\s+/g,' ').trim(),short=line.length>52?line.slice(0,50).replace(/\s+\S*$/,'')+'…':line;return short.charAt(0).toUpperCase()+short.slice(1)||'New chat';};
const chatSummary=c=>{const last=[...c.messages].reverse().find(m=>m.role==='assistant'||m.role==='user');return {id:c.id,title:c.title,createdAt:c.createdAt,updatedAt:c.updatedAt,archived:c.archived,count:c.messages.length,preview:(last?.text||'').replace(/\*\*|`|^#+\s*/gm,'').replace(/\s+/g,' ').slice(0,90)};};
let sidebarShown=true;try{sidebarShown=localStorage.getItem('orb-chat-sidebar')!=='hidden';}catch{}

// The orb swells, shrinks into itself and fades; the chat then blooms out from the same spot. Closing reverses it.
async function openChat(id){
 if(chatOpen||chat.moving)return;window.knowledgeUI?.closeWorkspace();chat.moving=true;
 if(connected||connecting)endVoice();
 if(cardMode)showPanel(null);
 $('error').hidden=true;$('moon-tip').hidden=true;if(id)resumeChat(id);
 if(!stillMotion()){document.body.classList.add('orb-leaving');await pause(380);}
 chatOpen=true;await api.resize('chat').catch(()=>{});
 document.body.classList.remove('orb-leaving');document.body.classList.add('chat-mode');
 const app=$('chat-app');app.classList.toggle('sidebar-hidden',!sidebarShown);app.hidden=false;
 if(!stillMotion()){app.classList.add('entering');setTimeout(()=>app.classList.remove('entering'),900);}
 chat.moving=false;
 await refreshChatList();
 if(chat.current&&chat.current.id===chat.currentId)renderThread();
 else if(chat.currentId&&chat.list.some(c=>c.id===chat.currentId))await selectChat(chat.currentId);
 else newChat();
 focusComposer();
}
async function closeChat(){
 if(!chatOpen||chat.moving)return;window.knowledgeUI?.closeWorkspace();chat.moving=true;closeMenu();
 const app=$('chat-app');
 if(!stillMotion()){app.classList.add('leaving');await pause(280);}
 app.hidden=true;app.classList.remove('leaving','entering');document.body.classList.remove('chat-mode');chatOpen=false;
 await api.resize('compact').catch(()=>{});
 if(!stillMotion()){document.body.classList.add('orb-arriving');setTimeout(()=>document.body.classList.remove('orb-arriving'),900);}
 chat.moving=false;$('chat-button').focus();
}
function resumeChat(id){if(chat.currentId!==id){chat.currentId=id;chat.current=null;}}
function focusComposer(){setTimeout(()=>$('chat-input').focus(),40);}
function chatToast(message){const toast=$('chat-toast');toast.querySelector('span').textContent=message;toast.hidden=false;clearTimeout(chatToast.timer);chatToast.timer=setTimeout(()=>toast.hidden=true,6000);}

// Chat list: recent or archived, grouped by day, searchable.
async function refreshChatList(){try{chat.list=await api.chats();}catch(e){chatToast(cleanError(e));}renderChatList();}
function dayGroup(iso){
 const date=new Date(iso),today=new Date();today.setHours(0,0,0,0);const days=Math.floor((today-new Date(date).setHours(0,0,0,0))/864e5);
 return days<=0?'Today':days===1?'Yesterday':days<7?'Previous 7 days':days<30?'Previous 30 days':date.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
}
function renderChatList(){
 const nav=$('chat-list'),archived=chat.filter==='archived',words=chat.query.toLowerCase().split(/\s+/).filter(Boolean);
 $('chat-tab-recent').setAttribute('aria-selected',String(!archived));$('chat-tab-archived').setAttribute('aria-selected',String(archived));
 const items=chat.list.filter(c=>!!c.archived===archived&&words.every(w=>`${c.title} ${c.preview}`.toLowerCase().includes(w)));
 nav.replaceChildren();
 if(!items.length){nav.append(node('p','chat-list-empty',words.length?'No chats match.':archived?'Archived chats rest here.':'Your chats will appear here.'));return;}
 let group=null;
 items.forEach((c,i)=>{
  const heading=dayGroup(c.updatedAt);if(heading!==group){group=heading;nav.append(node('h2','chat-list-group',heading));}
  const row=node('div','chat-item');row.style.setProperty('--i',String(Math.min(i,14)));
  const open=node('button','chat-item-open');open.type='button';if(c.id===chat.currentId)open.setAttribute('aria-current','page');
  const title=node('span','chat-item-title');title.append(node('span',null,c.title));
  if(chat.pending?.chatId===c.id)title.append(node('i','chat-item-dot working'));else if(chat.unread.has(c.id))title.append(node('i','chat-item-dot'));
  open.append(title,node('span','chat-item-preview',c.preview||'No messages yet'));open.onclick=()=>selectChat(c.id).catch(error);
  const actions=node('span','chat-item-actions');
  actions.append(itemAction(archived?'i-unarchive':'i-archive',archived?'Restore chat':'Archive chat',()=>setArchived(c.id,!archived)));
  if(archived)actions.append(deleteAction(c));
  row.append(open,actions);nav.append(row);
 });
}
function itemAction(icon,label,run){const button=node('button','chat-item-action');button.type='button';button.title=label;button.setAttribute('aria-label',label);button.append(svgIcon(icon));button.onclick=e=>{e.stopPropagation();Promise.resolve(run()).catch(error);};return button;}
// Deleting asks twice: the first click turns the button into a red “Delete”.
function deleteAction(c){
 const button=itemAction('i-trash','Delete chat permanently',async()=>{
  if(!button.classList.contains('confirm')){button.classList.add('confirm');button.replaceChildren(document.createTextNode('Delete'));setTimeout(()=>{if(button.isConnected){button.classList.remove('confirm');button.replaceChildren(svgIcon('i-trash'));}},3000);return;}
  await api.deleteChat(c.id);chat.list=chat.list.filter(x=>x.id!==c.id);if(chat.currentId===c.id)newChat();else renderChatList();
 });
 return button;
}
async function setArchived(id,archived){
 const updated=await api.archiveChat(id,archived);chat.list=chat.list.map(c=>c.id===id?updated:c);
 if(chat.current?.id===id){chat.current.archived=archived;renderHeader();}
 if(archived&&chat.currentId===id&&chat.filter==='recent'){chatToast('Chat archived. Find it under Archived.');newChat();}else renderChatList();
}

// Switching chats. A new chat is only a draft until its first message.
async function selectChat(id){
 if(chat.currentId===id&&chat.current){focusComposer();return;}
 const load=++chat.load;chat.currentId=id;chat.current=null;chat.unread.delete(id);closeMenu();renderChatList();renderThread();
 try{const loaded=await api.getChat(id);if(load!==chat.load)return;chat.current=loaded;renderThread();focusComposer();}
 catch(e){if(load===chat.load){chatToast(cleanError(e));newChat();}}
}
function newChat(){chat.load++;chat.currentId=crypto.randomUUID();chat.current={id:chat.currentId,title:'New chat',messages:[],archived:false,draft:true};closeMenu();renderChatList();renderThread();focusComposer();}
function renderHeader(){
 const c=chat.current,working=chat.pending&&chat.pending.chatId===chat.currentId;
 $('chat-title').textContent=c?.title||'Loading…';
 const when=c?.updatedAt?new Date(c.updatedAt):null,time=when?`${dayGroup(c.updatedAt)==='Today'?'Today':when.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}, ${when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:'';
 $('chat-subtitle').textContent=working?'Working…':!c||c.draft?'Auto':[c.archived?'Archived':'',time].filter(Boolean).join(' · ');
 $('chat-subtitle').classList.toggle('working',!!working);
 $('chat-archive').hidden=!c||c.draft;
 const label=c?.archived?'Restore chat':'Archive chat';$('chat-archive').setAttribute('aria-label',label);$('chat-archive').title=label;$('chat-archive-icon').setAttribute('href',c?.archived?'#i-unarchive':'#i-archive');
 updateComposer();
}
function renderThread(){
 renderHeader();
 const thread=$('chat-thread'),c=chat.current;thread.replaceChildren();
 if(!c){thread.append(node('p','chat-loading','Opening chat…'));return;}
 const pending=chat.pending?.chatId===c.id;
 if(!c.messages.length&&!pending){thread.append(emptyState());return;}
 c.messages.forEach((m,i)=>{const view=messageView(m);view.style.setProperty('--i',String(Math.max(0,8-(c.messages.length-i))));thread.append(view);});
 if(pending)thread.append(chat.pending.el);
 scrollToEnd(false);
}
function scrollToEnd(smooth=true){const scroll=$('chat-scroll');requestAnimationFrame(()=>scroll.scrollTo({top:scroll.scrollHeight,behavior:smooth&&!stillMotion()?'smooth':'auto'}));}
function emptyState(){
 const box=node('div','chat-empty');box.append(orbMark('chat-empty-orb'),node('h2',null,'What’s on your mind?'),node('p',null,'Orb can read and update your vault, tasks, goals, habits and calendar.'));
 const list=node('div','chat-suggestions');
 prompts.forEach(([category,label,request,icon,tint],i)=>{const button=node('button','chat-suggestion');button.type='button';button.style.setProperty('--i',String(i));const copy=node('span');copy.append(node('strong',null,label),node('small',null,category));button.append(appIcon(icon,tint),copy);button.onclick=()=>sendChat(request);list.append(button);});
 box.append(list);return box;
}

// Messages. Answers are light Markdown, built as DOM nodes so nothing from the model is parsed as HTML.
function inlineMarkdown(text,parent){
 const pattern=/(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\((?:<[^>]+>|[^)]+)\)|\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g;let last=0,m;
 while((m=pattern.exec(text))){if(m.index>last)parent.append(text.slice(last,m.index));const t=m[0];
  if(t.startsWith('[')){
   const wiki=t.startsWith('[['),parts=wiki?t.slice(2,-2).split('|'):t.match(/^\[([^]+)\]\(([^]+)\)$/)?.slice(1),label=wiki?(parts[1]||parts[0]):parts?.[0];
   let source=wiki?parts[0]:parts?.[1]?.replace(/^<|>$/g,'');try{source=decodeURIComponent(source||'').split('#')[0];}catch{source='';}
   if(wiki&&source&&!source.endsWith('.md'))source+='.md';
   if(source&&source.endsWith('.md')&&!/^[a-z][a-z\d+.-]*:|^\/|\\/i.test(source)&&!source.split('/').some(x=>x==='..'||x.startsWith('.'))){const link=node('button','source-link',label);link.type='button';link.title=source;link.onclick=()=>api.openNote(source).catch(error);parent.append(link);}else parent.append(document.createTextNode(t));
  }else parent.append(t.startsWith('**')?node('strong',null,t.slice(2,-2)):t.startsWith('`')?node('code',null,t.slice(1,-1)):node('em',null,t.slice(1,-1)));last=m.index+t.length;}
 if(last<text.length)parent.append(text.slice(last));
}
function markdown(text){
 const root=node('div','chat-text');let paragraph=null,list=null;
 for(const line of String(text).split('\n')){
  const item=/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(line),heading=/^#{1,6}\s+(.*)$/.exec(line);
  if(!line.trim()){paragraph=null;list=null;continue;}
  if(item){const tag=item[1]?'OL':'UL';if(list?.tagName!==tag){list=node(tag.toLowerCase());root.append(list);paragraph=null;}const li=node('li');inlineMarkdown(item[2],li);list.append(li);continue;}
  list=null;
  if(heading){paragraph=null;const p=node('p','chat-text-heading');inlineMarkdown(heading[1],p);root.append(p);continue;}
  if(paragraph)paragraph.append(node('br'));else{paragraph=node('p');root.append(paragraph);}
  inlineMarkdown(line,paragraph);
 }
 return root;
}
// New answers fade in word by word, like ink settling.
function reveal(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts=[];let i=0;while(walker.nextNode())texts.push(walker.currentNode);
 for(const text of texts){const parts=document.createDocumentFragment();for(const part of text.data.split(/(\s+)/)){if(!part)continue;if(/^\s+$/.test(part)){parts.append(part);continue;}const word=node('span','w',part);word.style.setProperty('--i',String(Math.min(i++,180)));parts.append(word);}text.replaceWith(parts);}
 root.classList.add('reveal');
}
function messageView(m){
 const view=node('div',`chat-msg ${m.role==='user'?'user':'assistant'}`);
 if(m.role==='user'){view.append(node('div','chat-bubble',m.text));return view;}
 if(m.steps?.length){const run=toolRun();paintRun(run,m.steps,false);view.append(run);}
 if(m.role==='error'){const stopped=m.text==='Stopped.',box=node('div',stopped?'chat-error stopped':'chat-error');box.append(svgIcon(stopped?'i-stop':'i-alert'),node('span',null,stopped?'Stopped before finishing.':m.text));view.append(box);}
 else view.append(markdown(m.text));
 if(m.visual){const host=node('div','chat-visual');renderChatVisual(host,m.visual);view.append(host);}
 return view;
}
function renderChatVisual(host,v){
 currentVisual=v;
 window.renderVisual(host,v,path=>api.openNote(path).catch(error),{trading212:args=>api.trading212(args),settings:async()=>{await closeChat();await openSettings();},habits:args=>api.habits(args),setHabit:async args=>{await api.setHabit(args);const status=host.querySelector('.habit-status');if(status)status.textContent='Saved to your vault.';},openHabitRecord:async args=>{const result=await api.openHabitRecord(args);await api.openNote(result.path);},filterGoals:scope=>api.goals(scope).catch(error),request:text=>sendChat(text)});
}
// Visuals refreshed by a card's own controls (a goal filter, a habit tick) redraw the latest card in place.
function chatVisual(v){
 if(!v)return;
 if(chat.pending){chatActivity({kind:'visual',visual:v});return;}
 const host=[...$('chat-thread').querySelectorAll('.chat-visual')].at(-1);if(host)renderChatVisual(host,v);
}

// Tool activity: a stack of little app icons that deal in as tools start, with a shimmering label while they run.
const toolKinds={trading212:'chart',knowledge_sources:'knowledge',knowledge_context:'knowledge',knowledge_graph:'knowledge',update_knowledge:'write',connect_knowledge:'write',list_knowledge:'knowledge',create_knowledge:'write',query_calendar:'calendar',create_calendar_event:'calendar',list_tasks:'tasks',create_task:'tasks',update_task:'tasks',list_goals:'goals',create_goal:'goals',update_goal:'goals',review_goal:'goals',list_habits:'habits',set_habit:'habits',search_notes:'search',find_files:'search',read_note:'read',append_note:'write',read_spreadsheet:'sheet',show_visual:'chart',dismiss_visual:'chart',think_deeply:'think',undo_change:'undo'};
const kindIcons={knowledge:['i-steps','teal'],tasks:['i-list','orange'],goals:['i-target','red'],habits:['i-flame','green'],search:['i-search','blue'],read:['i-doc','yellow'],write:['i-pencil','yellow'],sheet:['i-table','green'],chart:['i-chart','purple'],think:['i-sparkle','blue'],undo:['i-undo','gray']};
function toolGlyph(step){
 const kind=toolKinds[step.name]||'think',glyph=node('span','glyph');glyph.dataset.kind=kind;glyph.setAttribute('aria-hidden','true');
 if(kind==='calendar'){
  // The page shows the day being worked on: the event's date when there is one, otherwise today.
  const iso=/\d{4}-\d{2}-\d{2}/.exec(step.detail||'')?.[0],date=iso?new Date(iso+'T12:00:00'):new Date();
  const face=extra=>{const page=node('span','glyph-page'+extra);page.append(node('span','glyph-weekday',date.toLocaleDateString('en-GB',{weekday:'short'})),node('span','glyph-day',date.getDate()));return page;};
  glyph.append(face(''),face(' glyph-leaf'));
 }else{const [icon,tint]=kindIcons[kind];glyph.dataset.tint=tint;glyph.append(svgIcon(icon));}
 return glyph;
}
function toolRun(){
 const run=node('div','tool-run'),head=node('button','tool-run-head');head.type='button';head.setAttribute('aria-expanded','false');
 const chevron=svgIcon('i-chevron');chevron.classList.add('tool-run-chevron');
 head.append(node('span','tool-stack'),node('span','tool-run-label'),node('span','tool-run-detail'),node('span','tool-run-count'),chevron);
 const wrap=node('div','tool-steps-wrap');wrap.append(node('ol','tool-steps'));
 head.onclick=()=>{const open=!run.classList.contains('open');run.classList.toggle('open',open);head.setAttribute('aria-expanded',String(open));};
 run.slots=new Map();run.append(head,wrap);return run;
}
function runSummary(steps){
 const failed=steps.filter(s=>s.status==='failed').length,writes=steps.filter(s=>s.status==='done'&&/^(create|update|append|set|review|undo)_/.test(s.name));
 const key=writes.at(-1)||steps.filter(s=>s.status==='done').at(-1)||steps.at(-1),subject=(key.detail||'').split(' · ')[0];
 const label=key.name==='create_calendar_event'&&key.status==='done'&&subject?`Scheduled ${subject}`:key.label;
 return {label:failed?`${label} · ${failed} failed`:label,detail:key.name==='create_calendar_event'?'':subject&&key.name!=='query_calendar'?subject:''};
}
function paintRun(run,steps,live){
 const running=steps.filter(s=>s.status==='running').at(-1),failed=steps.some(s=>s.status==='failed');
 const state=live?(!steps.length?'thinking':running?'running':'composing'):failed?'failed':'done';
 run.dataset.state=state;run.classList.toggle('live',live);
 const head=run.querySelector('.tool-run-head'),stack=run.querySelector('.tool-stack');head.disabled=!steps.length;
 // The newest three steps are stacked, newest in front; older cards fan out behind.
 const shown=steps.slice(-3);
 if(!shown.length){if(!stack.querySelector('.glyph-orb'))stack.replaceChildren(orbMark('glyph-orb'));}
 else{
  stack.querySelector('.glyph-orb')?.remove();
  for(const [id,slot] of run.slots)if(!shown.some(s=>s.id===id)){slot.remove();run.slots.delete(id);}
  shown.forEach((step,i)=>{
   let slot=run.slots.get(step.id);
   if(!slot){slot=node('span','stack-slot');const glyph=toolGlyph(step);if(live)glyph.classList.add('deal');slot.append(glyph);run.slots.set(step.id,slot);}
   slot.style.setProperty('--depth',String(shown.length-1-i));slot.classList.toggle('running',step.status==='running');slot.firstChild.classList.toggle('running',step.status==='running');slot.dataset.status=step.status;
   // Re-inserting a slot would restart its animations, so only new ones are added.
   if(slot.parentNode!==stack)stack.append(slot);
  });
 }
 const summary=!live&&steps.length?runSummary(steps):null;
 run.querySelector('.tool-run-label').textContent=state==='thinking'?'Thinking':state==='running'?running.label:state==='composing'?'Putting it together':summary.label;
 run.querySelector('.tool-run-detail').textContent=state==='running'?(running.detail||stepName(running.path)||''):summary?.detail||'';
 const count=run.querySelector('.tool-run-count'),total=String(steps.length);
 if(count.textContent!==total){count.textContent=total;if(live){count.classList.remove('bump');void count.offsetWidth;count.classList.add('bump');}}
 count.hidden=!steps.length;head.setAttribute('aria-label',`${run.querySelector('.tool-run-label').textContent}${steps.length?`, ${steps.length} ${steps.length===1?'step':'steps'}`:''}`);
 const list=run.querySelector('.tool-steps');list.replaceChildren();
 for(const step of steps){
  const item=node('li','tool-step');item.dataset.status=step.status;
  const main=node('span','tool-step-main');main.append(node('strong',null,step.label));
  if(step.detail)main.append(node('small',null,step.detail));
  if(step.path){const link=/\.md$/i.test(step.path)?node('button','source-link tool-step-path',step.path):node('small','tool-step-path',step.path);if(link.tagName==='BUTTON'){link.type='button';link.onclick=()=>api.openNote(step.path).catch(error);}main.append(link);}
  const time=step.status==='running'?'Running':step.status==='failed'?'Failed':step.ms!=null?`${(step.ms/1000).toFixed(1)}s`:'';
  item.append(toolGlyph(step),main,node('span','tool-step-time',time));list.append(item);
 }
}

// Sending. Only one request runs at a time; its turn keeps drawing even while another chat is open.
function pendingTurn(chatId){const el=node('div','chat-msg assistant pending'),run=toolRun();el.append(run);paintRun(run,[],true);return {chatId,el,run,steps:[],visual:null,host:null};}
function chatOwns(data){return !!chat.pending&&chat.pending.chatId===data.chatId;}
function chatActivity(data){
 const turn=chat.pending;if(!turn)return;const viewing=chat.currentId===turn.chatId;
 if(data.kind==='tool-state'){
  const i=turn.steps.findIndex(s=>s.id===data.id),before=turn.steps[i],step={...before,...data,path:data.path||before?.path,detail:data.detail||before?.detail,started:before?.started??performance.now()};
  if(step.status!=='running')step.ms??=performance.now()-step.started;
  if(i<0)turn.steps.push(step);else turn.steps[i]=step;
  paintRun(turn.run,turn.steps,true);if(viewing)scrollToEnd();
 }
 if(data.kind==='visual'){
  turn.visual=data.visual;
  if(!data.visual){turn.host?.remove();turn.host=null;return;}
  turn.host??=node('div','chat-visual');renderChatVisual(turn.host,data.visual);if(!turn.host.isConnected)turn.el.append(turn.host);if(viewing)scrollToEnd();
 }
 if(data.kind==='visual-error'&&viewing)chatToast(data.message);
}
async function sendChat(raw){
 const text=String(raw||'').trim(),c=chat.current;if(!text||!c)return;
 if(busy||chat.pending){chatToast(chat.pending?'Orb is still answering. Stop it or wait a moment.':'Orb is busy with another request.');return;}
 if(!preview&&!settings?.chatReady){await closeChat();openSettings().catch(error);return;}
 closeMenu();$('chat-input').value='';autosize();
 const at=new Date().toISOString();c.messages.push({role:'user',text,at});c.updatedAt=at;
 if(c.draft){delete c.draft;c.title=chatTitle(text);c.createdAt=at;}
 chat.list=[chatSummary(c),...chat.list.filter(x=>x.id!==c.id)];
 const turn=chat.pending=pendingTurn(c.id);busy=true;
 const thread=$('chat-thread');thread.querySelector('.chat-empty')?.remove();
 const sent=messageView(c.messages.at(-1));sent.classList.add('sent');thread.append(sent,turn.el);
 renderHeader();renderChatList();scrollToEnd();
 let result,failure;
 try{result=await api.chat({chatId:c.id,text});}catch(e){failure=e;}
 busy=false;chat.pending=null;
 const stopped=turn.stopped||/abort|Stopped/i.test(failure?.message||''),steps=(result?.message?.steps||turn.steps).map(s=>({...s,status:s.status==='running'?'failed':s.status}));
 const message=result?.message||{role:'error',text:stopped?'Stopped.':cleanError(failure),steps};
 // Finish the live turn in place so its icons settle rather than redraw.
 turn.el.classList.remove('pending');
 if(steps.length)paintRun(turn.run,steps,false);else turn.run.remove();
 const body=messageView({...message,steps:[],visual:null}).lastChild;if(message.role==='assistant')reveal(body);
 if(turn.host)turn.el.insertBefore(body,turn.host);else turn.el.append(body);
 if(!message.visual&&turn.host){turn.host.remove();}
 const target=chat.current?.id===turn.chatId?chat.current:null;
 if(target&&!target.messages.some(m=>m.id&&m.id===message.id)&&!(message.role==='error'&&target.messages.at(-1)?.role==='error'))target.messages.push(message);
 if(target)target.updatedAt=result?.chat?.updatedAt||new Date().toISOString();else chat.unread.add(turn.chatId);
 if(result?.chat)chat.list=[result.chat,...chat.list.filter(x=>x.id!==result.chat.id)];
 renderHeader();renderChatList();if(chat.currentId===turn.chatId)scrollToEnd();
 refreshChatList();
}
function stopChat(){if(!chat.pending)return;chat.pending.stopped=true;api.stop().catch(error);}
function updateComposer(){
 const send=$('chat-send'),here=chat.pending&&chat.pending.chatId===chat.currentId,elsewhere=(chat.pending&&!here)||(busy&&!chat.pending);
 send.classList.toggle('stop',!!here);$('chat-send-icon').setAttribute('href',here?'#i-stop':'#i-arrow-up');
 const label=here?'Stop answering':elsewhere?'Orb is answering another request':'Send message';send.setAttribute('aria-label',label);send.title=here?'Stop':elsewhere?label:'Send · Return';
 send.disabled=!here&&(elsewhere||!$('chat-input').value.trim());
}
function autosize(){const input=$('chat-input');input.style.height='auto';input.style.height=`${Math.min(input.scrollHeight,168)}px`;updateComposer();}

// Composer menu: “/” for commands, “@” to point Orb at a tool, or the + button for both.
const chatTools=[['Trading212','i-chart','teal','Read investments and activity'],['Calendar','i-calendar','red','Read or add events'],['Tasks','i-list','orange','Plan, add or update tasks'],['Goals','i-target','red','Review and move goals forward'],['Habits','i-flame','green','Log and check habits'],['Notes','i-doc','yellow','Search, read and add to notes'],['Sheets','i-table','green','Read spreadsheets and chart them']].map(([title,icon,tint,subtitle])=>({kind:'tool',title,icon,tint,subtitle,hint:'@'+title}));
const chatCommands=[
 {name:'new',title:'New chat',icon:'i-compose',tint:'blue',subtitle:'Start fresh',run:()=>newChat()},
 {name:'archive',title:'Archive chat',icon:'i-archive',tint:'gray',subtitle:'Move this chat to Archived',run:()=>chat.current&&!chat.current.draft?setArchived(chat.current.id,true):chatToast('Send a message first. Empty chats are not saved.')},
 {name:'trading212',title:'Trading 212',icon:'i-chart',tint:'teal',subtitle:'Open your investments',run:async()=>{await closeChat();await window.trading212UI.open();}},
 {name:'recurring',title:'Recurring tasks',icon:'i-sun',tint:'orange',subtitle:'Manage repeating tasks',run:async()=>{await closeChat();openRecurring();}},
 {name:'today',title:'Today',icon:'i-sun',tint:'orange',subtitle:'Open the Today dashboard',run:async()=>{await closeChat();await openHome();}},
 {name:'settings',title:'Settings',icon:'i-gear',tint:'gray',subtitle:'Vault, integrations and preferences',run:async()=>{await closeChat();await openSettings();}},
 {name:'orb',title:'Back to Orb',icon:'i-back',tint:'blue',subtitle:'Return to the voice orb',run:()=>closeChat()}
].map(c=>({...c,kind:'command',hint:'/'+c.name}));
function updateMenu(){
 const input=$('chat-input'),before=input.value.slice(0,input.selectionStart);let m;
 if((m=/^\/(\w*)$/.exec(before)))openMenu('slash',m[1],0);
 else if((m=/(^|\s)@(\w*)$/.exec(before)))openMenu('at',m[2],before.length-m[2].length-1);
 else if(chat.menu&&chat.menu.mode!=='all')closeMenu();
}
function openMenu(mode,query='',start=null){
 const q=query.toLowerCase(),pool=mode==='slash'?chatCommands:mode==='at'?chatTools:[...chatTools,...chatCommands];
 const items=pool.filter(item=>!q||item.title.toLowerCase().includes(q)||item.hint.slice(1).toLowerCase().startsWith(q));
 if(!items.length){closeMenu();return;}
 chat.menu={mode,items,start,index:Math.min(chat.menu?.mode===mode?chat.menu.index:0,items.length-1)};renderMenu();
}
function renderMenu(){
 const menu=$('chat-menu'),{items,index}=chat.menu;menu.replaceChildren();let group=null;
 items.forEach((item,i)=>{
  if(item.kind!==group){group=item.kind;const heading=node('div','chat-menu-group',group==='tool'?'Tools':'Commands');heading.setAttribute('role','presentation');menu.append(heading);}
  const row=node('button','chat-menu-item');row.type='button';row.id='chat-menu-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected',String(i===index));
  row.append(appIcon(item.icon,item.tint),node('span','chat-menu-title',item.title),node('span','chat-menu-subtitle',item.subtitle),node('kbd','chat-menu-hint',item.hint));
  row.onpointermove=()=>{if(chat.menu.index!==i){chat.menu.index=i;renderMenu();}};row.onmousedown=e=>e.preventDefault();row.onclick=()=>chooseMenu(i);menu.append(row);
 });
 menu.hidden=false;$('chat-plus').setAttribute('aria-expanded','true');$('chat-plus').classList.add('open');
 $('chat-input').setAttribute('aria-activedescendant','chat-menu-'+index);menu.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});
}
function closeMenu(){chat.menu=null;$('chat-menu').hidden=true;$('chat-plus').setAttribute('aria-expanded','false');$('chat-plus').classList.remove('open');$('chat-input').removeAttribute('aria-activedescendant');}
function chooseMenu(i=chat.menu?.index){
 const menu=chat.menu,item=menu?.items[i];if(!item)return;
 const input=$('chat-input'),caret=input.selectionStart;closeMenu();
 if(item.kind==='command'){if(menu.mode==='slash')input.value=input.value.slice(caret).trimStart();autosize();Promise.resolve(item.run()).catch(error);return;}
 const start=menu.start??caret,token=`@${item.title} `;
 input.value=input.value.slice(0,start)+token+input.value.slice(caret);input.focus();input.setSelectionRange(start+token.length,start+token.length);autosize();
}
function chatKeydown(e){
 const key=e.key.toLowerCase(),plain=e.metaKey&&!e.shiftKey&&!e.altKey;
 if(plain&&key==='n'){e.preventDefault();newChat();return true;}
 if(plain&&key==='k'){e.preventDefault();chat.menu?closeMenu():openMenu('all');$('chat-input').focus();return true;}
 if(e.key!=='Escape')return false;
 if(chat.menu){closeMenu();return true;}
 if(document.activeElement===$('chat-input')&&$('chat-input').value){$('chat-input').value='';autosize();return true;}
 return false;
}
$('chat-input').oninput=()=>{autosize();updateMenu();};
$('chat-input').onclick=updateMenu;
$('chat-input').onblur=()=>setTimeout(()=>{if(document.activeElement!==$('chat-input')&&document.activeElement!==$('chat-plus'))closeMenu();},120);
$('chat-input').onkeydown=e=>{
 if(chat.menu&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const last=chat.menu.items.length-1;chat.menu.index=e.key==='ArrowDown'?(chat.menu.index>=last?0:chat.menu.index+1):(chat.menu.index<=0?last:chat.menu.index-1);renderMenu();return;}
 if(chat.menu&&(e.key==='Tab'||e.key==='Enter'&&!e.shiftKey)){e.preventDefault();chooseMenu();return;}
 if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chat-composer').requestSubmit();}
};
$('chat-composer').onsubmit=e=>{e.preventDefault();if(chat.pending&&chat.pending.chatId===chat.currentId)stopChat();else sendChat($('chat-input').value).catch(error);};
$('chat-plus').onclick=()=>{if(chat.menu)closeMenu();else openMenu('all');$('chat-input').focus();};
$('chat-back').onclick=()=>closeChat();
$('chat-new').onclick=()=>newChat();
$('chat-archive').onclick=()=>{const c=chat.current;if(c&&!c.draft)setArchived(c.id,!c.archived).catch(error);};
$('chat-sidebar-toggle').onclick=()=>{sidebarShown=!sidebarShown;$('chat-app').classList.toggle('sidebar-hidden',!sidebarShown);$('chat-sidebar-toggle').setAttribute('aria-pressed',String(sidebarShown));$('chat-sidebar-toggle').setAttribute('aria-label',sidebarShown?'Hide chat list':'Show chat list');try{localStorage.setItem('orb-chat-sidebar',sidebarShown?'shown':'hidden');}catch{}};
$('chat-search').oninput=()=>{chat.query=$('chat-search').value;renderChatList();};
$('chat-tab-recent').onclick=()=>{chat.filter='recent';renderChatList();};
$('chat-tab-archived').onclick=()=>{chat.filter='archived';renderChatList();};
$('chat-toast').onclick=()=>$('chat-toast').hidden=true;
$('chat-sidebar-toggle').setAttribute('aria-pressed',String(sidebarShown));

// Fictional, in-memory preview of the chat backend. Nothing leaves the page.
if(preview){
 const store=new Map(),ago=ms=>new Date(Date.now()-ms).toISOString(),tomorrow=new Date(Date.now()+864e5).toISOString().slice(0,10);let stopRequested=false;
 const seed=(id,title,ms,messages,archived=false)=>store.set(id,{id,title,createdAt:ago(ms),updatedAt:ago(ms),archived,messages:messages.map((m,i)=>({id:`${id}-${i}`,at:ago(ms),...m}))});
 seed('0b7e1f7a-1c1f-4d9e-9a51-6f1d2c3b4a01','Plan my week',2*36e5,[{role:'user',text:'Help me plan my week'},{role:'assistant',text:'Here’s a calm shape for the week:\n\n- **Monday** — finish the launch notes before lunch\n- **Wednesday** — dentist at 10:00, then a long walk\n- **Friday** — review your portfolio goal\n\nWant me to add any of these as tasks?',steps:[{id:'a',name:'list_tasks',label:'Read tasks',status:'done',ms:620},{id:'b',name:'query_calendar',label:'Read calendar',status:'done',detail:'2026-09-28 → 2026-10-04',ms:910},{id:'c',name:'list_goals',label:'Read goals',status:'done',ms:480}]}]);
 seed('0b7e1f7a-1c1f-4d9e-9a51-6f1d2c3b4a02','Schedule a call with Tom',26*36e5,[{role:'user',text:'Setup a call with Tom tomorrow'},{role:'assistant',text:'Done — I’ve scheduled a 30-minute call with Tom for **tomorrow at 10:00 AM** on your Work calendar.',steps:[{id:'a',name:'query_calendar',label:'Read calendar',status:'done',ms:840},{id:'b',name:'query_calendar',label:'Read calendar',status:'done',ms:610},{id:'c',name:'create_calendar_event',label:'Added Google event',status:'done',detail:'Call with Tom · 2026-09-29 10:00',ms:1320}]}]);
 seed('0b7e1f7a-1c1f-4d9e-9a51-6f1d2c3b4a03','Savings trend this year',9*864e5,[{role:'user',text:'How are my savings trending?'},{role:'assistant',text:'Up **£2,450** since January, with one small dip in March.',steps:[{id:'a',name:'find_files',label:'Found files',status:'done',detail:'savings',ms:300},{id:'b',name:'read_spreadsheet',label:'Read sheet',status:'done',path:'Example savings.csv',ms:700},{id:'c',name:'show_visual',label:'Drew chart',status:'done',detail:'A little more set aside.',ms:200}],visual:{id:'preview',kind:'area',title:'A little more set aside.',subtitle:'Example data · savings balance, January–June',series:['Savings'],points:[{label:'Jan',values:[3200]},{label:'Feb',values:[3700]},{label:'Mar',values:[3550]},{label:'Apr',values:[4400]},{label:'May',values:[4900]},{label:'Jun',values:[5650]}],unit:'GBP',x_label:'2026',y_label:'Balance',sources:[]}}],true);
 api.chats=async()=>[...store.values()].map(chatSummary).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 api.getChat=async id=>{if(!store.has(id))throw new Error('That chat no longer exists.');return structuredClone(store.get(id));};
 api.archiveChat=async(id,archived)=>{store.get(id).archived=archived;return chatSummary(store.get(id));};
 api.deleteChat=async id=>store.delete(id);
 api.stop=async()=>{stopRequested=true;};
 api.chat=async({chatId,text})=>{
  stopRequested=false;const at=new Date().toISOString();
  if(!store.has(chatId))store.set(chatId,{id:chatId,title:chatTitle(text),createdAt:at,updatedAt:at,archived:false,messages:[]});
  const c=store.get(chatId);c.messages.push({id:crypto.randomUUID(),role:'user',text,at});
  const trading=/trading\s?212/i.test(text);
  const plan=trading?[['trading212','Reading Trading 212','Read Trading 212','Fictional preview']]:/schedul|call|book|set ?up|meeting/i.test(text)?[['query_calendar','Reading calendar','Read calendar',`${tomorrow} → ${tomorrow}`],['create_calendar_event','Adding Google event','Added Google event',`Call with Tom · ${tomorrow} 10:00`]]
   :/calendar|schedule|week/i.test(text)?[['query_calendar','Reading calendar','Read calendar',''],['list_tasks','Reading tasks','Read tasks','']]
   :/goal/i.test(text)?[['list_goals','Reading goals','Read goals','']]:/habit/i.test(text)?[['list_habits','Reading habits','Read habits','']]
   :/note|find|search/i.test(text)?[['search_notes','Searching vault','Searched vault',text.split(/\s+/).slice(-2).join(' ')],['read_note','Reading note','Read note','']]
   :[['list_tasks','Reading tasks','Read tasks',''],['think_deeply','Deep thinking','Thought it through','']];
  const steps=[];
  for(const [name,running,done,detail] of plan){
   const id=crypto.randomUUID(),path=name==='read_note'?'Notes/Example meeting.md':undefined;
   routeActivity({kind:'tool-state',chatId,id,name,label:running,status:'running',detail,path});await pause(1300);
   if(stopRequested){routeActivity({kind:'tool-state',chatId,id,name,label:running,status:'failed',detail,path});steps.push({id,name,label:running,status:'failed',detail,path});c.messages.push({role:'error',text:'Stopped.',steps});throw new Error('Stopped.');}
   routeActivity({kind:'tool-state',chatId,id,name,label:done,status:'done',detail,path});steps.push({id,name,label:done,status:'done',detail,path,ms:1300});
  }
  await pause(500);
  const answer=trading?'This is a fictional Trading 212 portfolio preview. In the Mac app, this view uses your connected account.':plan[1]?.[0]==='create_calendar_event'?'Done — I’ve scheduled a 30-minute call with Tom for **tomorrow at 10:00 AM** on your Work calendar.':'This is an interface preview with fictional data. In the Mac app, Orb would answer from your vault here — with **steps above** showing each tool it used.';
  const tradingVisual=trading?await api.trading212({view:/dividend/i.test(text)?'dividends':/deposit|interest|cash movement/i.test(text)?'cash':/pending|order/i.test(text)?'pending':'overview'}):null;
  if(tradingVisual)routeActivity({kind:'visual',chatId,visual:tradingVisual});
  const message={id:crypto.randomUUID(),role:'assistant',text:answer,steps,...(tradingVisual?{visual:tradingVisual}:{}),at:new Date().toISOString()};c.messages.push(message);c.updatedAt=message.at;
  return {text:answer,message,chat:chatSummary(c)};
 };
}
