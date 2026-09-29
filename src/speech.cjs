const {request}=require('./providers.cjs');
const {randomUUID}=require('node:crypto');
async function transcribe(audio,mime,voice,{getKey,signal,fetchImpl}={}){
  if(!(audio instanceof Uint8Array)||!audio.length||audio.length>8*1024*1024)throw new Error('Voice recording must be between 1 byte and 8 MB.');
  if(!['audio/webm','audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].includes(mime))throw new Error('Unsupported recording format.');
  const query=new URLSearchParams({model:voice.sttModel,smart_format:'true'});
  const data=await request(voice.sttProvider,`/listen?${query}`,getKey(voice.sttProvider),{body:audio,contentType:mime,signal,fetchImpl});
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim()||'';
}
async function speak(text,voice,{getKey,signal,fetchImpl}={}){
  if(typeof text!=='string'||!text.trim()||text.length>12000)throw new Error('The answer is too long to speak. Read it in the transcript.');
  return request(voice.ttsProvider,`/text-to-speech/${encodeURIComponent(voice.voiceId)}?output_format=mp3_44100_128`,getKey(voice.ttsProvider),{body:{text,model_id:voice.ttsModel},signal,fetchImpl,binary:true});
}
// One conversation, one active turn. Cancellation never retries a model request or an edit.
class SpeechSession {
  constructor({agent,voice,getKey,signal,fetchImpl,onTranscript=()=>{}}){this.id=randomUUID();this.agent=agent;this.voice=voice;this.getKey=getKey;this.signal=signal;this.fetchImpl=fetchImpl;this.onTranscript=onTranscript;this.history=[];this.turn=null;}
  interrupt(){this.turn?.abort();}
  respond(payload){
    if(this.turn&&!this.turn.signal.aborted)throw new Error('A voice turn is already running.');
    const previous=this.pending,controller=new AbortController();this.turn=controller;
    this.pending=(async()=>{await previous?.catch(()=>{});return this.run(payload,controller);})();
    return this.pending;
  }
  async run({audio,mime,text},controller){
    const signal=AbortSignal.any([this.signal,controller.signal]);
    const options={getKey:this.getKey,signal,fetchImpl:this.fetchImpl};
    let userText='',answer;
    try {
      signal.throwIfAborted();
      userText=text===undefined?await transcribe(audio,mime,this.voice,options):text;
      signal.throwIfAborted();
      if(!userText)return {text:'',audio:null};
      if(typeof userText!=='string'||userText.length>12000)throw new Error('Enter a message up to 12,000 characters.');
      this.history.push({role:'user',content:userText});this.onTranscript('user',userText);
      answer=await this.agent.respond([{role:'user',content:'Voice conversation: keep answers brief and natural. Read vault facts with tools. Tool results confirm edits. Previous interrupted requests must not be repeated unless the user asks.'},...this.history.slice(-24)],{signal});
      signal.throwIfAborted();
      this.history.push({role:'assistant',content:answer.text});this.onTranscript('assistant',answer.text);
      let bytes;
      try{bytes=await speak(answer.text,this.voice,options);}catch(e){signal.throwIfAborted();return {...answer,audio:null,speechError:e.message};}
      signal.throwIfAborted();return {...answer,audio:bytes};
    }catch(e){
      if(userText&&!answer)this.history.push({role:'assistant',content:'The previous request was interrupted or failed. Any confirmed edits remain saved in Activity. Do not repeat those actions automatically.'});
      throw e;
    }finally{if(this.turn===controller)this.turn=null;}
  }
}
module.exports={transcribe,speak,SpeechSession};
