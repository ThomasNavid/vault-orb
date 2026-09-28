const {app,BrowserWindow,ipcMain,dialog,safeStorage,globalShortcut,Menu,shell,session,systemPreferences,Tray,nativeImage,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {Vault,FOLDERS,RULES_PATH,atomicWrite}=require('./vault.cjs');
const {Agent}=require('./agent.cjs');
const {pluginSettings}=require('./google-calendar.cjs');
let win,tray,shortcut,shortcutActive=false,rendererReady=false,pendingActivation=false,config={},vault,agent,controller=new AbortController(),conversation=[],calls=new Map(),generation=0,chatBusy=false,quitting=false;
const userData=app.getPath('userData');
const configFile=path.join(userData,'settings.json');
const index=path.join(__dirname,'index.html');
const trusted=event=>event.sender===win?.webContents && event.senderFrame?.url===pathToFileURL(index).href;
function handle(name,fn) {ipcMain.handle(name,async(event,...args)=>{if(!trusted(event))throw new Error('Untrusted window.');return fn(...args);});}
function getKey() {if(!config.encryptedKey)return '';if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');return safeStorage.decryptString(Buffer.from(config.encryptedKey,'base64'));}
function getCalendarToken() {if(!config.encryptedCalendarToken)return '';if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');return safeStorage.decryptString(Buffer.from(config.encryptedCalendarToken,'base64'));}
function publicSettings() {let calendar={calendars:[],enabled:false};try {if(vault)calendar=pluginSettings(vault);}catch{}return {vaultPath:config.vaultPath||'',taskFolders:{...FOLDERS,...config.taskFolders},rulesPath:config.rulesPath??RULES_PATH,hasKey:!!config.encryptedKey,hasCalendarToken:!!config.encryptedCalendarToken,googleCalendars:calendar.calendars.map(({id,name})=>({id,name})),fullCalendarServer:calendar.enabled,calendarId:config.calendarId||'',autoStart:config.autoStart!==false,voiceModel:'gpt-realtime-2.1',advancedModel:'gpt-6-sol',shortcutActive};}
function setupVault() {if(!config.vaultPath) return;vault=new Vault(config.vaultPath,path.join(userData,'changes'),{folders:config.taskFolders||FOLDERS,rulesPath:config.rulesPath??RULES_PATH});agent=new Agent({vault,getKey,getCalendarAccess:()=>({token:getCalendarToken(),calendarId:config.calendarId||''}),onActivity:data=>win?.webContents.send('activity',data)});}
function stop() {controller.abort();controller=new AbortController();calls.clear();generation++;}
function resize(mode='compact'){
  const previous=win.getBounds(),work=screen.getDisplayMatching(previous).workArea;
  const expanded=mode!=='compact';const width=Math.min(expanded?870:312,work.width-24),height=Math.min(expanded?560:350,work.height-32);
  const x=Math.max(work.x+12,Math.min(previous.x,work.x+work.width-width-12));
  const y=Math.max(work.y+16,Math.min(Math.round(previous.y+(previous.height-height)/2),work.y+work.height-height-16));
  win.setBounds({x,y,width,height},false);
}
function show({voice=true,settings=false}={}) {
  if(!win.isVisible()){
    const work=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    win.setBounds({x:Math.round(work.x+work.width/2-156),y:Math.round(work.y+work.height*.43-175),width:312,height:350});
  }
  win.show();win.focus();
  if(settings){win.webContents.send('open-settings');return;}
  if(voice&&config.autoStart!==false&&config.encryptedKey){if(rendererReady)win.webContents.send('activate-voice');else pendingActivation=true;}
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
    win=new BrowserWindow({width:312,height:350,title:'Vault Orb',frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,type:'panel',alwaysOnTop:true,resizable:false,fullscreenable:false,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
    win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win.webContents&&permission==='media'&&details.mediaTypes?.every(t=>t==='audio')&&win.webContents.getURL()===pathToFileURL(index).href));
    session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win.webContents&&permission==='media'&&contents.getURL()===pathToFileURL(index).href);
    win.loadFile(index);win.once('ready-to-show',()=>show({voice:false,settings:!config.vaultPath}));
    win.on('close',e=>{if(!quitting){e.preventDefault();hide();}});
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
    handle('resize',mode=>{if(!['compact','visual','settings','history','transcript','steps'].includes(mode))throw new Error('Unknown layout.');resize(mode);return true;});
    handle('hide',()=>{hide();return true;});
    handle('enable-shortcut',async()=>{if(!shortcut)throw new Error('The native shortcut module is unavailable.');return startShortcut();});
    handle('settings',()=>publicSettings());
    handle('choose-vault',async()=>{const r=await dialog.showOpenDialog(win,{title:'Choose your Obsidian vault',properties:['openDirectory'],defaultPath:config.vaultPath||app.getPath('documents')});return r.canceled?null:r.filePaths[0];});
    handle('save-settings',({vaultPath,taskFolders,rulesPath,key,calendarToken,calendarId,autoStart})=>{
      const candidate=new Vault(vaultPath,path.join(userData,'changes'),{folders:taskFolders||FOLDERS,rulesPath:rulesPath??RULES_PATH});
      candidate.validateTaskFolders();
      const available=pluginSettings(candidate).calendars;
      if(calendarId&&!available.some(c=>c.id===calendarId))throw new Error('Choose a Google calendar connected in this Obsidian vault.');
      const next={...config,vaultPath:candidate.root,taskFolders:candidate.folders,rulesPath:candidate.rulesPath,autoStart:!!autoStart};
      if(key){if(typeof key!=='string'||key.length>1000||!key.startsWith('sk-'))throw new Error('Enter a valid OpenAI API key.');if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');next.encryptedKey=safeStorage.encryptString(key.trim()).toString('base64');}
      next.calendarId=calendarId||'';
      if(calendarToken){if(typeof calendarToken!=='string'||calendarToken.length>2000)throw new Error('Enter a valid Full Calendar access token.');if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');next.encryptedCalendarToken=safeStorage.encryptString(calendarToken.trim()).toString('base64');}
      atomicWrite(configFile,JSON.stringify(next,null,2));config=next;stop();conversation=[];setupVault();return publicSettings();
    });
    handle('today',()=>{if(!vault)throw new Error('Choose a valid vault in Settings.');return {today:vault.tasks({scope:'today'}),overdue:vault.tasks({scope:'overdue'})};});
    handle('history',()=>vault?.publicHistory()||[]);
    handle('undo',id=>{if(chatBusy||calls.size)throw new Error('End the current conversation before undoing from Activity.');return agent.execute('undo_change',{change_id:id});});
    handle('open-note',relative=>{const file=vault.resolve(relative,{note:false});if(!['.md','.txt','.csv','.tsv','.xlsx'].includes(path.extname(file).toLowerCase()))throw new Error('Unsupported source file.');if(!relative.endsWith('.md'))return shell.openPath(file);return shell.openExternal(`obsidian://open?vault=${encodeURIComponent(vault.root)}&file=${encodeURIComponent(relative)}`);});
    handle('connect',async sdp=>{
      if(!agent)throw new Error('Choose your vault in Settings.');
      stop(); const current=generation; const signal=controller.signal;
      const allowed=await systemPreferences.askForMediaAccess('microphone');if(!allowed)throw new Error('Allow microphone access in macOS System Settings → Privacy & Security → Microphone.');
      signal.throwIfAborted();if(current!==generation)throw new Error('Conversation ended.');
      const answer=await agent.connect(sdp,{signal});if(current!==generation)throw new Error('Conversation ended.');return {sdp:answer,generation:current};
    });
    handle('tool',async({name,args,callId,generation:expected})=>{
      if(expected!==generation)throw new Error('Conversation ended.');
      if(typeof callId!=='string')throw new Error('Missing tool call ID.');
      if(!calls.has(callId))calls.set(callId,agent.execute(name,args,{signal:controller.signal}).catch(e=>({error:e.message})));
      return calls.get(callId);
    });
    handle('chat',async text=>{
      if(chatBusy)throw new Error('Wait for the current answer.');if(!agent)throw new Error('Choose your vault first.');
      if(typeof text!=='string'||!text.trim()||text.length>12000)throw new Error('Enter a message up to 12,000 characters.');
      chatBusy=true;const signal=controller.signal;conversation.push({role:'user',content:text});
      try {const result=await agent.respond(conversation.slice(-20),{signal});signal.throwIfAborted();conversation.push({role:'assistant',content:result.text});return result;}
      finally {chatBusy=false;}
    });
    handle('stop',()=>{stop();return true;});
    app.on('activate',()=>{if(win)show();});
  });
  app.on('before-quit',()=>{quitting=true;stop();});
  app.on('will-quit',()=>globalShortcut.unregisterAll());
}
