(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.orbAppearance=factory();
})(typeof window==='object'?window:undefined,()=>{
  const DEFAULT_COLOUR='#1f86ff';
  const presets=[['Blue',DEFAULT_COLOUR],['Violet','#8b5cf6'],['Rose','#ec4899'],['Amber','#f59e0b'],['Mint','#34d399'],['Teal','#14b8a6']];
  function validateColour(value){
    if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Enter a colour as #RRGGBB, for example #8b5cf6.');
    return value.toLowerCase();
  }
  function readAppearance(config){
    try{return {orbColour:validateColour(config?.appearance?.orbColour)};}catch{return {orbColour:DEFAULT_COLOUR};}
  }
  function withAppearance(config,input){
    if(input===undefined)return config;
    return {...config,appearance:{...config.appearance,orbColour:validateColour(input?.orbColour)}};
  }
  const hex=value=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
  const rgb=value=>`rgb(${value.map(Math.round).join(',')})`;
  const blue={
    idle:['#62d0ff','#1f86ff','#0a4fe3'],
    listening:['#7ce6ff','#16a0ff','#075fe8'],
    thinking:['#9db4ff','#4f72ff','#3a2fd8'],
    speaking:['#74d8ff','#2a8eff','#0b55f0']
  };
  function toHsl(colour){
    const [r,g,b]=hex(colour).map(v=>v/255),hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo,l=(hi+lo)/2;
    if(!delta)return [0,0,l];
    const h=hi===r?(g-b)/delta+(g<b?6:0):hi===g?(b-r)/delta+2:(r-g)/delta+4;
    return [h*60,delta/(1-Math.abs(2*l-1)),l];
  }
  function fromHsl(h,s,l){
    const a=s*Math.min(l,1-l),channel=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};
    return [channel(0),channel(8),channel(4)];
  }
  function palette(colour){
    colour=validateColour(colour);
    if(colour===DEFAULT_COLOUR)return {
      states:Object.fromEntries(Object.entries(blue).map(([state,tones])=>[state,Object.fromEntries(['light','mid','deep'].map((key,i)=>[key,hex(tones[i])]))])),
      rim:hex('#001a66'),shadow:hex('#000a2e'),reflection:hex('#58c8ff'),glow:hex('#2f86ff')
    };
    const [h,s,rawLightness]=toHsl(colour),l=Math.max(.18,Math.min(.82,rawLightness));
    // Keep light/shadow separation even for achromatic colours and the black/white endpoints.
    const states=Object.fromEntries([['idle',0,0],['listening',-5,.025],['thinking',12,-.025],['speaking',0,.015]].map(([state,shift,lift])=>{
      const hue=(h+shift+360)%360,mid=l+lift;
      return [state,{light:fromHsl(hue,s*.72,Math.min(.96,mid+.29)),mid:fromHsl(hue,s,mid),deep:fromHsl(hue,s*.92,Math.max(.07,mid-.22))}];
    }));
    return {states,rim:fromHsl(h,s,.13),shadow:fromHsl(h,s,.055),reflection:states.idle.light,glow:states.idle.mid};
  }
  return {DEFAULT_COLOUR,presets,validateColour,readAppearance,withAppearance,palette,rgb};
});
