const {selection}=require('./ai-settings.cjs');
const BASE={openai:'https://api.openai.com/v1',openrouter:'https://openrouter.ai/api/v1',deepgram:'https://api.deepgram.com/v1',elevenlabs:'https://api.elevenlabs.io/v1'};
const LABEL={openai:'OpenAI',openrouter:'OpenRouter',deepgram:'Deepgram',elevenlabs:'ElevenLabs'};
async function request(provider,path,key,{body,method='POST',signal,fetchImpl=fetch,binary=false,form=false,contentType,publicAccess=false}={}){
  if(!BASE[provider])throw new Error('Unknown provider.');
  if(!key&&!publicAccess)throw new Error(`Add your ${LABEL[provider]} API key in Settings first.`);
  const headers=key?(provider==='elevenlabs'?{'xi-api-key':key}:{Authorization:`${provider==='deepgram'?'Token':'Bearer'} ${key}`}):{};
  if(contentType)headers['Content-Type']=contentType;else if(body!==undefined&&!form)headers['Content-Type']='application/json';
  const timeout=AbortSignal.timeout(150000);
  const response=await fetchImpl(BASE[provider]+path,{method,headers,body:body===undefined?undefined:form||contentType?body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok){let detail='';try{const data=await response.json();detail=data.error?.message||data.detail?.message||data.err_msg||'';}catch{}if(key)detail=String(detail).split(key).join('[redacted]');throw new Error(`${LABEL[provider]} ${response.status}: ${String(detail||response.statusText||'Request failed').slice(0,500)}`);}
  if(binary)return new Uint8Array(await response.arrayBuffer());
  return form?response.text():response.json();
}
function openAIReasoning(model){return /^(gpt-(?:5|6)|o[134])/.test(model)?{reasoning:{effort:'medium'},include:['reasoning.encrypted_content']}:{ };}
function createTextSession({provider,model},messages,instructions,tools,{key,signal,fetchImpl}={}){
  selection({provider,model});
  const input=provider==='openai'?[...messages]:[{role:'system',content:instructions},...messages];
  return {
    async next(){
      if(provider==='openai'){
        const result=await request(provider,'/responses',key,{signal,fetchImpl,body:{model,...openAIReasoning(model),store:false,instructions,input,tools:tools.map(t=>({...t,strict:true})),parallel_tool_calls:false,max_output_tokens:8000}});
        if(result.error||['failed','incomplete'].includes(result.status))throw new Error(result.error?.message||'The model could not finish. Try a narrower request.');
        const output=result.output||[];input.push(...output);
        return {calls:output.filter(i=>i.type==='function_call'),text:output.filter(i=>i.type==='message').flatMap(i=>i.content||[]).map(c=>c.text||c.refusal||'').join('\n')};
      }
      const result=await request(provider,'/chat/completions',key,{signal,fetchImpl,body:{model,messages:input,tools:tools.map(({type,...fn})=>({type,function:fn})),tool_choice:'auto',provider:{require_parameters:true,allow_fallbacks:false},max_tokens:8000}});
      const choice=result.choices?.[0],message=choice?.message;
      if(result.error||!message||['length','content_filter','error'].includes(choice.finish_reason))throw new Error(result.error?.message||'The model could not finish. Try a narrower request.');
      // Carry the complete assistant message, including signed/encrypted reasoning, unchanged.
      input.push(message);
      return {calls:(message.tool_calls||[]).map(c=>({call_id:c.id,name:c.function?.name,arguments:c.function?.arguments})),text:typeof message.content==='string'?message.content:message.refusal||''};
    },
    result(call,result){input.push(provider==='openai'?{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)}:{role:'tool',tool_call_id:call.call_id,content:JSON.stringify(result)});}
  };
}
// Validate model-authored arguments even when a provider does not enforce strict schemas.
function validateArguments(schema,value,path='arguments'){
  const types=Array.isArray(schema.type)?schema.type:[schema.type];
  const type=value===null?'null':Array.isArray(value)?'array':typeof value;
  if(!types.includes(type)&&!(type==='number'&&Number.isInteger(value)&&types.includes('integer')))throw new Error(`Invalid ${path}: expected ${types.join(' or ')}.`);
  if(type==='number'&&!Number.isFinite(value))throw new Error(`Invalid ${path}.`);
  if(schema.enum&&!schema.enum.includes(value))throw new Error(`Invalid ${path}: unsupported value.`);
  if(type==='object'){
    for(const name of schema.required||[])if(!Object.hasOwn(value,name))throw new Error(`Missing ${path}.${name}.`);
    for(const name of Object.keys(value)){if(!Object.hasOwn(schema.properties||{},name))throw new Error(`Unknown ${path}.${name}.`);validateArguments(schema.properties[name],value[name],`${path}.${name}`);}
  }
  if(type==='array')for(const item of value)validateArguments(schema.items,item,`${path}[]`);
  return value;
}
async function catalog(provider,{key,fetchImpl,signal}={}){
  if(provider==='openrouter'){
    const data=await request(provider,'/models',key,{method:'GET',fetchImpl,signal,publicAccess:true});
    return {models:(data.data||[]).filter(m=>m.supported_parameters?.includes('tools')&&m.architecture?.output_modalities?.includes('text')).map(m=>({id:m.id,name:m.name||m.id,role:'text'})),voices:[]};
  }
  if(provider==='openai'){
    const data=await request(provider,'/models',key,{method:'GET',fetchImpl,signal});
    return {models:(data.data||[]).filter(m=>/^(gpt-|o[134]|chatgpt-)/.test(m.id)&&!/(image|audio|tts|search|computer|codex|embedding)/.test(m.id)).map(m=>({id:m.id,name:m.id,role:m.id.includes('transcribe')?'transcription':m.id.includes('realtime')?'realtime':'text'})),voices:['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar'].map(id=>({id,name:id}))};
  }
  if(provider==='deepgram'){
    const data=await request(provider,'/models',key,{method:'GET',fetchImpl,signal});
    return {models:(data.stt||[]).filter(m=>m.batch===true).map(m=>({id:m.canonical_name||m.name,name:m.name,role:'transcription'})),voices:[]};
  }
  if(provider==='elevenlabs'){
    const [models,voices]=await Promise.all([request(provider,'/models',key,{method:'GET',fetchImpl,signal}),request(provider,'/voices',key,{method:'GET',fetchImpl,signal})]);
    return {models:models.filter(m=>m.can_do_text_to_speech).map(m=>({id:m.model_id,name:m.name,role:'speech'})),voices:(voices.voices||[]).map(v=>({id:v.voice_id,name:v.name}))};
  }
  throw new Error('Unknown provider.');
}
async function testText(config,options){
  const session=createTextSession(config,[{role:'user',content:'Call connection_check with ok=true. This is a connection test.'}],'Call only connection_check. Do not access any user data.',[{type:'function',name:'connection_check',description:'Confirm tool support.',parameters:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false}}],options);
  const result=await session.next();
  if(!result.calls.some(c=>c.name==='connection_check'&&c.arguments&&JSON.parse(c.arguments).ok===true))throw new Error('The model did not complete the tool compatibility check. Choose another tool-capable model.');
  return {message:'Connection and tool calling verified. This test uses a small API request.'};
}
module.exports={request,createTextSession,validateArguments,catalog,testText};
