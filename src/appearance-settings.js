(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./appearance.js'));
  else root.orbAppearanceSettings=factory(root.orbAppearance);
})(typeof window==='object'?window:undefined,A=>{
  // A separate saved baseline keeps previews reversible, including while a save is in flight.
  function createEditor({paint,render=()=>{}}){
    let saved=A.DEFAULT_COLOUR,draft=saved,invalid='',message='',editing=false,pending=false,revision=0;
    const state=()=>({saved,draft,invalid,message,editing,pending,revision});
    const refresh=()=>{paint(editing?draft:saved);render(state());};
    return {
      state,
      initialise(appearance){saved=A.readAppearance({appearance}).orbColour;draft=saved;refresh();},
      open(appearance){revision++;editing=true;saved=A.readAppearance({appearance}).orbColour;draft=saved;invalid='';message='';refresh();},
      close(){revision++;editing=false;draft=saved;invalid='';message='';refresh();},
      change(value){
        if(pending||!editing)return;
        message='';try{draft=A.validateColour(value);invalid='';}catch(e){invalid=e.message;}
        refresh();
      },
      async save(work){
        if(pending)throw new Error('Wait for the current save to finish.');
        if(invalid)throw new Error(invalid);
        const token=revision;pending=true;message='Saving colour…';refresh();
        try{
          const result=await work({orbColour:draft});
          saved=A.validateColour(result.appearance.orbColour);draft=saved;
          message=token===revision?'Colour saved.':'';
          return result;
        }catch(e){
          if(token===revision)message=e.message.replace(/^Error invoking remote method '[^']+': Error: /,'');
          throw e;
        }finally{pending=false;refresh();}
      }
    };
  }
  // HSV suits a saturation/brightness square with a separate hue strip.
  function toHsv(colour){
    const [r,g,b]=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255),hi=Math.max(r,g,b),delta=hi-Math.min(r,g,b);
    const h=!delta?0:hi===r?((g-b)/delta+6)%6:hi===g?(b-r)/delta+2:(r-g)/delta+4;
    return {h:h*60,s:hi?delta/hi:0,v:hi};
  }
  function fromHsv({h,s,v}){
    const channel=n=>{const k=(n+h/60)%6;return Math.round(255*(v-v*s*Math.max(0,Math.min(k,4-k,1))));};
    return '#'+[5,3,1].map(n=>channel(n).toString(16).padStart(2,'0')).join('');
  }
  const readableInk=colour=>{const [r,g,b]=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16));return (r*299+g*587+b*114)/1000>160?'#111':'#fff';};
  function bind({api,visual,isPreview,onCommit}){
    const el=id=>document.getElementById(id),hex=el('orb-colour-hex'),area=el('orb-colour-area'),hue=el('orb-colour-hue'),status=el('appearance-status'),group=area.closest('.appearance-settings');
    // Hue survives greys and black so dragging back into colour does not jump to red.
    let hsv=toHsv(A.DEFAULT_COLOUR),editor;
    const choose=next=>{hsv=next;editor.change(fromHsv(hsv));};
    const swatches=A.presets.map(([name,colour])=>{
      const button=document.createElement('button');button.type='button';button.className='colour-swatch';button.style.setProperty('--swatch',colour);
      button.setAttribute('aria-label',name==='Blue'?'Blue (default)':name);button.title=name;
      el('orb-colour-presets').append(button);
      button.onclick=()=>editor.change(colour);return {button,colour};
    });
    editor=createEditor({paint:colour=>visual.setColour(colour),render:s=>{
      if(!s.invalid&&fromHsv(hsv)!==s.draft){const next=toHsv(s.draft);hsv=next.s&&next.v?next:{...next,h:hsv.h};}
      if(!s.invalid&&document.activeElement!==hex)hex.value=s.draft;
      group.style.setProperty('--draft',s.draft);group.style.setProperty('--draft-ink',readableInk(s.draft));
      group.style.setProperty('--hue',String(Math.round(hsv.h)));group.style.setProperty('--sat',String(hsv.s));group.style.setProperty('--val',String(hsv.v));
      hue.value=String(Math.round(hsv.h));area.setAttribute('aria-valuenow',String(Math.round(hsv.s*100)));
      area.setAttribute('aria-valuetext',`Saturation ${Math.round(hsv.s*100)}%, brightness ${Math.round(hsv.v*100)}%`);
      hex.setCustomValidity(s.invalid);hex.setAttribute('aria-invalid',String(!!s.invalid));
      el('orb-colour-error').textContent=s.invalid;el('orb-colour-error').hidden=!s.invalid;
      for(const {button,colour} of swatches){button.setAttribute('aria-pressed',String(!s.invalid&&s.draft===colour));button.disabled=s.pending;}
      hue.disabled=hex.disabled=el('orb-colour-reset').disabled=s.pending;area.setAttribute('aria-disabled',String(s.pending));
      el('orb-colour-apply').disabled=s.pending||!!s.invalid||s.draft===s.saved;
      el('footer-primary').disabled=s.pending;
      status.textContent=s.message||(isPreview?'Preview only. Applied colours last until this page reloads.':s.draft!==s.saved?'Previewing. Apply colour to keep it.':'Your colour is saved on this Mac.');
    }});
    const pick=e=>{const box=area.getBoundingClientRect(),clamp=n=>Math.max(0,Math.min(1,n));choose({h:hsv.h,s:clamp((e.clientX-box.left)/box.width),v:1-clamp((e.clientY-box.top)/box.height)});};
    area.onpointerdown=e=>{if(editor.state().pending)return;area.setPointerCapture(e.pointerId);area.focus();pick(e);area.onpointermove=pick;};
    area.onpointerup=area.onpointercancel=()=>{area.onpointermove=null;};
    area.onkeydown=e=>{
      const step=e.shiftKey?.1:.02,move={ArrowLeft:['s',-step],ArrowRight:['s',step],ArrowUp:['v',step],ArrowDown:['v',-step]}[e.key];
      if(!move||editor.state().pending)return;e.preventDefault();choose({...hsv,[move[0]]:Math.max(0,Math.min(1,hsv[move[0]]+move[1]))});
    };
    hue.oninput=()=>choose({...hsv,h:Number(hue.value),s:hsv.s||.75,v:hsv.v||.9});
    hex.oninput=()=>editor.change(/^#/.test(hex.value)?hex.value:'#'+hex.value);
    hex.onblur=()=>{const s=editor.state();if(!s.invalid)hex.value=s.draft;};
    el('orb-colour-reset').onclick=()=>editor.change(A.DEFAULT_COLOUR);
    el('orb-colour-apply').onclick=async()=>{try{const result=await editor.save(appearance=>api.saveAppearance(appearance));onCommit(result.appearance);}catch{/* The editor displays the save failure inline. */}};
    return editor;
  }
  return {createEditor,bind};
});
