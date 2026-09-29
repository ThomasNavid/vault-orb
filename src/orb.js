(() => {
  // Jelly Orb: layered SVG driven by damped springs so it can lean, stretch and bounce without blurring.
  const stage=document.querySelector('.orb-stage'),button=document.getElementById('orb-button');
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=motionQuery.matches,phase='idle',level=0,smooth=0;
  const R=74,NS='http://www.w3.org/2000/svg';
  const make=(tag,attrs={},parent)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));parent?.append(n);return n;};

  // Per-state look: body gradient, halo tint, spin of the inner light, ring visibility and where the glasses rest.
  const A=window.orbAppearance;
  let colours=A.palette(A.DEFAULT_COLOUR);
  const looks={
    idle:     {halo:.2, spin:.35,ring:0,look:[0,0],   tilt:0},
    listening:{halo:.34,spin:.5, ring:1,look:[0,-3],  tilt:0},
    thinking: {halo:.3, spin:1.5,ring:0,look:[13,-10],tilt:-7},
    speaking: {halo:.36,spin:.8, ring:1,look:[0,0],   tilt:0}
  };
  const updatePalette=()=>{
    for(const [state,tones] of Object.entries(colours.states))Object.assign(looks[state],tones);
    const style=document.documentElement.style;
    for(const [name,value] of Object.entries(colours.states.idle))style.setProperty('--orb-idle-'+name,A.rgb(value));
    for(const name of ['rim','shadow','reflection'])style.setProperty('--orb-'+name,A.rgb(colours[name]));
    style.setProperty('--orb-glow',colours.glow.join(','));
  };
  updatePalette();
  const current=structuredClone(looks.idle),rgb=A.rgb;

  const svg=make('svg',{id:'orb-svg',viewBox:'-140 -140 280 280','aria-hidden':'true'});
  const defs=make('defs',{},svg);
  const bodyGradient=make('radialGradient',{id:'jelly-body',cx:.7,cy:.26,r:.92,fx:.72,fy:.2},defs);
  const bodyStops=[0,.48,1].map(offset=>make('stop',{offset},bodyGradient));
  const rimGradient=make('radialGradient',{id:'jelly-rim'},defs);
  make('stop',{offset:.72,'stop-color':'var(--orb-rim)','stop-opacity':0},rimGradient);make('stop',{offset:1,'stop-color':'var(--orb-rim)','stop-opacity':.32},rimGradient);
  const haloGradient=make('radialGradient',{id:'jelly-halo'},defs);
  const haloStops=[[0,.9],[.45,.35],[1,0]].map(([offset,opacity])=>make('stop',{offset,'stop-opacity':opacity},haloGradient));
  const glowGradient=make('radialGradient',{id:'jelly-glow'},defs);
  make('stop',{offset:0,'stop-color':'#ffffff','stop-opacity':.85},glowGradient);make('stop',{offset:1,'stop-color':'#ffffff','stop-opacity':0},glowGradient);
  const soft=make('filter',{id:'jelly-soft',x:'-60%',y:'-200%',width:'220%',height:'500%'},defs);make('feGaussianBlur',{stdDeviation:5},soft);
  const clip=make('clipPath',{id:'jelly-clip'},defs);make('circle',{r:R},clip);

  const shadow=make('ellipse',{cx:0,cy:R+18,rx:R*.66,ry:6,fill:'var(--orb-shadow)',filter:'url(#jelly-soft)'},svg);
  const halo=make('circle',{r:R*1.62,fill:'url(#jelly-halo)'},svg);
  const ring=make('circle',{r:R+13,fill:'none','stroke-width':1.5,opacity:0},svg);
  // Focus session: a faint track and a thin arc that fills clockwise from 12 o'clock, just outside the jelly.
  const focusRing=make('g',{display:'none'},svg);
  const focusTrack=make('circle',{r:R+9,fill:'none','stroke-width':1.5},focusRing);
  const focusArc=make('circle',{r:R+9,fill:'none','stroke-width':2,'stroke-linecap':'round',pathLength:1,transform:'rotate(-90)'},focusRing);
  const sparks=make('g',{},focusRing);
  const body=make('g',{},svg);
  const inner=make('g',{'clip-path':'url(#jelly-clip)'},body);
  make('circle',{r:R,fill:'url(#jelly-body)'},inner);
  // A soft light that circles inside the jelly: the orb's slow rotation.
  const glow=make('ellipse',{rx:R*.5,ry:R*.34,fill:'url(#jelly-glow)'},inner);
  // Weather: fine falling light (or slow flecks for snow) inside the jelly, so it squashes and leans with the body.
  const rain=make('g',{display:'none'},inner);
  const streaks=Array.from({length:9},(_,i)=>({el:make('line',{stroke:'#fff','stroke-width':1.5,'stroke-linecap':'round','vector-effect':'non-scaling-stroke'},rain),x:-R*.84+i*R*.21+(i%2)*6,speed:150+(i*37)%60,offset:(i*53)%160,alpha:.7+(i%3)*.15}));
  const flecks=Array.from({length:6},(_,i)=>({el:make('circle',{fill:'#fff'},rain),x:-R*.7+i*R*.28,speed:45+(i*13)%20,offset:(i*61)%160,size:1.6+(i%3)*.5,alpha:.75+(i%2)*.2}));
  make('circle',{r:R,fill:'url(#jelly-rim)'},inner);
  make('ellipse',{cx:-R*.5,cy:-R*.6,rx:R*.16,ry:R*.07,fill:'#fff',opacity:.6,transform:`rotate(-38 ${-R*.5} ${-R*.6})`},inner);
  make('circle',{r:R,fill:'none',stroke:'#fff','stroke-width':2.6,'vector-effect':'non-scaling-stroke'},body);
  const lens='M6 -14C6 -21 16 -23 30 -23C44 -23 55 -21 56 -13C57 -2 50 13 34 13C18 13 6 3 6 -14Z';
  const drawGlasses=parent=>{
    const g=make('g',{},parent);
    make('path',{d:'M-8 -15Q0 -22 8 -15',fill:'none',stroke:'#0c1233','stroke-width':4.5,'stroke-linecap':'round'},g);
    make('path',{d:lens,fill:'#0c1233'},g);
    make('path',{d:lens,fill:'#0c1233',transform:'scale(-1 1)'},g);
    // Both lenses catch the same light from the upper right.
    for(const shift of [0,-62]){
      make('path',{d:`M${38+shift} -17Q${46+shift} -16 ${48+shift} -8`,fill:'none',stroke:'#fff','stroke-width':3,'stroke-linecap':'round'},g);
      make('path',{d:`M${47+shift} -1Q${47+shift} 3 ${45+shift} 6`,fill:'none',stroke:'var(--orb-reflection)','stroke-width':2.2,'stroke-linecap':'round',opacity:.85},g);
    }
    return g;
  };
  const glasses=drawGlasses(body);
  stage.prepend(svg);
  let focus=null,focusAlpha=0,arc=0,flash=0,burst=1,ticker=0;
  // Reduced motion has no animation loop, so a running session redraws once a second instead.
  const syncTicker=()=>{clearInterval(ticker);ticker=0;if(reduced&&focus)ticker=setInterval(()=>render(1),1000);};
  const celebrate=()=>{
    arc=1;flash=1;
    if(reduced){render(1);setTimeout(()=>{flash=0;render(1);},1200);return;}
    jump.v-=260;squash.v+=3;look.y.v-=80;burst=0;
    sparks.replaceChildren();
    for(let i=0;i<12;i++)make('circle',{r:2.6,'data-a':(i/12*Math.PI*2+Math.random()*.3).toFixed(3),'data-d':(26+Math.random()*16).toFixed(1)},sparks);
  };
  // Weather reaction: blend towards a mood colour for about five seconds, then settle back to the user's own palette.
  const IN=.6,HOLD=3.5,OUT=1.2,ease=t=>1-(1-t)**3;
  let weather=null,weatherTones=null,weatherMix=0,weatherTimer=0;
  const endWeather=()=>{clearTimeout(weatherTimer);weather=null;weatherMix=0;rain.setAttribute('display','none');};
  const react=mood=>{
    endWeather();
    let tones=null;try{if(mood?.colour)tones=A.palette(mood.colour);}catch{}
    if(!tones&&!mood?.wet&&!mood?.snow){if(reduced)render(1);return;}
    weather={wet:!!mood.wet,snow:!!mood.snow,start:performance.now()};weatherTones=tones;
    // Reduced motion: the tint simply appears, holds and leaves, with no shimmer.
    if(reduced){weatherMix=1;render(1);weatherTimer=setTimeout(()=>{endWeather();render(1);},(IN+HOLD+OUT)*1000);}
  };
  window.orbVisual={setColour:colour=>{endWeather();colours=A.palette(colour);updatePalette();if(reduced)render(1);},react,setState:s=>{phase=s;if(reduced)render(1);},setLevel:l=>{level=Math.min(1.4,l);if(reduced)render(1);},
    setFocus:f=>{focus=f;syncTicker();if(reduced)render(1);},celebrate};

  // A still copy of the idle orb, glasses and all, for places like the chat window where the live orb is hidden.
  // Each copy owns its gradients: the live orb's defs stop resolving once its SVG is display:none.
  let marks=0;
  window.orbMark=className=>{
    const id=`orb-mark-${++marks}`;
    const mark=make('svg',{class:className,viewBox:`${-R-4} ${-R-4} ${2*R+8} ${2*R+8}`,'aria-hidden':'true'});
    const markDefs=make('defs',{},mark);
    const fill=make('radialGradient',{id:`${id}-body`,cx:.7,cy:.26,r:.92,fx:.72,fy:.2},markDefs);
    ['light','mid','deep'].forEach((tone,i)=>make('stop',{offset:[0,.48,1][i],'stop-color':`var(--orb-idle-${tone})`},fill));
    const rim=make('radialGradient',{id:`${id}-rim`},markDefs);
    make('stop',{offset:.72,'stop-color':'var(--orb-rim)','stop-opacity':0},rim);make('stop',{offset:1,'stop-color':'var(--orb-rim)','stop-opacity':.32},rim);
    make('circle',{r:R,fill:`url(#${id}-body)`},mark);
    make('circle',{r:R,fill:`url(#${id}-rim)`},mark);
    make('ellipse',{cx:-R*.5,cy:-R*.6,rx:R*.16,ry:R*.07,fill:'#fff',opacity:.6,transform:`rotate(-38 ${-R*.5} ${-R*.6})`},mark);
    make('circle',{r:R,fill:'none',stroke:'#fff','stroke-width':2.6},mark);
    drawGlasses(mark).setAttribute('transform',`translate(0 ${R*.03})`);
    return mark;
  };

  // Damped springs. Low damping gives the jelly overshoot; the glasses use a softer spring so they lag behind the body.
  const spring=(k,c)=>({x:0,v:0,target:0,k,c});
  const step=(s,dt)=>{s.v+=(s.k*(s.target-s.x)-s.c*s.v)*dt;s.x+=s.v*dt;};
  const lean={x:spring(110,9),y:spring(110,9)},stretch={x:spring(120,8),y:spring(120,8)};
  const squash=spring(190,9),jump=spring(150,11),look={x:spring(60,10),y:spring(60,10)},tilt=spring(50,9);
  const all=[lean.x,lean.y,stretch.x,stretch.y,squash,jump,look.x,look.y,tilt];
  let pointer=null,pressed=false,spin=0,clock=0,nextBob=3+Math.random()*4;

  addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};});
  document.documentElement.addEventListener('pointerleave',()=>{pointer=null;});
  addEventListener('blur',()=>{pointer=null;});
  button.addEventListener('pointerdown',()=>{pressed=true;});
  const release=bounce=>{if(!pressed)return;pressed=false;if(bounce&&!reduced){squash.v-=3.2;jump.v-=190;}};
  button.addEventListener('pointerup',()=>release(true));
  button.addEventListener('pointercancel',()=>release(false));
  button.addEventListener('pointerleave',()=>release(true));
  button.addEventListener('click',e=>{if(e.detail===0&&!reduced){squash.v+=2.4;jump.v-=150;}});

  function render(dt){
    const target=looks[phase]||looks.idle,blend=reduced?1:1-Math.exp(-dt*3);
    for(const k of ['light','mid','deep'])current[k]=current[k].map((v,i)=>v+(target[k][i]-v)*blend);
    for(const k of ['halo','spin','ring','tilt'])current[k]+=(target[k]-current[k])*blend;
    smooth+=(level-smooth)*(reduced?1:1-Math.exp(-dt*9));
    if(!reduced){clock+=dt;spin+=dt*current.spin;}

    // Lean and stretch towards the pointer, easing off when it is over the orb itself.
    let dir=[0,0],pull=0,near=1,gaze=0;
    if(pointer&&!reduced){
      const box=svg.getBoundingClientRect(),dx=pointer.x-(box.left+box.width/2),dy=pointer.y-(box.top+box.height/2),dist=Math.hypot(dx,dy)||1;
      dir=[dx/dist,dy/dist];pull=dist/(dist+150);near=Math.min(1,Math.max(0,(dist-R*.3)/(R*.7)));gaze=Math.min(1,dist/170);
    }
    lean.x.target=dir[0]*8*pull*near;lean.y.target=dir[1]*8*pull*near;
    stretch.x.target=dir[0]*.07*pull*near;stretch.y.target=dir[1]*.07*pull*near;
    // Glasses follow the gaze, drift with the rotation, and rest where the current state puts them.
    look.x.target=dir[0]*R*.26*gaze+Math.sin(spin)*3+target.look[0];
    look.y.target=dir[1]*R*.2*gaze+target.look[1];
    tilt.target=current.tilt+dir[0]*4*gaze;
    const voice=phase==='speaking'?smooth:0;
    squash.target=pressed?.13:-voice*.09+Math.sin(clock*9)*voice*.025;
    if(!reduced&&clock>nextBob){look.y.v-=55;nextBob=clock+4+Math.random()*5;}
    if(reduced)for(const s of all){s.x=s.target;s.v=0;}else for(const s of all)step(s,dt);

    const breathe=reduced?1:1+Math.sin(clock*1.25)*.012+(phase==='listening'?.015:0);
    const s=Math.min(.16,Math.hypot(stretch.x.x,stretch.y.x)),angle=Math.atan2(stretch.y.x,stretch.x.x)*180/Math.PI;
    const q=Math.max(-.22,Math.min(.25,squash.x)),qx=1+q*.75,qy=1-q,lift=Math.min(0,jump.x);
    body.setAttribute('transform',`translate(${lean.x.x.toFixed(2)} ${(lean.y.x+jump.x).toFixed(2)}) translate(0 ${R}) scale(${qx.toFixed(4)} ${qy.toFixed(4)}) translate(0 ${-R}) rotate(${angle.toFixed(2)}) scale(${(1+s).toFixed(4)} ${(1-s*.55).toFixed(4)}) rotate(${(-angle).toFixed(2)}) scale(${breathe.toFixed(4)})`);
    const gx=look.x.x,gy=look.y.x+R*.03;
    glasses.setAttribute('transform',`translate(${gx.toFixed(2)} ${gy.toFixed(2)}) rotate(${tilt.x.toFixed(2)}) scale(${(1-Math.abs(gx)/R*.32).toFixed(4)} ${(1-Math.abs(look.y.x)/R*.28).toFixed(4)})`);
    const z=Math.cos(spin);
    glow.setAttribute('cx',(Math.sin(spin)*R*.55).toFixed(2));glow.setAttribute('cy',(R*.28+z*R*.08).toFixed(2));glow.setAttribute('opacity',(.1+.2*(z*.5+.5)+voice*.15).toFixed(3));

    // Shadow shrinks as the orb leaves the ground; halo and ring answer the voice level.
    const air=Math.max(0,1+lift/110);
    shadow.setAttribute('transform',`translate(${(lean.x.x*.5).toFixed(2)} 0) scale(${(air*qx).toFixed(4)} 1)`);shadow.setAttribute('opacity',(.55*air).toFixed(3));
    if(weather&&!reduced){
      const t=(performance.now()-weather.start)/1000;
      weatherMix=t<IN?ease(t/IN):t<IN+HOLD?1:t<IN+HOLD+OUT?1-ease((t-IN-HOLD)/OUT):0;
      if(t>=IN+HOLD+OUT)endWeather();
    }
    const tint=weatherTones&&weather?weatherTones.states[phase]||weatherTones.states.idle:null,mix=weatherMix*.75;
    const [light,mid,deep]=['light','mid','deep'].map(k=>rgb(tint?current[k].map((v,i)=>v+(tint[k][i]-v)*mix):current[k]));
    const falling=weather&&!reduced&&(weather.wet||weather.snow)&&weatherMix>0;
    rain.setAttribute('display',falling?'inline':'none');
    if(falling){
      const span=2*R+20,drops=weather.snow?flecks:streaks;
      for(const d of weather.snow?streaks:flecks)d.el.setAttribute('opacity','0');
      for(const d of drops){
        const y=-R-10+(clock*d.speed+d.offset)%span,x=d.x+(weather.snow?Math.sin(clock*1.3+d.offset)*4:-(y+R)*.12);
        if(weather.snow){d.el.setAttribute('cx',x.toFixed(2));d.el.setAttribute('cy',y.toFixed(2));d.el.setAttribute('r',d.size.toFixed(2));}
        else{d.el.setAttribute('x1',x.toFixed(2));d.el.setAttribute('y1',y.toFixed(2));d.el.setAttribute('x2',(x-3).toFixed(2));d.el.setAttribute('y2',(y+14).toFixed(2));}
        d.el.setAttribute('opacity',((weather.snow?.6:.42)*d.alpha*weatherMix*(.7+.3*Math.sin(clock*7+d.offset))).toFixed(3));
      }
    }
    bodyStops[0].setAttribute('stop-color',light);bodyStops[1].setAttribute('stop-color',mid);bodyStops[2].setAttribute('stop-color',deep);
    for(const stop of haloStops)stop.setAttribute('stop-color',mid);
    halo.setAttribute('opacity',Math.min(1,current.halo+smooth*.35).toFixed(3));
    halo.setAttribute('transform',`translate(${lean.x.x.toFixed(2)} ${(lean.y.x+jump.x).toFixed(2)})`);
    // While focusing, the voice ring steps outward so the two rings never overlap.
    let focusTarget=0;
    if(focus){const remaining=Math.max(0,focus.endsAt-(focus.pausedAt??Date.now()));arc=Math.min(1,Math.max(0,1-remaining/focus.durationMs));focusTarget=focus.pausedAt?.5:1;}
    focusAlpha+=(focusTarget-focusAlpha)*(reduced?1:1-Math.exp(-dt*4));
    if(!reduced){flash*=Math.exp(-dt*1.6);burst=Math.min(1,burst+dt/.9);}
    const shownRing=Math.max(focusAlpha,flash);
    focusRing.setAttribute('display',shownRing>.005||burst<1?'inline':'none');
    focusRing.setAttribute('transform',`translate(${lean.x.x.toFixed(2)} ${(lean.y.x+jump.x).toFixed(2)})`);
    focusTrack.setAttribute('stroke',light);focusTrack.setAttribute('opacity',(.14*shownRing).toFixed(3));
    focusArc.setAttribute('stroke',light);focusArc.setAttribute('stroke-dasharray',`${arc.toFixed(4)} 1`);
    focusArc.setAttribute('opacity',(Math.min(1,.85+flash*.15)*shownRing).toFixed(3));focusArc.setAttribute('stroke-width',(2+flash*1.5).toFixed(2));
    if(burst<1){
      const out=1-(1-burst)**3;
      for(const spark of sparks.children){const a=+spark.dataset.a,d=R+9+out*+spark.dataset.d;spark.setAttribute('cx',(Math.sin(a)*d).toFixed(2));spark.setAttribute('cy',(-Math.cos(a)*d).toFixed(2));spark.setAttribute('fill',light);spark.setAttribute('opacity',(1-burst).toFixed(3));spark.setAttribute('r',(2.6*(1-burst*.6)).toFixed(2));}
    }else if(sparks.childElementCount)sparks.replaceChildren();
    ring.setAttribute('stroke',light);ring.setAttribute('r',(R+13+focusAlpha*6+smooth*7).toFixed(2));ring.setAttribute('opacity',(current.ring*(.3+smooth*.5)).toFixed(3));
  }

  let last=performance.now(),frame=0;
  function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;render(dt);frame=requestAnimationFrame(loop);}
  function start(){cancelAnimationFrame(frame);if(reduced)render(1);else{last=performance.now();frame=requestAnimationFrame(loop);}}
  motionQuery.addEventListener('change',e=>{reduced=e.matches;syncTicker();start();});
  start();
})();
