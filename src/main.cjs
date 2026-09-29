const {workingHours}=require('./calendar-time.cjs');
const {app,BrowserWindow,ipcMain,dialog,safeStorage,globalShortcut,Menu,shell,session,systemPreferences,Tray,nativeImage,screen,powerMonitor,Notification,protocol}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {Vault,FOLDERS,RULES_PATH,GOALS_FOLDER,HABIT_FOLDER,atomicWrite}=require('./vault.cjs');
const {HABIT_SCRIPT}=require('./habits.cjs');
const {knowledgeSnapshot,knowledgeNote,dismissSuggestion}=require('./knowledge.cjs');
const {clippings,invalidateClippings,readClipping}=require('./clippings.cjs');
const {todaySnapshot}=require('./today.cjs');
const {DayPlans}=require('./day-plans.cjs');
const {Agent,voiceTools}=require('./agent.cjs');
const {FocusTimer,focusTarget,DEFAULT_MINUTES}=require('./focus.cjs');
const {normalizeAI,keyFor,saveAI,publicAI}=require('./ai-settings.cjs');
const {readAppearance,withAppearance}=require('./appearance.js');
const {Trading212,publicTrading,readCredentials}=require('./trading212.cjs');
const {createTradingService}=require('./trading212-service.cjs');
const {createWeatherService,readWeather,withWeather}=require('./weather.cjs');
const {createPlacesProvider,tileURL}=require('./places-provider.cjs');
const {createPlacesService,readPlacesSettings,withPlacesSettings,placesKey}=require('./places-service.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'orbplaces',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
const placesRequests=new Map();
const tradingClients=new Map();
let activeTradingClient=null;
function tradingClient(credentials=readCredentials(config,safeStorage)){
  const id=require('node:crypto').createHash('sha256').update(JSON.stringify(credentials)).digest('hex');
  if(!tradingClients.has(id))tradingClients.set(id,new Trading212(credentials));
  const client=tradingClients.get(id);if(arguments.length===0)activeTradingClient=client;
  while(tradingClients.size>3){const entry=[...tradingClients].find(([,value])=>value!==activeTradingClient&&value!==client);if(!entry)break;entry[1].dispose();tradingClients.delete(entry[0]);}
  return client;
}
function clearTradingClients(keep){for(const [id,client] of tradingClients)if(client!==keep){client.dispose();tradingClients.delete(id);}activeTradingClient=keep||null;}
const {catalog,testText,validateArguments}=require('./providers.cjs');
const {SpeechSession}=require('./speech.cjs');
const {pluginSettings}=require('./google-calendar.cjs');
const {ChatStore}=require('./chats.cjs');
const {createWorkspace,validateWorkspace,DEFAULTS}=require('./workspace.cjs');
let speechSession,win,tray,shortcut,shortcutActive=false,rendererReady=false,pendingActivation=false,config={},vault,agent,planner,controller=new AbortController(),chats,activeChat=null,layout='compact',chatSize={width:920,height:620},calls=new Map(),generation=0,chatBusy=false,quitting=false,focusTimer,focusNotice;
const userData=app.getPath('userData');
const configFile=path.join(userData,'settings.json');
const tradingService=createTradingService({directory:path.join(userData,'trading212'),safeStorage,getConfig:()=>config,saveConfig:next=>{atomicWrite(configFile,JSON.stringify(next,null,2));config=next;},getClient:tradingClient,clearClients:clearTradingClients,exportFile:async data=>{
  const result=await dialog.showSaveDialog(win,{title:'Export unencrypted investment history',defaultPath:'trading212-history.json',filters:[{name:'JSON',extensions:['json']}]});if(result.canceled)return false;
  atomicWrite(result.filePath,JSON.stringify(data,null,2));return true;
}});
const locale=()=>app.getLocale?.()||'';
const weatherService=createWeatherService({getConfig:()=>config,getLocale:locale});
const placesProvider=createPlacesProvider({getKey:()=>placesKey(config,safeStorage)});
const placesService=createPlacesService({getVault:()=>vault,getConfig:()=>config,provider:placesProvider,onChange:change=>recordActivity({kind:'change',...change})});
const index=path.join(__dirname,'index.html');
const trusted=event=>event.sender===win?.webContents && event.senderFrame?.url===pathToFileURL(index).href;
function handle(name,fn) {ipcMain.handle(name,async(event,...args)=>{if(!trusted(event))throw new Error('Untrusted window.');return fn(...args);});}
function getKey(provider='openai') {return keyFor(config,provider,safeStorage);}
function getCalendarToken() {if(!config.encryptedCalendarToken)return '';if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');return safeStorage.decryptString(Buffer.from(config.encryptedCalendarToken,'base64'));}
function publicSettings() {let calendar={calendars:[],enabled:false};try {if(vault)calendar=pluginSettings(vault);}catch{}return {appearance:readAppearance(config),vaultPath:config.vaultPath||'',taskFolders:{...FOLDERS,...config.taskFolders},rulesPath:config.rulesPath??RULES_PATH,goalsFolder:vault?.goalsFolder??config.goalsFolder??GOALS_FOLDER,habitFolder:vault?.habitFolder??config.habitFolder??HABIT_FOLDER,habitScript:config.habitScript??HABIT_SCRIPT,...publicAI(config),trading212:publicTrading(config),weather:readWeather(config,locale()),places:readPlacesSettings(config),hasCalendarToken:!!config.encryptedCalendarToken,googleCalendars:calendar.calendars.map(({id,name})=>({id,name})),fullCalendarServer:calendar.enabled,calendarId:config.calendarId||'',workingHours:workingHours(config.workingHours),autoStart:config.autoStart!==false,shortcutActive};}
function dayPlanner(){if(!vault)throw new Error('Choose a valid vault in Settings.');if(!planner)planner=new DayPlans(vault,{getKey,getAI:()=>normalizeAI(config.ai),aiReady:()=>publicAI(config).chatReady,getCalendarAccess:()=>({token:getCalendarToken(),calendarId:config.calendarId||'',workingHours:workingHours(config.workingHours)}),onChange:change=>recordActivity({kind:'change',...change})});return planner;}
function setupVault() {placesService.clear();invalidateClippings(vault);if(!config.vaultPath) return;vault=new Vault(config.vaultPath,path.join(userData,'changes'),{folders:config.taskFolders||FOLDERS,rulesPath:config.rulesPath??RULES_PATH,goalsFolder:config.goalsFolder,habitFolder:config.habitFolder,habitScript:config.habitScript});planner=null;agent=new Agent({vault,getKey,getDayPlan:(args,options)=>dayPlanner().command(args,options?.signal),getTrading212:(args,options)=>tradingService.view(args,options),getWeather:(args,options)=>weatherService.forecast(args,options),getPlaces:(args,options)=>placesService.command(args,{...options,notify:false}),getAI:()=>normalizeAI(config.ai),getCalendarAccess:()=>({token:getCalendarToken(),calendarId:config.calendarId||'',workingHours:workingHours(config.workingHours)}),getFocus:()=>focusTimer,onActivity:recordActivity});}
// While a typed chat is answering, its tool steps and visuals are kept with the reply so the chat can be reopened later.
function recordActivity(data){
  if(data.kind==='change')invalidateClippings(vault);
  if(activeChat){
    data={...data,chatId:activeChat.id};
    if(data.kind==='tool-state'){const {id,name,label,status,path,detail}=data,step=activeChat.steps.find(s=>s.id===id);if(step)Object.assign(step,{label,status,path:path||step.path,detail:detail||step.detail,ms:Date.now()-step.started});else activeChat.steps.push({id,name,label,status,path,detail,started:Date.now()});}
    if(data.kind==='visual')activeChat.visual=data.visual;
  }
  win?.webContents.send('activity',data);
}
const savedSteps=steps=>steps.map(({started,...step})=>({...step,status:step.status==='running'?'failed':step.status}));
function stop() {for(const pending of placesRequests.values())pending.abort();placesRequests.clear();speechSession?.interrupt();speechSession=null;controller.abort();controller=new AbortController();calls.clear();generation++;}
function layoutSize(mode,work){
  if(mode==='chat')return {width:Math.min(Math.max(chatSize.width,640),work.width-24),height:Math.min(Math.max(chatSize.height,420),work.height-32)};
  // Reading a knowledge note gets a document-sized window.
  if(mode==='reader')return {width:Math.min(1100,work.width-24),height:Math.min(820,work.height-32)};
  const expanded=mode!=='compact';return {width:Math.min(expanded?870:312,work.width-24),height:Math.min(expanded?560:350,work.height-32)};
}
function resize(mode='compact'){
  const previous=win.getBounds(),work=screen.getDisplayMatching(previous).workArea;
  if(layout==='chat')chatSize={width:previous.width,height:previous.height};
  // Chat grows out of the orb and shrinks back into it, so both share a centre.
  const centred=['chat','reader'].includes(mode)||['chat','reader'].includes(layout);layout=mode;
  const {width,height}=layoutSize(mode,work);
  win.setResizable(mode==='chat');win.setMinimumSize(mode==='chat'?640:0,mode==='chat'?420:0);
  const x=Math.max(work.x+12,Math.min(centred?Math.round(previous.x+(previous.width-width)/2):previous.x,work.x+work.width-width-12));
  const y=Math.max(work.y+16,Math.min(Math.round(previous.y+(previous.height-height)/2),work.y+work.height-height-16));
  win.setBounds({x,y,width,height},false);
}
function show({voice=true,settings=false,activate=true}={}) {
  if(!win.isVisible()){
    const work=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const {width,height}=layoutSize(layout,work);
    win.setBounds({x:Math.round(work.x+work.width/2-width/2),y:Math.round(work.y+work.height*(layout==='chat'?.5:.43)-height/2),width,height});
  }
  // A finished focus session brings the orb back without taking the keyboard.
  if(activate){win.show();win.focus();}else win.showInactive();
  if(settings){win.webContents.send('open-settings');return;}
  if(voice&&config.autoStart!==false&&publicAI(config).voiceReady){if(rendererReady)win.webContents.send('activate-voice');else pendingActivation=true;}
}
// The menu bar shows the minutes left, so a hidden orb still tells the time.
function updateFocusTray(){const s=focusTimer?.status();tray?.setTitle?.(!s||s.status==='completed'?'':s.status==='paused'?'Paused':`${Math.ceil(s.remainingMs/60000)}m`);}
function focusChanged(session,event){
  updateFocusTray();
  win?.webContents.send('focus',{session,event});
  if(event!=='complete'||!win)return;
  if(!win.isVisible())show({voice:false,activate:false});
  if(!win.isFocused()&&Notification.isSupported()){focusNotice=new Notification({title:'Focus session complete',body:`${session.minutes} min on ${session.title}`});focusNotice.on('click',()=>show({voice:false}));focusNotice.show();}
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
    focusTimer=new FocusTimer({file:path.join(userData,'focus.json'),onChange:focusChanged});focusTimer.restore();
    try {setupVault();}catch{}
    tradingService.start();
    powerMonitor.on('resume',()=>{tradingService.resume();focusTimer.rearm();updateFocusTray();});
    try {chats=new ChatStore(path.join(userData,'chats.json'));}catch(e){dialog.showErrorBox('Chats could not be read',e.message);chats=new ChatStore(path.join(userData,'chats-recovered.json'));}
    win=new BrowserWindow({width:312,height:350,title:'Vault Orb',frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,type:'panel',alwaysOnTop:true,resizable:false,fullscreenable:false,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
    win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win.webContents&&permission==='media'&&details.mediaTypes?.every(t=>t==='audio')&&win.webContents.getURL()===pathToFileURL(index).href));
    session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win.webContents&&permission==='media'&&contents.getURL()===pathToFileURL(index).href);
    protocol.handle('orbplaces',async request=>{
      try{if(request.method!=='GET')return new Response('',{status:405});const url=tileURL(request.url,placesKey(config,safeStorage));const response=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)return new Response('',{status:response.status});const bytes=await response.arrayBuffer();if(bytes.byteLength>2000000)return new Response('',{status:502});return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=3600','Access-Control-Allow-Origin':'*'}});}catch{return new Response('',{status:503});}
    });
    win.loadFile(index);win.once('ready-to-show',()=>show({voice:false,settings:!config.vaultPath}));
    win.on('close',e=>{if(!quitting){e.preventDefault();hide();}});
    win.on('resized',()=>{if(layout==='chat'){const {width,height}=win.getBounds();chatSize={width,height};}});
    const menuImage=nativeImage.createFromPath(path.join(__dirname,'../assets/menuTemplate.png'));menuImage.setTemplateImage(true);
    tray=new Tray(menuImage);tray.setToolTip('Vault Orb · double-tap Control');tray.on('click',toggle);
    tray.on('right-click',()=>tray.popUpContextMenu(Menu.buildFromTemplate([{label:'Show Orb',click:()=>show()},{label:'Settings…',click:()=>show({voice:false,settings:true})},{type:'separator'},{label:'Quit Vault Orb',click:()=>app.quit()}])));
    try {shortcut=require(app.isPackaged?path.join(process.resourcesPath,'orb-shortcut.node'):path.join(__dirname,'../native/orb-shortcut.node'));startShortcut();}catch(e){shortcutError=e.message;shortcutDiagnostics();}
    updateFocusTray();const focusTray=setInterval(updateFocusTray,15000);focusTray.unref();
    const shortcutTimer=setInterval(()=>{if(!shortcutActive)startShortcut();else shortcutDiagnostics();},3000);shortcutTimer.unref();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'Vault Orb',submenu:[{role:'about'},{type:'separator'},{label:'Show Orb',accelerator:'CommandOrControl+Shift+Space',click:()=>show()},{label:'Settings…',accelerator:'CommandOrControl+,',click:()=>show({voice:false,settings:true})},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
      {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
      {label:'Window',submenu:[{role:'minimize'},{role:'close'}]}
    ]));
    globalShortcut.register('CommandOrControl+Shift+Space',toggle);
    handle('ready',()=>{rendererReady=true;if(pendingActivation){pendingActivation=false;win.webContents.send('activate-voice');}return true;});
    handle('resize',mode=>{if(!['compact','visual','reader','settings','history','transcript','steps','chat'].includes(mode))throw new Error('Unknown layout.');resize(mode);return true;});
    handle('hide',()=>{hide();return true;});
    handle('enable-shortcut',async()=>{if(!shortcut)throw new Error('The native shortcut module is unavailable.');return startShortcut();});
    handle('settings',()=>publicSettings());
    handle('save-appearance',input=>{
      if(!input)throw new Error('Choose an orb colour.');
      const next=withAppearance(config,input);
      atomicWrite(configFile,JSON.stringify(next,null,2));config=next;
      return {appearance:readAppearance(config)};
    });
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
    handle('save-settings',({vaultPath,taskFolders,rulesPath,goalsFolder,habitFolder,habitScript,key,ai,providerKeys,calendarToken,calendarId,workingHours:hours,autoStart,appearance})=>{
      if(planner?.busy)throw new Error('Wait for the planner to finish before changing vault settings.');
      const sameVault=!!config.vaultPath&&fs.realpathSync(vaultPath)===config.vaultPath;
      // Preserve existing installations; all newly connected vaults use the standard system.
      const layout=sameVault?{...DEFAULTS,...config}:DEFAULTS;
      const candidate=new Vault(vaultPath,path.join(userData,'changes'),{folders:layout.taskFolders,rulesPath:layout.rulesPath,goalsFolder:layout.goalsFolder,habitFolder:layout.habitFolder,habitScript:layout.habitScript});
      if(sameVault)candidate.validateTaskFolders();else validateWorkspace(candidate);
      const available=pluginSettings(candidate).calendars;
      if(calendarId&&!available.some(c=>c.id===calendarId))throw new Error('Choose a Google calendar connected in this Obsidian vault.');
      let next={...config,vaultPath:candidate.root,taskFolders:candidate.folders,rulesPath:candidate.rulesPath,goalsFolder:candidate.goalsFolder,habitFolder:candidate.habitFolder,habitScript:candidate.habitScript,autoStart:!!autoStart};
      next=withAppearance(next,appearance);
      next=saveAI(next,{ai,providerKeys,key},safeStorage);
      next.calendarId=calendarId||'';
      next.workingHours=workingHours(hours??config.workingHours);
      if(calendarToken){if(typeof calendarToken!=='string'||calendarToken.length>2000)throw new Error('Enter a valid Full Calendar access token.');if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');next.encryptedCalendarToken=safeStorage.encryptString(calendarToken.trim()).toString('base64');}
      atomicWrite(configFile,JSON.stringify(next,null,2));config=next;stop();setupVault();return publicSettings();
    });
    let locationPending=null;
    handle('places-location',async()=>{
      if(locationPending)return locationPending;
      const location=require(app.isPackaged?path.join(process.resourcesPath,'orb-location.node'):path.join(__dirname,'../native/orb-location.node'));
      const signal=controller.signal;locationPending=location.locate();
      try{const fix=await locationPending;signal.throwIfAborted();return await placesService.command({action:'origin',source:'device',...fix});}finally{locationPending=null;}
    });
    handle('save-places',input=>{const next=withPlacesSettings(config,input,safeStorage);atomicWrite(configFile,JSON.stringify(next,null,2));config=next;placesService.clear();return {places:readPlacesSettings(config)};});
    handle('places',async args=>{
      if(!args||typeof args!=='object')throw new Error('Invalid Places request.');
      if(args.clientId!==undefined&&(typeof args.clientId!=='string'||!/^[a-f0-9-]{36}$/i.test(args.clientId)))throw new Error('Invalid Places panel.');
      const clientId=args.clientId;
      if(args.action==='cancel'){if(clientId){placesRequests.get(clientId)?.abort();placesRequests.delete(clientId);}return true;}
      let request;
      if(clientId&&['list','search'].includes(args.action)){placesRequests.get(clientId)?.abort();request=new AbortController();placesRequests.set(clientId,request);}
      try{const result=await placesService.command(args,{signal:request?AbortSignal.any([controller.signal,request.signal]):controller.signal});
        if(args.action==='directions'){await shell.openExternal(result.url);return true;}
        if(args.action==='note'){await shell.openExternal(`obsidian://open?vault=${encodeURIComponent(vault.root)}&file=${encodeURIComponent(result.path)}`);return true;}
        return result;
      }finally{if(request&&placesRequests.get(clientId)===request)placesRequests.delete(clientId);}
    });
    handle('weather',args=>weatherService.forecast(args||{},{signal:controller.signal}));
    handle('weather-search',query=>weatherService.search(query,{signal:controller.signal}));
    handle('save-weather',input=>{
      const next=withWeather(config,input??null,locale());
      atomicWrite(configFile,JSON.stringify(next,null,2));config=next;
      return {weather:readWeather(config,locale())};
    });
    handle('trading212',args=>tradingService.view(args,{signal:controller.signal}));
    handle('trading212-tracking',input=>tradingService.tracking(input));
    handle('trading212-connect',input=>{
      if(chatBusy||calls.size||speechSession?.turn)throw new Error('Finish the conversation before changing the Trading 212 connection.');
      return tradingService.connect(input,{signal:controller.signal});
    });
    handle('clippings',args=>clippings(vault).search(args));
    handle('clipping-note',relative=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return readClipping(vault,relative);});
    handle('clipping-source',relative=>{if(!vault)throw new Error('Choose a valid vault in Settings.');const note=readClipping(vault,relative);if(!note.source)throw new Error('This clipping has no valid HTTP(S) source URL.');return shell.openExternal(note.source);});
    handle('knowledge',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return knowledgeSnapshot(vault);});
    handle('knowledge-note',relative=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return knowledgeNote(vault,relative);});
    handle('knowledge-write',({action,args})=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for the chat to finish or end voice before editing knowledge.');if(!['create_knowledge','update_knowledge','connect_knowledge'].includes(action))throw new Error('Unknown knowledge action.');return agent.execute(action,args);});
    handle('knowledge-dismiss',args=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return dismissSuggestion(vault,args);});
    handle('recurring-install',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return require('./recurring-install.cjs').installRecurring(vault);});
    handle('recurring',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return vault.tasks({include_completed:true});});
    handle('recurring-write',async args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Smith to finish before editing a task.');const result=vault.recurringTask(args);if(result.change_id)recordActivity({kind:'change',...result});return result;});
    handle('recurring-create',async args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Smith to finish before editing a task.');const result=vault.createTask(args);recordActivity({kind:'change',...result});return result;});
    handle('habits',args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');return agent.showHabits(args);});
    handle('set-habit',args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Smith to finish before logging a habit.');return agent.execute('set_habit',args);});
    handle('open-habit-record',async args=>{if(!agent)throw new Error('Choose a valid vault in Settings.');if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Smith to finish before opening a record.');return agent.openHabitRecord(args);});
    handle('goals',scope=>{if(!agent)throw new Error('Choose a valid vault in Settings.');return agent.showGoals({scope,date:null});});
    handle('day-planner',args=>{if(!vault)throw new Error('Choose a valid vault in Settings.');if(!['open','cancel'].includes(args?.action)&&(chatBusy||calls.size||speechSession?.turn))throw new Error('Wait for Smith to finish before editing the planner.');return dayPlanner().command(args,controller.signal);});
    handle('calendar',async()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return require('./visuals.cjs').calendarVisual(await require('./calendar.cjs').queryCalendar(vault,{include_tasks:false},{skipSync:true,google:{token:getCalendarToken(),calendarId:config.calendarId||''}}));});
    handle('today',()=>{if(planner?.busy)throw new Error('Wait for the planner to finish before refreshing Today.');if(!vault)throw new Error('Choose a valid vault in Settings.');return todaySnapshot(vault,{getCalendarAccess:()=>({token:getCalendarToken(),calendarId:config.calendarId||'',workingHours:workingHours(config.workingHours)})});});
    handle('focus',({action,path:relative=null,title=null,minutes=null,note=null}={})=>{
      if(['pause','resume','stop','dismiss'].includes(action))return focusTimer[action]();
      if(action==='status')return focusTimer.status();
      if(action==='start')return focusTimer.start({...focusTarget(vault,{path:relative,title}),minutes:minutes??DEFAULT_MINUTES});
      if(action==='extend')return focusTimer.extend(minutes??5);
      if(!['log','done'].includes(action))throw new Error('Unknown focus action.');
      if(!agent)throw new Error('Choose a valid vault in Settings.');
      if(chatBusy||calls.size||speechSession?.turn)throw new Error('Wait for Smith to finish before editing a task.');
      const finished=focusTimer.status();if(finished?.status!=='completed'||!finished.path)throw new Error('There is no finished task session to update.');
      const version=vault.read(finished.path).version;
      if(action==='log')return agent.execute('log_focus',{path:finished.path,version,minutes:finished.minutes,note});
      return agent.execute('update_task',{path:finished.path,version,planned:null,due:null,completed:true,category:null,venture:null});
    });
    handle('history',()=>vault?.publicHistory()||[]);
    handle('undo',id=>{if(chatBusy||calls.size||speechSession?.turn)throw new Error('End the current conversation before undoing from Activity.');return agent.execute('undo_change',{change_id:id});});
    handle('open-link',url=>{if(typeof url!=='string'||url.length>4000)throw new Error('Invalid link.');const parsed=new URL(url);if(!['http:','https:','mailto:'].includes(parsed.protocol))throw new Error('Only web and email links open from notes.');return shell.openExternal(parsed.href);});
    handle('open-note',relative=>{
      // A bare wikilink name (no folder) that isn't at the vault root is handed to Obsidian to resolve by name.
      if(typeof relative==='string'&&relative.endsWith('.md')&&!relative.includes('/')&&!relative.includes('\\')&&!relative.startsWith('.')&&!fs.existsSync(path.join(vault.root,relative)))return shell.openExternal(`obsidian://open?vault=${encodeURIComponent(vault.root)}&file=${encodeURIComponent(relative.slice(0,-3))}`);
      const file=vault.resolve(relative,{note:false});if(!['.md','.txt','.csv','.tsv','.xlsx'].includes(path.extname(file).toLowerCase()))throw new Error('Unsupported source file.');if(!relative.toLowerCase().endsWith('.md'))return shell.openPath(file);return shell.openExternal(`obsidian://open?vault=${encodeURIComponent(vault.root)}&file=${encodeURIComponent(relative)}`);});
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
  app.on('before-quit',()=>{quitting=true;stop();tradingService.close().catch(()=>{});});
  app.on('will-quit',()=>globalShortcut.unregisterAll());
}
