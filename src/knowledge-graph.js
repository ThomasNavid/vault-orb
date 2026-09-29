// Local SVG graph. No remote scripts, note HTML, or Obsidian plugin execution.
// Layout is a d3-style force simulation (charge, links, centring, collision) in world space;
// the camera fits the settled graph instead of clamping nodes to the canvas edges.
(() => {
 const NS='http://www.w3.org/2000/svg',colors={hub:'#69adff',topic:'#c391ff',knowledge:'#a5b2c4',portfolio:'#64d5a4'},sizes={hub:9.5,topic:5.5,knowledge:3.2,portfolio:4.5};
 // Minimum zoom at which a label appears without hover or selection; busier kinds wait for more zoom.
 const labelZoom={hub:0,topic:.6,portfolio:.75,knowledge:1.25};
 const el=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
 function filter(data,{focus=null,depth=1,kind='all',hidden=[],query='',hub='',orphans=false}={}){
  let allowed=new Set(data.notes.map(n=>n.path));
  if(hub){allowed=new Set([hub]);for(let i=0;i<2;i++)for(const e of data.edges)if(e.type==='hierarchy'&&allowed.has(e.target))allowed.add(e.source);}
  if(focus){const local=new Set([focus]);for(let i=0;i<depth;i++){const previous=new Set(local);for(const e of data.edges)if(previous.has(e.source)||previous.has(e.target)){local.add(e.source);local.add(e.target);}}allowed=new Set([...allowed].filter(p=>local.has(p)));}
  const connected=new Set(data.edges.flatMap(e=>[e.source,e.target]));
  const all=data.notes.filter(n=>allowed.has(n.path)&&(kind==='all'||n.kind===kind)&&!hidden.includes(n.kind)&&(!query||n.title.toLowerCase().includes(query.toLowerCase()))&&(!orphans||!connected.has(n.path)));
  const nodes=all.slice(0,300),ids=new Set(nodes.map(n=>n.path));return {nodes,edges:data.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),total:all.length};
 }
 function simulation(nodes,edges,spacing,aspect=1.6){
  const degree=new Map(nodes.map(n=>[n.path,0]));for(const e of edges){degree.set(e.source,degree.get(e.source)+1);degree.set(e.target,degree.get(e.target)+1);}
  // Phyllotaxis seed keeps the first frames calm; hubs start nearest the centre.
  const order=[...nodes].sort((a,b)=>(sizes[b.kind]-sizes[a.kind])||(degree.get(b.path)-degree.get(a.path)));
  order.forEach((n,i)=>{const r=spacing*.55*Math.sqrt(i+.5),a=i*2.399963;n.x=Math.cos(a)*r;n.y=Math.sin(a)*r;n.vx=n.vy=0;n.degree=degree.get(n.path);n.r=sizes[n.kind]+Math.min(9,Math.sqrt(n.degree)*1.5);});
  const links=edges.map(e=>({...e,count:Math.max(1,Math.min(e.a.degree,e.b.degree)),bias:e.a.degree/(e.a.degree+e.b.degree||1)}));
  const charge=-spacing*2.2,reach2=(spacing*4)**2,sim={alpha:1,target:0};
  sim.tick=()=>{
   sim.alpha+=(sim.target-sim.alpha)*.0228;const alpha=sim.alpha;
   for(let i=0;i<nodes.length;i++){const a=nodes[i];for(let j=i+1;j<nodes.length;j++){const b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;if(!d2){dx=Math.random()-.5;dy=Math.random()-.5;d2=dx*dx+dy*dy;}
    if(d2<reach2){const w=charge*alpha/Math.max(d2,spacing*spacing*.04);a.vx+=dx*w*(1+b.degree*.08);a.vy+=dy*w*(1+b.degree*.08);b.vx-=dx*w*(1+a.degree*.08);b.vy-=dy*w*(1+a.degree*.08);}
    const min=a.r+b.r+6;if(d2<min*min){const d=Math.sqrt(d2),push=(min-d)/d*.5;a.x-=dx*push;a.y-=dy*push;b.x+=dx*push;b.y+=dy*push;}}}
   for(const l of links){const distance=l.type==='hierarchy'?spacing*.75:spacing;let dx=l.b.x+l.b.vx-l.a.x-l.a.vx,dy=l.b.y+l.b.vy-l.a.y-l.a.vy,d=Math.hypot(dx,dy)||1,f=(d-distance)/d*alpha/l.count*.9;dx*=f;dy*=f;l.b.vx-=dx*l.bias;l.b.vy-=dy*l.bias;l.a.vx+=dx*(1-l.bias);l.a.vy+=dy*(1-l.bias);}
   for(const n of nodes){n.vx-=n.x*.045*alpha;n.vy-=n.y*.045*aspect*alpha;if(n.fx!=null){n.x=n.fx;n.y=n.fy;n.vx=n.vy=0;continue;}n.vx*=.6;n.vy*=.6;n.x+=n.vx;n.y+=n.vy;}
  };
  return sim;
 }
 function bounds(nodes){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const n of nodes){x0=Math.min(x0,n.x-n.r);y0=Math.min(y0,n.y-n.r);x1=Math.max(x1,n.x+n.r);y1=Math.max(y1,n.y+n.r);}return {x0,y0,x1,y1};}
 function draw(host,data,{mini=false,selected=null,onSelect=()=>{},onFocus=()=>{},...options}={}){
  host._dispose?.();host.replaceChildren();const filtered=filter(data,options),spacing=Number(options.spacing)||100;
  const svg=el('svg',{role:mini?'img':'group','aria-label':mini?'Knowledge connections preview':'Interactive knowledge graph. Tab to a note and press Enter to preview it.'});host.append(svg);
  if(!filtered.nodes.length){svg.setAttribute('viewBox','0 0 800 500');const text=el('text',{x:400,y:250,'text-anchor':'middle',class:'graph-empty','font-size':mini?40:15});text.textContent=data.notes.length?'No matching notes':'Capture your first idea';svg.append(text);host._dispose=()=>{};return {total:0,shown:0,reset:()=>{},zoom:()=>{},select:()=>{},has:()=>false};}
  const nodes=filtered.nodes.map(n=>({...n})),map=new Map(nodes.map(n=>[n.path,n]));
  const edges=filtered.edges.map(e=>({...e,a:map.get(e.source),b:map.get(e.target)})).filter(e=>e.a!==e.b);
  const sim=simulation(nodes,edges,spacing,mini?1.9:Math.max(1,Math.min(2.2,(host.clientWidth||800)/(host.clientHeight||500))));
  if(mini){
   for(let i=0;i<260;i++)sim.tick();const b=bounds(nodes),pad=spacing*.6,w=b.x1-b.x0+pad*2,h=b.y1-b.y0+pad*2,unit=Math.max(w/170,h/88);
   svg.setAttribute('viewBox',`${b.x0-pad} ${b.y0-pad} ${w} ${h}`);svg.setAttribute('preserveAspectRatio','xMidYMid meet');
   const lines=el('g',{class:'graph-edges'});for(const e of edges)lines.append(el('line',{x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y,class:'graph-edge','data-type':e.type,'vector-effect':'non-scaling-stroke'}));svg.append(lines);
   for(const n of nodes){const c=el('circle',{cx:n.x,cy:n.y,r:unit*(.9+n.r*.17),fill:colors[n.kind]});if(n.path===options.focus)c.setAttribute('class','graph-mini-focus');svg.append(c);}
   host._dispose=()=>{};return {total:filtered.total,shown:nodes.length};
  }
  const view=el('g',{class:'graph-view'}),lineLayer=el('g',{class:'graph-edges'}),nodeLayer=el('g',{class:'graph-nodes'});view.append(lineLayer,nodeLayer);svg.append(view);
  let width=0,height=0,scale=1,panX=0,panY=0,autoFit=true,frame=0,stopped=false,drag=null,moved=false,hovered=null,lastTap={},current=selected&&map.has(selected)?selected:null;
  for(const e of edges){e.line=el('line',{class:'graph-edge','data-type':e.type});lineLayer.append(e.line);}
  const neighbours=new Map(nodes.map(n=>[n.path,new Set([n.path])]));for(const e of edges){neighbours.get(e.source).add(e.target);neighbours.get(e.target).add(e.source);}
  for(const n of nodes){
   const item=el('g',{class:'graph-node','data-kind':n.kind,tabindex:0,role:'button','aria-label':`${n.title}, ${n.kind}`});item.style.setProperty('--node',colors[n.kind]);
   const circle=el('circle',{r:n.r,fill:colors[n.kind]}),text=el('text',{'text-anchor':'middle',class:'graph-label'});text.textContent=n.title.length>34?n.title.slice(0,32)+'…':n.title;
   const title=el('title');title.textContent=n.title;item.append(title,circle,text);
   item.addEventListener('pointerenter',()=>{if(!drag){hovered=n.path;highlight();}});item.addEventListener('pointerleave',()=>{if(hovered===n.path&&!drag){hovered=null;highlight();}});
   item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.path,true);}});
   item.addEventListener('pointerdown',e=>{if(e.button)return;e.stopPropagation();moved=false;const p=point(e);drag={node:n,x:p.x,y:p.y};svg.setPointerCapture(e.pointerId);});
   n.item=item;n.circle=circle;n.text=text;nodeLayer.append(item);
  }
  function highlight(){
   const p=hovered||current,near=p?neighbours.get(p):null;svg.classList.toggle('is-focused',!!p);
   for(const n of nodes){n.item.classList.toggle('is-near',!!near?.has(n.path));n.item.classList.toggle('is-selected',n.path===current);}
   for(const e of edges){const on=!!p&&(e.source===p||e.target===p);e.line.classList.toggle('is-near',on);if(on)e.line.style.stroke=colors[map.get(p).kind];else e.line.style.removeProperty('stroke');}
   labels();
  }
  // Labels stay 11px on screen at any zoom. In busy graphs lesser kinds fade in as you zoom closer,
  // and labels claim screen space in priority order (focus, Hubs, Topics, busiest notes) so none overlap.
  const crowd=Math.min(1,nodes.length/80),rank={hub:0,topic:1,portfolio:2,knowledge:3},ranked=[...nodes].sort((a,b)=>(rank[a.kind]-rank[b.kind])||(b.degree-a.degree));
  function labels(){const focus=hovered||current,near=focus?neighbours.get(focus):null,size=11/scale,taken=[];
   for(const n of focus?[map.get(focus),...ranked.filter(n=>n.path!==focus)]:ranked){
    n.text.setAttribute('font-size',size);n.text.setAttribute('y',n.r+size*1.25);n.text.setAttribute('stroke-width',3/scale);
    let shown=near?near.has(n.path):scale>=labelZoom[n.kind]*crowd-Math.min(.5,n.degree*.08);
    if(shown){const x=n.x*scale+panX,y=(n.y+n.r)*scale+panY+3,half=Math.min(33,n.title.length)*3.1+3,box=[x-half,y,x+half,y+15];shown=n.path===focus||!taken.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]);if(shown)taken.push(box);}
    n.text.classList.toggle('is-shown',shown);}}
  function select(p,notify){current=p&&map.has(p)?p:null;highlight();if(notify)onSelect(current?map.get(current):null);}
  function paint(){for(const n of nodes)n.item.setAttribute('transform',`translate(${n.x} ${n.y})`);for(const e of edges){e.line.setAttribute('x1',e.a.x);e.line.setAttribute('y1',e.a.y);e.line.setAttribute('x2',e.b.x);e.line.setAttribute('y2',e.b.y);}}
  function transform(){view.setAttribute('transform',`translate(${panX} ${panY}) scale(${scale})`);labels();}
  function fit(ease=1){const b=bounds(nodes),pad=56,next=Math.max(.25,Math.min(1.35,(width-pad*2)/Math.max(1,b.x1-b.x0),(height-pad*2)/Math.max(1,b.y1-b.y0))),tx=width/2-(b.x0+b.x1)/2*next,ty=height/2-(b.y0+b.y1)/2*next;scale+=(next-scale)*ease;panX+=(tx-panX)*ease;panY+=(ty-panY)*ease;transform();}
  function size(){width=host.clientWidth||800;height=host.clientHeight||500;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);}
  function loop(){if(stopped)return;sim.tick();paint();if(autoFit)fit(.12);else labels();frame=sim.alpha>.004||sim.target?requestAnimationFrame(loop):0;}
  function wake(target){sim.target=target;if(target)sim.alpha=Math.max(sim.alpha,target);if(!frame&&!stopped)frame=requestAnimationFrame(loop);}
  function point(e){const r=svg.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  const zoom=(factor,p={x:width/2,y:height/2})=>{autoFit=false;const next=Math.max(.2,Math.min(6,scale*factor));panX=p.x-(p.x-panX)*next/scale;panY=p.y-(p.y-panY)*next/scale;scale=next;transform();};
  svg.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*(e.ctrlKey?.01:.0015)),point(e));},{passive:false});
  svg.addEventListener('pointerdown',e=>{if(e.button)return;moved=false;const p=point(e);drag={x:p.x,y:p.y};svg.setPointerCapture(e.pointerId);svg.classList.add('is-panning');});
  svg.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e),dx=p.x-drag.x,dy=p.y-drag.y;if(!moved&&Math.abs(dx)+Math.abs(dy)<3)return;
   if(!moved){moved=true;if(drag.node){hovered=drag.node.path;highlight();wake(.3);}}
   if(drag.node){autoFit=false;drag.node.fx=(p.x-panX)/scale;drag.node.fy=(p.y-panY)/scale;}else{autoFit=false;panX+=dx;panY+=dy;transform();}drag.x=p.x;drag.y=p.y;});
  // Pointer capture retargets click events to the svg, so taps and double-taps are resolved here.
  const finish=()=>{if(!drag)return;const wasMoved=moved,node=drag.node,now=Date.now();
   if(node&&wasMoved){node.fx=node.fy=null;wake(0);hovered=null;highlight();}
   else if(node){if(lastTap.path===node.path&&now-lastTap.time<400){lastTap={};onFocus(node);}else{lastTap={path:node.path,time:now};select(node.path,true);}}
   else if(!wasMoved)select(null,true);drag=null;svg.classList.remove('is-panning');setTimeout(()=>moved=false,0);};
  svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',()=>{moved=true;finish();});
  size();for(let i=0;i<40;i++)sim.tick();paint();fit();highlight();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){while(sim.alpha>.004)sim.tick();paint();fit();}else wake(0);
  const resize=new ResizeObserver(()=>{const w=width,h=height;size();if(w!==width||h!==height){if(autoFit)fit();else{panX+=(width-w)/2;panY+=(height-h)/2;transform();}}});resize.observe(host);
  host._dispose=()=>{stopped=true;cancelAnimationFrame(frame);resize.disconnect();};
  return {total:filtered.total,shown:nodes.length,zoom,has:p=>map.has(p),select:p=>select(p,false),reset:()=>{autoFit=true;sim.alpha=Math.max(sim.alpha,.12);wake(0);}};
 }
 window.KnowledgeGraph={draw,filter,colors};
})();
