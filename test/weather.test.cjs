const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWeatherService,parseForecast,conditionFor,adviceFor,moodFor,windowFor,summarize,forModel,readWeather,withWeather,validLocation,defaultUnits}=require('../src/weather.cjs');

const LONDON={name:'London',detail:'England, United Kingdom',latitude:51.5074,longitude:-0.1278,timezone:'Europe/London'};
// A small Open-Meteo-shaped response: 48 hourly values from midnight on 29 September.
function response({feels=12,temp=14,code=3,precip=0,chance=()=>10,gust=20,hourCode=()=>3,uv=3}={}){
  const time=Array.from({length:48},(_,i)=>`2026-09-${29+Math.floor(i/24)}T${String(i%24).padStart(2,'0')}:00`);
  return {timezone:'Europe/London',
    current:{time:'2026-09-29T14:15',temperature_2m:temp,apparent_temperature:feels,precipitation:precip,weather_code:code,wind_speed_10m:15,wind_gusts_10m:gust,is_day:1},
    hourly:{time,temperature_2m:time.map((_,i)=>temp-Math.abs(14-i%24)/2),apparent_temperature:time.map((_,i)=>feels-Math.abs(14-i%24)/2),precipitation_probability:time.map((_,i)=>chance(i)),precipitation:time.map(()=>0),weather_code:time.map((_,i)=>hourCode(i)),wind_gusts_10m:time.map(()=>gust),is_day:time.map((_,i)=>i%24>=7&&i%24<19?1:0)},
    daily:{time:['2026-09-29','2026-09-30','2026-10-01'],weather_code:[3,61,2],temperature_2m_max:[16,15,17],temperature_2m_min:[9,8,10],sunrise:['2026-09-29T06:57','2026-09-30T06:59','2026-10-01T07:00'],sunset:['2026-09-29T18:42','2026-09-30T18:40','2026-10-01T18:38'],uv_index_max:[uv,2,2]}};
}
const hour=(time,feelsLike,precipChance=0,extra={})=>({time,temp:feelsLike,feelsLike,precipChance,precip:0,code:3,gust:null,isDay:true,...extra});

test('parses a forecast and rejects incomplete responses',()=>{
  const f=parseForecast(response());
  assert.equal(f.hours.length,48);assert.equal(f.days.length,2);assert.equal(f.now.feelsLike,12);assert.equal(f.timezone,'Europe/London');
  assert.throws(()=>parseForecast({}),/incomplete forecast/);
  const broken=response();broken.current.apparent_temperature=null;
  assert.throws(()=>parseForecast(broken),/feels-like/);
  const short=response();short.hourly.temperature_2m=short.hourly.temperature_2m.slice(0,10);
  assert.throws(()=>parseForecast(short),/hourly temperature/);
});

test('maps WMO codes to labels and day or night icons',()=>{
  assert.deepEqual(conditionFor(0,true),{label:'Clear',icon:'sun'});
  assert.deepEqual(conditionFor(0,false),{label:'Clear',icon:'moon'});
  assert.deepEqual(conditionFor(2,false),{label:'Partly cloudy',icon:'cloud-moon'});
  assert.equal(conditionFor(63).icon,'rain');assert.equal(conditionFor(75).icon,'snow');assert.equal(conditionFor(95).icon,'storm');assert.equal(conditionFor(45).icon,'fog');
  assert.deepEqual(conditionFor(1234),{label:'Unknown',icon:'cloud'});
});

test('jacket advice uses UK-tuned feels-like bands and steps up in strong wind',()=>{
  const jacket=feels=>adviceFor([hour('2026-09-29T15:00',20),hour('2026-09-29T18:00',feels)]).jacket;
  assert.equal(jacket(7.9),'warm');assert.equal(jacket(8),'light');assert.equal(jacket(15),'light');assert.equal(jacket(15.1),'none');
  const windy=adviceFor([hour('2026-09-29T15:00',16,0,{gust:40})]);
  assert.equal(windy.jacket,'light');assert.match(windy.reasons.join(' '),/gusts up to 40 km\/h/);
  assert.equal(adviceFor([hour('2026-09-29T15:00',16,0,{gust:39})]).jacket,'none');
  assert.equal(adviceFor([hour('2026-09-29T15:00',5,0,{gust:60})]).jacket,'warm');
  assert.match(adviceFor([hour('2026-09-29T18:00',6.4)]).reasons[0],/feels like 6° at 18:00/);
});

test('umbrella advice triggers at 40% or 0.3 mm and explains the right hour',()=>{
  assert.equal(adviceFor([hour('2026-09-29T15:00',16,39)]).umbrella,false);
  const likely=adviceFor([hour('2026-09-29T15:00',16,40)]);assert.equal(likely.umbrella,true);assert.match(likely.reasons.at(-1),/40% chance of rain around 15:00/);
  const heavy=adviceFor([hour('2026-09-29T07:00',16,3),hour('2026-09-29T16:00',16,20,{precip:.3})]);
  assert.equal(heavy.umbrella,true);assert.match(heavy.reasons.at(-1),/0\.3 mm of rain forecast around 16:00/);
  assert.equal(adviceFor([hour('2026-09-29T15:00',16,20,{precip:.29})]).umbrella,false);
  assert.deepEqual(adviceFor([]),{jacket:'none',umbrella:false,sun:false,reasons:['No forecast hours in that window.']});
});

test('orb mood thresholds: cold, hot, heat, wet and snow',()=>{
  const now=(feelsLike,extra={})=>({feelsLike,code:3,precip:0,...extra});
  assert.equal(moodFor(now(5),[])?.tint,'cold');assert.equal(moodFor(now(5.1),[]),null);
  assert.equal(moodFor(now(25.9),[]),null);assert.equal(moodFor(now(26),[]).tint,'hot');assert.equal(moodFor(now(26),[]).colour,'#ffae3d');
  assert.equal(moodFor(now(31.9),[]).tint,'hot');assert.equal(moodFor(now(32),[]).tint,'heat');
  assert.deepEqual(moodFor(now(12,{code:61}),[]),{tint:null,colour:null,wet:true,snow:false});
  assert.equal(moodFor(now(12,{precip:.2}),[]).wet,true);
  assert.equal(moodFor(now(12),[hour('a',12,49),hour('b',12,49),hour('c',12,49)]),null);
  assert.equal(moodFor(now(12),[hour('a',12,0),hour('b',12,0),hour('c',12,50)]).wet,true);
  assert.equal(moodFor(now(12),[hour('a',12,0),hour('b',12,0),hour('c',12,0),hour('d',12,90)]),null,'only the next 3 hours count');
  const snow=moodFor(now(-2,{code:73}),[]);assert.equal(snow.snow,true);assert.equal(snow.wet,false);assert.equal(snow.tint,'cold');
});

test('advice windows cover now, the rest of today, tonight and tomorrow',()=>{
  const f=parseForecast(response());
  const now=windowFor(f,'now');assert.equal(now.hours.length,12);assert.equal(now.hours[0].time,'2026-09-29T14:00');
  const today=windowFor(f,'today');assert.equal(today.hours[0].time,'2026-09-29T14:00');assert.equal(today.hours.at(-1).time,'2026-09-29T23:00');
  const tonight=windowFor(f,'tonight');assert.equal(tonight.hours[0].time,'2026-09-29T18:00');assert.equal(tonight.hours.at(-1).time,'2026-09-30T05:00');
  const tomorrow=windowFor(f,'tomorrow');assert.equal(tomorrow.hours[0].time,'2026-09-30T07:00');assert.equal(tomorrow.hours.at(-1).time,'2026-09-30T21:00');
});

test('summaries show 24 hours from now, convert to Fahrenheit, and flag sun protection',()=>{
  const f=parseForecast(response({uv:6}));
  const v=summarize(f,{place:{name:'London',detail:'',saved:true},units:'metric',updatedAt:'2026-09-29T13:15:00.000Z'});
  assert.equal(v.kind,'weather');assert.equal(v.hours.length,24);assert.equal(v.hours[0].time,'2026-09-29T14:00');
  assert.equal(v.advice.sun,true);assert.match(v.advice.reasons.at(-1),/UV index up to 6/);
  assert.equal(v.tomorrow.condition,'Light rain');
  const us=summarize(f,{place:{name:'London',detail:'',saved:true},units:'imperial',updatedAt:''});
  assert.equal(us.now.temp,57);assert.equal(us.today.high,61);
  assert.equal(us.advice.jacket,v.advice.jacket,'advice thresholds stay in °C');
  const compact=forModel(v);assert.equal(compact.hours.length,12);assert.equal(compact.now.icon,undefined);assert.equal(compact.hours[0].icon,undefined);assert.equal(compact.displayed,true);
});

test('settings validate places, units and reactions, and preserve unrelated config',()=>{
  assert.deepEqual(validLocation(LONDON),{...LONDON,latitude:51.51,longitude:-0.13});
  for(const bad of [{...LONDON,latitude:91},{...LONDON,longitude:-181},{...LONDON,name:''},{...LONDON,latitude:'51'},null])assert.throws(()=>validLocation(bad));
  const config={vaultPath:'/Vault',providerKeys:{openai:'secret'}};
  assert.deepEqual(readWeather(config,'en-GB'),{location:null,units:'metric',orbReactions:true});
  assert.equal(readWeather(config,'en-US').units,'imperial');
  const next=withWeather(config,{location:LONDON});
  assert.equal(next.vaultPath,'/Vault');assert.equal(next.providerKeys.openai,'secret');assert.equal(next.weather.location.name,'London');
  const quiet=withWeather(next,{orbReactions:false});assert.equal(quiet.weather.location.name,'London');assert.equal(quiet.weather.orbReactions,false);
  assert.equal(withWeather(quiet,{units:'imperial'}).weather.units,'imperial');
  assert.throws(()=>withWeather(config,{units:'kelvin'}),/Celsius or Fahrenheit/);
  assert.throws(()=>withWeather(config,{orbReactions:'yes'}));
  assert.equal(withWeather(config,undefined),config);
  assert.equal(readWeather({weather:{location:{name:'Nowhere',latitude:500,longitude:0}}}).location,null,'a corrupt stored place is ignored');
  assert.equal(defaultUnits('en-GB'),'metric');assert.equal(defaultUnits('en-US'),'imperial');assert.equal(defaultUnits(''),'metric');
});

function service({config={weather:{location:LONDON}},responses=[],clock={t:Date.parse('2026-09-29T13:15:00Z')},timeoutMs}={}){
  const urls=[];
  const fetchImpl=async(url,options)=>{urls.push(url);const next=responses.shift();if(typeof next==='function')return next(url,options);if(next instanceof Error)throw next;return {ok:true,status:200,json:async()=>next};};
  return {urls,clock,weather:createWeatherService({getConfig:()=>config,getLocale:()=>'en-GB',fetchImpl,now:()=>clock.t,timeoutMs})};
}

test('forecasts use rounded coordinates and are cached for ten minutes',async()=>{
  const {weather,urls,clock}=service({responses:[response(),response({feels:3})]});
  const first=await weather.forecast({place:null,when:'now'});
  assert.equal(first.place.name,'London');assert.equal(first.place.saved,true);assert.equal(first.stale,false);
  const url=new URL(urls[0]);assert.equal(url.searchParams.get('latitude'),'51.51');assert.equal(url.searchParams.get('longitude'),'-0.13');
  clock.t+=9*60000;await weather.forecast({place:null,when:'today'});assert.equal(urls.length,1);
  clock.t+=2*60000;const later=await weather.forecast({});assert.equal(urls.length,2);assert.equal(later.mood.tint,'cold');
});

test('falls back to a recent forecast when offline, but not an old one',async()=>{
  const {weather,clock}=service({responses:[response(),new Error('offline'),new Error('offline')]});
  await weather.forecast({});
  clock.t+=30*60000;const stale=await weather.forecast({});assert.equal(stale.stale,true);
  clock.t+=2*3600000;await assert.rejects(weather.forecast({}),/could not be reached/);
});

test('reports errors, timeouts and missing setup plainly',async()=>{
  await assert.rejects(service({config:{}}).weather.forecast({}),/Settings → Connectors → Weather, or name a place/);
  await assert.rejects(service({responses:[()=>({ok:false,status:503})]}).weather.forecast({}),/returned an error \(503\)/);
  const slow=service({timeoutMs:20,responses:[(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))]});
  await assert.rejects(slow.weather.forecast({}),/took too long/);
  const controller=new AbortController(),aborted=service({responses:[(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))]});
  const pending=aborted.weather.forecast({},{signal:controller.signal});controller.abort();
  await assert.rejects(pending,e=>e.name==='AbortError');
  await assert.rejects(service().weather.forecast({when:'next week'}),/now, today, tonight or tomorrow/);
});

test('named places use the geocoder top match and show whether it is the saved place',async()=>{
  const geo={results:[{name:'Lisbon',admin1:'Lisbon District',country:'Portugal',latitude:38.7167,longitude:-9.1333,timezone:'Europe/Lisbon'},{name:'Lisbon',admin1:'Ohio',country:'United States',latitude:40.77,longitude:-80.77}]};
  const {weather,urls}=service({responses:[geo,response()]});
  const v=await weather.forecast({place:'Lisbon',when:'tomorrow'});
  assert.deepEqual(v.place,{name:'Lisbon',detail:'Lisbon District, Portugal',saved:false});assert.equal(v.window,'tomorrow');
  assert.equal(new URL(urls[0]).searchParams.get('name'),'Lisbon');assert.equal(new URL(urls[1]).searchParams.get('latitude'),'38.72');
  const home=service({responses:[{results:[{name:'London',admin1:'England',country:'United Kingdom',latitude:51.5085,longitude:-0.1257}]},response()]});
  assert.equal((await home.weather.forecast({place:'London'})).place.saved,true);
  await assert.rejects(service({responses:[{}]}).weather.forecast({place:'Atlantis'}),/No place called “Atlantis”/);
  await assert.rejects(service().weather.search(' '),/Enter a place name/);
});
