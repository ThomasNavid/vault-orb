(() => {
  const el=id=>document.getElementById(id),keyIds={openai:'api-key',openrouter:'openrouter-key',deepgram:'deepgram-key',elevenlabs:'elevenlabs-key'};
  let api,preview=false,revision=0;
  const value=id=>el(id).value.trim();
  const update=()=>{el('pipeline-settings').hidden=value('voice-mode')!=='pipeline';el('realtime-settings').hidden=value('voice-mode')!=='realtime';el('reasoning-settings').hidden=!el('reasoning-enabled').checked;};
  const key=provider=>{if(el('remove-'+provider).checked)throw new Error('Uncheck Remove saved key before checking this provider.');return value(keyIds[provider]);};
  const choices=(id,items)=>el(id).replaceChildren(...items.map(item=>{const option=document.createElement('option');option.value=item.id;option.label=item.name;return option;}));
  async function run(button,work){const token=revision;button.disabled=true;el('provider-status').textContent='Checking provider…';try{if(preview)throw new Error('Provider connections are available in the Mac app.');const message=await work(token);if(token===revision)el('provider-status').textContent=message;}catch(e){if(token===revision)el('provider-status').textContent=e.message;}finally{button.disabled=false;}}
  for(const role of ['chat','reasoning']){
    el(role+'-provider').onchange=()=>{revision++;el(role+'-model').value='';el(role+'-models').replaceChildren();el('provider-status').textContent='Find models, then choose one for this provider.';};
    el(role+'-model-refresh').onclick=e=>run(e.currentTarget,async token=>{const provider=value(role+'-provider'),result=await api.providerCatalog({provider,key:key(provider)});if(token===revision)choices(role+'-models',result.models.filter(m=>m.role==='text'));return `${result.models.filter(m=>m.role==='text').length} model candidates loaded. Search the model field, then test your selection for tool compatibility.`;});
    el(role+'-model-test').onclick=e=>run(e.currentTarget,async()=>{const provider=value(role+'-provider');return (await api.testModel({provider,model:value(role+'-model'),key:key(provider)})).message;});
  }
  el('realtime-refresh').onclick=e=>run(e.currentTarget,async token=>{const result=await api.providerCatalog({provider:'openai',key:key('openai')});if(token===revision){choices('realtime-models',result.models.filter(m=>m.role==='realtime'));choices('transcription-models',result.models.filter(m=>m.role==='transcription'));}return 'Account models loaded. Start a voice conversation after saving to verify audio access.';});
  el('stt-refresh').onclick=e=>run(e.currentTarget,async token=>{const result=await api.providerCatalog({provider:'deepgram',key:key('deepgram')});if(token===revision)choices('stt-models',result.models);return 'Recognition models loaded. Start voice after saving to verify recognition.';});
  el('tts-refresh').onclick=e=>run(e.currentTarget,async token=>{const result=await api.providerCatalog({provider:'elevenlabs',key:key('elevenlabs')});if(token===revision){choices('tts-models',result.models);choices('tts-voices',result.voices);}return 'Speech models and your voices loaded. Select a voice by name or ID.';});
  el('voice-mode').onchange=update;el('reasoning-enabled').onchange=update;
  window.orbProviderSettings={
    load(settings,client,isPreview){api=client;preview=isPreview;revision++;
      const ai=settings.ai||{chat:{provider:'openai',model:'gpt-6-sol'},reasoning:null,voice:{mode:'realtime',realtimeModel:'gpt-realtime-2.1',realtimeVoice:'cedar',transcriptionModel:'gpt-4o-mini-transcribe',sttModel:'nova-3',ttsModel:'eleven_flash_v2_5',voiceId:''}};
      for(const role of ['chat','reasoning']){const selected=ai[role]||ai.chat;el(role+'-provider').value=selected.provider;el(role+'-model').value=selected.model;el(role+'-models').replaceChildren();}
      el('reasoning-enabled').checked=!!ai.reasoning;
      for(const [id,field] of Object.entries({'voice-mode':'mode','realtime-model':'realtimeModel','realtime-voice':'realtimeVoice','transcription-model':'transcriptionModel','stt-model':'sttModel','tts-model':'ttsModel','tts-voice':'voiceId'}))el(id).value=ai.voice[field];
      for(const [provider,id] of Object.entries(keyIds)){el(id).value='';el(id).placeholder=settings.hasProviderKeys?.[provider]?'Key saved':'Paste API key';el('remove-'+provider).checked=false;}
      el('provider-status').textContent='Choose providers independently. Voice delegates vault requests to your chat & tools model.';update();
    },
    read(){return {ai:{chat:{provider:value('chat-provider'),model:value('chat-model')},reasoning:el('reasoning-enabled').checked?{provider:value('reasoning-provider'),model:value('reasoning-model')}:null,voice:{mode:value('voice-mode'),realtimeModel:value('realtime-model'),realtimeVoice:value('realtime-voice'),transcriptionModel:value('transcription-model'),sttProvider:'deepgram',sttModel:value('stt-model'),ttsProvider:'elevenlabs',ttsModel:value('tts-model'),voiceId:value('tts-voice')}},providerKeys:Object.fromEntries(Object.entries(keyIds).map(([provider,id])=>[provider,el('remove-'+provider).checked?null:value(id)]))};},
    clear(){revision++;for(const id of Object.values(keyIds))el(id).value='';}
  };
})();
