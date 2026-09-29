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
  function bind({api,visual,isPreview,onCommit}){
    const el=id=>document.getElementById(id),picker=el('orb-colour-picker'),hex=el('orb-colour-hex'),status=el('appearance-status');
    const swatches=A.presets.map(([name,colour])=>{
      const button=document.createElement('button');button.type='button';button.className='colour-swatch';button.style.setProperty('--swatch',colour);
      button.setAttribute('aria-label',name==='Blue'?'Blue (default)':name);
      const dot=document.createElement('span');dot.className='colour-dot';dot.setAttribute('aria-hidden','true');
      button.append(dot,document.createTextNode(name));el('orb-colour-presets').append(button);
      button.onclick=()=>editor.change(colour);return {button,colour};
    });
    const editor=createEditor({paint:colour=>visual.setColour(colour),render:s=>{
      picker.value=s.draft;
      if(!s.invalid)hex.value=s.draft;
      hex.setCustomValidity(s.invalid);hex.setAttribute('aria-invalid',String(!!s.invalid));
      el('orb-colour-error').textContent=s.invalid;el('orb-colour-error').hidden=!s.invalid;
      for(const {button,colour} of swatches){button.setAttribute('aria-pressed',String(!s.invalid&&s.draft===colour));button.disabled=s.pending;}
      picker.disabled=hex.disabled=el('orb-colour-reset').disabled=s.pending;
      el('orb-colour-apply').disabled=s.pending||!!s.invalid;
      el('footer-primary').disabled=s.pending;
      status.textContent=s.message||(isPreview?'Preview only. Applied colours last until this page reloads.':s.draft!==s.saved?'Previewing. Apply colour to keep it.':'Your colour is saved on this Mac.');
    }});
    picker.oninput=()=>editor.change(picker.value);hex.oninput=()=>editor.change(hex.value);
    el('orb-colour-reset').onclick=()=>editor.change(A.DEFAULT_COLOUR);
    el('orb-colour-apply').onclick=async()=>{try{const result=await editor.save(appearance=>api.saveAppearance(appearance));onCommit(result.appearance);}catch{/* The editor displays the save failure inline. */}};
    return editor;
  }
  return {createEditor,bind};
});
