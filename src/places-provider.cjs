const {coordinates,pinned,text,website}=require('./places.cjs');
const HOST='https://api.geoapify.com';
const TYPES=[[/café|cafe|coffee/i,'catering.cafe','Café'],[/restaurant|food|eat|lunch|dinner/i,'catering.restaurant','Restaurant'],[/\bbar|pub\b/i,'catering.bar','Bar'],[/park|garden/i,'leisure.park','Park'],[/hotel|stay/i,'accommodation.hotel','Hotel'],[/shop|store/i,'commercial','Shop'],[/attraction|museum/i,'tourism','Attraction']];
function categoryFor(query){const match=TYPES.find(([re])=>re.test(query));return match?{id:match[1],label:match[2]}:{id:'catering',label:'Uncategorized'};}
function parseFeature(feature){
  const p=feature?.properties;if(!p||typeof p!=='object')return null;
  let coords;try{coords=coordinates({latitude:p.lat??feature.geometry?.coordinates?.[1],longitude:p.lon??feature.geometry?.coordinates?.[0]});}catch{return null;}if(!pinned(coords))return null;
  const clean=(v,max=500)=>typeof v==='string'?v.slice(0,max):'';
  let url='';try{url=website(clean(p.website||p.datasource?.raw?.website,2000));}catch{}
  return {name:clean(p.name||p.address_line1,180),location:clean(p.formatted||p.address_line2),...coords,providerId:clean(p.place_id,500),website:url,source:'geoapify'};
}
function createPlacesProvider({getKey,fetchImpl=fetch,timeoutMs=10000,now=()=>Date.now(),spacingMs=220}){
  const cache=new Map();let nextRequest=0;
  async function request(endpoint,params,{signal}={}){
    const key=getKey();if(!key)throw new Error('Connect Geoapify in Settings → Connectors → Places for nearby search and maps.');
    signal?.throwIfAborted();
    const cacheKey=JSON.stringify([endpoint,params]),hit=cache.get(cacheKey);if(hit&&hit.key===key&&hit.expires>now())return structuredClone(hit.data);
    const url=new URL(endpoint,HOST);url.search=new URLSearchParams({...params,apiKey:key});
    const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
    const wait=Math.max(0,nextRequest-now());nextRequest=now()+wait+spacingMs;
    if(wait)await require('node:timers/promises').setTimeout(wait,null,{signal:combined});
    let response;try{response=await fetchImpl(url,{signal:combined,redirect:'error',headers:{accept:'application/json'}});}catch(e){signal?.throwIfAborted();throw new Error(timeout.aborted?'Places took too long to respond. Try again.':'Places could not be reached. Saved notes are still available.');}
    if(!response.ok)throw new Error(response.status===429?'Places quota reached. Try again later.':response.status===401||response.status===403?'Check the Geoapify key in Places settings.':`Places service unavailable (${response.status}).`);
    const body=await response.text();if(body.length>2000000)throw new Error('Places response is too large.');let data;try{data=JSON.parse(body);}catch{throw new Error('Places returned an invalid response.');}combined.throwIfAborted();cache.set(cacheKey,{key,data:structuredClone(data),expires:now()+5*60000});while(cache.size>100)cache.delete(cache.keys().next().value);return data;
  }
  return {
    clear(){cache.clear();nextRequest=0;},
    async geocode(query,options){const data=await request('/v1/geocode/search',{text:text(query,'area',200),limit:5,format:'geojson'},options);if(!Array.isArray(data.features))throw new Error('Places returned invalid locations.');return data.features.map(parseFeature).filter(Boolean);},
    async search(query,origin,radius,options){const cat=categoryFor(query),data=await request('/v2/places',{categories:cat.id,filter:`circle:${origin.longitude},${origin.latitude},${radius}`,bias:`proximity:${origin.longitude},${origin.latitude}`,limit:15},options);if(!Array.isArray(data.features))throw new Error('Places returned invalid results.');return data.features.map(parseFeature).filter(p=>p?.name).map(p=>({...p,category:cat.label}));},
    async walkingRoute(origin,destination,options){const data=await request('/v1/routing',{waypoints:`${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`,mode:'walk',details:'route_details'},options);const p=data.features?.[0]?.properties;if(typeof p?.time!=='number'||!Number.isFinite(p.time)||p.time<0)throw new Error('Walking time unavailable.');return {seconds:p.time,metres:typeof p.distance==='number'&&Number.isFinite(p.distance)&&p.distance>=0?p.distance:null};}
  };
}
function tileURL(value,key){
  const u=new URL(value),match=/^\/(positron|dark-matter)\/(\d{1,2})\/(\d+)\/(\d+)\.png$/.exec(u.pathname);
  if(u.protocol!=='orbplaces:'||u.host!=='tiles'||u.search||u.hash||!match)throw new Error('Invalid map tile.');
  const [,style,z,x,y]=match,zoom=Number(z);if(zoom>19||Number(x)>=2**zoom||Number(y)>=2**zoom)throw new Error('Invalid map tile.');
  if(!key)throw new Error('Connect Geoapify to display maps.');
  return `${HOST}/v1/tile/${style}/${z}/${x}/${y}.png?${new URLSearchParams({apiKey:key})}`;
}
module.exports={createPlacesProvider,categoryFor,parseFeature,tileURL};
