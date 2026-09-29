const {contextBridge,ipcRenderer}=require('electron');
const invoke=name=>(...args)=>ipcRenderer.invoke(name,...args);
contextBridge.exposeInMainWorld('orb',{
  settings:invoke('settings'),saveSettings:invoke('save-settings'),chooseVault:invoke('choose-vault'),
  habits:invoke('habits'),setHabit:invoke('set-habit'),openHabitRecord:invoke('open-habit-record'),goals:invoke('goals'),today:invoke('today'),history:invoke('history'),undo:invoke('undo'),openNote:invoke('open-note'),
  connect:invoke('connect'),tool:invoke('tool'),chat:invoke('chat'),stop:invoke('stop'),
  ready:invoke('ready'),resize:invoke('resize'),hide:invoke('hide'),enableShortcut:invoke('enable-shortcut'),
  onActivity:fn=>{ipcRenderer.on('activity',(_e,data)=>fn(data));},
  onActivate:fn=>{ipcRenderer.on('activate-voice',()=>fn());},
  onHide:fn=>{ipcRenderer.on('hide-voice',()=>fn());},
  onSettings:fn=>{ipcRenderer.on('open-settings',()=>fn());},
  onShortcut:fn=>{ipcRenderer.on('shortcut-status',(_e,active)=>fn(active));}
});
