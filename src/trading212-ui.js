(() => {
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const button=(label,fn)=>{const b=make('button','secondary',label);b.type='button';b.onclick=fn;return b;};
 const numeric=n=>typeof n==='number'&&Number.isFinite(n);
 const amount=(n,currency)=>{if(!numeric(n))return '—';if(currency==='GBX')return n.toLocaleString('en-GB',{maximumFractionDigits:2})+' GBX';try{return new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:2}).format(n);}catch{return n.toLocaleString('en-GB',{maximumFractionDigits:2})+(currency?' '+currency:' (currency unavailable)');}};
 const qty=n=>numeric(n)?n.toLocaleString('en-GB',{maximumFractionDigits:6}):'—';
 const date=d=>d&&!Number.isNaN(Date.parse(d))?new Date(d).toLocaleDateString('en-GB'):'—';
 const stamp=d=>d&&!Number.isNaN(Date.parse(d))?new Date(d).toLocaleString('en-GB'):'Not yet loaded';
 const name=i=>i?.name||i?.ticker||'Unknown instrument';
 function table(columns,rows){const wrap=make('div','table-scroll'),t=make('table'),head=make('thead'),hr=make('tr'),body=make('tbody');for(const c of columns)hr.append(make('th',null,c));head.append(hr);for(const row of rows){const tr=make('tr');for(const cell of row)tr.append(make('td',null,cell??'—'));body.append(tr);}t.append(head,body);wrap.append(t);return wrap;}
 function note(root,text){root.append(make('p','t212-note',text));}
 function metric(root,label,value){const box=make('div','t212-metric');box.append(make('span',null,label),make('strong',null,value));root.append(box);}
 function allocations(root,holdings){
  const currencies=[...new Set(holdings.map(h=>h.walletImpact?.currency))];
  if(currencies.length!==1||!currencies[0]||holdings.some(h=>!numeric(h.walletImpact?.currentValue)||h.walletImpact.currentValue<0)){note(root,'Allocation unavailable: some holding values or currencies are missing or inconsistent.');return;}
  const total=holdings.reduce((sum,h)=>sum+h.walletImpact.currentValue,0);if(!total)return;
  const box=make('section','t212-allocation');box.append(make('h2',null,'Investment allocation'));note(box,'Share of invested value · cash excluded');
  for(const h of [...holdings].sort((a,b)=>b.walletImpact.currentValue-a.walletImpact.currentValue).slice(0,8)){
   const share=h.walletImpact.currentValue/total*100,row=make('div','t212-allocation-row'),label=make('div'),bar=make('progress');bar.max=100;bar.value=share;bar.setAttribute('aria-label',`${name(h.instrument)} ${share.toFixed(1)}%`);label.append(make('span',null,name(h.instrument)),make('strong',null,share.toFixed(1)+'%'));row.append(label,bar);box.append(row);
  }
  if(holdings.length>8)note(box,'Largest 8 holdings shown; percentages include all holdings.');root.append(box);
 }
 function render(host,initial,actions={}){
  host.replaceChildren();const root=make('section','t212-panel');host.append(root);let data=initial,pages=new Set(),loading=false,year='all';
  async function load(view,nextPagePath=null){
   if(loading)return;loading=true;draw();
   try{
    const next=await actions.trading212({view,nextPagePath,connectionId:nextPagePath?data.connectionId:null});if(!host.contains(root))return;
    if(nextPagePath){if(pages.has(nextPagePath))throw new Error('This history page has already been loaded.');pages.add(nextPagePath);data={...next,fromStart:data.fromStart,complete:data.fromStart!==false&&!next.nextPagePath,items:[...(data.items||[]),...(next.items||[])],updatedAt:data.updatedAt,lastPageUpdatedAt:next.updatedAt};}
    else{data=next;pages=new Set();year='all';}
    loading=false;draw();
   }catch(e){if(!host.contains(root))return;loading=false;draw();const message=make('p','t212-error',e.message.replace(/^Error invoking remote method '[^']+': Error: /,''));message.setAttribute('role','alert');root.prepend(message);}
  }
  function draw(){
   root.replaceChildren();const header=make('header','t212-heading'),titles=make('div');titles.append(make('h1',null,'Trading 212'),make('p','t212-note',`${data.preview?'Fictional preview · ':''}${data.environment==='demo'?'Demo':'Live'} · Read-only`));header.append(titles);
   if(!data.loading){header.append(button('Settings',()=>actions.settings?.()));if(!data.setup)header.append(button(loading?'Loading…':'Refresh',()=>load(data.view)));}root.append(header);
   if(data.loading){note(root,'Connecting to Trading 212…');return;}
   if(data.setup){note(root,data.setup);return;}
   const nav=make('nav','t212-tabs');nav.setAttribute('aria-label','Trading 212 views');
   for(const [id,label] of [['overview','Overview'],['holdings','Holdings'],['dividends','Dividends'],['activity','Activity']]){const selected=id==='activity'?['trades','cash','pending'].includes(data.view):data.view===id,b=button(label,()=>load(id==='activity'?'trades':id));b.setAttribute('aria-pressed',String(selected));nav.append(b);}root.append(nav);
   if(['trades','cash','pending'].includes(data.view)){const sub=make('nav','t212-tabs t212-subtabs');sub.setAttribute('aria-label','Activity type');for(const [id,label] of [['trades','Trades'],['cash','Cash movements'],['pending','Pending orders']]){const b=button(label,()=>load(id));b.setAttribute('aria-pressed',String(data.view===id));sub.append(b);}root.append(sub);}
   note(root,`Updated ${stamp(data.updatedAt)}${data.cached?' · Cached within API refresh limit':''}`);
   for(const warning of data.warnings||[])root.append(make('p','t212-error',warning));
   if(data.view==='overview'){
    const s=data.summary;if(s){const cards=make('div','t212-metrics');for(const [label,value]of [['Account value',s.totalValue],['Available cash',s.cash?.availableToTrade],['Invested value',s.investments?.currentValue],['Cost of holdings',s.investments?.totalCost],['Unrealised return',s.investments?.unrealizedProfitLoss],['Realised return · all time',s.investments?.realizedProfitLoss]])metric(cards,label,amount(value,s.currency));root.append(cards);note(root,`Cash reserved for orders: ${amount(s.cash?.reservedForOrders,s.currency)} · Cash in Pies: ${amount(s.cash?.inPies,s.currency)}`);}
    if(data.holdings?.length)allocations(root,data.holdings);else if(data.holdings)note(root,'No open holdings.');
   }else if(data.view==='holdings'){
    const items=data.items||[];if(!items.length)note(root,'No open holdings.');else{
     allocations(root,items);root.append(table(['Holding','Shares','Avg. paid','Price','Value','Return','FX impact'],items.map(h=>[name(h.instrument),qty(h.quantity),amount(h.averagePricePaid,h.instrument?.currency),amount(h.currentPrice,h.instrument?.currency),amount(h.walletImpact?.currentValue,h.walletImpact?.currency),amount(h.walletImpact?.unrealizedProfitLoss,h.walletImpact?.currency),amount(h.walletImpact?.fxImpact,h.walletImpact?.currency)])));
     note(root,'Share prices use the instrument currency; value and return use the account currency. Return is unrealised, not today’s change.');
    }
   }else if(data.view==='dividends'){
    const items=data.items||[],years=[...new Set(items.map(x=>x.paidOn?.slice(0,4)).filter(Boolean))].sort().reverse(),label=make('label','t212-year','Payment year'),select=make('select');select.setAttribute('aria-label','Dividend payment year');select.append(new Option('All loaded years','all'));for(const y of years)select.append(new Option(y,y));select.value=year;select.onchange=()=>{year=select.value;draw();};label.append(select);root.append(label);
    const filtered=items.filter(x=>year==='all'||x.paidOn?.startsWith(year)),totals=new Map(),months=new Map();
    for(const d of filtered){if(!numeric(d.amount)||!d.currency)continue;totals.set(d.currency,(totals.get(d.currency)||0)+d.amount);const month=d.paidOn?.slice(0,7);if(month){const key=month+' '+d.currency;months.set(key,(months.get(key)||0)+d.amount);}}
    const cards=make('div','t212-metrics');for(const [currency,total]of totals)metric(cards,'Payments in loaded records',amount(total,currency));root.append(cards);
    if(filtered.some(d=>!numeric(d.amount)||!d.currency))note(root,'Some payment amounts or currencies are missing and excluded from totals.');
    if(months.size)root.append(table(['Month / currency','Payments in loaded records'],[...months].sort(([a],[b])=>b.localeCompare(a)).map(([key,total])=>[key,amount(total,key.split(' ')[1])])));
    if(filtered.length)root.append(table(['Paid','Holding','Type','Amount'],filtered.map(d=>[date(d.paidOn),d.instrument?.name||d.instrument?.ticker||d.ticker||'Unknown instrument',d.type,amount(d.amount,d.currency)])));else note(root,'No payments in these loaded records.');
   }else{
    const items=data.items||[];
    if(!items.length)note(root,data.view==='pending'?'No pending orders.':'No activity in this page.');
    else if(data.view==='cash')root.append(table(['Date','Type','Amount'],items.map(x=>[date(x.dateTime),x.type,amount(x.amount,x.currency)])));
    else if(data.view==='trades')root.append(table(['Date','Holding','Side / event','Shares','Fill price','Net value','Realised return'],items.map(x=>[date(x.fill?.filledAt||x.order?.createdAt),name(x.order?.instrument),[x.order?.side,x.fill?.type].filter(Boolean).join(' · '),qty(x.fill?.quantity),amount(x.fill?.price,x.order?.instrument?.currency),amount(x.fill?.walletImpact?.netValue,x.fill?.walletImpact?.currency),amount(x.fill?.walletImpact?.realisedProfitLoss,x.fill?.walletImpact?.currency)])));
    else root.append(table(['Created','Holding','Side','Type','Status','Shares / value','Limit','Stop'],items.map(x=>[date(x.createdAt),x.instrument?.name||x.instrument?.ticker||x.ticker||'Unknown instrument',x.side,x.type,x.status,x.strategy==='VALUE'?amount(x.value,x.currency):qty(x.quantity),amount(x.limitPrice,x.instrument?.currency),amount(x.stopPrice,x.instrument?.currency)])));
   }
   if(['dividends','trades','cash'].includes(data.view)){
    note(root,`${data.items?.length||0} ${data.items?.length===1?'record':'records'} loaded. ${data.nextPagePath?'More history is available; totals cover loaded records only.':data.fromStart===false?'This is a partial history page. Refresh to start at the latest records.':'All available pages loaded for this view.'}`);
    if(data.nextPagePath)root.append(button(loading?'Loading…':'Load older records',()=>load(data.view,data.nextPagePath)));
   }
   if(actions.request)root.append(button('Ask Orb about my investments',()=>actions.request('Review my Trading 212 portfolio, including allocation and unrealised returns.')));
   root.setAttribute('aria-busy',String(loading));for(const b of root.querySelectorAll('button,select'))b.disabled=loading;
  }
  draw();
 }
 async function open(){
  const loading={kind:'trading212',view:'overview',environment:settings?.trading212?.environment||'live',loading:true};displayVisual(loading);
  try{const result=await api.trading212({view:'overview'});if(currentVisual===loading&&cardMode==='visual')displayVisual(result);}
  catch(e){if(currentVisual===loading&&cardMode==='visual')displayVisual({...loading,loading:false,setup:e.message.replace(/^Error invoking remote method '[^']+': Error: /,'')});}
 }
 let connectionBusy=false;
 function clearSecrets(){document.getElementById('t212-key').value='';document.getElementById('t212-secret').value='';}
 function loadSettings(){
  clearSecrets();const c=settings?.trading212||{configured:false,environment:'live'};
  $('t212-environment').value=c.environment;$('t212-status').textContent=c.configured?'Saved · '+(c.environment==='demo'?'Demo':'Live'):'Set up';$('t212-status').className='integration-status'+(c.configured?' connected':'');
  $('t212-key').placeholder=c.configured?'Key saved · leave blank to keep':'API key';$('t212-secret').placeholder=c.configured?'Secret saved · leave blank to keep':'API secret';$('t212-disconnect').hidden=!c.configured;$('t212-message').textContent='';
 }
 async function connect(action){
  if(connectionBusy)return;connectionBusy=true;const fields=[...$('trading212-integration').querySelectorAll('input,select,button')];fields.forEach(x=>x.disabled=true);$('t212-message').textContent=action==='disconnect'?'Disconnecting…':'Checking your connection…';
  try{
   const result=await api.trading212Connect({action,environment:$('t212-environment').value,key:$('t212-key').value.trim(),secret:$('t212-secret').value.trim()});
   if(action!=='test'){settings.trading212=result.trading212;loadSettings();if(currentVisual?.kind==='trading212'){currentVisual=null;$('visual-view').replaceChildren();}}
   $('t212-message').textContent=action==='test'?`Connection works · ${result.currency}. Click Connect & save to store these credentials.`:action==='save'?`Connected · ${result.currency}. Saved on this Mac.`:'Disconnected. Saved credentials and cached account data removed. Your Trading 212 key is not revoked.';
  }catch(e){$('t212-message').textContent=e.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
  finally{connectionBusy=false;fields.forEach(x=>x.disabled=false);}
 }
 window.trading212UI={render,open,loadSettings,clearSecrets,init};
 function init(){
 $('t212-test').onclick=()=>connect('test');$('t212-save').onclick=()=>connect('save');$('t212-disconnect').onclick=()=>connect('disconnect');
 // The preview uses fictional data and cannot save credentials or reach the API.
 if(preview){
  api.trading212Connect=async()=>{throw new Error('Connect Trading 212 in the Mac app. This is a fictional preview.');};
  api.trading212=async({view='overview',nextPagePath=null}={})=>{
   const holding=(ticker,name,quantity,currentValue,cost,price,currency='USD')=>({instrument:{ticker,name,currency},quantity,averagePricePaid:price*.9,currentPrice:price,walletImpact:{currency:'GBP',currentValue,totalCost:cost,unrealizedProfitLoss:currentValue-cost,fxImpact:12}});
   const holdings=[holding('ALPHA_US_EQ','Alpha Technologies',12,2400,2000,260),holding('WORLD_EQ','Global Equity ETF',40,4200,3800,105,'GBP'),holding('GREEN_EQ','Green Energy Fund',20,1400,1600,70,'GBP')];
   const base={connectionId:'fictional-preview',fromStart:!nextPagePath,kind:'trading212',view,environment:'demo',preview:true,updatedAt:new Date().toISOString(),warnings:[],nextPagePath:null};
   if(view==='overview')return {...base,summary:{currency:'GBP',totalValue:9200,cash:{availableToTrade:1000,inPies:100,reservedForOrders:100},investments:{currentValue:8000,totalCost:7400,unrealizedProfitLoss:600,realizedProfitLoss:240}},holdings};
   if(view==='holdings')return {...base,items:holdings};
   if(view==='dividends')return {...base,items:[{paidOn:nextPagePath?'2025-12-10':'2026-09-10',instrument:holdings[1].instrument,type:'ORDINARY',amount:nextPagePath?32:42,currency:'GBP'}],nextPagePath:nextPagePath?null:'/api/v0/equity/history/dividends?limit=50&cursor=1'};
   if(view==='cash')return {...base,items:[{dateTime:'2026-09-01',type:'DEPOSIT',amount:500,currency:'GBP'},{dateTime:'2026-09-10',type:'INTEREST_ON_FREE_CASH',amount:3.21,currency:'GBP'}]};
   if(view==='trades')return {...base,items:[{order:{instrument:holdings[0].instrument,side:'BUY'},fill:{filledAt:'2026-09-04',quantity:2,price:250,type:'TRADE',walletImpact:{netValue:-384,currency:'GBP',realisedProfitLoss:0}}}]};
   return {...base,items:[]};
  };
 }
 }
})();
