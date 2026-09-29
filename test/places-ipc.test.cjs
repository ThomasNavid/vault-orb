const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const {createWorkspace}=require('../src/workspace.cjs');
const main=path.resolve(__dirname,'../src/main.cjs'),realRequire=createRequire(main);
async function boot(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-places-ipc-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const created=createWorkspace(path.join(dir,'vault'));fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({...created,weather:{units:'imperial'}}));
 const handlers=new Map(),opened=[],events=[],webContents=Object.assign(new EventEmitter(),{setWindowOpenHandler(){},send:(...args)=>events.push(args)});let ready;
 const app=Object.assign(new EventEmitter(),{getPath:()=>dir,requestSingleInstanceLock:()=>true,whenReady:()=>({then:fn=>{ready=Promise.resolve().then(fn);}})});
 const electron={app,protocol:{registerSchemesAsPrivileged(){},handle(){}},powerMonitor:new EventEmitter(),ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},shell:{openExternal:async url=>opened.push(url)},BrowserWindow:class extends EventEmitter{constructor(){super();this.webContents=webContents;}setVisibleOnAllWorkspaces(){}loadFile(){}},Tray:class extends EventEmitter{setToolTip(){}},nativeImage:{createFromPath:()=>({setTemplateImage(){}})},Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},globalShortcut:{register(){}},session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}}},dialog:{showErrorBox:(_title,message)=>assert.fail(message)},safeStorage:{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('fixture:'+s),decryptString:b=>b.toString().slice(8)}};
 const load=name=>name==='electron'?electron:name.endsWith('orb-shortcut.node')?{start:()=>true,status:()=>({})}:name.endsWith('orb-location.node')?{locate:async()=>({latitude:51.5,longitude:-.1,accuracy:50})}:realRequire(name);
 vm.runInNewContext(fs.readFileSync(main,'utf8'),{require:load,__dirname:path.dirname(main),Buffer,AbortController,AbortSignal,process,setTimeout,clearTimeout,setInterval:()=>({unref(){}}),console},{filename:main});await ready;
 const event={sender:webContents,senderFrame:{url:pathToFileURL(path.join(path.dirname(main),'index.html')).href}};
 return {dir,opened,events,invoke:(name,input)=>handlers.get(name)(event,input),untrusted:(name,input)=>handlers.get(name)({},input)};
}
test('Places IPC preserves settings and credentials, resolves saved-note directions, and rejects untrusted actions',async t=>{
 const app=await boot(t);await assert.rejects(app.untrusted('save-places',{key:'fixture'}),/Untrusted/);
 const saved=await app.invoke('save-places',{key:'fixture',directionsApp:'google',defaultArea:'Example town'});assert.equal(saved.places.configured,true);assert.equal((await app.invoke('settings')).weather.units,'imperial');assert.equal(JSON.stringify(saved).includes('encryptedKey'),false);
 const place=await app.invoke('places',{action:'save',place:{name:'Example café',location:'Example street',latitude:51.5,longitude:-.1}});const listed=await app.invoke('places',{action:'list'});assert.equal(listed.results.length,1);
 await app.invoke('places',{action:'directions',id:listed.results[0].id,app:'google'});assert.match(app.opened[0],/^https:\/\/www.google.com\/maps\/dir\//);assert.match(app.opened[0],/travelmode=walking/);
 await app.invoke('places',{action:'note',path:place.path,vaultId:listed.vaultId});assert.match(app.opened[1],/^obsidian:\/\/open/);
 await assert.rejects(app.invoke('places',{action:'note',path:'../escape.md',vaultId:listed.vaultId}),/Places/);
 await assert.rejects(app.invoke('places',{action:'directions',destination:{name:'malicious',location:'javascript:alert(1)'},app:'javascript'}),/Apple Maps/);
 const fix=await app.invoke('places-location');assert.ok(fix.originId);assert.equal(fix.latitude,undefined);
});
