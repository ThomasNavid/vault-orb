const test=require('node:test');
const assert=require('node:assert/strict');
const {Trading212,publicTrading,readCredentials,candidateCredentials,saveCredentials,requestPath,project}=require('../src/trading212.cjs');
const {Agent,tools}=require('../src/agent.cjs');
const {validateArguments}=require('../src/providers.cjs');
const credentials={environment:'demo',key:'fictional-key',secret:'fictional-secret'};
const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('encrypted:'+s),decryptString:b=>b.toString().slice(10)};
const summary={currency:'GBP',totalValue:1250,cash:{availableToTrade:250},investments:{currentValue:1000,totalCost:800,unrealizedProfitLoss:200,realizedProfitLoss:25},unknown:'private'};
const holdings=[{instrument:{ticker:'EXAMPLE_US_EQ',name:'Example stock',currency:'USD'},quantity:10,currentPrice:125,averagePricePaid:100,walletImpact:{currency:'GBP',currentValue:1000,totalCost:800,unrealizedProfitLoss:200,fxImpact:-12}}];
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
function client(fetchImpl){let time=Date.parse('2026-09-29T12:00:00Z');const waits=[];return {api:new Trading212(credentials,{fetchImpl,now:()=>time,wait:async(ms,_,{signal})=>{signal.throwIfAborted();waits.push(ms);time+=ms;}}),waits,advance:ms=>time+=ms};}

test('credentials stay encrypted and public settings never include keys',()=>{
 const existing={vaultPath:'/example',ai:{chat:'keep'}};
 const saved=saveCredentials(existing,credentials,storage);
 assert.deepEqual(readCredentials(saved,storage),credentials);assert.equal(saved.vaultPath,existing.vaultPath);assert.equal(existing.trading212,undefined);
 assert.equal(saved.trading212.key,Buffer.from('encrypted:fictional-key').toString('base64'));
 assert.equal(saved.trading212.secret,Buffer.from('encrypted:fictional-secret').toString('base64'));
 assert.deepEqual(Object.keys(publicTrading(saved)).sort(),['configured','connectedAt','environment']);
 assert.doesNotMatch(JSON.stringify(publicTrading(saved)),/fictional/);
 assert.deepEqual(candidateCredentials(saved,{environment:'demo',key:'',secret:''},storage),credentials);
 assert.throws(()=>candidateCredentials(saved,{environment:'live',key:'',secret:''},storage),/new Live or Demo/);
 assert.throws(()=>candidateCredentials(saved,{environment:'demo',key:'replacement'},storage),/both/);
 for(const key of ['x\ny','x:y','   ',12])assert.throws(()=>saveCredentials({}, {...credentials,key},storage),/valid/);
 assert.throws(()=>saveCredentials({},credentials,{isEncryptionAvailable:()=>false}),/encryption/);
 assert.throws(()=>readCredentials({},storage),/Connect Trading 212/);
 assert.throws(()=>publicTrading({trading212:{environment:'https://evil.test'}}),/Live or Demo/);
});
test('all data requests use only GET to the selected fixed host; credentials are not in results',async()=>{
 const calls=[];const {api}=client(async(url,options)=>{calls.push({url,options});return json(url.endsWith('/summary')?summary:holdings);});
 const result=await api.view();assert.equal(result.summary.totalValue,1250);assert.equal(result.holdings[0].walletImpact.currentValue,1000);assert.equal(result.summary.unknown,undefined);
 assert.equal(result.kind,'trading212');assert.equal(result.environment,'demo');assert.equal(result.readOnly,true);
 assert.equal(calls.length,2);
 for(const {url,options}of calls){assert.match(url,/^https:\/\/demo.trading212.com\/api\/v0\/equity\//);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Basic '+Buffer.from('fictional-key:fictional-secret').toString('base64'));assert.equal(options.body,undefined);}
 assert.doesNotMatch(JSON.stringify(result),/fictional-key|fictional-secret|private/);
 await assert.rejects(()=>api.read('market'),/Unsupported/);await assert.rejects(()=>api.view({view:'sell'}),/valid/);
});
test('history follows bounded same-resource pagination, keeps currencies and reports incompleteness',async()=>{
 const next='/api/v0/equity/history/dividends?limit=50&cursor=123',calls=[];
 const {api,waits}=client(async url=>{calls.push(url);return json({items:[{amount:8,currency:'USD',paidOn:'2026-01-02',instrument:holdings[0].instrument}],nextPagePath:calls.length===1?next:null});});
 const first=await api.view({view:'dividends'});assert.equal(first.complete,false);assert.equal(first.items[0].currency,'USD');assert.equal(first.nextPagePath,next);
 const second=await api.view({view:'dividends',nextPagePath:first.nextPagePath,connectionId:first.connectionId});assert.equal(second.complete,false);assert.equal(second.fromStart,false);assert.equal(second.nextPagePath,null);assert.deepEqual(waits,[10000]);assert.ok(calls[1].endsWith(next));
 for(const path of ['https://evil.test/api/v0/equity/history/dividends?cursor=1','//evil.test/path','/api/v0/equity/history/orders?cursor=1','/api/v0/equity/history/dividends?limit=500','/api/v0/equity/history/dividends?cursor=a&cursor=b','/api/v0/equity/history/dividends?key=secret','/api/v0/equity/history/dividends?cursor=1#x','/api/v0/equity/history/dividends?cursor=a%0Ab'])assert.throws(()=>requestPath('dividends',path),/Invalid/);
 assert.throws(()=>requestPath('pending','/api/v0/equity/orders?cursor=1'),/Invalid/);
});
test('shared client coalesces concurrent refreshes and respects per-endpoint pacing',async()=>{
 let count=0;const {api,advance}=client(async()=>{count++;return json(summary);});
 const results=await Promise.all([api.read('summary'),api.read('summary'),api.read('summary')]);assert.equal(count,1);assert.deepEqual(results.map(r=>r.cached),[false,true,true]);
 advance(5000);await api.read('summary');assert.equal(count,2);
});
test('rate limits and error bodies are handled without exposing provider content',async()=>{
 for(const [status,pattern]of [[401,/key or secret/],[403,/permissions and IP/],[429,/rate limit/],[500,/HTTP 500/]]){
  const {api}=client(async()=>json({error:'fictional-secret internal details'},status));
  await assert.rejects(()=>api.read('summary'),e=>pattern.test(e.message)&&!e.message.includes('fictional-secret'));
 }
 let calls=0;const {api}=client(async()=>{calls++;return json({},429,{'retry-after':'60'});});
 await assert.rejects(()=>api.read('summary'),/rate limit/);await assert.rejects(()=>api.read('summary'),/60 seconds/);assert.equal(calls,1);
 const broken=client(async()=>{throw new Error('fictional-secret');}).api;await assert.rejects(()=>broken.read('summary'),e=>/Could not reach/.test(e.message)&&!e.message.includes('fictional-secret'));
});
test('overview preserves available sections and never converts missing financial values to zero',async()=>{
 const {api}=client(async url=>url.endsWith('/positions')?json({},403):json(summary));
 const result=await api.view();assert.equal(result.holdings,null);assert.equal(result.summary.cash.inPies,null);assert.match(result.warnings[0],/Holdings.*permissions/);
 assert.equal(project('holdings',[{quantity:'12',walletImpact:{currentValue:null}}])[0].quantity,null);
 const failed=client(async()=>json({},401)).api;await assert.rejects(()=>failed.view(),/rejected/);
});
test('malformed and unsafe server responses do not become apparently empty successful history',async()=>{
 for(const response of [()=>json({items:'broken'}),()=>new Response('<html>oops</html>'),()=>json({items:[null]}),()=>json({items:[],nextPagePath:123}),()=>json({items:[],nextPagePath:''}),()=>json({items:[],nextPagePath:'https://evil.test/'})]){
  const {api}=client(response);await assert.rejects(()=>api.view({view:'cash'}),/invalid|Invalid/);
 }
 const repeated=client(async()=>json({items:[],nextPagePath:'/api/v0/equity/history/transactions?limit=50'})).api;await assert.rejects(()=>repeated.view({view:'cash'}),/repeated/);
 const oversize=client(async()=>new Response(' '.repeat(4*1024*1024+1))).api;await assert.rejects(()=>oversize.read('summary'),/too large/);
});
test('cancelling or disconnecting stops requests and prevents stale results',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 const {api}=client(async()=>{calls++;return json(summary);});await assert.rejects(()=>api.read('summary',{signal:controller.signal}),{name:'AbortError'});assert.equal(calls,0);
 api.dispose();await assert.rejects(()=>api.read('summary'),{name:'AbortError'});assert.equal(calls,0);
 let resolve;const slow=client(async()=>new Promise(r=>resolve=r)).api;const result=slow.read('summary');await Promise.resolve();await Promise.resolve();slow.dispose();resolve(json(summary));await assert.rejects(()=>result,{name:'AbortError'});assert.equal(slow.cache.size,0);
});
test('trade history and pending orders retain signed values and absent fields',async()=>{
 const data=project('trades',{items:[{order:{side:'SELL',instrument:holdings[0].instrument},fill:{price:120,quantity:-2,walletImpact:{currency:'GBP',netValue:180,realisedProfitLoss:-20}}}],nextPagePath:null});
 assert.equal(data.items[0].fill.quantity,-2);assert.equal(data.items[0].fill.walletImpact.realisedProfitLoss,-20);assert.equal(data.items[0].order.limitPrice,null);
 assert.deepEqual(project('pending',[]),[]);assert.equal(project('cash',{items:[{type:'INTEREST_ON_FREE_CASH',amount:1.2,currency:'GBP'}]}).items[0].amount,1.2);
});
test('assistant has one read-only trading tool, emits a data visual, and propagates cancellation',async()=>{
 const schema=tools.find(t=>t.name==='trading212');assert.ok(schema);assert.deepEqual(tools.filter(t=>/trading|order|position/i.test(t.name)).map(t=>t.name),['trading212']);
 const args=validateArguments(schema.parameters,{view:'overview',nextPagePath:null,connectionId:null});const events=[],calls=[];
 const data={kind:'trading212',view:'overview',summary:project('summary',summary)};
 const agent=new Agent({vault:{},getKey:()=>'',getTrading212:async(a,o)=>{calls.push([a,o]);return data;},onActivity:e=>events.push(e)});
 const controller=new AbortController();assert.deepEqual(await agent.execute('trading212',args,{signal:controller.signal}),data);assert.equal(calls[0][1].signal,controller.signal);assert.deepEqual(events.find(e=>e.kind==='visual').visual,data);
 assert.equal(events.at(-1).status,'done');controller.abort();await assert.rejects(()=>agent.execute('trading212',args,{signal:controller.signal}),{name:'AbortError'});assert.equal(calls.length,1);
 await assert.rejects(()=>new Agent({vault:{},getKey:()=>''}).execute('trading212',args),/Connect Trading 212/);
});

test('history cursors cannot mix a saved snapshot with a different connection',async()=>{
 const one=client(async()=>json({items:[],nextPagePath:'/api/v0/equity/history/dividends?limit=50&cursor=1'})).api;
 const first=await one.view({view:'dividends'});let calls=0;
 const two=client(async()=>{calls++;return json({items:[],nextPagePath:null});}).api;
 await assert.rejects(()=>two.view({view:'dividends',nextPagePath:first.nextPagePath,connectionId:first.connectionId}),/connection changed/);
 assert.equal(calls,0);assert.equal((await two.view({view:'dividends'})).complete,true);
});
