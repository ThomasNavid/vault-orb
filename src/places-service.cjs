const crypto=require('node:crypto');
const {listPlaces,readPlace,savePlace,updateLocation,setupPlaces,coordinates,pinned,text,samePlace}=require('./places.cjs');
const {categoryFor}=require('./places-provider.cjs');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24);
const vaultId=vault=>digest(vault.root);
function readPlacesSettings(config){const p=config.places||{};return {configured:!!p.encryptedKey,defaultArea:typeof p.defaultArea==='string'?p.defaultArea:'',directionsApp:p.directionsApp==='google'?'google':'apple'};}
function placesKey(config,safeStorage){const key=config.places?.encryptedKey;if(!key)return '';if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');return safeStorage.decryptString(Buffer.from(key,'base64'));}
function withPlacesSettings(config,input,safeStorage){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid Places settings.');const next={...config.places};
  if('key' in input){const key=text(input.key,'Geoapify key',200);if(key){if(!/^[a-zA-Z0-9_-]+$/.test(key))throw new Error('Invalid Geoapify key.');if(!safeStorage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');next.encryptedKey=safeStorage.encryptString(key).toString('base64');}}
  if(input.disconnect===true)delete next.encryptedKey;
  if('defaultArea' in input)next.defaultArea=text(input.defaultArea,'default area',200);
  if('directionsApp' in input){if(!['apple','google'].includes(input.directionsApp))throw new Error('Choose Apple Maps or Google Maps.');next.directionsApp=input.directionsApp;}
  return {...config,places:next};
}
function distance(a,b){const rad=n=>n*Math.PI/180,dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude),h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));}
function directionsURL(destination,app='apple',origin=null){
  if(!['apple','google'].includes(app))throw new Error('Choose Apple Maps or Google Maps.');
  const p=coordinates(destination),name=text(destination.name??'','place name',180),address=text(destination.location??'','address');
  const dest=pinned(p)?`${p.latitude},${p.longitude}`:[name,address].filter(Boolean).join(', ');if(!pinned(p)&&!address)throw new Error('Add an address or coordinates before opening directions.');
  let start=null;if(origin){const c=coordinates(origin);if(pinned(c))start=`${c.latitude},${c.longitude}`;}
  const u=new URL(app==='google'?'https://www.google.com/maps/dir/':'https://maps.apple.com/');
  u.search=new URLSearchParams(app==='google'?{api:'1',destination:dest,travelmode:'walking',...(start?{origin:start}:{})}:{daddr:dest,dirflg:'w',...(start?{saddr:start}:{})});return u.href;
}
// Persist destinations (per provider storage terms), never the device fix or session handles.
function persistedPlaces(v){
  return {kind:'places',schema:1,id:v.id,title:v.title,query:v.query,mode:v.mode,radius:v.radius,vaultId:v.vaultId,createdAt:v.createdAt,originLabel:'Previous search · choose a starting point to refresh',historical:true,configured:v.configured,directionsApp:v.directionsApp,warnings:[],results:(v.results||[]).slice(0,100).map(({name,category,location,latitude,longitude,website,path,version,walkingSeconds,evidence,source,geocoded})=>({name,category,location,latitude,longitude,website,path,version,walkingSeconds,evidence,source,geocoded}))};
}
function forModel(v){return {displayed:true,query:v.query,origin:v.originLabel,state:v.state,warnings:v.warnings,results:(v.results||[]).map(({id,name,category,location,path,walkingSeconds,evidence})=>({id,name,category,location,path,walkingSeconds,evidence})),next:v.state==='origin'?'Choose an origin in the Places panel.':v.state==='choose-origin'?'Choose one of the matching areas in the Places panel.':undefined};}
function createPlacesService({getVault,getConfig,provider,onChange=()=>{},now=()=>Date.now()}){
  const records=new Map(),origins=new Map();let lifetime=new AbortController();
  const current=()=>{const v=getVault();if(!v)throw new Error('Connect a vault in Settings first.');return v;};
  function remember(map,data,vault){const id=crypto.randomUUID();map.set(id,{...data,vaultId:vaultId(vault),expires:now()+30*60000});while(map.size>500)map.delete(map.keys().next().value);return id;}
  function lookup(map,id,vault){const found=map.get(id);if(!found||found.expires<now()||found.vaultId!==vaultId(vault))throw new Error('This Places result expired. Refresh the search.');return found;}
  function clear(){lifetime.abort();lifetime=new AbortController();records.clear();origins.clear();provider.clear?.();}
  async function view(args={},options={}){
    const vault=current(),signal=options.signal?AbortSignal.any([options.signal,lifetime.signal]):lifetime.signal;
    const query=text(args.query??'','query',200),mode=args.mode??'saved';if(!['saved','nearby'].includes(mode))throw new Error('Invalid Places view.');
    const radius=args.radius??1500;if(![1500,3000].includes(radius))throw new Error('Choose a 1.5 or 3 km area.');
    const settings=readPlacesSettings(getConfig()),data=listPlaces(vault,mode==='saved'?{query}:{}),warnings=[...data.warnings];
    const visual={kind:'places',schema:1,id:crypto.randomUUID(),title:mode==='saved'?'Your places':query||'Nearby places',query,mode,radius,vaultId:vaultId(vault),createdAt:new Date(now()).toISOString(),configured:settings.configured,directionsApp:settings.directionsApp,setup:data.setup,warnings,results:[],state:'ready',originLabel:'Choose a starting point'};
    if(mode==='nearby'&&!settings.configured)warnings.push('Connect Geoapify in Places settings for nearby search, address lookup and walking times.');
    let origin=null;
    if(args.originId)origin=lookup(origins,args.originId,vault);
    else if(mode==='nearby'){
      const area=text(args.area??settings.defaultArea,'area',200);
      if(area&&settings.configured){const matches=await provider.geocode(area,{signal});signal.throwIfAborted();
        if(matches.length===1){origin=matches[0];origin.label=origin.location||origin.name;origin.id=remember(origins,origin,vault);}
        else {visual.state=matches.length?'choose-origin':'origin';visual.choices=matches.map(p=>({id:remember(origins,{...p,label:p.location||p.name},vault),label:p.location||p.name}));if(!matches.length)warnings.push('No matching starting point. Try a more specific address.');}
      }else visual.state='origin';
    }
    if(origin){visual.originId=origin.id||args.originId;visual.origin={latitude:origin.latitude,longitude:origin.longitude};visual.originLabel=origin.label||origin.location||origin.name;}
    let places=data.places;
    if(mode==='nearby'&&origin){
      const cat=categoryFor(query),quiet=/quiet|peaceful|calm/i.test(query);
      places=places.filter(p=>cat.label==='Uncategorized'||categoryFor(p.category).id===cat.id);
      // Resolve only a bounded subset. Ambiguous matches remain unpinned and unchanged on disk.
      let geocoded=0;
      for(const p of places){if(!pinned(p)&&p.location&&settings.configured&&geocoded++<5){try{const matches=await provider.geocode(`${p.name}, ${p.location}`,{signal});if(matches.length===1)Object.assign(p,coordinates(matches[0]),{geocoded:true});}catch(e){signal.throwIfAborted();warnings.push('Some saved addresses could not be located.');break;}}}
      places=places.filter(p=>!pinned(p)||distance(origin,p)<=radius);
      if(settings.configured){try{const discovered=await provider.search(query,origin,radius,{signal});for(const p of discovered)if(!places.some(saved=>samePlace(saved,p)))places.push(p);}catch(e){signal.throwIfAborted();warnings.push(e.message);}}
      else warnings.push('Connect Geoapify in Places settings to discover nearby places and walking times.');
      for(const p of places){p.straightMetres=pinned(p)?distance(origin,p):null;
        // Quote matching user text without interpreting negation or claiming current noise levels.
        const line=quiet?p.body?.split('\n').find(line=>/quiet|peaceful|calm/i.test(line)):null;
        p.evidence=quiet?(line?`Your note: “${line.trim().slice(0,180)}”`:'Quietness not verified'):null;
        p.preferenceMatch=!!line&&!/\b(not|never|no|isn't|wasn't|isn’t|wasn’t|might|maybe)\b/i.test(line);
      }
      places.sort((a,b)=>Number(b.preferenceMatch)-Number(a.preferenceMatch)||(a.straightMetres??Infinity)-(b.straightMetres??Infinity));places=places.slice(0,10);
      if(settings.configured){
        let cursor=0;await Promise.all(Array.from({length:2},async()=>{while(cursor<places.length){const p=places[cursor++];if(!pinned(p))continue;try{const r=await provider.walkingRoute(origin,p,{signal});p.walkingSeconds=r.seconds;}catch(e){signal.throwIfAborted();p.walkingSeconds=null;}}}));
      }
      places.sort((a,b)=>Number(b.preferenceMatch)-Number(a.preferenceMatch)||(a.walkingSeconds??Infinity)-(b.walkingSeconds??Infinity)||(a.straightMetres??Infinity)-(b.straightMetres??Infinity));places=places.slice(0,5);
    }else if(mode==='nearby')places=[];
    signal.throwIfAborted();if(current()!==vault)throw new Error('The vault changed. Open Places again.');
    if(places.length>100)warnings.push('Showing the first 100 saved places. Search to narrow the list.');
    visual.results=places.slice(0,100).map(({body,warnings:_,...p})=>({...p,id:remember(records,{place:p,origin},vault)}));
    visual.warnings=[...new Set(warnings)];return visual;
  }
  async function command(args={},options={}){
    if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid Places request.');const vault=current();
    switch(args.action??'list'){
      case 'list':return view({...args,mode:'saved'},options);
      case 'search':return view({...args,mode:'nearby'},options);
      case 'origin': {const coords=coordinates(args);if(!pinned(coords))throw new Error('A location needs both coordinates.');const accuracy=typeof args.accuracy==='number'&&Number.isFinite(args.accuracy)&&args.accuracy>=0?args.accuracy:null;const label=args.source==='device'?`Current location${accuracy!==null&&accuracy>100?` · accuracy about ${Math.round(accuracy)} m`:''}`:'Map centre';return {originId:remember(origins,{...coords,label},vault)};}
      case 'setup':return setupPlaces(vault,{apply:args.apply===true});
      case 'resolve': {
        const record=lookup(records,args.id,vault);if(!record.place.path)throw new Error('Choose a saved place.');
        const place=readPlace(vault,record.place.path);if(!place.location)throw new Error('Add an address to the place note first.');
        const signal=options.signal?AbortSignal.any([options.signal,lifetime.signal]):lifetime.signal;
        const matches=await provider.geocode(`${place.name}, ${place.location}`,{signal});signal.throwIfAborted();
        return matches.map(match=>{const resolved={...record.place,version:place.version,...coordinates(match),geocoded:true};return {...resolved,label:match.location||match.name,id:remember(records,{place:resolved,origin:record.origin},vault)};});
      }
      case 'save': {
        const record=args.id?lookup(records,args.id,vault):null;
        if(!record&&!args.place)throw new Error('Choose a place to save.');
        if(record?.place.path&&!record.place.geocoded){const existing=readPlace(vault,record.place.path);return {path:existing.path,version:existing.version,duplicate:true};}
        const result=savePlace(vault,record?{...record.place,name:args.name??record.place.name,notes:args.notes??''}:args.place);if(record)record.place={...record.place,path:result.path,version:result.version};if(result.change_id&&options.notify!==false)onChange(result);return result;
      }
      case 'save-location': {const record=lookup(records,args.id,vault);if(!record.place.path||!record.place.geocoded)throw new Error('Choose a resolved saved place.');const result=updateLocation(vault,record.place);if(options.notify!==false)onChange(result);record.place={...record.place,version:result.version,geocoded:false};return result;}
      case 'directions': {
        let destination,origin=null;
        if(args.id){const record=lookup(records,args.id,vault);destination=record.place;origin=args.historical?null:record.origin;}
        else if(args.path){if(args.vaultId!==vaultId(vault))throw new Error('This place belongs to a different vault.');destination=readPlace(vault,args.path);}
        else destination=args.destination;
        return {url:directionsURL(destination,args.app??readPlacesSettings(getConfig()).directionsApp,origin)};
      }
      case 'note': {if(args.vaultId!==vaultId(vault))throw new Error('This place belongs to a different vault.');return {path:readPlace(vault,args.path).path};}
      default:throw new Error('Unknown Places action.');
    }
  }
  return {command,clear};
}
module.exports={createPlacesService,readPlacesSettings,placesKey,withPlacesSettings,persistedPlaces,forModel,directionsURL,distance,vaultId};
