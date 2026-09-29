// Local SVG graph. No remote scripts, note HTML, or Obsidian plugin execution.
(() => {
 const NS='http://www.w3.org/2000/svg',colors={hub:'#69adff',topic:'#c391ff',knowledge:'#a5b2c4',portfolio:'#64d5a4'},sizes={hub:11,topic:8,knowledge:4,portfolio:7};
 const el=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
 function filter(data,{focus=null,depth=1,kind='all',query='',hub='',orphans=false}={}){
  let allowed=new Set(data.notes.map(n=>n.path));
  if(hub){allowed=new Set([hub]);for(let i=0;i<2;i++)for(const e of data.edges)if(e.type==='hierarchy'&&allowed.has(e.target))allowed.add(e.source);}
  if(focus){const local=new Set([focus]);for(let i=0;i<depth;i++){const previous=new Set(local);for(const e of data.edges)if(previous.has(e.source)||previous.has(e.target)){local.add(e.source);local.add(e.target);}}allowed=new Set([...allowed].filter(p=>local.has(p)));}
  const connected=new Set(data.edges.flatMap(e=>[e.source,e.target]));
  const all=data.notes.filter(n=>allowed.has(n.path)&&(kind==='all'||n.kind===kind)&&(!query||n.title.toLowerCase().includes(query.toLowerCase()))&&(!orphans||!connected.has(n.path)));
  const nodes=all.slice(0,300),ids=new Set(nodes.map(n=>n.path));return {nodes,edges:data.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),total:all.length};
 }
 function draw(host,data,{mini=false,selected=null,onSelect=()=>{},onFocus=()=>{},...options}={}){
  host._dispose?.();host.replaceChildren();const filtered=filter(data,options);
  const width=mini?800:(host.clientWidth||800),height=mini?500:(host.clientHeight||500),cx=width/2,cy=height/2;
  const svg=el('svg',{viewBox:`0 0 ${width} ${height}`,role:mini?'img':'group','aria-label':mini?'Knowledge connections preview':'Interactive knowledge graph. Tab to a note and press Enter to preview it.'});host.append(svg);
  if(!filtered.nodes.length){const text=el('text',{x:cx,y:cy,'text-anchor':'middle',fill:'#aeb5c0','font-size':mini?28:16});text.textContent=data.notes.length?'No matching notes':'Capture your first idea';svg.append(text);host._dispose=()=>{};return {total:0,shown:0,reset:()=>{},zoom:()=>{}};}
  const group=el('g');svg.append(group);let scale=1,panX=0,panY=0,frame=0,stopped=false,drag=null,moved=false,ticks=0;
  const transform=()=>group.setAttribute('transform',`translate(${panX} ${panY}) scale(${scale})`);
  const nodes=filtered.nodes.map((n,i)=>{const angle=i*2.399963,rad=20+Math.min(width,height)*.3*Math.sqrt(i/filtered.nodes.length);return {...n,x:cx+Math.cos(angle)*rad*1.3,y:cy+Math.sin(angle)*rad,vx:0,vy:0};});
  const map=new Map(nodes.map(n=>[n.path,n]));
  const edges=filtered.edges.map(e=>{const line=el('line',{stroke:e.type==='hierarchy'?'#6a7e9c':'#77859b','stroke-opacity':e.type==='hierarchy'?'.52':'.22','stroke-width':e.type==='hierarchy'?1.6:1,...(e.type==='reference'?{'stroke-dasharray':'3 4'}:{})});group.append(line);return {...e,a:map.get(e.source),b:map.get(e.target),line};});
  for(const n of nodes){
   const item=el('g',mini?{}:{tabindex:0,role:'button','aria-label':`${n.title}, ${n.kind}`});item.style.cursor=mini?'inherit':'pointer';
   const circle=el('circle',{r:sizes[n.kind]+(mini?2:0),fill:colors[n.kind],stroke:n.path===selected?'#fff':colors[n.kind],'stroke-width':n.path===selected?3:1,'stroke-opacity':n.path===selected?1:.4});
   const title=el('title');title.textContent=n.title;item.append(title,circle);
   if(!mini){const text=el('text',{y:sizes[n.kind]+18,'text-anchor':'middle',fill:'#d9dee8','font-size':11});text.textContent=n.title.length>32?n.title.slice(0,30)+'…':n.title;text.style.pointerEvents='none';if(nodes.length>60&&n.kind==='knowledge'&&n.path!==selected)text.setAttribute('opacity','.15');item.append(text);item.addEventListener('click',()=>{if(!moved){highlight(n.path);onSelect(n);}});item.addEventListener('dblclick',()=>onFocus(n));item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();highlight(n.path);onSelect(n);}});item.addEventListener('pointerdown',e=>{e.stopPropagation();moved=false;drag={node:n,last:point(e)};svg.setPointerCapture(e.pointerId);});}
   n.item=item;n.circle=circle;group.append(item);
  }
  function highlight(p){
   if(!map.has(p))p=null;
   const neighbours=new Set([p]);for(const e of edges)if(e.source===p||e.target===p){neighbours.add(e.source);neighbours.add(e.target);}
   for(const n of nodes){n.item.setAttribute('opacity',!p||neighbours.has(n.path)?1:.22);n.circle.setAttribute('stroke',n.path===p?'#fff':colors[n.kind]);n.circle.setAttribute('stroke-width',n.path===p?3:1);n.circle.setAttribute('stroke-opacity',n.path===p?1:.4);}
   for(const e of edges)e.line.setAttribute('stroke-opacity',!p?(e.type==='hierarchy'?.52:.22):(e.source===p||e.target===p)? .85 : .08);
  }
  highlight(selected);
  function paint(){for(const n of nodes)n.item.setAttribute('transform',`translate(${n.x} ${n.y})`);for(const e of edges){e.line.setAttribute('x1',e.a.x);e.line.setAttribute('y1',e.a.y);e.line.setAttribute('x2',e.b.x);e.line.setAttribute('y2',e.b.y);}}
  function tick(){if(stopped)return;const spacing=Number(options.spacing)||100;
   for(let i=0;i<nodes.length;i++){const a=nodes[i];for(let j=i+1;j<nodes.length;j++){const b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=Math.max(80,dx*dx+dy*dy),force=spacing*9/d2,dist=Math.sqrt(d2);a.vx+=dx/dist*force;a.vy+=dy/dist*force;b.vx-=dx/dist*force;b.vy-=dy/dist*force;}}
   for(const e of edges){const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-spacing)*.004;e.a.vx+=dx/d*f;e.a.vy+=dy/d*f;e.b.vx-=dx/d*f;e.b.vy-=dy/d*f;}
   for(const n of nodes){if(drag?.node===n)continue;n.vx=(n.vx+(cx-n.x)*.002)*.8;n.vy=(n.vy+(cy-n.y)*.002)*.8;n.x=Math.max(35,Math.min(width-45,n.x+n.vx));n.y=Math.max(30,Math.min(height-45,n.y+n.vy));}
   paint();if(++ticks<180)frame=requestAnimationFrame(tick);
  }
  function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  const zoom=(factor,p={x:cx,y:cy})=>{const next=Math.max(.4,Math.min(5,scale*factor));panX=p.x-(p.x-panX)*next/scale;panY=p.y-(p.y-panY)*next/scale;scale=next;transform();};
  if(!mini){svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:.89,point(e));},{passive:false});svg.addEventListener('pointerdown',e=>{moved=false;drag={last:point(e)};svg.setPointerCapture(e.pointerId);});svg.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e),dx=p.x-drag.last.x,dy=p.y-drag.last.y;if(Math.abs(dx)+Math.abs(dy)>1)moved=true;if(drag.node){drag.node.x+=dx/scale;drag.node.y+=dy/scale;paint();}else{panX+=dx;panY+=dy;transform();}drag.last=p;});const finish=()=>{drag=null;setTimeout(()=>moved=false,0);};svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);}
  paint();if(matchMedia('(prefers-reduced-motion: reduce)').matches){for(let i=0;i<100;i++){ticks=180;tick();}}else frame=requestAnimationFrame(tick);
  host._dispose=()=>{stopped=true;cancelAnimationFrame(frame);};
  return {total:filtered.total,shown:nodes.length,zoom,reset:()=>{scale=1;panX=panY=0;transform();}};
 }
 window.KnowledgeGraph={draw,filter,colors};
})();
