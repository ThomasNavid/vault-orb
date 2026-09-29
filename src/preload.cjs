const {contextBridge,ipcRenderer}=require('electron');
const invoke=name=>(...args)=>ipcRenderer.invoke(name,...args);
contextBridge.exposeInMainWorld('orb',{
  providerCatalog:invoke('provider-catalog'),testModel:invoke('test-model'),speechStart:invoke('speech-start'),speechTurn:invoke('speech-turn'),speechInterrupt:invoke('speech-interrupt'),
  trading212:invoke('trading212'),trading212Tracking:invoke('trading212-tracking'),trading212Connect:invoke('trading212-connect'),
  settings:invoke('settings'),saveAppearance:invoke('save-appearance'),saveSettings:invoke('save-settings'),chooseVault:invoke('choose-vault'),createVault:invoke('create-vault'),
  clippings:invoke('clippings'),clippingNote:invoke('clipping-note'),clippingSource:invoke('clipping-source'),
  knowledge:invoke('knowledge'),knowledgeNote:invoke('knowledge-note'),knowledgeWrite:invoke('knowledge-write'),knowledgeDismiss:invoke('knowledge-dismiss'),
  recurring:invoke('recurring'),recurringInstall:invoke('recurring-install'),recurringWrite:invoke('recurring-write'),recurringCreate:invoke('recurring-create'),
  dayPlanner:invoke('day-planner'),
  calendar:invoke('calendar'),habits:invoke('habits'),setHabit:invoke('set-habit'),openHabitRecord:invoke('open-habit-record'),goals:invoke('goals'),today:invoke('today'),history:invoke('history'),undo:invoke('undo'),openNote:invoke('open-note'),openLink:invoke('open-link'),
  connect:invoke('connect'),tool:invoke('tool'),chat:invoke('chat'),stop:invoke('stop'),
  chats:invoke('chats'),getChat:invoke('chat-get'),archiveChat:invoke('chat-archive'),renameChat:invoke('chat-rename'),deleteChat:invoke('chat-delete'),
  ready:invoke('ready'),resize:invoke('resize'),hide:invoke('hide'),enableShortcut:invoke('enable-shortcut'),
  onActivity:fn=>{ipcRenderer.on('activity',(_e,data)=>fn(data));},
  onActivate:fn=>{ipcRenderer.on('activate-voice',()=>fn());},
  onHide:fn=>{ipcRenderer.on('hide-voice',()=>fn());},
  onSettings:fn=>{ipcRenderer.on('open-settings',()=>fn());},
  onShortcut:fn=>{ipcRenderer.on('shortcut-status',(_e,active)=>fn(active));}
});
