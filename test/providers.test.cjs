const {test}=require('node:test'),assert=require('node:assert/strict');
const {Agent}=require('../src/agent.cjs');
const {normalizeAI,saveAI,publicAI,keyFor}=require('../src/ai-settings.cjs');
const {catalog,request,testText}=require('../src/providers.cjs');
const {transcribe,speak,SpeechSession}=require('../src/speech.cjs');
const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('encrypted:'+s),decryptString:b=>b.toString().slice(10)};
const json=data=>({ok:true,json:async()=>data});
const selection={provider:'openrouter',model:'vendor/tool-model'};
const ai=()=>normalizeAI({chat:selection});
const toolCall=(name,args,id='call_1')=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const response=message=>json({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]});
const final=text=>response({role:'assistant',content:text});
const listArgs={scope:'today',date:null,include_completed:false};

test('legacy encrypted key migrates without changing defaults or exposing credentials',()=>{
  const old={encryptedKey:storage.encryptString('legacy').toString('base64'),vaultPath:'/vault'};
  assert.equal(publicAI(old).voiceReady,true);
  const saved=saveAI(old,{},storage);
  assert.equal(saved.encryptedKey,undefined);assert.equal(saved.vaultPath,'/vault');
  assert.equal(saved.ai.chat.model,'gpt-6-sol');assert.equal(keyFor(saved,'openai',storage),'legacy');
  assert.equal(JSON.stringify(publicAI(saved)).includes('encrypted:'),false);
});
test('OpenRouter-only chat needs no OpenAI or voice key; explicit key deletion persists',()=>{
  let config=saveAI({}, {ai:ai(),providerKeys:{openrouter:'router'}},storage);
  assert.equal(publicAI(config).chatReady,true);assert.equal(publicAI(config).voiceReady,false);
  config=saveAI(config,{providerKeys:{openrouter:''}},storage);assert.equal(keyFor(config,'openrouter',storage),'router');
  config=saveAI(config,{providerKeys:{openrouter:null}},storage);assert.equal(publicAI(config).chatReady,false);
  assert.throws(()=>saveAI({}, {providerKeys:{arbitrary:'key'}},storage),/Unknown provider/);
  assert.throws(()=>saveAI({}, {providerKeys:{openrouter:'key'}},{...storage,isEncryptionAvailable:()=>false}),/encryption/);
});
test('voice and reasoning readiness uses only the configured providers',()=>{
  const config=saveAI({}, {ai:{chat:selection,reasoning:{provider:'openai',model:'gpt-6-sol'},voice:{mode:'pipeline',voiceId:'my-voice'}},providerKeys:{openrouter:'router',deepgram:'dg',elevenlabs:'el'}},storage);
  assert.equal(publicAI(config).chatReady,false);
  config.ai.reasoning=null;assert.equal(publicAI(config).voiceReady,true);
  config.ai.voice.mode='off';assert.equal(publicAI(config).voiceReady,false);
  assert.throws(()=>normalizeAI({voice:{mode:'pipeline'}}),/voice/);
});
test('OpenRouter carries complete reasoning and tool result messages through sequential tool turns',async()=>{
  const requests=[],reasoning=[{type:'reasoning.encrypted',data:'signed'}];let calls=0;
  const agent=new Agent({vault:{read:()=>({content:''}),tasks:query=>{if(query.scope)calls++;return {tasks:[],warnings:[]};}},getAI:ai,getKey:p=>{assert.equal(p,'openrouter');return 'router';},fetchImpl:async(url,options)=>{
    requests.push({url,options,body:JSON.parse(options.body)});
    return requests.length===1?response({role:'assistant',content:null,reasoning_details:reasoning,tool_calls:[toolCall('list_tasks',listArgs)]}):final('No tasks.');
  }});
  const result=await agent.respond([{role:'user',content:'Tasks?'}]);
  assert.equal(result.text,'No tasks.');assert.equal(calls,1);
  assert.equal(requests[0].url,'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(requests[0].body.model,selection.model);assert.equal(requests[0].options.headers.Authorization,'Bearer router');
  assert.ok(requests[0].body.tools.every(t=>t.function.name));
  assert.deepEqual(requests[1].body.messages.find(m=>m.reasoning_details).reasoning_details,reasoning);
  assert.equal(requests[1].body.messages.at(-1).role,'tool');assert.equal(requests[1].body.messages.at(-1).tool_call_id,'call_1');
});
test('malformed model tool arguments cannot reach vault writes',async()=>{
  let wrote=false,step=0,last;
  const agent=new Agent({vault:{read:()=>({content:''}),createTask:()=>{wrote=true;}},getAI:ai,getKey:()=> 'key',fetchImpl:async(_url,opts)=>{last=JSON.parse(opts.body);return ++step===1?response({role:'assistant',content:null,tool_calls:[toolCall('create_task',{title:'Sneaky'})]}):final('Missing arguments.');}});
  await agent.respond([{role:'user',content:'Create task'}]);assert.equal(wrote,false);assert.match(last.messages.at(-1).content,/Missing arguments/);
});
test('repeated tool call IDs do not repeat writes',async()=>{
  let wrote=0,step=0;
  const agent=new Agent({vault:{read:()=>({content:''}),appendNote:()=>{wrote++;return {path:'Notes/test.md'};}},getAI:ai,getKey:()=> 'key',fetchImpl:async()=>++step<3?response({role:'assistant',content:null,tool_calls:[toolCall('append_note',{path:'Notes/test.md',version:'v1',text:'Add'})]}):final('Saved')});
  await agent.respond([{role:'user',content:'Append Add'}]);assert.equal(wrote,1);
});
test('advanced reasoning selects its own provider and cannot delegate recursively',async()=>{
  const requests=[];
  const agent=new Agent({vault:{read:()=>({content:''})},getAI:()=>normalizeAI({chat:selection,reasoning:{provider:'openai',model:'gpt-6-sol'}}),getKey:p=>p,fetchImpl:async(url,opts)=>{
    const body=JSON.parse(opts.body);requests.push({url,body});
    if(url.includes('openrouter'))return requests.length===1?response({role:'assistant',content:null,tool_calls:[toolCall('think_deeply',{request:'Plan',context:''})]}):final('A plan');
    assert.ok(!body.tools.some(t=>t.name==='think_deeply'));return json({output:[{type:'message',content:[{text:'Careful plan'}]}]});
  }});
  assert.equal((await agent.respond([{role:'user',content:'Plan'}])).text,'A plan');
  assert.match(requests[1].url,/api.openai.com/);assert.equal(requests[1].body.model,'gpt-6-sol');
});
test('OpenRouter cancellation and incomplete answers execute no tools',async()=>{
  for(const abort of [false,true]){
    const controller=new AbortController();let called=false;
    const agent=new Agent({vault:{read:()=>({content:''}),tasks:()=>{called=true;}},getAI:ai,getKey:()=> 'key',fetchImpl:async()=>{if(abort)controller.abort();return json({choices:[{finish_reason:abort?'tool_calls':'length',message:{tool_calls:[toolCall('list_tasks',listArgs)]}}]});}});
    await assert.rejects(()=>agent.respond([{role:'user',content:'Tasks'}],{signal:controller.signal}));assert.equal(called,false);
  }
});
test('catalog filters OpenRouter models by actual tool and output capabilities',async()=>{
  const result=await catalog('openrouter',{fetchImpl:async()=>json({data:[{id:'ok',name:'OK',supported_parameters:['tools'],architecture:{output_modalities:['text']}},{id:'no-tools',supported_parameters:[],architecture:{output_modalities:['text']}},{id:'image',supported_parameters:['tools'],architecture:{output_modalities:['image']}}]})});
  assert.deepEqual(result.models.map(m=>m.id),['ok']);
});
test('connection check validates tool behavior without executing vault tools',async()=>{
  const result=await testText(selection,{key:'key',fetchImpl:async()=>response({role:'assistant',tool_calls:[toolCall('connection_check',{ok:true})]})});assert.match(result.message,/verified/);
  await assert.rejects(()=>testText(selection,{key:'key',fetchImpl:async()=>final('I do not support tools')}),/compatibility/);
});
test('provider authentication errors are identified and redact echoed keys',async()=>{
  await assert.rejects(()=>request('openrouter','/chat/completions','secret',{body:{},fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:{message:'Invalid secret'}})})}),e=>/OpenRouter 401/.test(e.message)&&!e.message.includes('secret'));
});
test('speech adapters use distinct credentials and documented payloads',async()=>{
  const voice=normalizeAI({voice:{mode:'pipeline',voiceId:'voice-123'}}).voice,requests=[];
  const options={getKey:p=>p+'-key',fetchImpl:async(url,opts)=>{requests.push({url,opts});return url.includes('deepgram')?json({results:{channels:[{alternatives:[{transcript:'Hello Orb'}]}]}}):{ok:true,arrayBuffer:async()=>Uint8Array.of(1,2).buffer};}};
  assert.equal(await transcribe(Uint8Array.of(1),'audio/webm',voice,options),'Hello Orb');
  assert.deepEqual(await speak('Hello',voice,options),Uint8Array.of(1,2));
  assert.equal(requests[0].opts.headers.Authorization,'Token deepgram-key');assert.match(requests[0].url,/model=nova-3/);
  assert.equal(requests[1].opts.headers['xi-api-key'],'elevenlabs-key');assert.match(requests[1].url,/voice-123/);
  await assert.rejects(()=>transcribe(Uint8Array.of(1),'text/html',voice,options),/format/);
});
test('speech output failures retain the confirmed answer and do not rerun tools',async()=>{
  let answers=0;const events=[];
  const session=new SpeechSession({agent:{respond:async()=>{answers++;return {text:'Saved the note.'};}},voice:normalizeAI().voice,getKey:()=> 'key',signal:new AbortController().signal,onTranscript:(...args)=>events.push(args),fetchImpl:async()=>({ok:false,status:429,json:async()=>({})})});
  const result=await session.respond({text:'Save note'});assert.equal(result.text,'Saved the note.');assert.match(result.speechError,/ElevenLabs 429/);assert.equal(answers,1);assert.equal(events.length,2);
});
test('interruption aborts pending work before synthesis and serializes the next voice turn',async()=>{
  let started,release;const ready=new Promise(r=>started=r),wait=new Promise(r=>release=r);let count=0;
  const session=new SpeechSession({agent:{respond:async(_m,{signal})=>{if(++count===1){started();await wait;signal.throwIfAborted();}return {text:'Second answer'};}},voice:normalizeAI().voice,getKey:()=> 'key',signal:new AbortController().signal,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})});
  const first=session.respond({text:'First'});await ready;session.interrupt();const second=session.respond({text:'Second'});release();
  await assert.rejects(()=>first);assert.equal((await second).text,'Second answer');
  assert.match(session.history[1].content,/interrupted/);assert.equal(session.history[2].content,'Second');
});

test('Deepgram picker uses batch-capable canonical model IDs',async()=>{
  const result=await catalog('deepgram',{key:'test',fetchImpl:async()=>json({stt:[{name:'Nova 3',canonical_name:'nova-3',batch:true,streaming:true},{name:'Live only',canonical_name:'live',batch:false,streaming:true}]})});
  assert.deepEqual(result.models,[{id:'nova-3',name:'Nova 3',role:'transcription'}]);
});
test('Realtime model and voice are configurable while its only action delegates to chat',async()=>{
  let body;const agent=new Agent({vault:{read:()=>({content:''})},getAI:()=>normalizeAI({chat:selection,voice:{realtimeModel:'gpt-realtime-test',realtimeVoice:'marin'}}),getKey:provider=>{assert.equal(provider,'openai');return 'test';},fetchImpl:async(_url,options)=>{body=JSON.parse(options.body.get('session'));return {ok:true,text:async()=> 'sdp'};}});
  assert.equal(await agent.connect('v=0\r\n'),'sdp');assert.equal(body.model,'gpt-realtime-test');assert.equal(body.audio.output.voice,'marin');assert.deepEqual(body.tools.map(t=>t.name),['run_task']);
});
