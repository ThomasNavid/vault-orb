const $=id=>document.getElementById(id);
const visual=window.orbVisual;
let api=window.orb,settings,connected=false,connecting=false,muted=false,busy=false,peer,channel,microphone,audioContext,analyser,outputAnalyser,outputAudio,sessionGeneration,epoch=0,responseActive=false,pendingContinuation=false,connectionTimer,idleTimer,toolDepth=0;
let cardMode=null,currentVisual=null,preview=!api;
const transcriptItems=new Map();
const steps=new Map();
if(preview){
 document.body.classList.add('preview');
 api={settings:async()=>({vaultPath:'/Preview/Main',taskFolders:{life:'0. Home/Life Tasks',business:'0. Home/Business Tasks'},rulesPath:'0. Home/Task Rules.md',hasKey:true,googleCalendars:[],hasCalendarToken:false,calendarId:'',fullCalendarServer:false,autoStart:false,shortcutActive:true}),history:async()=>[],chooseVault:async()=>'/Preview/Main',saveSettings:async()=>{throw new Error('Preview only. Use Settings in the Mac app.');},openNote:async()=>{},stop:async()=>{},ready:async()=>{},resize:async()=>{},hide:async()=>{},onActivity:()=>{},onActivate:()=>{},onHide:()=>{},onSettings:()=>{},onShortcut:()=>{}};
}
function showPanel(mode){
 cardMode=mode;$('companion').hidden=!mode;
 for(const name of ['visual','transcript','settings','history','steps'])$(name+'-view').hidden=name!==mode;
 $('card-eyebrow').textContent={visual:'In view',transcript:'Conversation',settings:'Preferences',history:'In your vault',steps:'Behind the scenes'}[mode]||'';
 api.resize(mode||'compact').catch(()=>{});
}
function error(e){const message=(e?.message||String(e)).replace(/^Error invoking remote method '[^']+': Error: /,'');$('error-text').textContent=message;$('error').hidden=false;addMessage('tool',message);if(!cardMode)showPanel('transcript');}
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
 if(!item){item=document.createElement('div');item.className=`message ${role}`;const label=document.createElement('span');label.className='message-label';label.textContent={user:'YOU',assistant:'ORB',deep:'DEEPER THINKING',tool:'IN YOUR VAULT'}[role]||'ORB';const content=document.createElement('span');item.append(label,content);$('transcript').append(item);transcriptItems.set(id,item);}
 item.lastChild.textContent=text;$('transcript-view').scrollTop=$('transcript-view').scrollHeight;return item;
}
function liveUI(){
 $('voice-icon').setAttribute('href',connected||connecting?'#i-stop':'#i-mic');$('voice-button').classList.toggle('live',connected||connecting);$('mute-button').hidden=!connected;$('connection-dot').classList.toggle('live',connected);
 const label=connected||connecting?'End voice conversation':'Start voice conversation';$('orb-button').setAttribute('aria-label',label);$('voice-button').setAttribute('aria-label',label);$('voice-button').title=label;
}
function displayVisual(v){currentVisual=v;if(!v){if(cardMode==='visual')showPanel(null);return;}window.renderVisual($('visual-view'),v,path=>api.openNote(path).catch(error));showPanel('visual');}
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
  if(!settings?.hasKey){openSettings();return;}
  connecting=true;const token=++epoch;liveUI();$('error').hidden=true;setStatus('thinking','Connecting…');
  connectionTimer=setTimeout(()=>{if(token===epoch){endVoice();error('The voice connection timed out. Check your connection and try again.');}},35000);
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(token!==epoch){stream.getTracks().forEach(t=>t.stop());return;}
    microphone=stream;monitorAudio(stream);
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
  epoch++;clearTimeout(connectionTimer);clearTimeout(idleTimer);connected=false;connecting=false;muted=false;responseActive=false;pendingContinuation=false;toolDepth=0;
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
  if(!settings?.hasKey){openSettings();return;}
  if(connecting){error('Wait for voice to connect, or cancel it first.');return;}
  if(connected&&(responseActive||toolDepth)){error('Wait for Orb to finish, or interrupt by speaking.');return;}
  $('message').value='';$('error').hidden=true;clearToolActivity();addMessage('user',text);
  if(connected){
    send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});send({type:'response.create'});touch();return;
  }
  showPanel('transcript');busy=true;$('send-button').disabled=true;$('voice-button').disabled=true;setStatus('thinking','Thinking it through…');
  try{const result=await api.chat(text);addMessage('assistant',result.text);setStatus('idle','What else is on your mind?');}
  catch(e){error(e);setStatus('idle','Ready when you are.');}
  finally{busy=false;$('send-button').disabled=false;$('voice-button').disabled=false;}
}

async function refreshHistory(){
 const entries=await api.history();$('activity-list').replaceChildren();
 if(!entries.length){const p=document.createElement('p');p.className='empty';p.textContent='No changes yet.';$('activity-list').append(p);}
 for(const entry of entries){const item=document.createElement('div');item.className='activity';const title=document.createElement('strong');title.textContent=entry.action+(entry.status==='undone'?' · undone':'');const p=document.createElement('p');p.textContent=entry.path;const time=document.createElement('time');time.textContent=new Date(entry.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});item.append(title,p,time);
  if(entry.status==='applied'){const undo=document.createElement('button');undo.textContent='Undo';undo.disabled=connected||busy;undo.onclick=async()=>{try{await api.undo(entry.id);await refreshHistory();}catch(e){error(e);}};item.append(undo);}else if(entry.status!=='undone'){const span=document.createElement('span');span.textContent=entry.status;item.append(span);}$('activity-list').append(item);
 }
}
async function openSettings(){if(connected||connecting)endVoice();settings=await api.settings();$('vault-path').value=settings.vaultPath;$('life-folder').value=settings.taskFolders.life;$('business-folder').value=settings.taskFolders.business;$('rules-path').value=settings.rulesPath;$('auto-start').checked=settings.autoStart;$('api-key').value='';$('api-key').placeholder=settings.hasKey?'Key saved':'sk-…';$('calendar-token').value='';$('calendar-token').placeholder=settings.hasCalendarToken?'Token saved':'Paste token from Obsidian';const select=$('calendar-id');select.replaceChildren(new Option('Choose a Google calendar',''));for(const calendar of settings.googleCalendars||[])select.add(new Option(calendar.name,calendar.id));select.value=settings.calendarId||(settings.googleCalendars?.length===1?settings.googleCalendars[0].id:'');$('calendar-setup').textContent=!settings.googleCalendars?.length?'Connect a Google calendar in Obsidian Full Calendar first. Then reopen Orb Settings.':!settings.fullCalendarServer?'Enable Local REST Server in Obsidian Full Calendar → Integrations. Generate a token with Read events, Write events and Read providers.':'Generate a Full Calendar token with Read events, Write events and Read providers. Keep Obsidian open for calendar writes.';$('settings-error').hidden=true;updateShortcut(settings.shortcutActive);showPanel('settings');}
$('settings-button').onclick=()=>cardMode==='settings'?showPanel(null):openSettings().catch(error);
$('close-card').onclick=()=>showPanel(null);
$('hide-button').onclick=()=>{endVoice();api.hide().catch(error);};
function setTyping(on){$('dock').classList.toggle('typing',on);$('chat-form').inert=!on;$('controls').inert=on;$('shortcut-hint').hidden=on;if(on)setTimeout(()=>$('message').focus(),60);else $('type-button').focus();}
$('type-button').onclick=()=>setTyping(true);$('type-close').onclick=()=>setTyping(false);
$('shortcut-hint').onclick=()=>{if(!settings?.shortcutActive)openSettings().catch(error);};
$('enable-shortcut').onclick=async()=>{try{updateShortcut(await api.enableShortcut());}catch(e){$('settings-error').textContent=e.message;$('settings-error').hidden=false;}};
$('choose-vault').onclick=async()=>{try{const folder=await api.chooseVault();if(folder)$('vault-path').value=folder;}catch(e){error(e);}};
$('settings-form').onsubmit=async e=>{e.preventDefault();try{settings=await api.saveSettings({vaultPath:$('vault-path').value,taskFolders:{life:$('life-folder').value.trim(),business:$('business-folder').value.trim()},rulesPath:$('rules-path').value.trim(),key:$('api-key').value.trim(),calendarToken:$('calendar-token').value.trim(),calendarId:$('calendar-id').value,autoStart:$('auto-start').checked});$('api-key').value='';$('calendar-token').value='';showPanel(null);}catch(err){$('settings-error').textContent=err.message;$('settings-error').hidden=false;}};
$('chat-form').onsubmit=e=>{e.preventDefault();submit($('message').value).catch(error);};
const toggleVoice=()=>connected||connecting?endVoice():startVoice();$('voice-button').onclick=toggleVoice;$('orb-button').onclick=toggleVoice;
$('mute-button').onclick=()=>{muted=!muted;microphone?.getAudioTracks().forEach(t=>t.enabled=!muted);$('mute-icon').setAttribute('href',muted?'#i-mic-off':'#i-mic');$('mute-button').classList.toggle('muted',muted);$('mute-button').setAttribute('aria-label',muted?'Unmute microphone':'Mute microphone');setStatus('listening',muted?'Microphone muted.':'I’m listening.');liveUI();};
$('steps-chip').onclick=()=>{if(cardMode==='steps')return showPanel(null);showPanel('steps');renderSteps();};
$('dismiss-error').onclick=()=>$('error').hidden=true;
$('history-button').onclick=()=>{showPanel('history');refreshHistory().catch(error);};$('transcript-button').onclick=()=>showPanel('transcript');
api.onActivity(data=>{
 if(data.kind==='tool-state')updateToolActivity(data);
 if(data.kind==='change'){addMessage('tool',data.action+' · '+data.path);if(cardMode==='history')refreshHistory().catch(error);}
 if(data.kind==='deep')addMessage('deep',data.text);
 if(data.kind==='visual')displayVisual(data.visual);
 if(data.kind==='visual-error')error(data.message);
});
api.onActivate(()=>{if(settings&&!connected&&!connecting&&!busy&&cardMode!=='settings')startVoice();});
api.onHide(()=>{endVoice();clearToolActivity();showPanel(null);$('error').hidden=true;});
api.onSettings(()=>openSettings().catch(error));api.onShortcut(updateShortcut);
window.addEventListener('beforeunload',()=>{microphone?.getTracks().forEach(t=>t.stop());peer?.close();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){endVoice();api.hide().catch(error);}});
async function previewSteps(){
 clearToolActivity();const wait=ms=>new Promise(r=>setTimeout(r,ms));
 for(const [id,label,path,done] of [['a','Searching vault',null,'Searching vault'],['b','Reading note','Notes/Weekly plan.md','Reading note'],['c','Reading sheet','Finance/Savings 2026.xlsx','Reading sheet']]){
  updateToolActivity({id,label,path,status:'running'});await wait(900);updateToolActivity({id,label:done,path,status:'done'});
 }
}
async function previewAnswer(text){
 $('message').value='';addMessage('user',text);await previewSteps();
 if(/calendar|schedule|meeting/i.test(text))displayVisual({id:'preview',kind:'calendar',title:'Your calendar',subtitle:'3 entries · Europe/London',start:'2026-09-26',end:'2026-09-29',days:[
  {date:'2026-09-26',items:[]},{date:'2026-09-27',items:[{kind:'event',title:'Time off',start:'2026-09-27',end:'2026-09-29',allDay:true,calendar:'Personal'}]},
  {date:'2026-09-28',items:[{kind:'event',title:'Time off',start:'2026-09-27',end:'2026-09-29',allDay:true,calendar:'Personal'},{kind:'event',title:'Team meeting',start:'2026-09-28T09:00:00',end:'2026-09-28T10:00:00',allDay:false,calendar:'Work',location:'Office'}]},
  {date:'2026-09-29',items:[{kind:'task',title:'File report',start:'2026-09-29',allDay:true,dateType:'due',list:'business',path:'0. Home/Business Tasks/File report.md'}]}],warnings:[],truncated:false,total:3,shown:3,sources:[]});
 else if(/chart|saving|graph/i.test(text))displayVisual({id:'preview',kind:'area',title:'A little more set aside.',subtitle:'Example data · savings balance, January–June',series:['Savings'],points:[{label:'Jan',values:[3200]},{label:'Feb',values:[3700]},{label:'Mar',values:[3550]},{label:'Apr',values:[4400]},{label:'May',values:[4900]},{label:'Jun',values:[5650]}],unit:'GBP',x_label:'2026',y_label:'Balance',sources:[{path:'Example savings.csv',detail:'Illustrative data'}]});
 else displayVisual({id:'preview',kind:'table',title:'Today’s tasks',subtitle:'Example data · 3 tasks',columns:['Task','Area','Planned'],rows:[['Call the dentist','Life','10:00'],['Finish launch notes','Studio','14:00'],['Take a long walk','Life','17:30']],sources:[]});
 setStatus('idle','Here’s the picture.');
}
(async()=>{settings=await api.settings();liveUI();updateShortcut(settings.shortcutActive);await api.ready();if(!settings.hasKey&&!preview)await openSettings();})().catch(error);
