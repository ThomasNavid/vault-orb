(() => {
 'use strict';
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
 const button=(label,fn,cls='places-button')=>{const b=make('button',cls,label);b.type='button';b.onclick=fn;return b;};
 const clean=e=>(e?.message||String(e)).replace(/^Error invoking remote method '[^']+': Error: /,'');
 const pinned=p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude);
 const instances=new Map();
 function dispose(host){instances.get(host)?.dispose();instances.delete(host);}
 function render(host,v,actions={}){
  dispose(host);host.replaceChildren();host.scrollTop=0;let disposed=false,sequence=0,map=null,markers=[],selected=v.selected??0,mapFailed=false,mounting=false;
  const clientId=crypto.randomUUID(),api=actions.places||window.orb?.places;
  const root=make('section','places-panel'),head=make('header','places-heading'),intro=make('div');
  intro.append(make('h1',null,v.mode==='nearby'?'A little closer.':'Your places.'));
  const origin=make('p','places-origin',v.originLabel||'Places worth remembering');intro.append(origin);head.append(intro);
  const settings=button('Settings',()=>actions.placesSettings?.(),'places-text-button');head.append(settings);root.append(head);
  const toolbar=make('div','places-toolbar');root.append(toolbar);
  const tabs=make('div','places-tabs');tabs.setAttribute('aria-label','Places view');
  const nearby=button('Nearby',()=>load({action:'search',query:query.value||'coffee shop',originId:v.originId}));const saved=button('Saved',()=>load({action:'list',query:''}));
  for(const [b,mode] of [[nearby,'nearby'],[saved,'saved']]){b.setAttribute('aria-pressed',String(v.mode===mode));tabs.append(b);}toolbar.append(tabs);
  const form=make('form','places-search'),query=make('input');query.type='search';query.placeholder=v.mode==='nearby'?'Coffee, parks, somewhere to eat…':'Search your saved places';query.setAttribute('aria-label','Search places');query.value=v.query||'';query.maxLength=200;
  const search=button('Search',()=>{});search.type='submit';form.append(query,search);form.onsubmit=e=>{e.preventDefault();load({action:v.mode==='nearby'?'search':'list',query:query.value,originId:v.originId});};toolbar.append(form);
  const areaBox=make('details','places-area');areaBox.open=['origin','choose-origin'].includes(v.state)||v.historical===true;
  areaBox.append(make('summary',null,v.originId?'Change starting point':'Choose starting point'));
  const areaForm=make('form','places-search'),area=make('input');area.type='search';area.maxLength=200;area.placeholder='Address, neighbourhood or city';area.setAttribute('aria-label','Starting address or area');
  const find=button('Find area',()=>{});find.type='submit';areaForm.append(area,find);areaForm.onsubmit=e=>{e.preventDefault();load({action:'search',query:query.value||'coffee shop',area:area.value});};areaBox.append(areaForm);
  const locate=button('Use current location',async()=>{
   locate.disabled=true;status.textContent='Finding your location…';
   try{if(!actions.locate)throw new Error('Location unavailable');const found=await actions.locate();if(disposed)return;await load({action:'search',query:query.value||'coffee shop',originId:found.originId});}
   catch{if(!disposed)status.textContent='Location is unavailable. Enter an address or neighbourhood above.';}finally{locate.disabled=false;}
  },'places-text-button');areaBox.append(locate);root.append(areaBox);
  if(v.choices?.length){const choices=make('div','places-choices');choices.append(make('p',null,'Which starting point?'));for(const choice of v.choices)choices.append(button(choice.label,()=>load({action:'search',query:v.query||'coffee shop',originId:choice.id})));root.append(choices);}
  const status=make('p','places-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
  if(v.historical)status.textContent='Previous search. Walking times are historical; choose a starting point to refresh.';
  if(v.setup){const setup=make('div','places-empty');setup.append(make('p',null,'Keep places in your vault, ready for next time.'),button('Set up Places',async()=>{try{const plan=await api({action:'setup'});setup.replaceChildren(make('p',null,plan.missing.length?'Add these missing starter files:':'Your Places folder is ready.'),...plan.missing.map(p=>make('div','places-file',p)),make('p',null,plan.notes),button('Add missing files',async()=>{try{await api({action:'setup',apply:true});await load({action:'list'});}catch(e){status.textContent=clean(e);}}));}catch(e){status.textContent=clean(e);}}));root.append(setup);}
  const layout=make('div','places-layout'),mapWrap=make('div','places-map-wrap'),mapHost=make('div','places-map');mapHost.setAttribute('aria-label','Map of places');
  const fallback=make('div','places-map-fallback',v.configured?'Loading the map…':'Connect Geoapify in Settings to show the map.');mapWrap.append(mapHost,fallback);
  const searchArea=button('Search this area',async()=>{if(!map)return;const c=map.getCenter();try{const p=await api({action:'origin',latitude:c.lat,longitude:c.lng});await load({action:'search',query:query.value||'coffee shop',originId:p.originId});}catch(e){status.textContent=clean(e);}},'places-search-area');searchArea.hidden=true;mapWrap.append(searchArea);
  const list=make('div','places-list');list.setAttribute('aria-label','Places');
  const cards=[];
  for(const [i,p] of (v.results||[]).entries()){
   const card=make('article','place-card'),choose=button('',()=>select(i,true),'place-select'),badge=make('span','place-number',String(i+1)),copy=make('span','place-copy');
   copy.append(make('strong',null,p.name),make('span','place-address',[p.category,p.location||'Address not recorded',p.path?'Saved':null].filter(Boolean).join(' · ')));
   choose.append(badge,copy);choose.setAttribute('aria-label',`Select ${p.name}`);card.append(choose);
   const time=make('span','place-time',Number.isFinite(p.walkingSeconds)?`${Math.max(1,Math.round(p.walkingSeconds/60))} min walk${v.historical?' · previous search':''}`:v.mode==='nearby'?'Walking time unavailable':pinned(p)?'On the map':'Location needed');card.append(time);
   if(p.evidence)card.append(make('p','place-evidence',p.evidence));
   if(p.geocoded)card.append(make('p','place-evidence','Pin found from address · not yet saved to your note'));
   const controls=make('div','place-actions');
   const route=async app=>{try{await api({action:'directions',...(p.id?{id:p.id,historical:!!v.historical}:p.path?{path:p.path,vaultId:v.vaultId}:{destination:{name:p.name,location:p.location,latitude:p.latitude,longitude:p.longitude}}),app});}catch(e){status.textContent=clean(e);}};
   controls.append(button('Directions',()=>route(v.directionsApp||'apple'),'places-button primary'));
   const menu=make('details','place-map-menu');menu.append(make('summary',null,'Open in…'));menu.append(button('Apple Maps',()=>route('apple')),button('Google Maps',()=>route('google')));controls.append(menu);
   if(p.path){controls.append(button('Open note',async()=>{try{await api({action:'note',path:p.path,vaultId:v.vaultId});}catch(e){status.textContent=clean(e);}},'places-text-button'));
    if(!pinned(p)&&!v.historical&&v.configured)controls.append(button('Locate on map',async()=>{try{const matches=await api({action:'resolve',id:p.id});if(disposed)return;if(!matches.length){status.textContent='No matching location. Add a more specific address in the note.';return;}const choices=make('div','places-choices');choices.append(make('p',null,'Choose the correct location'));for(const match of matches)choices.append(button(match.label,()=>{const results=[...v.results];results[i]=match;render(host,{...v,results,selected:i},actions);}));controls.append(choices);}catch(e){status.textContent=clean(e);}},'places-text-button'));
    if(p.geocoded&&!v.historical)controls.append(button('Save location',async()=>{try{await api({action:'save-location',id:p.id});status.textContent='Location saved. You can undo it in Recent changes.';}catch(e){status.textContent=clean(e);}},'places-text-button'));
   }else if(!v.historical){const save=button('Save',async()=>{save.disabled=true;try{const result=await api({action:'save',id:p.id});p.path=result.path;save.textContent='Saved';status.textContent='Saved to Places. You can undo it in Recent changes.';}catch(e){save.disabled=false;status.textContent=clean(e);if(/different place/.test(clean(e))){const label=make('label','places-rename','Place name including branch'),name=make('input');name.value=p.name;name.maxLength=180;label.append(name);controls.append(label,button('Save with this name',async()=>{try{await api({action:'save',id:p.id,name:name.value});status.textContent='Saved to Places.';save.disabled=true;save.textContent='Saved';label.remove();}catch(err){status.textContent=clean(err);}}));}}},'places-text-button');controls.append(save);}
   card.append(controls);cards.push({card,choose,controls});list.append(card);
  }
  if(!cards.length)list.append(make('p','places-empty',v.state==='origin'||v.state==='choose-origin'?'Choose a starting point to find a few good options.':v.mode==='nearby'?'No matching places in this area. Try another search or widen the area.':'No saved places here yet. Find somewhere nearby and save it.'));
  layout.append(mapWrap,list);root.append(layout);
  const footer=make('footer','places-footer');
  if(v.mode==='nearby'&&v.originId){footer.append(make('span',null,`${v.radius/1000} km search radius`));if(v.radius===1500)footer.append(button('Widen to 3 km',()=>load({action:'search',query:v.query,originId:v.originId,radius:3000}),'places-text-button'));}
  const attribution=make('span','places-attribution');for(const [label,url] of [['© OpenStreetMap','https://www.openstreetmap.org/copyright'],['Geoapify','https://www.geoapify.com/']]){const a=make('a',null,label);a.href=url;a.onclick=e=>{e.preventDefault();actions.openLink?.(url);};attribution.append(a);}footer.append(attribution);root.append(footer);
  for(const warning of v.warnings||[])root.append(make('p','places-warning',warning));
  host.append(root);
  async function load(args){const ticket=++sequence;status.textContent='Finding places…';root.setAttribute('aria-busy','true');try{const result=await api({...args,clientId});if(!disposed&&ticket===sequence)render(host,result,actions);}catch(e){if(!disposed&&ticket===sequence)status.textContent=clean(e);}finally{if(!disposed&&ticket===sequence)root.removeAttribute('aria-busy');}}
  function select(i,pan=false){selected=i;cards.forEach((c,j)=>{c.card.classList.toggle('is-selected',j===i);c.choose.setAttribute('aria-pressed',String(j===i));c.controls.hidden=j!==i;});markers.forEach(({element,index})=>{element.classList.toggle('is-selected',index===i);element.setAttribute('aria-pressed',String(index===i));});const p=v.results?.[i];if(pan&&map&&pinned(p))map.easeTo({center:[p.longitude,p.latitude],duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:250});}
  select(selected);
  function destroyMap(){map?.remove();map=null;markers=[];}
  async function mountMap(){
   if(disposed||map||mapFailed||mounting||!v.configured)return;
   const points=(v.results||[]).filter(pinned);if(!points.length&&!v.origin){fallback.textContent='Pins appear when places have coordinates.';return;}
   try{
    mounting=true;
    const maplibregl=await import('./vendor/maplibre/maplibre-gl.mjs');if(disposed||!mapHost.checkVisibility())return;
    maplibregl.setWorkerUrl(new URL('vendor/maplibre/maplibre-gl-worker.mjs',document.baseURI).href);
    const dark=matchMedia('(prefers-color-scheme: dark)').matches,style=dark?'dark-matter':'positron';
    const tiles=v.previewTiles?['https://tile.openstreetmap.org/{z}/{x}/{y}.png']:[`orbplaces://tiles/${style}/{z}/{x}/{y}.png`];
    map=new maplibregl.Map({container:mapHost,style:{version:8,sources:{streets:{type:'raster',tiles,tileSize:256,maxzoom:19}},layers:[{id:'streets',type:'raster',source:'streets'}]},center:points.length?[points[0].longitude,points[0].latitude]:[v.origin.longitude,v.origin.latitude],zoom:14,attributionControl:false,dragRotate:false,pitchWithRotate:false,renderWorldCopies:false});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    let tileError=false;fallback.hidden=false;fallback.textContent='Loading the map…';
    map.on('load',()=>{fallback.hidden=!tileError;map?.resize();});
    map.on('error',()=>{tileError=true;fallback.hidden=false;fallback.textContent='Map unavailable. Cards and directions still work.';});
    map.on('dragend',()=>{searchArea.hidden=v.mode!=='nearby';});
    const bounds=new maplibregl.LngLatBounds();
    (v.results||[]).forEach((p,i)=>{if(!pinned(p))return;const marker=button(String(i+1),()=>{select(i);const card=cards[i]?.card;if(card)list.scrollTop+=card.getBoundingClientRect().top-list.getBoundingClientRect().top;},'place-pin');marker.setAttribute('aria-label',p.name);new maplibregl.Marker({element:marker}).setLngLat([p.longitude,p.latitude]).addTo(map);markers.push({element:marker,index:i});bounds.extend([p.longitude,p.latitude]);});
    if(v.origin){const dot=make('div','place-origin-dot');dot.setAttribute('aria-label',v.originLabel);new maplibregl.Marker({element:dot}).setLngLat([v.origin.longitude,v.origin.latitude]).addTo(map);bounds.extend([v.origin.longitude,v.origin.latitude]);}
    if(!bounds.isEmpty())map.fitBounds(bounds,{padding:24,maxZoom:15,duration:0});select(selected);
   }catch{mapFailed=true;destroyMap();fallback.textContent='Map unavailable. You can still use the place cards.';}finally{mounting=false;}
  }
  const intersection=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){mountMap();map?.resize();}else destroyMap();});intersection.observe(mapHost);
  const resize=new ResizeObserver(()=>map?.resize());resize.observe(mapHost);
  const pause=()=>{sequence++;root.removeAttribute('aria-busy');destroyMap();api?.({action:'cancel',clientId}).catch(()=>{});};
  instances.set(host,{pause,hidden:false,dispose(){disposed=true;pause();intersection.disconnect();resize.disconnect();},root});
 }
 // Removed chat messages release WebGL resources; hidden panels pause through IntersectionObserver.
 new MutationObserver(()=>{for(const [host,state] of instances){if(!host.isConnected||!host.contains(state.root))dispose(host);else{const hidden=!!host.closest('[hidden]');if(hidden&&!state.hidden)state.pause();state.hidden=hidden;}}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 function bindSettings({api,onChange}){
  const el=id=>document.getElementById(id);let current={};
  function load(value={}){current=value;el('places-key').value='';el('places-key').placeholder=value.configured?'Key saved':'Geoapify API key';el('places-default-area').value=value.defaultArea||'';el('places-app').value=value.directionsApp||'apple';el('places-status').textContent=value.configured?'Connected':'Optional';}
  const save=async(disconnect=false)=>{const message=el('places-message');try{const result=await api.savePlaces({key:el('places-key').value,defaultArea:el('places-default-area').value,directionsApp:el('places-app').value,disconnect});load(result.places);onChange?.(result.places);message.textContent=disconnect?'Disconnected. Saved places are still in your vault.':'Places settings saved.';}catch(e){message.textContent=clean(e);}};
  el('places-connect').onclick=()=>save();el('places-disconnect').onclick=()=>save(true);
  return {load,clearSecrets:()=>{el('places-key').value='';}};
 }
 window.placesUI={render,dispose,bindSettings};
})();
