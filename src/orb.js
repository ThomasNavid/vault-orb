(() => {
  const canvas=document.getElementById('orb-canvas');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let phase='idle',level=0,smooth=0;
  window.orbVisual={setState:s=>{phase=s;},setLevel:l=>{level=Math.min(1.4,l);}};

  // Per-state look: body colours, rim, outer glow, flow speed, brightness and whether the listening ring shows.
  const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
  const looks={
    idle:     {deep:'#122436',mid:'#4a7392',light:'#e2c9a2',rim:'#a9c3d3',glow:'#6f95b2',swirl:.45,intensity:.8,ring:0},
    listening:{deep:'#0d3342',mid:'#3f9aae',light:'#d6f2ef',rim:'#b8ecef',glow:'#6fcbd6',swirl:.8,intensity:1,ring:1},
    thinking: {deep:'#4a2d12',mid:'#d08d4c',light:'#f6ddb0',rim:'#f0d4a2',glow:'#e0a664',swirl:1.7,intensity:.96,ring:0},
    speaking: {deep:'#172a4d',mid:'#6d8fd4',light:'#f2e4c6',rim:'#e6e1d6',glow:'#a2b9e8',swirl:1.05,intensity:1,ring:1}
  };
  for(const look of Object.values(looks))for(const k of ['deep','mid','light','rim','glow'])look[k]=hex(look[k]);
  const current=structuredClone(looks.idle);
  const ease=(key,target,rate)=>{if(Array.isArray(target))current[key]=current[key].map((v,i)=>v+(target[i]-v)*rate);else current[key]+=(target-current[key])*rate;};

  const gl=canvas.getContext('webgl',{premultipliedAlpha:true,antialias:false,alpha:true});
  if(!gl)return fallback();

  const vertex='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fragment=`precision highp float;
uniform vec2 res;uniform float t,level,radius,swirl,intensity,ring;
uniform vec3 cDeep,cMid,cLight,cRim,cGlow;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}
void main(){
  vec2 p=gl_FragCoord.xy/res*2.-1.;
  float r=length(p),R=radius,aa=3./res.x;
  // Outer glow and the listening ring, as premultiplied light.
  float halo=exp(-max(r-R,0.)*10.)*.3*intensity*(1.+level*.9);
  float ringR=R+.08+level*.05;
  float ringA=ring*smoothstep(.011,0.,abs(r-ringR))*(.18+level*.55);
  vec3 outside=cGlow*halo+cRim*ringA;
  float outsideA=clamp(halo+ringA,0.,1.);
  // Sphere surface.
  float inside=smoothstep(R+aa,R-aa,r);
  vec2 q=p/R;
  vec3 n=vec3(q,sqrt(max(1.-dot(q,q),0.)));
  float sw=t*.22*swirl+(1.-n.z)*swirl*1.1;
  vec3 s=n;s.xy=mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*s.xy;
  vec3 w=s*1.55+vec3(0.,0.,t*.06*swirl);
  float f1=fbm(w+vec3(t*.04));
  float f2=fbm(w*1.35+f1*1.9+vec3(0.,t*.06,0.));
  vec3 body=mix(cDeep,cMid,smoothstep(.2,.8,f2));
  body=mix(body,cLight,smoothstep(.56,.95,f2+f1*.22)*.8);
  vec3 L=normalize(vec3(-.62,.66,.42));
  body*=.5+.62*clamp(dot(n,L),0.,1.);
  body+=cGlow*pow(clamp(dot(n,normalize(vec3(.4,-.62,.3))),0.,1.),2.)*.32*(1.+level);
  body+=cLight*level*.28*pow(n.z,3.);
  body=mix(body,cRim,pow(1.-n.z,2.8)*.45);
  float h=clamp(dot(n,normalize(L+vec3(0,0,1))),0.,1.);
  body+=vec3(pow(h,140.)*.55+pow(h,14.)*.07);
  body=mix(body,cRim,smoothstep(aa*2.5,0.,R-r)*.22);
  body*=.86+intensity*.14;
  gl_FragColor=vec4(mix(outside,body,inside),mix(outsideA,1.,inside));
}`;
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  let program;
  try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));}
  catch(e){console.warn('Orb shader unavailable',e);return;}
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const u=Object.fromEntries(['res','t','level','radius','swirl','intensity','ring','cDeep','cMid','cLight','cRim','cGlow'].map(k=>[k,gl.getUniformLocation(program,k)]));
  gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(u.res,canvas.width,canvas.height);

  let clock=0,last=performance.now();
  function draw(now){
    const dt=Math.min(.1,(now-last)/1000);last=now;
    smooth+=(level-smooth)*(1-Math.exp(-dt*9));
    const target=looks[phase]||looks.idle,blend=1-Math.exp(-dt*3);
    for(const k of ['deep','mid','light','rim','glow','swirl','intensity','ring'])ease(k,target[k],blend);
    if(!reduced)clock=(clock+dt*(.6+current.swirl*.4))%1000;
    const breathe=reduced?0:Math.sin(now/1000*.8)*.006;
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.t,clock);gl.uniform1f(u.level,smooth);gl.uniform1f(u.radius,.6+breathe+smooth*.035);
    gl.uniform1f(u.swirl,current.swirl);gl.uniform1f(u.intensity,current.intensity);gl.uniform1f(u.ring,current.ring);
    gl.uniform3fv(u.cDeep,current.deep);gl.uniform3fv(u.cMid,current.mid);gl.uniform3fv(u.cLight,current.light);gl.uniform3fv(u.cRim,current.rim);gl.uniform3fv(u.cGlow,current.glow);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // Simple 2D orb for machines without WebGL.
  function fallback(){
    const ctx=canvas.getContext('2d');
    function frame(now){
      smooth+=(level-smooth)*.12;const look=looks[phase]||looks.idle,rgb=c=>`rgb(${c.map(v=>Math.round(v*255)).join(',')})`;
      const t=reduced?0:now/1000,radius=228+Math.sin(t*.8)*3+smooth*20;
      ctx.clearRect(0,0,760,760);ctx.save();ctx.translate(380,380);
      const g=ctx.createRadialGradient(-80,-100,20,0,0,radius);g.addColorStop(0,rgb(look.light));g.addColorStop(.55,rgb(look.mid));g.addColorStop(1,rgb(look.deep));
      ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.restore();requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
