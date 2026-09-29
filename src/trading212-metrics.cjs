const {Decimal,decimal}=require('./trading212-numbers.cjs');
const {timestamp,instant,wallDate}=require('./calendar-time.cjs');
const VERSION=1,BOUNDARY_MS=5*60000;
const PERIODS=['today','week','month','quarter','ytd','year','tracking','calendar_year','calendar_month','tax_year','custom'];
function timeZone(value='Europe/London'){if(typeof value!=='string'||value.length>100)throw new Error('Choose a valid reporting timezone.');try{new Intl.DateTimeFormat('en-GB',{timeZone:value}).format();}catch{throw new Error('Choose a valid reporting timezone.');}return value;}
function shiftDate(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function rangeFor(period='today',zone='Europe/London',now=Date.now(),custom={}){
 timeZone(zone);if(!PERIODS.includes(period))throw new Error('Choose a supported investment period.');const today=timestamp(now,zone).slice(0,10),year=Number(today.slice(0,4));let start,end=now;
 if(period==='custom'){wallDate(custom.start);wallDate(custom.end);if(custom.start.length!==10||custom.end.length!==10||custom.start>custom.end)throw new Error('Choose a valid date range.');start=custom.start;end=Math.min(now,instant(shiftDate(custom.end,1)+'T00:00:00',zone));}
 else if(['week','month','quarter','year'].includes(period))return {period,timeZone:zone,start:new Date(now-({week:7,month:30,quarter:90,year:365}[period])*86400000).toISOString(),end:new Date(end).toISOString()};
 else if(period==='calendar_month')start=today.slice(0,7)+'-01';
 else if(period==='tracking')return {period,timeZone:zone,start:null,end:new Date(end).toISOString()};
 else if(period==='tax_year')start=(today.slice(5)>='04-06'?year:year-1)+'-04-06';
 else if(['ytd','calendar_year'].includes(period))start=year+'-01-01';
 else start=shiftDate(today,{today:0,week:-7,month:-30,quarter:-90,year:-365}[period]);
 const from=instant(start+'T00:00:00',zone);if(from>end)throw new Error('The selected period is in the future.');return {period,timeZone:zone,start:new Date(from).toISOString(),end:new Date(end).toISOString()};
}
function percentage(profit,cost){try{const c=Decimal.from(cost);return c.positive?Decimal.from(profit).div(c).mul(100).number():null;}catch{return null;}}
function unrealised(summary){return {metric:'unrealised_return',amount:summary?.investments?.unrealizedProfitLoss??null,percentage:percentage(summary?.investments?.exact?.unrealizedProfitLoss??summary?.investments?.unrealizedProfitLoss,summary?.investments?.exact?.totalCost??summary?.investments?.totalCost),currency:summary?.currency||null,label:'Open holdings · since purchase',method:'Current unrealised gain divided by current cost basis'};}
function reconcile(summary){
 try{const total=decimal(summary,'totalValue'),invested=decimal(summary.investments,'currentValue'),cash=summary.cash;
  const sum=invested.add(decimal(cash,'availableToTrade')).add(decimal(cash,'inPies')).add(decimal(cash,'reservedForOrders'));
  if(total.sub(sum).abs().number()>.02)return 'The broker account value does not reconcile with investments and cash. Period return is unavailable.';
  return null;
 }catch{return 'Some broker cash/value fields are missing; account-value reconciliation is unavailable.';}
}
function fresh(at,now){return !!at&&now-Date.parse(at)<=10*60000;}
function resultBase(metric,range,currency,now){return {version:VERSION,metric,status:'unavailable',amount:null,percentage:null,currency,requested:range,actual:null,method:null,reason:null,coverage:{},freshness:{asOf:null,stale:true},evidence:[],warnings:['Broker prices may be delayed; fetch times are not quote times.'],computedAt:new Date(now).toISOString()};}
function coverageReady(coverage,kind,end){const c=coverage[kind];return !!c?.complete&&Date.parse(c.through)>=Date.parse(end);}
function publicCoverage(coverage){return Object.fromEntries(Object.entries(coverage||{}).map(([kind,c])=>[kind,c?{complete:!!c.complete,through:c.through||null,pages:c.pages||0,revisionCount:c.revisionCount||0,syncing:!!c.scan,lastPageAt:c.lastPageAt||null,error:c.error||null,retryAt:c.retryAt||null}:null]));}
function performance({observations=[],events={},coverage={},range,now=Date.now(),tracking=true}){
 const ordered=[...observations].sort((a,b)=>a.at.localeCompare(b.at)),last=ordered.at(-1),r=resultBase('account_performance',range,last?.summary?.currency||null,now);r.coverage=publicCoverage(coverage);r.dataRevision=Object.values(coverage).reduce((n,c)=>n+(c?.revisionCount||0),0);if(r.dataRevision)r.warnings.push('Broker history contains revised records; earlier calculations may have changed.');
 const fail=reason=>({...r,reason});if(!tracking)return fail('Enable Track performance on this Mac in Settings to start collecting valuations.');
 if(!last)return fail('Collecting the first account valuation.');
 const startMs=range.start?Date.parse(range.start):Date.parse(ordered[0].at),endMs=Date.parse(range.end);
 const start=ordered.reduce((best,o)=>Math.abs(Date.parse(o.at)-startMs)<Math.abs(Date.parse(best.at)-startMs)?o:best,ordered[0]);
 const verifiedThrough=['cash','trades'].every(k=>coverage[k]?.complete&&coverage[k]?.through)?Math.min(...['cash','trades'].map(k=>Date.parse(coverage[k].through))):endMs;
 const end=ordered.filter(o=>Date.parse(o.at)<=Math.min(endMs,verifiedThrough)).at(-1);
 r.freshness={asOf:end?.at||last.at,stale:!fresh(end?.at,now)};
 if(Math.abs(Date.parse(start.at)-startMs)>BOUNDARY_MS)return fail(`No opening valuation for this period. Tracking began ${ordered[0].at}. Choose Since tracking began or another supported period.`);
 if(!end||Date.parse(end.at)<=Date.parse(start.at))return fail('A second, later valuation is needed for this period.');
 if(endMs<now-BOUNDARY_MS&&Math.abs(Date.parse(end.at)-endMs)>BOUNDARY_MS)return fail('No closing valuation near the end of this historical period.');
 r.actual={start:start.at,end:end.at};r.evidence=[start.id,end.id];r.currency=end.summary.currency;
 if(start.summary.currency!==end.summary.currency)return fail('Account currency changed across the selected period.');
 const invalid=reconcile(start.summary)||reconcile(end.summary);if(invalid)return fail(invalid);
 for(const kind of ['cash','trades'])if(!coverageReady(coverage,kind,end.at))return fail(`Complete ${kind==='cash'?'cash-transaction':'trade/fill'} history through the closing valuation is needed. Sync history, and check its read permission.`);
 const startTime=Date.parse(start.at),endTime=Date.parse(end.at),duration=endTime-startTime;
 const selected={};
 for(const kind of ['cash','trades']){
  if((events[kind]||[]).some(e=>!Number.isFinite(Date.parse(e.at))))return fail(`Some ${kind} event dates are missing. Their period cannot be verified.`);
  selected[kind]=(events[kind]||[]).filter(e=>Date.parse(e.at)>startTime&&Date.parse(e.at)<=endTime);
  if(selected[kind].some(e=>!e.identityVerified))return fail('Some events lack stable broker references; deduplicated totals cannot be verified.');
 }
 // Endpoint capture timestamps cannot establish inclusion of a simultaneous funding event.
 const external=selected.cash.filter(e=>['DEPOSIT','WITHDRAW','TRANSFER'].includes(e.source.type));
 const boundaryCash=(events.cash||[]).filter(e=>['DEPOSIT','WITHDRAW','TRANSFER'].includes(e.source.type));
 if(boundaryCash.some(e=>[start,end].some(o=>Date.parse(e.at)>=Date.parse(o.captureStart||o.at)-30000&&Date.parse(e.at)<=Date.parse(o.captureEnd||o.at)+30000)))return fail('A funding event coincides with a valuation capture. Choose a later consistent observation or a different period.');
 if((events.trades||[]).some(e=>!['TRADE','STOCK_SPLIT'].includes(e.source.fill?.type)&&[start,end].some(o=>Math.abs(Date.parse(e.at)-Date.parse(o.at))<=30000)))return fail('A securities event coincides with a valuation boundary. Its inclusion cannot be verified.');
 if(selected.trades.some(e=>!['TRADE','STOCK_SPLIT'].includes(e.source.fill?.type)))return fail('This period contains a securities transfer or unsupported corporate action. Its external value needs verification.');
 const allowedCash=['DEPOSIT','WITHDRAW','FEE','INTEREST_ON_FREE_CASH','LENDING_INTEREST'];
 if(selected.cash.some(e=>!allowedCash.includes(e.source.type)))return fail('This period contains an unclassified transfer or cash event. It cannot be assumed to be profit.');
 try{
  let flows=Decimal.from(0),weighted=Decimal.from(0);for(const event of external){const x=event.source;if(x.currency!==r.currency)return fail('An external flow is not in the account currency; its historical conversion is unavailable.');let amount=decimal(x,'amount');
   // The API may represent withdrawal magnitude or signed debit. Type sets direction once.
   amount=x.type==='WITHDRAW'?amount.abs().mul(-1):amount;if(x.type==='DEPOSIT'&&amount.n<0n)return fail('A negative deposit requires verification.');
   flows=flows.add(amount);weighted=weighted.add(amount.mul(Decimal.from(endTime-Date.parse(event.at)).div(duration)));if(r.evidence.length<100)r.evidence.push(event.evidenceId||event.id);
  }
  const startValue=decimal(start.summary,'totalValue'),gain=decimal(end.summary,'totalValue').sub(startValue).sub(flows),denominator=startValue.add(weighted);
  const approximate=external.length>0||Date.parse(start.at)!==startMs;
  return {...r,status:approximate?'estimated':'available',amount:gain.number(),percentage:denominator.positive?gain.div(denominator).mul(100).number():null,netContributions:flows.number(),method:external.length?'Modified Dietz estimate':'Account-value return with no external flows',baselineEstimated:Date.parse(start.at)!==startMs,evidenceCount:external.length+2,evidenceTruncated:external.length+2>100,reason:denominator.positive?null:'Percentage unavailable: the weighted starting value is not positive.',warnings:[...r.warnings,...(approximate?['Estimated return uses the actual observation times shown.']:[]),...(r.freshness.stale?['The closing valuation is stale.']:[])]};
 }catch{return fail('A required valuation or cash-flow amount is missing or invalid.');}
}
function aggregate({metric,events={},coverage={},range,instrument=null,groupBy=null,now=Date.now(),currency=null}){
 const kinds={income:['dividends','cash'],dividends:['dividends'],deposits:['cash'],net_contributions:['cash','trades'],realised_result:['trades']}[metric];if(!kinds)throw new Error('Choose a supported financial metric.');
 const r=resultBase(metric,range,null,now),totals=new Map(),groups=new Map();let invalid=false,rows=0;r.coverage=publicCoverage(Object.fromEntries(kinds.map(k=>[k,coverage[k]||null])));
 const requestedEnd=Date.parse(range.end),knownThrough=kinds.every(k=>coverage[k]?.complete&&coverage[k]?.through)?Math.min(...kinds.map(k=>Date.parse(coverage[k].through))):null;
 const start=range.start?Date.parse(range.start):-Infinity,end=knownThrough!==null?Math.min(requestedEnd,knownThrough):requestedEnd;
 r.actual={start:range.start,end:new Date(end).toISOString()};
 for(const kind of kinds)for(const e of events[kind]||[]){const x=e.source,t=Date.parse(e.at);if(!Number.isFinite(t)){invalid=true;continue;}if(t<start||t>=end)continue;
  if(metric==='net_contributions'&&kind==='trades'){if(!['TRADE','STOCK_SPLIT'].includes(x.fill?.type))invalid=true;continue;}
  const ticker=x.instrument?.ticker||x.ticker||x.order?.instrument?.ticker||x.order?.ticker;if(instrument&&ticker!==instrument)continue;
  let category,object=x,key='amount';
  if(kind==='dividends')category=x.type==='ORDINARY'?'Dividends':'Other distributions';
  else if(metric==='realised_result'){if(x.fill?.type!=='TRADE'){invalid=true;continue;}object=x.fill?.walletImpact;key='realisedProfitLoss';category='Realised result';}
  else if(metric==='income'){category={INTEREST_ON_FREE_CASH:'Cash interest',LENDING_INTEREST:'Lending interest'}[x.type];if(!category)continue;}
  else {if(!['DEPOSIT','WITHDRAW','TRANSFER'].includes(x.type))continue;if(x.type==='TRANSFER'){if(metric==='net_contributions')invalid=true;continue;}if(metric==='deposits'&&x.type!=='DEPOSIT')continue;category=x.type==='DEPOSIT'?'Deposits':'Withdrawals';}
  try{if(!e.identityVerified||!object?.currency)throw new Error();let value=decimal(object,key);if(metric==='net_contributions'&&x.type==='WITHDRAW')value=value.abs().mul(-1);if(x.type==='DEPOSIT'&&value.n<0n)throw new Error();
   const currency=object.currency,group=groupBy==='month'?timestamp(t,range.timeZone).slice(0,7):groupBy==='instrument'?(ticker||'Account cash'):category,gkey=JSON.stringify([group,category,currency]);totals.set(currency,(totals.get(currency)||Decimal.from(0)).add(value));groups.set(gkey,(groups.get(gkey)||Decimal.from(0)).add(value));rows++;if(r.evidence.length<100)r.evidence.push(e.evidenceId||e.id);
  }catch{invalid=true;}
 }
 const complete=kinds.every(k=>coverageReady(coverage,k,r.actual.end))&&!invalid&&end>=start;
 if(complete&&!totals.size&&currency)totals.set(currency,Decimal.from(0));
 r.status=complete?'available':'partial';r.reason=complete?null:'Totals cover verified loaded records only. Complete history and valid event references/amounts are required.';
 r.totals=[...totals].map(([currency,value])=>({currency,amount:value.number()}));r.groups=[...groups].map(([key,value])=>{const [group,category,currency]=JSON.parse(key);return {group,category,currency,amount:value.number()};}).sort((a,b)=>a.group.localeCompare(b.group));
 r.groupsTruncated=r.groups.length>200;r.groupCount=r.groups.length;r.groups=r.groups.slice(0,200);if(r.groupsTruncated)r.warnings.push('First 200 groups shown; totals include all qualifying records. Narrow the range or export to inspect every group.');
 r.amount=r.totals.length===1?r.totals[0].amount:null;r.currency=r.totals.length===1?r.totals[0].currency:null;r.rows=rows;r.method='Sum of broker events by currency; no FX conversion';r.freshness={asOf:kinds.map(k=>coverage[k]?.through).filter(Boolean).sort()[0]||null,stale:!kinds.every(k=>fresh(coverage[k]?.through,now))};return r;
}
module.exports={VERSION,PERIODS,timeZone,rangeFor,unrealised,percentage,reconcile,performance,aggregate,publicCoverage};
