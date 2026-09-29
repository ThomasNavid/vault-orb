const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const {createWorkspace}=require('../src/workspace.cjs'),{ROOT}=require('../src/clippings.cjs');
const main=path.resolve(__dirname,'../src/main.cjs'),realRequire=createRequire(main);
async function boot(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-clips-ipc-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const layout=createWorkspace(path.join(dir,'vault')),userData=path.join(dir,'app');fs.mkdirSync(userData);fs.writeFileSync(path.join(userData,'settings.json'),JSON.stringify(layout));
 const handlers=new Map(),opened=[],webContents=Object.assign(new EventEmitter(),{setWindowOpenHandler(){},send(){}});let ready;
 const app=Object.assign(new EventEmitter(),{getPath:()=>userData,requestSingleInstanceLock:()=>true,whenReady:()=>({then:fn=>{ready=Promise.resolve().then(fn);}})});
 const electron={app,protocol:{registerSchemesAsPrivileged(){},handle(){}},powerMonitor:new EventEmitter(),ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},shell:{openExternal:async url=>opened.push(url)},
  BrowserWindow:class extends EventEmitter{constructor(){super();this.webContents=webContents;}setVisibleOnAllWorkspaces(){}loadFile(){}},
  Tray:class extends EventEmitter{setToolTip(){}},nativeImage:{createFromPath:()=>({setTemplateImage(){}})},Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},globalShortcut:{register(){}},session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}}},dialog:{showErrorBox:(_t,m)=>assert.fail(m)},safeStorage:{isEncryptionAvailable:()=>true}};
 vm.runInNewContext(fs.readFileSync(main,'utf8'),{require:name=>name==='electron'?electron:name.endsWith('orb-shortcut.node')?{start:()=>true,status:()=>({})}:realRequire(name),__dirname:path.dirname(main),Buffer,AbortController,process,setTimeout,clearTimeout,setInterval:()=>({unref(){}}),console},{filename:main});await ready;
 const trusted={sender:webContents,senderFrame:{url:pathToFileURL(path.join(path.dirname(main),'index.html')).href}};
 const put=(name,text)=>{const p=ROOT+'/Websites/'+name+'.md';fs.writeFileSync(path.join(layout.vaultPath,p),text);return p;};
 return {invoke:(name,args,event=trusted)=>handlers.get(name)(event,args),put,opened,layout,dir};
}
test('trusted clipping IPC shares retrieval and opens only a freshly read valid source inside the vault',async t=>{
 const app=await boot(t),p=app.put('Article','---\nsource: https://example.com/article\n---\nSaved body');
 assert.equal((await app.invoke('clippings',{query:'body'})).total,1);
 assert.equal((await app.invoke('clipping-note',p)).body,'Saved body');
 await assert.rejects(app.invoke('clippings',{},{}),/Untrusted/);
 await app.invoke('clipping-source',p);assert.deepEqual(app.opened,['https://example.com/article']);
 app.put('Article','---\nsource: javascript:alert(1)\n---\nSaved body');await assert.rejects(app.invoke('clipping-source',p),/valid HTTP/);assert.equal(app.opened.length,1);
 await assert.rejects(app.invoke('clipping-source','99. System/Assistant Guide.md'),/inside Web Clippings/);
 await assert.rejects(app.invoke('clipping-note',ROOT+'/../../outside.md'));
 const upper=ROOT+'/Websites/Upper.MD';fs.writeFileSync(path.join(app.layout.vaultPath,upper),'Uppercase Markdown');await app.invoke('open-note',upper);assert.match(app.opened.at(-1),/^obsidian:\/\/open/);
});
test('switching vault through settings cannot reuse another vault’s clipping revision or records',async t=>{
 const app=await boot(t);app.put('Private A','source only in first vault');const first=await app.invoke('clippings',{});
 const next=createWorkspace(path.join(app.dir,'next-vault'));await app.invoke('save-settings',{...next,autoStart:false});
 await assert.rejects(app.invoke('clippings',{revision:first.revision}),/Refresh/);
 const second=await app.invoke('clippings',{});assert.equal(second.total,0);assert.notEqual(second.revision,first.revision);
});
