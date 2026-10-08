const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const {createWorkspace}=require('../src/workspace.cjs');
const main=path.resolve(__dirname,'../src/main.cjs'),realRequire=createRequire(main);
async function boot(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-habit-ipc-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const layout=createWorkspace(path.join(dir,'vault')),userData=path.join(dir,'app');fs.mkdirSync(userData);fs.writeFileSync(path.join(userData,'settings.json'),JSON.stringify(layout));
 const handlers=new Map(),opened=[],webContents=Object.assign(new EventEmitter(),{setWindowOpenHandler(){},send(){}});let ready;
 const app=Object.assign(new EventEmitter(),{getPath:()=>userData,requestSingleInstanceLock:()=>true,whenReady:()=>({then:fn=>{ready=Promise.resolve().then(fn);}})});
 const electron={app,protocol:{registerSchemesAsPrivileged(){},handle(){}},powerMonitor:new EventEmitter(),ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},shell:{openExternal:async url=>opened.push(url)},
  BrowserWindow:class extends EventEmitter{constructor(){super();this.webContents=webContents;}setVisibleOnAllWorkspaces(){}loadFile(){}},
  Tray:class extends EventEmitter{setToolTip(){}},nativeImage:{createFromPath:()=>({setTemplateImage(){}})},Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},globalShortcut:{register(){}},session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}}},dialog:{showErrorBox:(_t,m)=>assert.fail(m)},safeStorage:{isEncryptionAvailable:()=>true}};
 vm.runInNewContext(fs.readFileSync(main,'utf8'),{require:name=>name==='electron'?electron:name.endsWith('orb-shortcut.node')?{start:()=>true,status:()=>({})}:realRequire(name),__dirname:path.dirname(main),Buffer,AbortController,process,setTimeout,clearTimeout,setInterval:()=>({unref(){}}),console},{filename:main});await ready;
 const trusted={sender:webContents,senderFrame:{url:pathToFileURL(path.join(path.dirname(main),'index.html')).href}};
 return {invoke:(name,args,event=trusted)=>handlers.get(name)(event,args),layout,dir};
}
test('habit creation IPC requires a trusted sender, persists definitions and supports recent-change undo',async t=>{
 const app=await boot(t),initial=await app.invoke('habits',{});
 assert.equal(initial.can_create,true);assert.equal(initial.habits.length,0);
 const args={label:'Running',target:3,script_version:initial.script_version};
 await assert.rejects(app.invoke('create-habit',args,{}),/Untrusted/);
 const result=await app.invoke('create-habit',args);assert.equal(result.habit.label,'Running');
 const next=await app.invoke('habits',{});assert.equal(next.habits.length,1);assert.equal(next.habits[0].week_count,0);assert.equal(next.selected.version,null);
 await assert.rejects(app.invoke('create-habit',args),/changed/);
 await app.invoke('undo',result.change_id);assert.equal((await app.invoke('habits',{})).habits.length,0);
});
