(() => {
 // Weather card beside the orb, and the Weather connector in Settings.
 const NS='http://www.w3.org/2000/svg';
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
 const svg=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const icon=(name,cls='icon')=>{const s=svg('svg',{class:cls,'aria-hidden':'true'});s.append(svg('use',{href:'#i-'+name}));return s;};
 const clean=e=>(e?.message||String(e)).replace(/^Error invoking remote method '[^']+': Error: /,'');
 const clock=time=>typeof time==='string'?time.slice(11,16):'';
 const updated=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};
 const jacketText={none:'No jacket needed',light:'Light jacket',warm:'Warm coat'};

 // The card's backdrop follows the conditions: frosty, warm, rainy, night or clear.
 function moodOf(v){
  if(v.mood?.snow)return 'snow';if(v.mood?.wet)return 'rain';
  if(v.mood?.tint==='cold')return 'cold';if(v.mood?.tint==='heat')return 'heat';if(v.mood?.tint==='hot')return 'hot';
  return v.now?.isDay===false?'night':/cloud|fog|overcast/i.test(v.now?.condition||'')?'cloud':'clear';
 }

 function hero(v){
  const box=make('section','weather-hero'),place=make('div','weather-place');
  place.append(make('h1',null,v.place?.name||'Weather'));
  const feels=Math.abs(v.now.feelsLike-v.now.temp)>=2?`Feels ${v.now.feelsLike}°`:null;
  place.append(make('p','weather-summary',[v.now.condition,feels,`H ${v.today.high}° L ${v.today.low}°`].filter(Boolean).join(' · ')));
  const detail=[v.place?.detail,v.place?.saved?null:'Not your saved place'].filter(Boolean).join(' · ');if(detail)place.title=detail;
  const temp=make('div','weather-temp');temp.append(icon(v.now.icon,'icon weather-now-icon'),make('strong',null,`${v.now.temp}°`));
  box.append(place,temp);return box;
 }

 // One quiet line of advice, e.g. "Light jacket and umbrella · rain likely around 10:00". Full reasons on hover.
 function advice(v){
  const a=v.advice,items=[];
  if(a.jacket!=='none')items.push(jacketText[a.jacket]);
  if(a.umbrella)items.push(items.length?'umbrella':'Umbrella');
  if(a.sun)items.push(items.length?'sun protection':'Sun protection');
  const text=items.length?items.length>1?items.slice(0,-1).join(', ')+' and '+items.at(-1):items[0]:'No jacket or umbrella needed';
  const rain=(a.reasons||[]).find(r=>/rain/.test(r)),rainNote=rain&&rain.match(/around (\d\d:\d\d)/);
  const line=make('p','weather-advice');line.append(icon(a.umbrella?'umbrella':a.jacket!=='none'?'jacket':a.sun?'sun':'check'),make('span',null,text));
  if(rainNote)line.append(make('span','weather-advice-note',`rain likely around ${rainNote[1]}`));
  if(a.reasons?.length)line.title=`${v.window?v.window[0].toUpperCase()+v.window.slice(1)+': ':''}${a.reasons.join(' · ')}`;
  return line;
 }

 // Next 12 hours: time, icon, temperature, and rain chance only when it matters.
 function hours(v){
  const list=(v.hours||[]).slice(0,12),row=make('div','weather-hours');
  row.setAttribute('role','list');row.setAttribute('aria-label','Hourly forecast');
  list.forEach((h,i)=>{
   const col=make('div','weather-hour'),time=i===0?'Now':clock(h.time);col.setAttribute('role','listitem');
   col.setAttribute('aria-label',`${time}, ${h.condition}, ${h.temp} degrees, ${h.precipChance}% chance of rain`);
   col.append(make('span','weather-hour-time',time),icon(h.icon),make('strong',null,`${h.temp}°`),make('span','weather-hour-rain',h.precipChance>=20?`${h.precipChance}%`:''));
   row.append(col);
  });
  return row;
 }

 function render(host,v,actions={}){
  host.replaceChildren();
  const card=make('article','weather-card');card.dataset.mood=moodOf(v);
  card.append(hero(v),advice(v),hours(v));
  const foot=make('footer','weather-footer'),tomorrow=make('span','weather-tomorrow');
  tomorrow.append(icon(v.tomorrow.icon),document.createTextNode(`Tomorrow · ${v.tomorrow.condition} · ${v.tomorrow.high}° / ${v.tomorrow.low}°`));
  const meta=make('span','weather-meta',v.stale?'Offline · last forecast':`Updated ${updated(v.updatedAt)}`);meta.title=`${v.source||'Open-Meteo'} · ${v.units==='imperial'?'°F':'°C'}`;
  const buttons=make('div','weather-footer-actions');buttons.append(meta);
  if(actions.weather&&!actions.saved){const refresh=make('button','weather-icon-button');refresh.type='button';refresh.title='Refresh';refresh.setAttribute('aria-label','Refresh weather');refresh.append(icon('refresh'));refresh.onclick=async()=>{refresh.disabled=true;try{render(host,await actions.weather({place:v.place?.saved?null:v.place?.name||null,when:v.when||'now'}),actions);}catch(e){refresh.disabled=false;meta.textContent=clean(e);}};buttons.append(refresh);}
  if(actions.weatherSettings){const settings=make('button','weather-icon-button');settings.type='button';settings.title='Location';settings.setAttribute('aria-label','Weather location');settings.append(icon('map'));settings.onclick=()=>actions.weatherSettings();buttons.append(settings);}
  foot.append(tomorrow,buttons);card.append(foot);host.append(card);
 }

 function unavailable(host,message,{retry,settings}={}){
  host.replaceChildren();const card=make('article','weather-card weather-empty');card.dataset.mood='cloud';
  card.append(icon('cloud','icon weather-now-icon'),make('h1',null,'Weather unavailable'),make('p',null,message));
  const row=make('div','weather-footer-actions');
  if(retry){const b=make('button','secondary','Retry');b.type='button';b.onclick=retry;row.append(b);}
  if(settings){const b=make('button','secondary','Weather settings');b.type='button';b.onclick=settings;row.append(b);}
  card.append(row);host.append(card);
 }

 // Settings → Connectors → Weather. Each change saves on its own, separately from Save settings.
 function bindSettings({api,onChange=()=>{}}){
  const $=id=>document.getElementById(id),input=$('weather-place'),list=$('weather-results'),message=$('weather-message');
  let current=null,results=[],active=-1,timer=0,sequence=0;
  const say=text=>{message.textContent=text;};
  const status=()=>{const s=$('weather-status');s.textContent=current?.location?current.location.name:'Set up';s.classList.toggle('connected',!!current?.location);};
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const highlight=i=>{active=i;[...list.children].forEach((li,j)=>li.setAttribute('aria-selected',String(j===i)));if(list.children[i]){input.setAttribute('aria-activedescendant',list.children[i].id);list.children[i].scrollIntoView({block:'nearest'});}};
  async function save(patch,done){
   try{const result=await api.saveWeather(patch);current=result.weather;onChange(current);status();say(done);return true;}
   catch(e){say(clean(e));return false;}
  }
  async function choose(i){
   const place=results[i];if(!place)return;close();input.value=place.name;
   if(await save({location:place},`Saved. Weather will use ${[place.name,place.detail].filter(Boolean).join(', ')}.`))input.value=place.name;
  }
  function draw(){
   list.replaceChildren();
   results.forEach((r,i)=>{const li=make('li','weather-result');li.id='weather-result-'+i;li.setAttribute('role','option');li.append(make('strong',null,r.name),make('span',null,r.detail));li.onpointerdown=e=>{e.preventDefault();choose(i);};list.append(li);});
   list.hidden=!results.length;input.setAttribute('aria-expanded',String(!!results.length));active=-1;
  }
  input.oninput=()=>{
   clearTimeout(timer);const query=input.value.trim(),token=++sequence;
   if(query.length<2){results=[];draw();return;}
   timer=setTimeout(async()=>{try{const found=await api.weatherSearch(query);if(token!==sequence)return;results=found;draw();say(found.length?'':'No matching places.');}catch(e){if(token===sequence)say(clean(e));}},300);
  };
  input.onkeydown=e=>{
   if(list.hidden)return;
   if(e.key==='ArrowDown'){e.preventDefault();highlight(Math.min(results.length-1,active+1));}
   else if(e.key==='ArrowUp'){e.preventDefault();highlight(Math.max(0,active-1));}
   else if(e.key==='Enter'){e.preventDefault();choose(active<0?0:active);}
   else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
  };
  input.onblur=()=>setTimeout(close,120);
  $('weather-units').onchange=e=>save({units:e.target.value},e.target.value==='imperial'?'Temperatures will show in °F.':'Temperatures will show in °C.');
  $('weather-reactions').onchange=e=>save({orbReactions:e.target.checked},e.target.checked?'The orb will react to the weather.':'The orb will keep its colour when you check the weather.');
  return {
   load(weather){current=weather||{location:null,units:'metric',orbReactions:true};input.value=current.location?.name||'';results=[];draw();close();$('weather-units').value=current.units;$('weather-reactions').checked=current.orbReactions!==false;say('');status();},
   current:()=>current
  };
 }

 // Short line for the Today chip, e.g. "9° · rain likely by 16:00".
 function headline(v){
  const rain=(v.hours||[]).slice(0,12).find(h=>h.precipChance>=40);
  return `${v.now.temp}° · ${rain?(rain===v.hours[0]?'rain now':`rain likely by ${clock(rain.time)}`):v.now.condition.toLowerCase()}`;
 }

 window.weatherUI={render,unavailable,bindSettings,moodOf,headline,icon};
})();
