const {createHash}=require('node:crypto');
const {accountKey}=require('./trading212-store.cjs');
const {rangeFor,timeZone,unrealised,performance,aggregate,percentage,publicCoverage}=require('./trading212-metrics.cjs');
const HISTORY=['cash','trades','dividends'];
function eventRecord(kind,source){const reference=kind==='trades'?source.fill?.id:source.reference,at=kind==='trades'?source.fill?.filledAt:kind==='cash'?source.dateTime:source.paidOn,id=createHash('sha256').update(kind+'\0'+(reference||JSON.stringify(source))).digest('hex'),revision=createHash('sha256').update(JSON.stringify(source)).digest('hex');return {id,revision,evidenceId:id+':'+revision,at:at||'',identityVerified:!!reference,source};}
class TradingSync {
 constructor({client,getStore,preferences={},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){this.client=client;this.getStore=getStore;this.preferences=preferences;this.now=now;this.setTimer=setTimer;this.clearTimer=clearTimer;this.controller=new AbortController();this.key=null;this.lastError=null;this.timer=null;this.running=null;this.captureTask=null;this.closed=false;}
 async identify(){const result=await this.client.read('summary',{signal:this.controller.signal});this.controller.signal.throwIfAborted();this.key=accountKey(this.client.credentials.environment,result.data);this.currency=result.data.currency;return result;}
 get enabled(){return this.preferences.enabled===true&&this.preferences.accountKey===this.key&&!this.closed;}
 store(){return this.getStore();}
 metadata(){return this.key?this.store().get(this.key,'meta','account'):null;}
 start(){if(this.preferences.enabled)this.schedule(0);}
 schedule(delay=10000){if(this.closed||this.timer)return;this.timer=this.setTimer(()=>{this.timer=null;this.tick().catch(e=>{if(!this.closed)this.lastError=e.message;}).finally(()=>{if(!this.closed&&this.preferences.enabled)this.schedule(this.lastError?60000:10000);});},delay);this.timer?.unref?.();}
 async tick(){if(this.running)return this.running;this.running=this.runTick().finally(()=>{this.running=null;});return this.running;}
 async runTick(){
  if(!this.key)await this.identify();if(!this.enabled)return;this.lastError=null;
  const meta=this.metadata()||{environment:this.client.credentials.environment,currency:this.currency,timeZone:this.preferences.timeZone||'Europe/London',createdAt:new Date(this.now()).toISOString(),coverage:{}};
  if(!meta.lastCapture||this.now()-Date.parse(meta.lastCapture)>=(this.activeUntil>this.now()?60000:5*60000))await this.capture();
  for(const kind of HISTORY){if(!this.enabled)return;try{await this.syncPage(kind);}catch(e){this.controller.signal.throwIfAborted();const current=this.metadata();if(current){current.coverage[kind]={...current.coverage[kind],error:e.message,retryAt:e.retryAt||null};this.store().put(this.key,'meta','account',current);}this.lastError=e.message;}}
 }
 async capture(){
  if(this.captureTask)return this.captureTask;
  this.captureTask=(async()=>{
   const captureStart=new Date(this.now()).toISOString();const results=await Promise.allSettled([this.client.read('summary',{signal:this.controller.signal}),this.client.read('holdings',{signal:this.controller.signal})]);this.controller.signal.throwIfAborted();
   if(results[0].status==='rejected')throw results[0].reason;const summary=results[0].value,key=accountKey(this.client.credentials.environment,summary.data);
   if(this.key&&key!==this.key)throw new Error('The broker account changed. Reconnect before recording more history.');this.key=key;this.currency=summary.data.currency;if(!this.enabled)return;
   const {id:brokerId,...publicSummary}=summary.data;const at=summary.updatedAt,id='valuation:'+at+':'+createHash('sha256').update(JSON.stringify(publicSummary)).digest('hex').slice(0,16),observation={id,at,captureStart:summary.cached?at:captureStart,captureEnd:new Date(this.now()).toISOString(),summary:publicSummary};
   const store=this.store();store.batch(()=>{const meta=this.metadata()||{createdAt:at,coverage:{}};Object.assign(meta,{environment:this.client.credentials.environment,currency:this.currency,timeZone:this.preferences.timeZone||'Europe/London',lastCapture:at});store.put(key,'observation',id,observation,at);if(results[1].status==='fulfilled')store.put(key,'holding-observation',id,{id,at:results[1].value.updatedAt,items:results[1].value.data},at);store.put(key,'meta','account',meta);store.pruneHoldings(key,new Date(this.now()-90*86400000).toISOString());});
  })().finally(()=>{this.captureTask=null;});return this.captureTask;
 }
 async syncPage(kind){
  const store=this.store(),meta=this.metadata();if(!meta)return;let coverage=meta.coverage[kind]||{};
  if(coverage.error&&coverage.retryAt&&coverage.retryAt>this.now())return;
  if(!coverage.scan&&coverage.through&&this.now()-Date.parse(coverage.through)<5*60000)return;
  let scan=coverage.scan||{startedAt:new Date(this.now()).toISOString(),next:null,seen:[],pages:0,incremental:!!coverage.complete,overlapBefore:new Date(this.now()-7*86400000).toISOString()};
  const response=await this.client.read(kind,{nextPagePath:scan.next,signal:this.controller.signal});this.controller.signal.throwIfAborted();if(!this.enabled)return;
  scan={...scan,startedAt:response.updatedAt<scan.startedAt?response.updatedAt:scan.startedAt};
  const records=response.data.items.map(item=>eventRecord(kind,item));
  const next=response.data.nextPagePath;const path=scan.next||'first';if(scan.seen.includes(path)||next&&scan.seen.includes(next))throw new Error('Trading 212 returned a history cursor loop. Rescan this history.');
  // The beta API does not promise event ordering. Only exhaustion proves coverage.
  const complete=!next;scan={...scan,pages:scan.pages+1,seen:[...scan.seen,path],next};if(scan.pages>20000)throw new Error('History sync reached its page safety limit. Export or narrow the history before continuing.');
  store.batch(()=>{let revisions=coverage.revisionCount||0;for(const r of records){const previous=store.get(this.key,kind,r.id);if(previous&&previous.revision!==r.revision)revisions++;if(!previous||previous.revision!==r.revision){store.put(this.key,kind+'-revision',r.evidenceId,r,r.at||response.updatedAt);store.put(this.key,kind,r.id,r,r.at||response.updatedAt);}}const current=this.metadata();current.coverage[kind]={revisionCount:revisions,complete:complete||!!coverage.complete,through:complete?scan.startedAt:coverage.through||null,lastPageAt:response.updatedAt,pages:scan.pages,scan:complete?null:scan,error:null,retryAt:null};store.put(this.key,'meta','account',current);});
 }
 async stop(){this.closed=true;this.controller.abort();if(this.timer)this.clearTimer(this.timer);this.timer=null;await Promise.allSettled([this.running,this.captureTask].filter(Boolean));}
 status(){if(!this.key)return {enabled:false,reason:this.lastError||'Open the dashboard to identify the connected account.'};let meta=null,stats={records:0,bytes:0};try{if(this.preferences.accountKey===this.key){meta=this.metadata();stats=this.store().stats(this.key);}}catch(e){return {enabled:this.enabled,accountKey:this.key,error:e.message};}return {enabled:this.enabled,accountKey:this.key,environment:this.client.credentials.environment,currency:this.currency,timeZone:this.preferences.timeZone||'Europe/London',lastCapture:meta?.lastCapture||null,coverage:publicCoverage(meta?.coverage),...stats,error:this.lastError};}
 async view(args={},options={}){
  const allowed=['view','nextPagePath','connectionId','accountKey','metric','period','start','end','instrument','groupBy'];if(!args||typeof args!=='object'||Object.keys(args).some(k=>!allowed.includes(k)))throw new Error('Invalid Trading 212 request.');
  if(!this.key)try{await this.identify();}catch(e){if(args.accountKey||args.view==='performance'||args.view==='query')throw e;}
  if(args.accountKey&&args.accountKey!==this.key)throw new Error('This saved card belongs to another account. Connect that account before refreshing.');
  if(args.instrument!=null&&(typeof args.instrument!=='string'||args.instrument.length>300))throw new Error('Invalid instrument.');if(args.groupBy!=null&&!['month','instrument','category'].includes(args.groupBy))throw new Error('Invalid grouping.');
  if(this.enabled)this.activeUntil=this.now()+60000;
  if(args.view==='instrument'){
   if(!args.instrument)throw new Error('Choose a holding.');const response=await this.client.read('holdings',options),position=response.data.find(h=>h.instrument?.ticker===args.instrument);if(!position)throw new Error('This instrument is no longer an open holding. Its ledger remains available in Activity.');
   let prices=[],trades=[],coverage={};if(this.preferences.accountKey===this.key){prices=this.store().recent(this.key,'holding-observation',200).flatMap(o=>{const h=o.items.find(h=>h.instrument?.ticker===args.instrument);return h?[{at:o.at,price:h.currentPrice,currency:h.instrument?.currency}]:[];}).reverse();trades=this.store().list(this.key,'trades').filter(e=>(e.source.order?.instrument?.ticker||e.source.order?.ticker)===args.instrument).slice(-100).reverse();coverage=this.metadata()?.coverage||{};}
   return {kind:'trading212',view:'instrument',schemaVersion:2,accountKey:this.key,environment:this.client.credentials.environment,position,prices,trades,coverage:publicCoverage(coverage),updatedAt:response.updatedAt,query:{instrument:args.instrument},warnings:[],readOnly:true};
  }
  if(['performance','query'].includes(args.view))return this.query(args);
  const data=await this.client.view(args,options);options.signal?.throwIfAborted();data.accountKey=this.key;data.schemaVersion=2;
  if(data.summary)data.unrealised=unrealised(data.summary);
  if(data.view==='holdings'){
   const currencies=new Set(data.items.map(h=>h.walletImpact?.currency)),valid=currencies.size===1&&[...currencies][0]&&data.items.every(h=>typeof h.walletImpact?.currentValue==='number'&&h.walletImpact.currentValue>=0),total=valid?data.items.reduce((sum,h)=>sum+h.walletImpact.currentValue,0):null;
   data.items=data.items.map(h=>({...h,returnPercentage:percentage(h.walletImpact?.exact?.unrealizedProfitLoss??h.walletImpact?.unrealizedProfitLoss,h.walletImpact?.exact?.totalCost??h.walletImpact?.totalCost),weightPercentage:total>0?h.walletImpact.currentValue/total*100:null}));
  }
  if(data.view==='overview'){data.performance=this.calculate({metric:'account_performance',period:'today'});if(this.enabled)this.schedule(0);}
  return data;
 }
 calculate(args){
  const zone=timeZone(this.preferences.timeZone||'Europe/London'),now=this.now(),range=rangeFor(args.period||'today',zone,now,args);let observations=[],events={},coverage={};
  if(this.key&&this.preferences.accountKey===this.key){const store=this.store();observations=store.list(this.key,'observation');coverage=this.metadata()?.coverage||{};for(const kind of HISTORY)events[kind]=store.list(this.key,kind);}
  const input={observations,events,coverage,range,now,currency:this.currency||observations.at(-1)?.summary.currency,tracking:observations.length>0||this.enabled,instrument:args.instrument||null,groupBy:args.groupBy||null};
  const metric=args.metric||'account_performance';if(metric==='account_performance')return performance(input);return aggregate({...input,metric});
 }
 query(args){
  args={...args,metric:args.view==='performance'?'account_performance':args.metric};
  const metric=this.calculate(args),base={kind:'trading212',view:args.view==='performance'?'performance':'query',schemaVersion:2,accountKey:this.key,environment:this.client.credentials.environment,readOnly:true,source:'Trading 212 Public API · local observations',updatedAt:metric.freshness.asOf,metric,query:{metric:args.metric||'account_performance',period:args.period||'today',start:args.start||null,end:args.end||null,instrument:args.instrument||null,groupBy:args.groupBy||null},warnings:[]};
  if(base.query.metric==='account_performance'&&this.key&&this.preferences.accountKey===this.key){const store=this.store(),observations=store.list(this.key,'observation'),events={cash:store.list(this.key,'cash'),trades:store.list(this.key,'trades')},coverage=this.metadata()?.coverage||{},start=metric.actual?.start||metric.requested.start;
   const selected=observations.filter(o=>(!start||o.at>=start)&&o.at<=metric.requested.end),stride=Math.max(1,Math.ceil(selected.length/100));base.series=selected.filter((_,i)=>i%stride===0||i===selected.length-1).map(o=>{const result=performance({observations,events,coverage,range:{...metric.requested,end:o.at},now:this.now(),tracking:true});return {at:o.at,value:o.summary.totalValue,returnPercentage:result.percentage,gain:result.amount,status:result.status};});base.seriesSampled=stride>1;const funding=events.cash.filter(e=>(!start||e.at>=start)&&e.at<=metric.requested.end&&['DEPOSIT','WITHDRAW'].includes(e.source.type));base.fundingEvents=funding.slice(-100).map(e=>({at:e.at,type:e.source.type,amount:e.source.amount,currency:e.source.currency}));base.fundingEventsTruncated=funding.length>100;}
  if(this.enabled)this.schedule(0);return base;
 }
}
module.exports={TradingSync,eventRecord};
