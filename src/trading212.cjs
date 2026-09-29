// Trading 212 public API. Only the fixed GET endpoints below are reachable.
const {randomUUID}=require('node:crypto');
const {SourceNumber,parseJSON,numeric:number,amounts}=require('./trading212-numbers.cjs');
const {setTimeout:delay}=require('node:timers/promises');
const BASES={live:'https://live.trading212.com',demo:'https://demo.trading212.com'};
const PREFIX='/api/v0/equity/';
const ENDPOINTS={summary:['account/summary',5000],holdings:['positions',1000],pending:['orders',5000],dividends:['history/dividends',10000],trades:['history/orders',10000],cash:['history/transactions',10000]};
const VIEWS=['overview','holdings','dividends','trades','cash','pending'];
const text=value=>typeof value==='string'?value.slice(0,300):null;
const fields=(value,keys,convert=number)=>Object.fromEntries(keys.map(key=>[key,convert(value?.[key])]));
const instrument=value=>fields(value,['ticker','name','isin','currency'],text);
function environment(value='live'){if(!Object.hasOwn(BASES,value))throw new Error('Choose Live or Demo for Trading 212.');return value;}
function credential(value){if(typeof value!=='string'||!value.trim()||value.length>2000||/[\s:]/.test(value.trim()))throw new Error('Enter a valid Trading 212 API key and secret.');return value.trim();}
function publicTrading(config){const c=config.trading212;return {configured:!!(c?.key&&c?.secret),environment:environment(c?.environment),connectedAt:c?.connectedAt||null};}
function readCredentials(config,storage){
  const c=config.trading212;if(!c?.key||!c?.secret)throw new Error('Connect Trading 212 in Settings → Integrations first.');
  if(!storage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');
  return {environment:environment(c.environment),key:storage.decryptString(Buffer.from(c.key,'base64')),secret:storage.decryptString(Buffer.from(c.secret,'base64'))};
}
function candidateCredentials(config,input={},storage){
  if(!input||typeof input!=='object')throw new Error('Invalid Trading 212 settings.');
  const env=environment(input.environment),hasKey=input.key!==undefined&&input.key!=='',hasSecret=input.secret!==undefined&&input.secret!=='';
  if(hasKey!==hasSecret)throw new Error('Enter both the API key and API secret to replace the saved connection.');
  if(hasKey)return {environment:env,key:credential(input.key),secret:credential(input.secret)};
  const saved=readCredentials(config,storage);
  if(saved.environment!==env)throw new Error('Enter the key and secret for the new Live or Demo environment.');
  return saved;
}
function saveCredentials(config,value,storage){
  if(!storage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');
  return {...config,trading212:{environment:environment(value.environment),key:storage.encryptString(credential(value.key)).toString('base64'),secret:storage.encryptString(credential(value.secret)).toString('base64'),connectedAt:new Date().toISOString()}};
}
function project(kind,data){
  if(kind==='summary'){
    if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.currency!=='string'||number(data.totalValue)===null)throw new Error('Trading 212 returned an invalid account summary.');
    return {id:data.id==null?null:String(data.id),currency:text(data.currency),...amounts(data,['totalValue']),cash:amounts(data.cash,['availableToTrade','inPies','reservedForOrders']),investments:amounts(data.investments,['currentValue','totalCost','realizedProfitLoss','unrealizedProfitLoss'])};
  }
  const order=value=>({...fields(value,['id'],v=>typeof v==='number'||typeof v==='string'||v instanceof SourceNumber?String(v):null),...fields(value,['status','type','side','createdAt','currency','ticker','strategy'],text),...fields(value,['quantity','filledQuantity','limitPrice','stopPrice','value','filledValue']),instrument:instrument(value?.instrument)});
  const holding=value=>({...amounts(value,['quantity','quantityAvailableForTrading','quantityInPies','averagePricePaid','currentPrice']),createdAt:text(value?.createdAt),instrument:instrument(value?.instrument),walletImpact:{currency:text(value?.walletImpact?.currency),...amounts(value?.walletImpact,['currentValue','totalCost','unrealizedProfitLoss','fxImpact'])}});
  const dividend=value=>({...amounts(value,['amount','grossAmountPerShare','quantity']),...fields(value,['currency','paidOn','reference','type','ticker','tickerCurrency'],text),instrument:instrument(value?.instrument)});
  const cash=value=>({...amounts(value,['amount']),...fields(value,['currency','dateTime','reference','type'],text)});
  const trade=value=>({order:order(value?.order),fill:{...fields(value?.fill,['id'],v=>v==null?null:String(v)),...fields(value?.fill,['filledAt','type'],text),...amounts(value?.fill,['price','quantity']),walletImpact:{...amounts(value?.fill?.walletImpact,['netValue','realisedProfitLoss','fxRate']),taxes:Array.isArray(value?.fill?.walletImpact?.taxes)?value.fill.walletImpact.taxes.map(t=>({...amounts(t,['quantity']),...fields(t,['name','currency'],text)})):[],currency:text(value?.fill?.walletImpact?.currency)}}});
  const list=['holdings','pending'].includes(kind)?data:data?.items;
  if(!Array.isArray(list)||list.length>10000||list.some(item=>!item||typeof item!=='object'||Array.isArray(item)))throw new Error('Trading 212 returned an invalid list.');
  const items=list.map(value=>({holdings:holding,pending:order,dividends:dividend,cash,trades:trade}[kind])(value));
  if(['holdings','pending'].includes(kind))return items;
  if(data.nextPagePath!=null&&(typeof data.nextPagePath!=='string'||!data.nextPagePath||data.nextPagePath.length>1000))throw new Error('Trading 212 returned an invalid history cursor.');
  return {items,nextPagePath:data.nextPagePath??null};
}
function requestPath(kind,nextPagePath){
  const route=PREFIX+ENDPOINTS[kind][0];
  if(nextPagePath==null)return route+(['dividends','trades','cash'].includes(kind)?'?limit=50':'');
  if(!['dividends','trades','cash'].includes(kind)||typeof nextPagePath!=='string'||nextPagePath.length>1000||!nextPagePath.startsWith(route+'?'))throw new Error('Invalid Trading 212 history page.');
  const url=new URL(nextPagePath,BASES.live);
  if(url.origin!==BASES.live||url.pathname!==route||url.hash||[...url.searchParams.keys()].some(k=>!['cursor','limit'].includes(k))||[...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length!==1))throw new Error('Invalid Trading 212 history page.');
  const limit=url.searchParams.get('limit'),cursor=url.searchParams.get('cursor');
  if(limit!==null&&(!/^\d+$/.test(limit)||Number(limit)<1||Number(limit)>50)||cursor!==null&&!/^[a-zA-Z0-9_=-]{1,200}$/.test(cursor))throw new Error('Invalid Trading 212 history page.');
  return url.pathname+url.search;
}
async function readJSON(response){
  const reader=response.body?.getReader();if(!reader)throw new Error('Trading 212 returned an empty response.');
  let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024)throw new Error('Trading 212 response is too large.');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  try{return parseJSON(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Trading 212 returned an invalid response.');}
}
class Trading212 {
  constructor(credentials,{fetchImpl=fetch,now=Date.now,wait=delay}={}){this.connectionId=randomUUID();this.credentials={environment:environment(credentials.environment),key:credential(credentials.key),secret:credential(credentials.secret)};this.fetchImpl=fetchImpl;this.now=now;this.wait=wait;this.cache=new Map();this.queues=new Map();this.nextAt=new Map();this.lifetime=new AbortController();}
  dispose(){this.lifetime.abort();this.cache.clear();}
  async read(kind,{nextPagePath=null,signal}={}){
    if(!Object.hasOwn(ENDPOINTS,kind))throw new Error('Unsupported Trading 212 read.');
    const path=requestPath(kind,nextPagePath),ttl=ENDPOINTS[kind][1];
    signal=AbortSignal.any([this.lifetime.signal,...(signal?[signal]:[])]);signal.throwIfAborted();
    const previous=this.queues.get(kind)||Promise.resolve();
    const run=previous.catch(()=>{}).then(async()=>{
      signal.throwIfAborted();const cached=this.cache.get(path);
      if(cached&&this.now()-cached.time<ttl)return {...cached.result,cached:true};
      const wait=Math.max(0,(this.nextAt.get(kind)||0)-this.now());
      if(wait>15000)throw new Error(`Trading 212 rate limit reached. Try again in ${Math.ceil(wait/1000)} seconds.`);
      if(wait)await this.wait(wait,undefined,{signal});
      signal.throwIfAborted();this.nextAt.set(kind,this.now()+ttl);
      let response;
      const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)]);
      try{response=await this.fetchImpl(BASES[this.credentials.environment]+path,{method:'GET',redirect:'error',headers:{Accept:'application/json',Authorization:'Basic '+Buffer.from(this.credentials.key+':'+this.credentials.secret).toString('base64')},signal:requestSignal});}
      catch{signal.throwIfAborted();throw new Error('Could not reach Trading 212. Check your connection and try again.');}
      if(!response.ok){
        if(response.status===429){const reset=Number(response.headers.get('x-ratelimit-reset'))*1000,retry=Number(response.headers.get('retry-after'))*1000;this.nextAt.set(kind,Math.max(this.now()+ttl,Number.isFinite(reset)?reset:0,this.now()+(Number.isFinite(retry)?retry:0)));}
        await response.body?.cancel().catch(()=>{});
        throw Object.assign(new Error(response.status===401?'Trading 212 rejected the key or secret. Check the credentials and Live/Demo environment.':response.status===403?'Trading 212 denied access. Check the key’s read permissions and IP restrictions.':response.status===429?'Trading 212 rate limit reached. Wait a little before refreshing.':`Trading 212 is unavailable (HTTP ${response.status}). Try again later.`),{status:response.status,retryAt:this.nextAt.get(kind)});
      }
      let data;try{data=project(kind,await readJSON(response));}catch(e){signal.throwIfAborted();if(requestSignal.aborted)throw new Error('Trading 212 timed out. Try again.');throw e;}
      signal.throwIfAborted();
      if(data?.nextPagePath){requestPath(kind,data.nextPagePath);if(data.nextPagePath===path)throw new Error('Trading 212 returned a repeated history page.');}
      const result={data,updatedAt:new Date(this.now()).toISOString(),cached:false};
      this.cache.set(path,{time:this.now(),result});if(this.cache.size>150)this.cache.delete(this.cache.keys().next().value);
      return result;
    });
    this.queues.set(kind,run);return run;
  }
  async capabilities(options={}){
    const labels={summary:'Accounts data',holdings:'Portfolio',dividends:'History dividends',trades:'History orders',cash:'History transactions',pending:'Orders read'};
    const entries=await Promise.all(Object.keys(ENDPOINTS).map(async kind=>{try{const result=await this.read(kind,options);return [kind,{state:'available',permission:labels[kind],checkedAt:result.updatedAt}];}catch(e){options.signal?.throwIfAborted();return [kind,{state:e.status===403?'denied':e.status===401?'rejected':e.status===429?'rate_limited':'unavailable',permission:labels[kind],message:e.message,retryAt:e.retryAt||null}];}}));
    return Object.fromEntries(entries);
  }
  async view({view='overview',nextPagePath=null,connectionId=null}={},options={}){
    if(!VIEWS.includes(view))throw new Error('Choose a valid Trading 212 view.');
    if(nextPagePath!==null&&!['dividends','trades','cash'].includes(view))throw new Error('This Trading 212 view has no history pages.');
    if(nextPagePath!==null&&connectionId!==this.connectionId)throw new Error('The Trading 212 connection changed. Refresh this view before loading older records.');
    const base={connectionId:this.connectionId,kind:'trading212',title:'Trading 212',view,environment:this.credentials.environment,readOnly:true,source:'Trading 212 Public API'};
    if(view==='overview'){
      const values=await Promise.allSettled(['summary','holdings'].map(kind=>this.read(kind,options)));options.signal?.throwIfAborted();
      if(values.every(v=>v.status==='rejected'))throw values[0].reason;
      const result={...base,summary:null,holdings:null,warnings:[],updatedAt:null};
      values.forEach((value,i)=>{const key=['summary','holdings'][i];if(value.status==='fulfilled'){result[key]=key==='summary'?(({id,...publicSummary})=>publicSummary)(value.value.data):value.value.data;result[key+'UpdatedAt']=value.value.updatedAt;if(!result.updatedAt||value.value.updatedAt<result.updatedAt)result.updatedAt=value.value.updatedAt;}else result.warnings.push(`${key==='summary'?'Account summary':'Holdings'}: ${value.reason.message}`);});
      return result;
    }
    const result=await this.read(view,{...options,nextPagePath});
    return {...base,...(result.data?.items?result.data:{items:result.data,nextPagePath:null}),updatedAt:result.updatedAt,cached:result.cached,fromStart:nextPagePath===null,complete:nextPagePath===null&&!result.data?.nextPagePath,warnings:[]};
  }
}
module.exports={Trading212,publicTrading,readCredentials,candidateCredentials,saveCredentials,requestPath,project};
