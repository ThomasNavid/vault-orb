const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const {createWorkspace}=require('../src/workspace.cjs');
const main=path.resolve(__dirname,'../src/main.cjs'),source=fs.readFileSync(main,'utf8'),realRequire=createRequire(main);

function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-appearance-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
// Exercise the real trusted IPC handlers and disk writes, with Electron's OS surfaces mocked.
async function boot(userData){
  const handlers=new Map(),webContents=Object.assign(new EventEmitter(),{setWindowOpenHandler(){},send(){}});
  let ready,failWrite=false,vaultStarts=0;
  const app=Object.assign(new EventEmitter(),{getPath:()=>userData,requestSingleInstanceLock:()=>true,whenReady:()=>({then:fn=>{ready=Promise.resolve().then(fn);}})});
  const electron={app,protocol:{registerSchemesAsPrivileged(){},handle(){}},powerMonitor:new EventEmitter(),ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},
    BrowserWindow:class extends EventEmitter{constructor(){super();this.webContents=webContents;}setVisibleOnAllWorkspaces(){}loadFile(){}},
    Tray:class extends EventEmitter{setToolTip(){}},nativeImage:{createFromPath:()=>({setTemplateImage(){}})},
    Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},globalShortcut:{register(){}},
    session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}}},
    dialog:{showErrorBox:(_title,message)=>assert.fail(message)},safeStorage:{isEncryptionAvailable:()=>true}
  };
  const vault=realRequire('./vault.cjs');
  const load=name=>{
    if(name==='electron')return electron;
    if(name.endsWith('orb-shortcut.node'))return {start:()=>true,status:()=>({})};
    if(name==='./vault.cjs')return {...vault,Vault:class extends vault.Vault{constructor(...args){super(...args);vaultStarts++;}},atomicWrite:(file,text)=>{
      if(failWrite&&file===path.join(userData,'settings.json'))throw new Error('Simulated disk write failure');
      return vault.atomicWrite(file,text);
    }};
    return realRequire(name);
  };
  vm.runInNewContext(source,{require:load,__dirname:path.dirname(main),Buffer,AbortController,process,setTimeout,clearTimeout,setInterval:()=>({unref(){}}),console},{filename:main});
  await ready;
  const event={sender:webContents,senderFrame:{url:pathToFileURL(path.join(path.dirname(main),'index.html')).href}};
  return {invoke:(name,input)=>handlers.get(name)(event,input),untrusted:input=>handlers.get('save-appearance')({},input),failWrite:()=>{failWrite=true;},vaultStarts:()=>vaultStarts};
}

test('appearance IPC works before setup, preserves unrelated settings, and survives a fresh startup',async t=>{
  const dir=fixture(t),file=path.join(dir,'settings.json');
  const original={providerKeys:{openai:'encrypted-fixture'},calendarId:'fixture',autoStart:false};fs.writeFileSync(file,JSON.stringify(original));
  const first=await boot(dir);
  assert.equal((await first.invoke('settings')).appearance.orbColour,'#1f86ff');
  await first.invoke('save-appearance',{orbColour:'#EC4899',providerKeys:{}});
  assert.equal(first.vaultStarts(),0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{...original,appearance:{orbColour:'#ec4899'}});
  const second=await boot(dir);assert.equal((await second.invoke('settings')).appearance.orbColour,'#ec4899');
});

test('the layout choice is saved beside the colour, survives a restart, and rejects unknown views',async t=>{
  const dir=fixture(t),file=path.join(dir,'settings.json');
  const first=await boot(dir);
  assert.equal((await first.invoke('settings')).appearance.view,'classic');
  await first.invoke('save-appearance',{orbColour:'#1f86ff',view:'bar'});
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')).appearance,{orbColour:'#1f86ff',view:'bar'});
  // Changing only the colour must leave the chosen layout alone.
  await first.invoke('save-appearance',{orbColour:'#34d399'});
  assert.deepEqual((await first.invoke('settings')).appearance,{orbColour:'#34d399',view:'bar'});
  const before=fs.readFileSync(file,'utf8');
  for(const input of [{orbColour:'#34d399',view:'sidebar'},{orbColour:'#34d399',view:null}])await assert.rejects(first.invoke('save-appearance',input),/classic orb or the top bar/);
  assert.equal(fs.readFileSync(file,'utf8'),before);
  const second=await boot(dir);assert.equal((await second.invoke('settings')).appearance.view,'bar');
});

test('invalid/untrusted appearance IPC and failed writes leave disk and in-memory settings unchanged',async t=>{
  const dir=fixture(t),file=path.join(dir,'settings.json'),original={appearance:{orbColour:'#14b8a6'}};
  fs.writeFileSync(file,JSON.stringify(original));const app=await boot(dir),before=fs.readFileSync(file,'utf8');
  await assert.rejects(app.untrusted({orbColour:'#ffffff'}),/Untrusted/);
  for(const input of [undefined,null,{},'red',{orbColour:'#abc'}])await assert.rejects(app.invoke('save-appearance',input));
  app.failWrite();await assert.rejects(app.invoke('save-appearance',{orbColour:'#ffffff'}),/disk write failure/);
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal((await app.invoke('settings')).appearance.orbColour,'#14b8a6');
});

test('full settings save commits the colour atomically and older callers preserve it',async t=>{
  const dir=fixture(t),layout=createWorkspace(path.join(dir,'vault')),app=await boot(path.join(dir,'app'));
  await app.invoke('save-settings',{...layout,autoStart:false,appearance:{orbColour:'#8b5cf6'}});
  assert.equal((await app.invoke('settings')).appearance.orbColour,'#8b5cf6');
  await app.invoke('save-settings',{...layout,autoStart:true});
  assert.equal((await app.invoke('settings')).appearance.orbColour,'#8b5cf6');
  const starts=app.vaultStarts();await app.invoke('save-appearance',{orbColour:'#34d399'});assert.equal(app.vaultStarts(),starts);
  await assert.rejects(app.invoke('save-settings',{...layout,appearance:{orbColour:'#ffffff'},ai:{chat:{provider:'invalid'}}}));
  assert.equal((await app.invoke('settings')).appearance.orbColour,'#34d399');
});
