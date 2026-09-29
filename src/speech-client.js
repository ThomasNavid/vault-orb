// Turn-based speech pipeline. Credentials and provider requests stay in the main process.
(() => {
  class SpeechClient {
    constructor({api,stream,analyser,onStatus,onError,onEnd}){Object.assign(this,{api,stream,analyser,onStatus,onError,onEnd});this.closed=false;this.sequence=0;this.pending=Promise.resolve();this.muted=false;}
    async start(){
      const session=await this.api.speechStart();if(this.closed)return;
      this.id=session.id;
      this.mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
      if(!this.mime)throw new Error('This app cannot record a supported audio format.');
      this.samples=new Float32Array(this.analyser.fftSize);this.record();this.tick();
      this.onStatus('listening','Go ahead. Pause briefly when you finish.');
    }
    stopPlayback(){if(this.audio){this.audio.pause();this.audio.onended=null;this.audio.onerror=null;this.audio=null;}if(this.url){URL.revokeObjectURL(this.url);this.url=null;}}
    interrupt(){this.sequence++;this.stopPlayback();if(this.id)this.api.speechInterrupt(this.id).catch(e=>{if(!this.closed)this.onError(e);});}
    record(){
      if(this.closed)return;
      this.chunks=[];this.started=performance.now();this.firstSound=0;this.lastSound=0;this.voiced=false;
      const recorder=new MediaRecorder(this.stream,{mimeType:this.mime});this.recorder=recorder;
      recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data);};
      recorder.onerror=()=>{if(!this.closed){this.onError(new Error('Microphone recording failed. Reconnect voice.'));this.onEnd();}};
      recorder.start(100);
    }
    finish(send){
      const recorder=this.recorder;if(!recorder||recorder.state==='inactive')return;
      this.recorder=null;
      recorder.onstop=()=>{
        if(this.closed)return;
        const blob=send?new Blob(this.chunks,{type:this.mime}):null;
        this.record();
        if(blob)this.answer({blob});
      };
      recorder.stop();
    }
    tick(){
      if(this.closed)return;
      this.analyser.getFloatTimeDomainData(this.samples);
      const rms=Math.sqrt(this.samples.reduce((sum,n)=>sum+n*n,0)/this.samples.length),now=performance.now();
      if(this.recorder){
        if(!this.muted&&rms>0.022){
          this.firstSound ||= now;this.lastSound=now;
          if(!this.voiced&&now-this.firstSound>=140){this.voiced=true;this.interrupt();this.onStatus('listening','I’m listening.');}
        }else if(!this.voiced){this.firstSound=0;}
        if(this.voiced&&now-this.firstSound>30000){this.onError(new Error('That voice turn exceeded 30 seconds. Reconnect and pause between shorter requests.'));this.onEnd();return;}
        if(this.voiced&&now-this.lastSound>850)this.finish(true);
        else if(!this.voiced&&!this.firstSound&&now-this.started>2000)this.finish(false);
      }
      this.frame=requestAnimationFrame(()=>this.tick());
    }
    setMuted(value){this.muted=value;if(value)this.finish(false);}
    answer({blob,text}){
      if(this.closed)return;
      this.interrupt();const sequence=this.sequence;
      this.onStatus('thinking','Thinking it through…');
      // Wait for an interrupted request to settle before starting the next turn.
      this.pending=this.pending.catch(()=>{}).then(async()=>{
        if(this.closed||sequence!==this.sequence)return;
        const payload=blob?{audio:new Uint8Array(await blob.arrayBuffer()),mime:this.mime}:{text};
        if(this.closed||sequence!==this.sequence)return;
        const result=await this.api.speechTurn({id:this.id,...payload});
        if(this.closed||sequence!==this.sequence)return;
        if(result.speechError)this.onError(new Error(result.speechError));
        if(!result.audio?.length){this.onStatus('listening','I’m listening.');return;}
        this.url=URL.createObjectURL(new Blob([result.audio],{type:'audio/mpeg'}));this.audio=new Audio(this.url);
        this.audio.onended=()=>{if(this.closed||sequence!==this.sequence)return;this.stopPlayback();this.onStatus('listening','I’m listening.');};
        this.audio.onerror=()=>{if(this.closed||sequence!==this.sequence)return;this.stopPlayback();this.onError(new Error('Speech could not play. The answer is in the transcript.'));this.onStatus('listening','I’m listening.');};
        this.onStatus('speaking','Here’s what I found.');await this.audio.play();
      }).catch(e=>{if(!this.closed&&sequence===this.sequence){this.stopPlayback();this.onError(e);this.onStatus('listening','I’m listening.');}});
      return this.pending;
    }
    close(){this.closed=true;this.interrupt();cancelAnimationFrame(this.frame);if(this.recorder&&this.recorder.state!=='inactive'){this.recorder.onstop=null;this.recorder.stop();}this.recorder=null;}
  }
  window.OrbSpeechClient=SpeechClient;
})();
