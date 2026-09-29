const {workingHours}=require('./calendar-time.cjs');
const {app,BrowserWindow,ipcMain,dialog,safeStorage,globalShortcut,Menu,shell,session,systemPreferences,Tray,nativeImage,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {Vault,FOLDERS,RULES_PATH,GOALS_FOLDER,HABIT_FOLDER,atomicWrite}=require('./vault.cjs');
const {HABIT_SCRIPT}=require('./habits.cjs');
const {knowledgeSnapshot,knowledgeNote,dismissSuggestion}=require('./knowledge.cjs');
const {todaySnapshot}=require('./today.cjs');
const {Agent,voiceTools}=require('./agent.cjs');
const {normalizeAI,keyFor,saveAI,publicAI}=require('./ai-settings.cjs');
const {Trading212,publicTrading,readCredentials,candidateCredentials,saveCredentials}=require('./trading212.cjs');
const tradingClients=new Map();
function tradingClient(credentials=readCredentials(config,safeStorage)){
  const id=require('node:crypto').createHash('sha256').update(JSON.stringify(credentials)).digest('hex');
  if(!tradingClients.has(id)){tradingClients.set(id,new Trading212(credentials));if(tradingClients.size>3){const first=tradingClients.keys().next().value;tradingClients.get(first).dispose();tradingClients.delete(first);}}
  return tradingClients.get(id);
}
function clearTradingClients(keep){for(const [id,client] of tradingClients)if(client!==keep){client.dispose();tradingClients.delete(id);}}
const {catalog,testText,validateArguments}=require('./providers.cjs');
const {SpeechSession}=require('./speech.cjs');
const {pluginSettings}=require('./google-calendar.cjs');
const {ChatStore}=require('./chats.cjs');
const {createWorkspace,validateWorkspace,DEFAULTS}=require('./workspace.cjs');
let speechSession,win,tray,shortcut,shortcutActive=false,rendererReady=false,pendingActivation=false,config={},vault,agent,controller=new AbortController(),chats,activeChat=null,layout='compact',chatSize={width:920,height:620},calls=new Map(),generation=0,chatBusy=false,quitting=false;
const userData=app.getPath('userData');
const configFile=path.join(userData,'settings.json');
const index=path.join(__dirname,'index.html');
const trusted=event=>event.sender===win?.webContents && event.senderFrame?.url===pathToFileURL(index).href;
function handle(name,fn) {ipcMain.handle(name,async(event,...args)=>{if(!trusted(event))throw new Error('Untrusted window.');return fn(...args);});}
function getKey(provider='openai') {return keyFor(config,provider,safeStorage);}
function getCalendarToken() {if(!config.encryptedCalendarToken)return '';if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');return safeStorage.decryptString(Buffer.from(config.encryptedCalendarToken,'base64'));}
function publicSettings() {let calendar={calendars:[],enabled:false};try {if(vault)calendar=pluginSettings(vault);}catch{}return {vaultPath:config.vaultPath||'',taskFolders:{...FOLDERS,...config.taskFolders},rulesPath:config.rulesPath??RULES_PATH,goalsFolder:vault?.goalsFolder??config.goalsFolder??GOALS_FOLDER,habitFolder:vault?.habitFolder??config.habitFolder??HABIT_FOLDER,habitScript:config.habitScript??HABIT_SCRIPT,...publicAI(config),trading212:publicTrading(config),hasCalendarToken:!!config.encryptedCalendarToken,googleCalendars:calendar.calendars.map(({id,name})=>({id,name})),fullCalendarServer:calendar.enabled,calendarId:config.calendarId||'',workingHours:workingHours(config.workingHours),autoStart:config.autoStart!==false,shortcutActive};}
function setupVault() {if(!config.vaultPath) return;vault=new Vault(config.vaultPath,path.join(userData,'changes'),{folders:config.taskFolders||FOLDERS,rulesPath:config.rulesPath??RULES_PATH,goalsFolder:config.goalsFolder,habitFolder:config.habitFolder,habitScript:config.habitScript});agent=new Agent({vault,getKey,getTrading212:(args,options)=>tradingClient().view(args,options),getAI:()=>normalizeAI(config.ai),getCalendarAccess:()=>({token:getCalendarToken(),calendarId:config.calendarId||'',workingHours:workingHours(config.workingHours)}),onActivity:recordActivity});}
// While a typed chat is answering, its tool steps and visuals are kept with the reply so the chat can be reopened later.
function recordActivity(data){
  if(activeChat){
    data={...data,chatId:activeChat.id};
    if(data.kind==='tool-state'){const {id,name,label,status,path,detail}=data,step=activeChat.steps.find(s=>s.id===id);if(step)Object.assign(step,{label,status,path:path||step.path,detail:detail||step.detail,ms:Date.now()-step.started});else activeChat.steps.push({id,name,label,status,path,detail,started:Date.now()});}
    if(data.kind==='visual')activeChat.visual=data.visual;
  }
  win?.webContents.send('activity',data);
}
const savedSteps=steps=>steps.map(({started,...step})=>({...step,status:step.status==='running'?'failed':step.status}));
function stop() {speechSession?.interrupt();speechSession=null;controller.abort();controller=new AbortController();calls.clear();generation++;}
function layoutSize(mode,work){
  if(mode==='chat')return {width:Math.min(Math.max(chatSize.width,640),work.width-24),height:Math.min(Math.max(chatSize.height,420),work.height-32)};
  const expanded=mode!=='compact';return {width:Math.min(expanded?870:312,work.width-24),height:Math.min(expanded?560:350,work.height-32)};
}
function resize(mode='compact'){
  const previous=win.getBounds(),work=screen.getDisplayMatching(previous).workArea;
  if(layout==='chat')chatSize={width:previous.width,height:previous.height};
  // Chat grows out of the orb and shrinks back into it, so both share a centre.
  const centred=mode==='chat'||layout==='chat';layout=mode;
  const {width,height}=layoutSize(mode,work);
  win.setResizable(mode==='chat');win.setMinimumSize(mode==='chat'?640:0,mode==='chat'?420:0);
  const x=Math.max(work.x+12,Math.min(centred?Math.round(previous.x+(previous.width-width)/2):previous.x,work.x+work.width-width-12));
  const y=Math.max(work.y+16,Math.min(Math.round(previous.y+(previous.height-height)/2),work.y+work.height-height-16));
  win.setBounds({x,y,width,height},false);
}
function show({voice=true,settings=false}={}) {
  if(!win.isVisible()){
    const work=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const {width,height}=layoutSize(layout,work);
    win.setBounds({x:Math.round(work.x+work.width/2-width/2),y:Math.round(work.y+work.height*(layout==='chat'?.5:.43)-height/2),width,height});
  }
  win.show();win.focus();
  if(settings){win.webContents.send('open-settings');return;}
  if(voice&&config.autoStart!==false&&publicAI(config).voiceReady){if(rendererReady)win.webContents.send('activate-voice');else pendingActivation=true;}
}
function hide(){stop();win.webContents.send('hide-voice');win.hide();}
function toggle(){win.isVisible()&&win.isFocused()?hide():show();}
let shortcutError=null,lastShortcutStats='';
function shortcutDiagnostics(){
  const stats={...(shortcut?.status?.()||{}),error:shortcutError};const value=JSON.stringify(stats);
  if(value!==lastShortcutStats){lastShortcutStats=value;try{atomicWrite(path.join(userData,'shortcut-status.json'),value);}catch{}}
}
function startShortcut(){
  try {shortcutActive=shortcut?.start(()=>{toggle();shortcutDiagnostics();})||false;shortcutError=null;}catch(e){shortcutActive=false;shortcutError=e.message;}
  shortcutDiagnostics();
  win?.webContents.send('shortcut-status',shortcutActive);return shortcutActive;
}
if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(win)show();});
  app.whenReady().then(()=>{
    fs.mkdirSync(userData,{recursive:true,mode:0o700});
    try {config=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch(e){if(e.code!=='ENOENT')dialog.showErrorBox('Settings could not be read',e.message);}
    try {setupVault();}catch{}
    try {chats=new ChatStore(path.join(userData,'chats.json'));}catch(e){dialog.showErrorBox('Chats could not be read',e.message);chats=new ChatStore(path.join(userData,'chats-recovered.json'));}
    win=new BrowserWindow({width:312,height:350,title:'Vault Orb',frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,type:'panel',alwaysOnTop:true,resizable:false,fullscreenable:false,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
    win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win.webContents&&permission==='media'&&details.mediaTypes?.every(t=>t==='audio')&&win.webContents.getURL()===pathToFileURL(index).href));
    session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win.webContents&&permission==='media'&&contents.getURL()===pathToFileURL(index).href);
    win.loadFile(index);win.once('ready-to-show',()=>show({voice:false,settings:!config.vaultPath}));
    win.on('close',e=>{if(!quitting){e.preventDefault();hide();}});
    win.on('resized',()=>{if(layout==='chat'){const {width,height}=win.getBounds();chatSize={width,height};}});
    const menuImage=nativeImage.createFromPath(path.join(__dirname,'../assets/menuTemplate.png'));menuImage.setTemplateImage(true);
    tray=new Tray(menuImage);tray.setToolTip('Vault Orb · double-tap Control');tray.on('click',toggle);
    tray.on('right-click',()=>tray.popUpContextMenu(Menu.buildFromTemplate([{label:'Show Orb',click:()=>show()},{label:'Settings…',click:()=>show({voice:false,settings:true})},{type:'separator'},{label:'Quit Vault Orb',click:()=>app.quit()}])));
    try {shortcut=require(app.isPackaged?path.join(process.resourcesPath,'orb-shortcut.node'):path.join(__dirname,'../native/orb-shortcut.node'));startShortcut();}catch(e){shortcutError=e.message;shortcutDiagnostics();}
    const shortcutTimer=setInterval(()=>{if(!shortcutActive)startShortcut();else shortcutDiagnostics();},3000);shortcutTimer.unref();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'Vault Orb',submenu:[{role:'about'},{type:'separator'},{label:'Show Orb',accelerator:'CommandOrControl+Shift+Space',click:()=>show()},{label:'Settings…',accelerator:'CommandOrControl+,',click:()=>show({voice:false,settings:true})},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
      {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
      {label:'Window',submenu:[{role:'minimize'},{role:'close'}]}
    ]));
    globalShortcut.register('CommandOrControl+Shift+Space',toggle);
    handle('ready',()=>{rendererReady=true;if(pendingActivation){pendingActivation=false;win.webContents.send('activate-voice');}return true;});
    handle('resize',mode=>{if(!['compact','visual','settings','history','transcript','steps','chat'].includes(mode))throw new Error('Unknown layout.');resize(mode);return true;});
    handle('hide',()=>{hide();return true;});
    handle('enable-shortcut',async()=>{if(!shortcut)throw new Error('The native shortcut module is unavailable.');return startShortcut();});
    handle('settings',()=>publicSettings());
    handle('provider-catalog',async({provider,key}={})=>{
      if(key!==undefined&&(typeof key!=='string'||key.length>2000||/[\r\n]/.test(key)))throw new Error('Invalid API key.');
      return catalog(provider,{key:key?.trim()||getKey(provider),signal:controller.signal});
    });
    handle('test-model',async({provider,model,key}={})=>{
      if(key!==undefined&&(typeof key!=='string'||key.length>2000||/[\r\n]/.test(key)))throw new Error('Invalid API key.');
      return testText({provider,model},{key:key?.trim()||getKey(provider),signal:controller.signal});
    });
    handle('choose-vault',async()=>{const r=await dialog.showOpenDialog(win,{title:'Choose your Obsidian vault',properties:['openDirectory'],defaultPath:config.vaultPath||app.getPath('documents')});return r.canceled?null:r.filePaths[0];});
    handle('create-vault',async()=>{
      const result=await dialog.showSaveDialog(win,{title:'Create your Orb vault',buttonLabel:'Create vault',defaultPath:path.join(app.getPath('documents'),'My Orb Vault'),properties:['createDirectory'],message:'Choose a new folder name. Orb creates the complete system with empty records. Existing folders are never overwritten.'});
      return result.canceled?null:createWorkspace(result.filePath);
    });
    handle('save-settings',({vaultPath,taskFolders,rulesPath,goalsFolder,habitFolder,habitScript,key,ai,providerKeys,calendarToken,calendarId,workingHours:hours,autoStart})=>{
      const sameVault=!!config.vaultPath&&fs.realpathSync(vaultPath)===config.vaultPath;
      // Preserve existing installations; all newly connected vaults use the standard system.
      const layout=sameVault?{...DEFAULTS,...config}:DEFAULTS;
      const candidate=new Vault(vaultPath,path.join(userData,'changes'),{folders:layout.taskFolders,rulesPath:layout.rulesPath,goalsFolder:layout.goalsFolder,habitFolder:layout.habitFolder,habitScript:layout.habitScript});
      if(sameVault)candidate.validateTaskFolders();else validateWorkspace(candidate);
      const available=pluginSettings(candidate).calendars;
      if(calendarId&&!available.some(c=>c.id===calendarId))throw new Error('Choose a Google calendar connected in this Obsidian vault.');
      let next={...config,vaultPath:candidate.root,taskFolders:candidate.folders,rulesPath:candidate.rulesPath,goalsFolder:candidate.goalsFolder,habitFolder:candidate.habitFolder,habitScript:candidate.habitScript,autoStart:!!autoStart};
      next=saveAI(next,{ai,providerKeys,key},safeStorage);
      next.calendarId=calendarId||'';
      next.workingHours=workingHours(hours??config.workingHours);
      if(calendarToken){if(typeof calendarToken!=='string'||calendarToken.length>2000)throw new Error('Enter a valid Full Calendar access token.');if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');next.encryptedCalendarToken=safeStorage.encryptString(calendarToken.trim()).toString('base64');}
      atomicWrite(configFile,JSON.stringify(next,null,2));config=next;stop();setupVault();return publicSettings();
    });
    handle('trading212',args=>tradingClient().view(args,{signal:controller.signal}));
    let tradingSettingsBusy=false;
    handle('trading212-connect',async input=>{
      if(tradingSettingsBusy)throw new Error('Wait for the Trading 212 connection check to finish.');
      if(chatBusy||calls.size||speechSession?.turn)throw new Error('Finish the conversation before changing the Trading 212 connection.');
      if(!input||!['test','save','disconnect'].includes(input.action))throw new Error('Unknown Trading 212 connection action.');
      tradingSettingsBusy=true;
      try{
        if(input.action==='disconnect'){
          const next={...config};delete next.trading212;atomicWrite(configFile,JSON.stringify(next,null,2));config=next;clearTradingClients();return {trading212:publicTrading(config)};
        }
        const credentials=candidateCredentials(config,input,safeStorage),client=tradingClient(credentials),signal=controller.signal;
        const check=await client.read('summary',{signal});signal.throwIfAborted();
        if(input.action==='save'){const next=saveCredentials(config,credentials,safeStorage);atomicWrite(configFile,JSON.stringify(next,null,2));config=next;clearTradingClients(client);}
        return {trading212:publicTrading(config),currency:check.data.currency,checkedAt:check.updatedAt};
      }finally{tradingSettingsBusy=false;}
    });
    handle('knowledge',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return knowledgeSnapshot(vault);});
    handle('knowledge-note',relative=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return knowledgeNote(vault,relative);});
    handle('knowledge-write',({action,args})=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for the chat to finish or end voice before editing knowledge.');if(!['create_knowledge','update_knowledge','connect_knowledge'].includes(action))throw new Error('Unknown knowledge action.');return agent.execute(action,args);});
    handle('knowledge-dismiss',args=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return dismissSuggestion(vault,args);});
    handle('recurring-install',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return require('./recurring-install.cjs').installRecurring(vault);});
    handle('recurring',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return vault.tasks({include_completed:true});});
    handle('recurring-write',async args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Orb to finish before editing a task.');const result=vault.recurringTask(args);if(result.change_id)recordActivity({kind:'change',...result});return result;});
    handle('recurring-create',async args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Orb to finish before editing a task.');const result=vault.createTask(args);recordActivity({kind:'change',...result});return result;});
    handle('habits',args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');return agent.showHabits(args);});
    handle('set-habit',args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Orb to finish before logging a habit.');return agent.execute('set_habit',args);});
    handle('open-habit-record',async args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Orb to finish before opening a record.');return agent.openHabitRecord(args);});
    handle('goals',scope=>{if(!agent)throw new Error('Choose a valid vault in Settings.');return agent.showGoals({scope,date:null});});
    handle('today',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return todaySnapshot(vault,{getCalendarAccess:()=>({token:getCalendarToken(),calendarId:config.calendarId||'',workingHours:workingHours(config.workingHours)})});});
    handle('history',()=>vault?.publicHistory()||[]);
    handle('undo',id=>{if(chatBusy||calls.size||speechSession?.turn)throw new Error('End the current conversation before undoing from Activity.');return agent.execute('undo_change',{change_id:id});});
    handle('open-note',relative=>{const file=vault.resolve(relative,{note:false});if(!['.md','.txt','.csv','.tsv','.xlsx'].includes(path.extname(file).toLowerCase()))throw new Error('Unsupported source file.');if(!relative.endsWith('.md'))return shell.openPath(file);return shell.openExternal(`obsidian://open?vault=${encodeURIComponent(vault.root)}&file=${encodeURIComponent(relative)}`);});
    handle('connect',async sdp=>{
      if(!agent)throw new Error('Choose your vault in Settings.');
      if(chatBusy)throw new Error('Wait for the typed answer to finish.');
      if(!publicAI(config).voiceReady||normalizeAI(config.ai).voice.mode!=='realtime')throw new Error('Configure realtime voice in Settings.');
      stop(); const current=generation; const signal=controller.signal;
      const allowed=await systemPreferences.askForMediaAccess('microphone');if(!allowed)throw new Error('Allow microphone access in macOS System Settings → Privacy & Security → Microphone.');
      signal.throwIfAborted();if(current!==generation)throw new Error('Conversation ended.');
      const answer=await agent.connect(sdp,{signal});if(current!==generation)throw new Error('Conversation ended.');return {sdp:answer,generation:current};
    });
    handle('tool',async({name,args,callId,generation:expected})=>{
      if(expected!==generation)throw new Error('Conversation ended.');
      if(typeof callId!=='string'||callId.length>200)throw new Error('Missing tool call ID.');
      const schema=voiceTools.find(t=>t.name===name);if(!schema)throw new Error('Unknown voice tool.');validateArguments(schema.parameters,args);
      if(!calls.has(callId))calls.set(callId,agent.execute(name,args,{signal:controller.signal}).catch(e=>({error:e.message})));
      return calls.get(callId);
    });
    handle('speech-start',async()=>{
      if(!agent||!publicAI(config).voiceReady||normalizeAI(config.ai).voice.mode!=='pipeline')throw new Error('Configure independent voice in Settings.');
      if(chatBusy)throw new Error('Wait for the typed answer to finish.');
      stop();const current=generation,signal=controller.signal;
      const allowed=await systemPreferences.askForMediaAccess('microphone');
      if(!allowed)throw new Error('Allow microphone access in macOS System Settings.');
      signal.throwIfAborted();
      speechSession=new SpeechSession({agent,voice:normalizeAI(config.ai).voice,getKey,signal,onTranscript:(role,text)=>{if(current===generation)recordActivity({kind:'voice-transcript',role,text});}});
      return {id:speechSession.id};
    });
    handle('speech-turn',async({id,audio,mime,text}={})=>{
      if(!speechSession||speechSession.id!==id)throw new Error('Voice conversation ended.');
      return speechSession.respond({audio,mime,text});
    });
    handle('speech-interrupt',id=>{if(speechSession?.id===id)speechSession.interrupt();return true;});
    handle('chat',async({chatId,text}={})=>{
      if(chatBusy||speechSession?.turn)throw new Error('Wait for the current answer.');if(!agent)throw new Error('Choose your vault first.');
      if(typeof text!=='string'||!text.trim()||text.length>12000)throw new Error('Enter a message up to 12,000 characters.');
      const chat=chats.open(chatId,text),history=chats.history(chat.id);chats.append(chat.id,{role:'user',text});
      chatBusy=true;const signal=controller.signal,turn=activeChat={id:chat.id,steps:[],visual:undefined};
      try {
        const result=await agent.respond([...history,{role:'user',content:text}],{signal});signal.throwIfAborted();
        const message=chats.append(chat.id,{role:'assistant',text:result.text,steps:savedSteps(turn.steps),...(turn.visual?{visual:turn.visual}:{})});
        return {...result,message,chat:chats.list().find(c=>c.id===chat.id)};
      }catch(e){
        chats.append(chat.id,{role:'error',text:signal.aborted?'Stopped.':e.message,steps:savedSteps(turn.steps)});throw e;
      }finally {chatBusy=false;if(activeChat===turn)activeChat=null;}
    });
    handle('chats',()=>chats.list());
    handle('chat-get',id=>chats.get(id));
    handle('chat-archive',(id,archived)=>chats.setArchived(id,archived));
    handle('chat-rename',(id,title)=>chats.rename(id,title));
    handle('chat-delete',id=>{if(chatBusy&&activeChat?.id===id)throw new Error('Wait for this chat to finish before deleting it.');return chats.remove(id);});
    handle('stop',()=>{stop();return true;});
    app.on('activate',()=>{if(win)show();});
  });
  app.on('before-quit',()=>{quitting=true;stop();});
  app.on('will-quit',()=>globalShortcut.unregisterAll());
}
