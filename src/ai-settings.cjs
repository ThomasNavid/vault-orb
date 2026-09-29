// Provider configuration is deliberately separate from encrypted credentials.
const PROVIDERS=['openai','openrouter','deepgram','elevenlabs'];
const DEFAULT_AI={chat:{provider:'openai',model:'gpt-6-sol'},reasoning:null,voice:{mode:'realtime',realtimeModel:'gpt-realtime-2.1',realtimeVoice:'cedar',transcriptionModel:'gpt-4o-mini-transcribe',sttProvider:'deepgram',sttModel:'nova-3',ttsProvider:'elevenlabs',ttsModel:'eleven_flash_v2_5',voiceId:''}};
function identifier(value,label){if(typeof value!=='string'||!value.trim()||value.length>200||! /^[a-zA-Z0-9_./:@+-]+$/.test(value))throw new Error(`Choose a valid ${label}.`);return value.trim();}
function selection(value){if(!value||!['openai','openrouter'].includes(value.provider))throw new Error('Choose OpenAI or OpenRouter.');return {provider:value.provider,model:identifier(value.model,'model')};}
function normalizeAI(value={}){
  const voice={...DEFAULT_AI.voice,...value.voice};
  if(!['realtime','pipeline','off'].includes(voice.mode))throw new Error('Choose a supported voice mode.');
  if(voice.sttProvider!=='deepgram'||voice.ttsProvider!=='elevenlabs')throw new Error('Unsupported speech provider.');
  for(const field of ['realtimeModel','realtimeVoice','transcriptionModel','sttModel','ttsModel'])voice[field]=identifier(voice[field],field);
  voice.voiceId=voice.voiceId?identifier(voice.voiceId,'speaking voice'):'';
  if(voice.mode==='pipeline'&&!voice.voiceId)throw new Error('Choose an ElevenLabs voice before enabling independent voice.');
  return {chat:selection(value.chat||DEFAULT_AI.chat),reasoning:value.reasoning?selection(value.reasoning):null,voice};
}
function credentials(config){return {...(config.encryptedKey?{openai:config.encryptedKey}:{}),...config.providerKeys};}
function keyFor(config,provider,storage){if(!PROVIDERS.includes(provider))throw new Error('Unknown provider.');const key=credentials(config)[provider];if(!key)return '';if(!storage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');return storage.decryptString(Buffer.from(key,'base64'));}
function saveAI(config,{ai,providerKeys={},key},storage){
  const next={...config,ai:normalizeAI(ai||config.ai),providerKeys:credentials(config)};
  if(key)providerKeys={...providerKeys,openai:key};
  for(const [provider,value] of Object.entries(providerKeys)){
    if(!PROVIDERS.includes(provider))throw new Error('Unknown provider.');
    if(value===null){delete next.providerKeys[provider];continue;}
    if(value==='')continue;
    if(typeof value!=='string'||value.length>2000||!value.trim()||/[\r\n]/.test(value))throw new Error(`Enter a valid ${provider} key.`);
    if(!storage.isEncryptionAvailable())throw new Error('macOS key encryption is unavailable.');
    next.providerKeys[provider]=storage.encryptString(value.trim()).toString('base64');
  }
  delete next.encryptedKey;
  return next;
}
function publicAI(config){
  const ai=normalizeAI(config.ai),keys=credentials(config),hasProviderKeys=Object.fromEntries(PROVIDERS.map(p=>[p,!!keys[p]]));
  const chatReady=hasProviderKeys[ai.chat.provider]&&(!ai.reasoning||hasProviderKeys[ai.reasoning.provider]);
  const voiceReady=chatReady&&(ai.voice.mode==='realtime'?hasProviderKeys.openai:ai.voice.mode==='pipeline'?hasProviderKeys.deepgram&&hasProviderKeys.elevenlabs&&!!ai.voice.voiceId:false);
  return {ai,hasProviderKeys,chatReady,voiceReady,hasKey:chatReady};
}
module.exports={PROVIDERS,DEFAULT_AI,normalizeAI,selection,keyFor,saveAI,publicAI};
