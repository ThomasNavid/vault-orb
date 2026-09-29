const fs=require('node:fs');
const {TradingStore}=require('./trading212-store.cjs');
const {TradingSync}=require('./trading212-sync.cjs');
const {timeZone}=require('./trading212-metrics.cjs');
const {candidateCredentials,saveCredentials,publicTrading}=require('./trading212.cjs');
function createTradingService({directory,safeStorage,getConfig,saveConfig,getClient,clearClients,exportFile,syncOptions={}}){
 let store=null,sync=null,busy=false,startupError=null;
 const getStore=()=>store||(store=new TradingStore(directory,safeStorage));
 const preference=()=>getConfig().trading212Tracking||{enabled:false,timeZone:'Europe/London'};
 function current(){const client=getClient();if(!sync||sync.client!==client||sync.closed){sync?.stop();sync=new TradingSync({client,getStore,preferences:preference(),...syncOptions});}return sync;}
 async function reset(){if(sync)await sync.stop();sync=null;}
 async function status(){
  let live={enabled:false,timeZone:preference().timeZone||'Europe/London',error:startupError};
  if(getConfig().trading212?.key){try{const s=current();if(!s.key)await s.identify();live=s.status();}catch(e){live.error=e.message;}}
  const accounts=fs.existsSync(directory+'/history.sqlite')?getStore().accounts():[];
  return {...live,accounts,capabilities:getConfig().trading212Capabilities||null};
 }
 async function exclusive(fn){if(busy)throw new Error('Wait for the Trading 212 settings operation to finish.');busy=true;try{return await fn();}finally{busy=false;}}
 return {
  view:(args,options)=>current().view(args,options),
  start(){try{if(preference().enabled&&getConfig().trading212?.key)current().start();startupError=null;}catch(e){startupError=e.message;}},
  resume(){try{if(preference().enabled&&getConfig().trading212?.key){const s=current();s.schedule(0);}}catch(e){startupError=e.message;}},
  connect(input,options={}){return exclusive(async()=>{
   if(!input||!['test','save','disconnect'].includes(input.action))throw new Error('Unknown Trading 212 connection action.');
   if(input.action==='disconnect'){await reset();const next={...getConfig(),trading212Tracking:{...preference(),enabled:false}};delete next.trading212;delete next.trading212Capabilities;saveConfig(next);clearClients();return {trading212:publicTrading(next)};}
   const credentials=candidateCredentials(getConfig(),input,safeStorage),client=getClient(credentials),capabilities=await client.capabilities(options);options.signal?.throwIfAborted();
   if(capabilities.summary.state!=='available')throw new Error(capabilities.summary.message||'Account access is unavailable.');const check=await client.read('summary',options);
   if(input.action==='save'){await reset();const {accountKey}=require('./trading212-store.cjs');let identity=null;try{identity=accountKey(credentials.environment,check.data);}catch{}
    const previous=preference(),tracking=previous.accountKey===identity?previous:{enabled:false,timeZone:previous.timeZone||'Europe/London'};
    const next={...saveCredentials(getConfig(),credentials,safeStorage),trading212Capabilities:capabilities,trading212Tracking:tracking};saveConfig(next);clearClients(client);if(tracking.enabled)current().start();
   }
   return {trading212:publicTrading(getConfig()),currency:check.data.currency,checkedAt:check.updatedAt,capabilities};
  });},
  tracking(input={}){if(input.action==='status')return status();return exclusive(async()=>{
   if(!['enable','pause','resume','rescan','delete','export'].includes(input.action))throw new Error('Unknown investment-history action.');
   if(['export','delete'].includes(input.action)){
    if(typeof input.accountKey!=='string'||!fs.existsSync(directory+'/history.sqlite')||!getStore().accounts().some(a=>a.accountKey===input.accountKey))throw new Error('Choose an existing local investment history.');
    if(input.action==='export'){const data=getStore().export(input.accountKey);const saved=await exportFile(data);return {...await status(),exported:!!saved};}
    const active=preference().accountKey===input.accountKey;if(active){await reset();saveConfig({...getConfig(),trading212Tracking:{enabled:false,timeZone:preference().timeZone||'Europe/London'}});}getStore().remove(input.accountKey);return status();
   }
   if(input.action==='pause'){await reset();saveConfig({...getConfig(),trading212Tracking:{...preference(),enabled:false}});return status();}
   const s=current();if(!s.key)await s.identify();const key=s.key,zone=timeZone(input.timeZone||preference().timeZone||'Europe/London');
   await reset();saveConfig({...getConfig(),trading212Tracking:{enabled:true,accountKey:key,timeZone:zone}});
   const active=current();active.key=key;active.currency=s.currency;
   if(input.action==='rescan'){const meta=getStore().get(key,'meta','account');if(meta){meta.coverage={};getStore().put(key,'meta','account',meta);}}
   active.start();return status();
  });},
  async close(){await reset();store?.close();store=null;}
 };
}
module.exports={createTradingService};
