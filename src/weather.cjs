const crypto=require('node:crypto');
// Live weather from Open-Meteo: no key or account, and only rounded coordinates or a typed place name leave the Mac.
const FORECAST='https://api.open-meteo.com/v1/forecast',GEOCODE='https://geocoding-api.open-meteo.com/v1/search';
const CACHE_MS=10*60000,STALE_MS=2*3600000,TIMEOUT_MS=8000;
const WHEN=['now','today','tonight','tomorrow'];
// Tuned for the UK. Temperatures are feels-like °C; the forecast is always fetched in metric and converted for display.
const RULES={cold:5,hot:26,heat:32,warmCoat:8,lightJacket:15,gust:40,rainChance:40,rainMm:.3,wetChance:50,wetNowMm:.1,uv:6};
const MOODS={cold:'#8fd8ff',hot:'#ffae3d',heat:'#ff6a3d'};

const CODES=[
  [[0],'Clear','sun'],[[1],'Mostly clear','sun'],[[2],'Partly cloudy','cloud-sun'],[[3],'Overcast','cloud'],
  [[45,48],'Fog','fog'],[[51,53,55],'Drizzle','rain'],[[56,57],'Freezing drizzle','rain'],
  [[61],'Light rain','rain'],[[63],'Rain','rain'],[[65],'Heavy rain','rain'],[[66,67],'Freezing rain','rain'],
  [[71],'Light snow','snow'],[[73],'Snow','snow'],[[75],'Heavy snow','snow'],[[77],'Snow grains','snow'],
  [[80],'Light showers','rain'],[[81],'Showers','rain'],[[82],'Heavy showers','rain'],[[85,86],'Snow showers','snow'],
  [[95],'Thunderstorm','storm'],[[96,99],'Thunderstorm with hail','storm']
];
function conditionFor(code,isDay=true){
  const match=CODES.find(([codes])=>codes.includes(code));
  const [,label,icon]=match||[null,'Unknown','cloud'];
  return {label,icon:!isDay&&icon==='sun'?'moon':!isDay&&icon==='cloud-sun'?'cloud-moon':icon};
}
const wetCode=code=>(code>=51&&code<=67)||(code>=80&&code<=82)||code>=95;
const snowCode=code=>(code>=71&&code<=77)||code===85||code===86;

const finite=(value,name)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`Weather response is missing ${name}.`);return value;};
const optional=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
function parseForecast(json){
  const c=json?.current,h=json?.hourly,d=json?.daily;
  if(!c||!h||!d||!Array.isArray(h.time)||!Array.isArray(d.time)||d.time.length<2)throw new Error('The weather service returned an incomplete forecast.');
  const now={time:String(c.time),temp:finite(c.temperature_2m,'temperature'),feelsLike:finite(c.apparent_temperature,'feels-like temperature'),code:finite(c.weather_code,'conditions'),precip:optional(c.precipitation)??0,wind:optional(c.wind_speed_10m),gust:optional(c.wind_gusts_10m),isDay:c.is_day!==0};
  const hours=h.time.map((time,i)=>({time:String(time),temp:finite(h.temperature_2m?.[i],'hourly temperature'),feelsLike:finite(h.apparent_temperature?.[i],'hourly feels-like'),precipChance:optional(h.precipitation_probability?.[i])??0,precip:optional(h.precipitation?.[i])??0,code:finite(h.weather_code?.[i],'hourly conditions'),gust:optional(h.wind_gusts_10m?.[i]),isDay:h.is_day?.[i]!==0}));
  const days=d.time.slice(0,2).map((date,i)=>({date:String(date),high:finite(d.temperature_2m_max?.[i],'daily high'),low:finite(d.temperature_2m_min?.[i],'daily low'),code:optional(d.weather_code?.[i]),sunrise:d.sunrise?.[i]?String(d.sunrise[i]):null,sunset:d.sunset?.[i]?String(d.sunset[i]):null,uvMax:optional(d.uv_index_max?.[i])}));
  return {timezone:typeof json.timezone==='string'?json.timezone:'UTC',now,hours,days};
}

// Hours are local wall-clock strings (YYYY-MM-DDTHH:MM) in the place's own timezone, so windows compare as text.
function windowFor(forecast,when){
  const {now,hours,days}=forecast,current=now.time.slice(0,13),today=days[0].date,tomorrow=days[1].date;
  const pick=(from,to)=>hours.filter(h=>h.time>=from&&h.time<to);
  if(when==='tomorrow')return {label:'tomorrow',hours:pick(tomorrow+'T07',tomorrow+'T22')};
  if(when==='tonight')return {label:'tonight',hours:pick(later(current,today+'T18'),tomorrow+'T06')};
  if(when==='today')return {label:'rest of today',hours:pick(current,tomorrow+'T00')};
  const upcoming=hours.filter(h=>h.time.slice(0,13)>=current);
  return {label:'next 12 hours',hours:upcoming.slice(0,12)};
}
const later=(a,b)=>a>b?a:b;
const clock=time=>time.slice(11,16);

function adviceFor(windowHours,{gust=null}={}){
  const hours=windowHours.length?windowHours:[];
  if(!hours.length)return {jacket:'none',umbrella:false,sun:false,reasons:['No forecast hours in that window.']};
  const coldest=hours.reduce((a,b)=>b.feelsLike<a.feelsLike?b:a),wettest=hours.reduce((a,b)=>b.precipChance>a.precipChance?b:a),heaviest=hours.reduce((a,b)=>b.precip>a.precip?b:a);
  const maxGust=Math.max(gust??0,...hours.map(h=>h.gust??0));
  const steps=['none','light','warm'];
  let jacket=coldest.feelsLike<RULES.warmCoat?2:coldest.feelsLike<=RULES.lightJacket?1:0;
  const reasons=[`feels like ${Math.round(coldest.feelsLike)}° at ${clock(coldest.time)}`];
  if(maxGust>=RULES.gust){jacket=Math.min(2,jacket+1);reasons.push(`gusts up to ${Math.round(maxGust)} km/h`);}
  const likely=wettest.precipChance>=RULES.rainChance,heavy=heaviest.precip>=RULES.rainMm,umbrella=likely||heavy;
  if(likely)reasons.push(`${Math.round(wettest.precipChance)}% chance of rain around ${clock(wettest.time)}`);
  else if(heavy)reasons.push(`${heaviest.precip.toFixed(1)} mm of rain forecast around ${clock(heaviest.time)}`);
  return {jacket:steps[jacket],umbrella,sun:false,reasons};
}

function moodFor(now,nextHours){
  const tint=now.feelsLike>=RULES.heat?'heat':now.feelsLike>=RULES.hot?'hot':now.feelsLike<=RULES.cold?'cold':null;
  const soon=nextHours.slice(0,3);
  const snow=snowCode(now.code)||(soon.some(h=>snowCode(h.code)&&h.precipChance>=RULES.wetChance));
  const wet=!snow&&(wetCode(now.code)||now.precip>RULES.wetNowMm||soon.some(h=>h.precipChance>=RULES.wetChance));
  if(!tint&&!wet&&!snow)return null;
  return {tint,colour:tint?MOODS[tint]:null,wet,snow};
}

const toF=c=>c*9/5+32;
function display(value,units){return Math.round(units==='imperial'?toF(value):value);}

function summarize(forecast,{place,when='now',units='metric',updatedAt,stale=false}){
  const window=windowFor(forecast,when),upcoming=forecast.hours.filter(h=>h.time.slice(0,13)>=forecast.now.time.slice(0,13));
  const advice=adviceFor(window.hours,{gust:when==='now'?forecast.now.gust:null});
  const day=when==='tomorrow'?forecast.days[1]:forecast.days[0];
  advice.sun=(day.uvMax??0)>=RULES.uv;if(advice.sun)advice.reasons.push(`UV index up to ${Math.round(day.uvMax)}`);
  const t=value=>display(value,units),now=forecast.now,condition=conditionFor(now.code,now.isDay);
  const tomorrow=forecast.days[1],tomorrowCondition=conditionFor(tomorrow.code??3,true);
  return {
    id:crypto.randomUUID(),kind:'weather',title:'Weather',place,when,window:window.label,units,updatedAt,stale,timezone:forecast.timezone,
    now:{temp:t(now.temp),feelsLike:t(now.feelsLike),condition:condition.label,icon:condition.icon,wind:now.wind==null?null:Math.round(units==='imperial'?now.wind*.621371:now.wind),isDay:now.isDay,time:now.time},
    today:{high:t(forecast.days[0].high),low:t(forecast.days[0].low),sunrise:forecast.days[0].sunrise,sunset:forecast.days[0].sunset,uvMax:forecast.days[0].uvMax},
    tomorrow:{high:t(tomorrow.high),low:t(tomorrow.low),condition:tomorrowCondition.label,icon:tomorrowCondition.icon},
    hours:upcoming.slice(0,24).map(h=>{const c=conditionFor(h.code,h.isDay);return {time:h.time,temp:t(h.temp),feelsLike:t(h.feelsLike),precipChance:Math.round(h.precipChance),condition:c.label,icon:c.icon};}),
    advice,mood:moodFor(now,upcoming),source:'Open-Meteo'
  };
}

function validLocation(location){
  if(!location||typeof location!=='object')throw new Error('Choose a place for the weather.');
  const {name,detail='',latitude,longitude,timezone=''}=location;
  if(typeof name!=='string'||!name.trim()||name.length>120)throw new Error('Invalid place name.');
  if(typeof detail!=='string'||detail.length>200||typeof timezone!=='string'||timezone.length>100)throw new Error('Invalid place details.');
  if(typeof latitude!=='number'||!(latitude>=-90&&latitude<=90)||typeof longitude!=='number'||!(longitude>=-180&&longitude<=180))throw new Error('Invalid coordinates.');
  return {name:name.trim(),detail:detail.trim(),latitude:round(latitude),longitude:round(longitude),timezone};
}
const round=n=>Math.round(n*100)/100;
function readWeather(config,locale=''){
  const w=config?.weather||{};let location=null;try{if(w.location)location=validLocation(w.location);}catch{}
  return {location,units:['metric','imperial'].includes(w.units)?w.units:defaultUnits(locale),orbReactions:w.orbReactions!==false};
}
function withWeather(config,input,locale=''){
  if(input===undefined)return config;
  if(!input||typeof input!=='object')throw new Error('Invalid weather settings.');
  const current=readWeather(config,locale),next={...current};
  if('location' in input)next.location=input.location===null?null:validLocation(input.location);
  if('units' in input){if(!['metric','imperial'].includes(input.units))throw new Error('Choose Celsius or Fahrenheit.');next.units=input.units;}
  if('orbReactions' in input){if(typeof input.orbReactions!=='boolean')throw new Error('Invalid weather reaction setting.');next.orbReactions=input.orbReactions;}
  return {...config,weather:next};
}
const defaultUnits=locale=>/^en-(US|LR)|-(US|BS|BZ|KY|PW|LR)$/i.test(locale||'')?'imperial':'metric';

function createWeatherService({getConfig,getLocale=()=>'',fetchImpl=fetch,now=()=>Date.now(),timeoutMs=TIMEOUT_MS}){
  const cache=new Map();
  async function getJSON(url,signal){
    const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
    let response;
    try{response=await fetchImpl(url,{signal:combined,headers:{accept:'application/json'}});}
    catch(e){if(signal?.aborted)throw e;throw new Error(timeout.aborted?'The weather service took too long to respond.':'The weather service could not be reached.');}
    if(!response.ok)throw new Error(`The weather service returned an error (${response.status}).`);
    return response.json();
  }
  async function search(query,{signal}={}){
    if(typeof query!=='string'||!query.trim()||query.length>100)throw new Error('Enter a place name.');
    const url=`${GEOCODE}?${new URLSearchParams({name:query.trim(),count:'5',language:'en',format:'json'})}`;
    const json=await getJSON(url,signal);
    return (Array.isArray(json?.results)?json.results:[]).filter(r=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)&&typeof r.name==='string').slice(0,5).map(r=>({
      name:r.name,detail:[r.admin1,r.country].filter(x=>typeof x==='string'&&x&&x!==r.name).join(', '),latitude:round(r.latitude),longitude:round(r.longitude),timezone:typeof r.timezone==='string'?r.timezone:''
    }));
  }
  async function load(location,signal){
    const key=`${location.latitude},${location.longitude}`,hit=cache.get(key),at=now();
    if(hit&&at-hit.at<CACHE_MS)return {...hit,stale:false};
    const params=new URLSearchParams({latitude:String(location.latitude),longitude:String(location.longitude),timezone:'auto',forecast_days:'3',
      current:'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
      hourly:'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_gusts_10m,is_day',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max'});
    try{
      const forecast=parseForecast(await getJSON(`${FORECAST}?${params}`,signal));
      const entry={forecast,at};cache.set(key,entry);
      while(cache.size>20)cache.delete(cache.keys().next().value);
      return {...entry,stale:false};
    }catch(e){
      if(!signal?.aborted&&hit&&at-hit.at<STALE_MS)return {...hit,stale:true};
      throw e;
    }
  }
  async function forecast({place=null,when='now'}={},{signal}={}){
    if(!WHEN.includes(when??'now'))throw new Error('Choose now, today, tonight or tomorrow.');
    if(place!==null&&(typeof place!=='string'||place.length>100))throw new Error('Invalid place name.');
    const settings=readWeather(getConfig(),getLocale());
    let location,saved=false;
    if(place?.trim()){
      const [match]=await search(place,{signal});
      if(!match)throw new Error(`No place called “${place.trim()}” was found.`);
      location=match;saved=!!settings.location&&settings.location.latitude===match.latitude&&settings.location.longitude===match.longitude;
    }else{
      if(!settings.location)throw new Error('Set your weather location in Settings → Connectors → Weather, or name a place.');
      location=settings.location;saved=true;
    }
    const {forecast:data,at,stale}=await load(location,signal);
    return summarize(data,{place:{name:location.name,detail:location.detail,saved},when:when??'now',units:settings.units,updatedAt:new Date(at).toISOString(),stale});
  }
  return {forecast,search,clear:()=>cache.clear()};
}
// Compact tool result: the model needs the numbers and advice, not the icons or every hour.
function forModel(visual){
  const {id,kind,title,hours,now:{icon,...now},tomorrow:{icon:_,...tomorrow},...rest}=visual;
  return {...rest,now,tomorrow,hours:hours.filter((_,i)=>i%2===0).slice(0,12).map(({icon,...h})=>h),displayed:true};
}
module.exports={createWeatherService,parseForecast,conditionFor,adviceFor,moodFor,windowFor,summarize,forModel,readWeather,withWeather,validLocation,defaultUnits,RULES};
