const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Trading212,project}=require('../src/trading212.cjs');
const {parseJSON,Decimal}=require('../src/trading212-numbers.cjs');
const {TradingStore,accountKey}=require('../src/trading212-store.cjs');
const {TradingSync,eventRecord}=require('../src/trading212-sync.cjs');
const {createTradingService}=require('../src/trading212-service.cjs');
const {rangeFor,performance,aggregate,unrealised}=require('../src/trading212-metrics.cjs');
const keyStorage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('fixture-encrypted:'+s),decryptString:b=>b.toString().slice(18)};
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-212-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function summary(value=1000,id='123'){return {id,currency:'GBP',totalValue:value,cash:{availableToTrade:0,inPies:0,reservedForOrders:0},investments:{currentValue:value,totalCost:800,unrealizedProfitLoss:value-800,realizedProfitLoss:0}};}
const start='2026-09-29T00:00:00.000Z',end='2026-09-29T12:00:00.000Z',middle='2026-09-29T06:00:00.000Z';
const observation=(at,value)=>({id:'valuation:'+at,at,captureStart:at,captureEnd:at,summary:summary(value)});
const coverage={cash:{complete:true,through:end},trades:{complete:true,through:end},dividends:{complete:true,through:end}};
const cash=(type,amount,at=middle,currency='GBP',reference='event-1')=>eventRecord('cash',{reference,type,amount,currency,dateTime:at});
function input(endValue=1050,events={cash:[],trades:[]}){return {observations:[observation(start,1000),observation(end,endValue)],events,coverage,range:{period:'today',timeZone:'UTC',start,end},now:Date.parse(end)};}

test('lossless ingestion preserves int64 identity and original decimal precision',async()=>{
 const data=project('summary',parseJSON('{"id":9007199254740993123,"currency":"GBP","totalValue":1000.123456789012345678}'));
 assert.equal(data.id,'9007199254740993123');assert.equal(data.exact.totalValue,'1000.123456789012345678');
 assert.equal(Decimal.from('0.1').add('0.2').sub('0.3').number(),0);
 const api=new Trading212({environment:'demo',key:'fixture',secret:'fixture'},{fetchImpl:async url=>new Response(url.includes('summary')?'{"id":9007199254740993123,"currency":"GBP","totalValue":1000}':'[]')});
 const v=await api.view();assert.equal(v.summary.id,undefined);assert.doesNotMatch(JSON.stringify(v),/9007199254740993123/);api.dispose();
});
test('basic return, funding and Modified Dietz use the correct denominator',()=>{
 for(const [value,flows,gain,percent]of [[1050,[],50,5],[1500,[cash('DEPOSIT',500)],0,0],[800,[cash('WITHDRAW',200)],0,0],[800,[cash('WITHDRAW',-200)],0,0],[1600,[cash('DEPOSIT',500)],100,8]]){const r=performance(input(value,{cash:flows,trades:[]}));assert.equal(r.amount,gain);assert.equal(r.percentage,percent);if(flows.length)assert.equal(r.status,'estimated');}
 assert.equal(unrealised(summary()).percentage,25);assert.equal(unrealised({investments:{unrealizedProfitLoss:10,totalCost:0}}).percentage,null);
});
test('internal trading, dividend cash and fees are not external contributions',()=>{
 const trade=eventRecord('trades',{fill:{id:'fill',filledAt:middle,type:'TRADE',walletImpact:{netValue:-300,currency:'GBP'}}});
 assert.equal(performance(input(1000,{cash:[cash('INTEREST_ON_FREE_CASH',10)],trades:[trade]})).amount,0);
 assert.equal(performance(input(990,{cash:[cash('FEE',-10)],trades:[]})).amount,-10);
 const split=eventRecord('trades',{fill:{id:'split',filledAt:middle,type:'STOCK_SPLIT'}});assert.equal(performance(input(1000,{cash:[],trades:[split]})).percentage,0);
});
test('missing fill/cash coverage, foreign funding and transfers cannot become profit',()=>{
 for(const kind of ['cash','trades']){const x=input();x.coverage={...coverage,[kind]:{complete:false}};assert.equal(performance(x).status,'unavailable');}
 for(const events of [{cash:[cash('TRANSFER',500)],trades:[]},{cash:[cash('DEPOSIT',500,middle,'USD')],trades:[]},{cash:[],trades:[eventRecord('trades',{fill:{id:'transfer',type:'FOP',filledAt:middle}})]}])assert.equal(performance(input(1500,events)).status,'unavailable');
 const x=input();x.events.cash=[cash('DEPOSIT',10,middle,'GBP',null)];assert.match(performance(x).reason,/references/);
});
test('missing baselines, capture-boundary flows and inconsistent totals remain unavailable',()=>{
 const x=input();x.range={...x.range,start:'2026-09-28T23:00:00Z'};assert.match(performance(x).reason,/opening valuation/);
 for(const at of [start,end])assert.match(performance(input(1500,{cash:[cash('DEPOSIT',500,at)],trades:[]})).reason,/coincides/);
 const zero=input();zero.observations=[observation(start,1000),observation(start,1000)];assert.equal(performance(zero).status,'unavailable');
 const bad=input();bad.observations[1].summary.cash.availableToTrade=50;assert.match(performance(bad).reason,/reconcile/);
 const missing=input();delete missing.observations[0].summary.cash.inPies;assert.match(performance(missing).reason,/missing/);
});
test('an approximate day boundary is labelled; older observations are not silently carried forward',()=>{
 const x=input();x.observations[0]=observation('2026-09-29T00:02:00.000Z',1000);assert.equal(performance(x).status,'estimated');assert.equal(performance(x).actual.start,x.observations[0].at);
 x.observations[0]=observation('2026-09-29T00:06:00.000Z',1000);assert.equal(performance(x).status,'unavailable');
});
test('fresh valuations ahead of verified history use a labelled earlier close',()=>{
 const x=input();x.observations.push(observation('2026-09-29T12:05:00.000Z',1200));x.range.end='2026-09-29T12:05:00.000Z';x.now=Date.parse(x.range.end);const r=performance(x);assert.equal(r.actual.end,end);assert.equal(r.amount,50);
});
test('calendar boundaries use the configured timezone and UK tax year',()=>{
 assert.equal(rangeFor('today','Europe/London',Date.parse('2026-09-29T12:00:00Z')).start,'2026-09-28T23:00:00.000Z');
 const spring=rangeFor('custom','Europe/London',Date.parse('2026-03-30T12:00:00Z'),{start:'2026-03-29',end:'2026-03-29'});assert.equal(Date.parse(spring.end)-Date.parse(spring.start),23*3600000);
 assert.equal(rangeFor('tax_year','Europe/London',Date.parse('2026-04-05T12:00:00Z')).start,'2025-04-05T23:00:00.000Z');
 assert.throws(()=>rangeFor('custom','UTC',Date.now(),{start:'2026-02-30',end:'2026-03-01'}),/Invalid/);
});
test('income is decimal-safe, separates currencies/categories and preserves partial coverage',()=>{
 const dividends=[eventRecord('dividends',{reference:'d1',paidOn:middle,amount:.1,currency:'GBP',type:'ORDINARY'}),eventRecord('dividends',{reference:'d2',paidOn:middle,amount:.2,currency:'GBP',type:'ORDINARY'}),eventRecord('dividends',{reference:'d3',paidOn:middle,amount:2,currency:'USD',type:'OTHER'})];
 const r=aggregate({metric:'income',range:input().range,now:Date.parse(end),events:{dividends,cash:[cash('INTEREST_ON_FREE_CASH',.3)]},coverage,groupBy:'month'});assert.deepEqual(r.totals,[{currency:'GBP',amount:.6},{currency:'USD',amount:2}]);assert.equal(r.amount,null);assert.equal(r.status,'available');
 assert.equal(aggregate({metric:'dividends',range:input().range,events:{dividends},coverage:{}}).status,'partial');
});
test('encrypted SQLite persists, isolates accounts, rolls back and rejects tampering',t=>{
 const dir=temp(t),store=new TradingStore(dir,keyStorage),one=accountKey('live',summary()),two=accountKey('demo',summary());
 store.put(one,'meta','account',{environment:'live',currency:'GBP',private:'Confidential fixture holding'});store.put(two,'meta','account',{environment:'demo',currency:'GBP'});
 assert.throws(()=>store.batch(()=>{store.put(one,'cash','fail',{x:1});throw new Error('interruption');}),/interruption/);assert.equal(store.get(one,'cash','fail'),null);
 store.close();assert.doesNotMatch(fs.readFileSync(path.join(dir,'history.sqlite')).toString(),/Confidential fixture holding/);
 const reopened=new TradingStore(dir,keyStorage);assert.equal(reopened.get(one,'meta','account').private,'Confidential fixture holding');assert.equal(reopened.accounts().length,2);
 const payload=reopened.db.prepare('SELECT payload FROM records WHERE account=?').get(one).payload;reopened.db.prepare('UPDATE records SET payload=? WHERE account=?').run(payload,two);assert.throws(()=>reopened.get(two,'meta','account'),/decrypted/);
 reopened.remove(two);assert.equal(reopened.get(two,'meta','account'),null);assert.ok(reopened.get(one,'meta','account'));reopened.close();
 fs.unlinkSync(path.join(dir,'key'));assert.throws(()=>new TradingStore(dir,keyStorage),/key is missing/);
});
test('no encryption fallback and unknown schema versions fail closed',t=>{
 assert.throws(()=>new TradingStore(temp(t),{isEncryptionAvailable:()=>false}),/encryption/);const dir=temp(t),store=new TradingStore(dir,keyStorage);store.db.exec('PRAGMA user_version=9');store.close();assert.throws(()=>new TradingStore(dir,keyStorage),/newer Orb/);
});
function syncFixture(t,{pages={},now=Date.parse(end)}={}){
 const dir=temp(t),store=new TradingStore(dir,keyStorage);t.after(()=>store.close());let time=now;const calls=[];
 const client={credentials:{environment:'demo'},read:async(kind,{nextPagePath,signal}={})=>{signal?.throwIfAborted();calls.push([kind,nextPagePath]);const at=new Date(time).toISOString();if(kind==='summary')return {data:summary(),updatedAt:at};if(kind==='holdings')return {data:[],updatedAt:at};return {data:pages[kind]?.(nextPagePath)||{items:[],nextPagePath:null},updatedAt:at};},view:async()=>({kind:'trading212',view:'overview',summary:summary(),updatedAt:new Date(time).toISOString()})};
 const key=accountKey('demo',summary()),preferences={enabled:true,accountKey:key,timeZone:'UTC'},sync=new TradingSync({client,getStore:()=>store,preferences,now:()=>time,setTimer:()=>({unref(){}}),clearTimer:()=>{}});t.after(()=>sync.stop());return {sync,store,key,calls,advance:ms=>time+=ms,client};
}
test('sync resumes pages after restart, upserts overlaps and never assumes short pages mean complete',async t=>{
 const item={reference:'r1',dateTime:middle,type:'DEPOSIT',amount:10,currency:'GBP'},f=syncFixture(t,{pages:{cash:cursor=>({items:[item],nextPagePath:cursor?null:'/page2'})}});
 await f.sync.tick();assert.equal(f.store.list(f.key,'cash').length,1);assert.equal(f.sync.metadata().coverage.cash.complete,false);assert.equal(f.sync.metadata().coverage.cash.scan.next,'/page2');await f.sync.stop();
 const resumed=new TradingSync({client:f.client,getStore:()=>f.store,preferences:f.sync.preferences,setTimer:()=>0});t.after(()=>resumed.stop());await resumed.tick();assert.equal(f.store.list(f.key,'cash').length,1);assert.equal(resumed.metadata().coverage.cash.complete,true);
 assert.equal(f.calls.filter(([kind,p])=>kind==='cash').at(-1)[1],'/page2');
});
test('cursor loops are surfaced without corrupting existing history',async t=>{
 const f=syncFixture(t,{pages:{cash:cursor=>({items:[],nextPagePath:cursor==='/a'?'/b':'/a'})}});await f.sync.tick();await f.sync.tick();await f.sync.tick();assert.match(f.sync.metadata().coverage.cash.error,/loop/);assert.equal(f.sync.metadata().coverage.cash.complete,false);
});
test('pause aborts in-flight work; another account cannot reuse preferences or a saved card',async t=>{
 const f=syncFixture(t);await f.sync.tick();await assert.rejects(()=>f.sync.view({view:'overview',accountKey:'different'}),/another account/);
 const other=new TradingSync({client:{...f.client,read:async()=>({data:summary(1000,'999'),updatedAt:end})},getStore:()=>f.store,preferences:f.sync.preferences});await other.tick();assert.equal(other.enabled,false);assert.equal(f.store.list(other.key,'observation').length,0);await other.stop();
 const before=f.store.list(f.key,'observation').length,resolvers=[];
 f.client.read=async()=>new Promise(resolve=>resolvers.push(resolve));const pending=f.sync.capture();await Promise.resolve();const stopped=f.sync.stop();assert.equal(f.sync.controller.signal.aborted,true);
 resolvers[0]({data:summary(),updatedAt:end});resolvers[1]({data:[],updatedAt:end});await assert.rejects(pending,{name:'AbortError'});await stopped;assert.equal(f.store.list(f.key,'observation').length,before);
});
test('capability diagnostics distinguish summary-only access from full access',async()=>{
 const client=new Trading212({environment:'demo',key:'fixture',secret:'fixture'},{fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/summary')?summary():{}),{status:url.endsWith('/summary')?200:403})});const r=await client.capabilities();assert.equal(r.summary.state,'available');assert.equal(r.cash.state,'denied');assert.equal(r.trades.permission,'History orders');client.dispose();
});

test('service keeps browsing storage-free; tracking is opt-in and account-bound',async t=>{
 const directory=path.join(temp(t),'history');let config={trading212:{key:'saved',secret:'saved',environment:'demo'}},id='123';
 const client={credentials:{environment:'demo'},read:async()=>({data:summary(1000,id),updatedAt:end}),view:async()=>({kind:'trading212',view:'overview',summary:summary(),holdings:[],updatedAt:end}),capabilities:async()=>({summary:{state:'available',permission:'Accounts data'},cash:{state:'denied',permission:'History transactions'}})};
 const service=createTradingService({directory,safeStorage:keyStorage,getConfig:()=>config,saveConfig:c=>config=c,getClient:()=>client,clearClients:()=>{},exportFile:async()=>true,syncOptions:{setTimer:()=>0,clearTimer:()=>{},now:()=>Date.parse(end)}});t.after(()=>service.close());
 const overview=await service.view({view:'overview'});assert.equal(overview.performance.status,'unavailable');assert.equal(fs.existsSync(directory),false);await service.tracking({action:'status'});assert.equal(fs.existsSync(directory),false);
 await service.tracking({action:'enable',timeZone:'UTC'});assert.equal(config.trading212Tracking.enabled,true);assert.ok(fs.existsSync(directory));const identity=config.trading212Tracking.accountKey;
 await service.tracking({action:'pause'});assert.equal(config.trading212Tracking.enabled,false);assert.equal(config.trading212Tracking.accountKey,identity);
 await service.tracking({action:'resume'});assert.equal(config.trading212Tracking.enabled,true);
 await service.connect({action:'save',environment:'demo',key:'rotated',secret:'rotated'});assert.equal(config.trading212Tracking.accountKey,identity);assert.equal(config.trading212Tracking.enabled,true);
 id='999';await service.connect({action:'save',environment:'demo',key:'different',secret:'different'});assert.equal(config.trading212Tracking.enabled,false);assert.equal(config.trading212Tracking.accountKey,undefined);
 await service.connect({action:'disconnect'});assert.equal(config.trading212,undefined);assert.equal(config.trading212Tracking.enabled,false);
});
test('saved account history remains exportable/deletable after disconnect without reconnecting',async t=>{
 const directory=temp(t),key=accountKey('demo',summary());const seed=new TradingStore(directory,keyStorage);seed.put(key,'meta','account',{currency:'GBP',environment:'demo',createdAt:start});seed.put(key,'observation','snapshot',{private:'fictional financial record'});seed.close();let config={};let exported;
 const service=createTradingService({directory,safeStorage:keyStorage,getConfig:()=>config,saveConfig:c=>config=c,getClient:()=>{throw new Error('Not connected');},clearClients:()=>{},exportFile:async value=>{exported=value;return true;}});t.after(()=>service.close());
 assert.equal((await service.tracking({action:'status'})).accounts.length,1);assert.equal((await service.tracking({action:'export',accountKey:key})).exported,true);assert.equal(exported.records.length,2);
 assert.equal((await service.tracking({action:'delete',accountKey:key})).accounts.length,0);await assert.rejects(()=>service.tracking({action:'export',accountKey:key}),/existing/);
});

test('a large observed history produces a bounded chart and exportable evidence',t=>{
 const f=syncFixture(t),begin=Date.parse(start),count=5000,latest=new Date(begin+(count-1)*300000).toISOString();
 f.store.batch(()=>{for(let i=0;i<count;i++){const o=observation(new Date(begin+i*300000).toISOString(),1000+i/100);f.store.put(f.key,'observation',o.id,o,o.at);}f.store.put(f.key,'meta','account',{environment:'demo',currency:'GBP',coverage:{cash:{complete:true,through:latest},trades:{complete:true,through:latest}}});});
 f.sync.key=f.key;f.sync.now=()=>Date.parse(latest);const before=performanceNow(),result=f.sync.query({view:'performance',metric:'account_performance',period:'tracking'});t.diagnostic(`5,000 observations: chart query ${Math.round(performanceNow()-before)} ms`);assert.ok(result.series.length<=101);assert.equal(result.metric.amount,49.99);assert.ok(JSON.stringify(result).length<50000);
});
function performanceNow(){return require('node:perf_hooks').performance.now();}

test('assistant and dashboard use identical deterministic period metrics',async t=>{
 const {Agent}=require('../src/agent.cjs'),f=syncFixture(t);f.sync.key=f.key;f.sync.currency='GBP';f.store.batch(()=>{for(const o of input().observations)f.store.put(f.key,'observation',o.id,o,o.at);f.store.put(f.key,'meta','account',{environment:'demo',currency:'GBP',coverage});});
 const args={view:'performance',nextPagePath:null,connectionId:null,metric:'account_performance',period:'today',start:null,end:null,instrument:null,groupBy:null},visuals=[];
 const dashboard=await f.sync.view(args),agent=new Agent({vault:{},getKey:()=>'',getTrading212:(a,o)=>f.sync.view(a,o),onActivity:e=>{if(e.kind==='visual')visuals.push(e.visual);}});const answer=await agent.execute('trading212',args);
 assert.deepEqual(answer.metric,dashboard.metric);assert.equal(answer.metric.percentage,5);assert.deepEqual(visuals[0].metric,dashboard.metric);
});
test('complete empty income is zero; missing coverage is not zero',()=>{
 const base={metric:'income',events:{},range:input().range,currency:'GBP',now:Date.parse(end)};assert.deepEqual(aggregate({...base,coverage}).totals,[{currency:'GBP',amount:0}]);assert.equal(aggregate({...base,coverage:{}}).amount,null);
});

test('cash corrections retain immutable evidence and increment data revision',async t=>{
 let amount=10;const f=syncFixture(t,{pages:{cash:()=>({items:[{reference:'corrected',dateTime:middle,type:'DEPOSIT',currency:'GBP',amount}],nextPagePath:null})}});await f.sync.tick();const original=f.store.list(f.key,'cash')[0];amount=12;f.advance(6*60000);await f.sync.tick();const revised=f.store.list(f.key,'cash')[0];assert.equal(revised.source.amount,12);assert.equal(f.store.list(f.key,'cash-revision').length,2);assert.equal(f.store.get(f.key,'cash-revision',original.evidenceId).source.amount,10);assert.equal(f.sync.metadata().coverage.cash.revisionCount,1);
});
test('rolling periods have fixed elapsed durations; this month uses the calendar boundary',()=>{
 const now=Date.parse('2026-10-28T13:35:00Z');const r=rangeFor('week','Europe/London',now);assert.equal(Date.parse(r.end)-Date.parse(r.start),7*86400000);assert.equal(rangeFor('calendar_month','Europe/London',now).start,'2026-09-30T23:00:00.000Z');
});
