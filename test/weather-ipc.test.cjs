const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const main=path.resolve(__dirname,'../src/main.cjs'),source=fs.readFileSync(main,'utf8'),realRequire=createRequire(main);

function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-weather-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
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
  return {invoke:(name,input)=>handlers.get(name)(event,input),untrusted:input=>handlers.get('save-weather')({},input),failWrite:()=>{failWrite=true;},vaultStarts:()=>vaultStarts};
}

const LONDON={name:'London',detail:'England, United Kingdom',latitude:51.5074,longitude:-0.1278,timezone:'Europe/London'};

test('weather settings save before setup, preserve unrelated settings, and survive a fresh startup',async t=>{
  const dir=fixture(t),file=path.join(dir,'settings.json');
  const original={providerKeys:{openai:'encrypted-fixture'},appearance:{orbColour:'#8b5cf6'},autoStart:false};fs.writeFileSync(file,JSON.stringify(original));
  const first=await boot(dir);
  assert.deepEqual((await first.invoke('settings')).weather,{location:null,units:'metric',orbReactions:true});
  const saved=await first.invoke('save-weather',{location:LONDON});
  assert.equal(saved.weather.location.latitude,51.51);assert.equal(first.vaultStarts(),0);
  await first.invoke('save-weather',{orbReactions:false});
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{...original,weather:{location:{...LONDON,latitude:51.51,longitude:-0.13},units:'metric',orbReactions:false}});
  const second=await boot(dir),weather=(await second.invoke('settings')).weather;
  assert.equal(weather.location.name,'London');assert.equal(weather.orbReactions,false);
  assert.equal((await second.invoke('settings')).appearance.orbColour,'#8b5cf6');
});

test('invalid or untrusted weather IPC and failed writes leave settings unchanged',async t=>{
  const dir=fixture(t),file=path.join(dir,'settings.json'),original={weather:{location:{...LONDON,latitude:51.51,longitude:-0.13},units:'metric',orbReactions:true}};
  fs.writeFileSync(file,JSON.stringify(original));const app=await boot(dir),before=fs.readFileSync(file,'utf8');
  await assert.rejects(app.untrusted({units:'imperial'}),/Untrusted/);
  for(const input of [undefined,null,'London',{units:'kelvin'},{orbReactions:'no'},{location:{name:'X',latitude:95,longitude:0}}])await assert.rejects(app.invoke('save-weather',input));
  app.failWrite();await assert.rejects(app.invoke('save-weather',{units:'imperial'}),/disk write failure/);
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal((await app.invoke('settings')).weather.units,'metric');
  await assert.rejects(app.invoke('weather',{when:'next week'}),/now, today, tonight or tomorrow/);
  await assert.rejects(app.invoke('weather-search',''),/Enter a place name/);
});
