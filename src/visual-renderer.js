(() => {
 const palette=['#9ac4d4','#d5ba90','#9fc8b1','#b5accc'];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const icon=id=>{const s=svg('svg',{class:'icon','aria-hidden':'true'});s.append(svg('use',{href:'#'+id}));return s;};
 const stagger=(node,i)=>{node.style.setProperty('--i',String(Math.min(i,12)));return node;};
 function fmt(n,unit='',compact=false){if(n===null)return '—';const currency={GBP:'GBP','£':'GBP',USD:'USD','$':'USD',EUR:'EUR','€':'EUR'}[unit];if(currency)return new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:compact?0:2,...(Number.isInteger(n)?{minimumFractionDigits:0}:{}),...(compact?{notation:'compact'}:{})}).format(n);return new Intl.NumberFormat('en-GB',{maximumFractionDigits:2,...(compact?{notation:'compact'}:{})}).format(n)+(unit==='%'?'%':unit?' '+unit:'');}
 function table(columns,rows,paths,open){const wrap=el('div','table-scroll'),t=el('table'),head=el('thead'),tr=el('tr');columns.forEach((col,j)=>tr.append(el('th',rows.some(r=>typeof r[j]==='number')?'numeric':null,col)));head.append(tr);const body=el('tbody');rows.forEach((row,i)=>{const r=stagger(el('tr'),i);row.forEach((value,j)=>{const c=el('td',typeof value==='number'?'numeric':'');if(j===0&&paths?.[i]){const b=el('button','source-link',value??'—');b.onclick=()=>open(paths[i]);c.append(b);}else c.textContent=value??'—';r.append(c);});body.append(r);});t.append(head,body);wrap.append(t);return wrap;}
 // Task tables read better as a list: title, area tag, and when.
 const isTaskTable=v=>v.columns[0]==='Task'&&v.columns.includes('Area');
 function taskList(v,open){
  const col=name=>v.columns.indexOf(name),area=col('Area'),planned=col('Planned'),due=col('Deadline');
  const tags=new Map(),list=el('ul','task-list');
  v.rows.forEach((row,i)=>{
   const item=stagger(el('li','task'),i),main=el('div','task-main');
   item.append(el('span','task-ring'));
   const title=v.rowPaths?.[i]?el('button','source-link task-title',row[0]??'—'):el('span','task-title',row[0]??'—');if(v.rowPaths?.[i])title.onclick=()=>open(v.rowPaths[i]);main.append(title);
   if(area>=0&&row[area]){if(!tags.has(row[area]))tags.set(row[area],tags.size%palette.length);main.append(el('span',`tag tag-${tags.get(row[area])}`,row[area]));}
   const when=el('div','task-when');if(planned>=0&&row[planned])when.append(el('span',null,row[planned]));if(due>=0&&row[due])when.append(el('span','due','Due '+row[due]));
   item.append(main,when);list.append(item);
  });
  return list;
 }
 function calendar(v,open,selectedDate){
  const months=new Map();for(const day of v.days){const month=day.date.slice(0,7);if(!months.has(month))months.set(month,[]);months.get(month).push(day);}
  const keys=[...months.keys()],wrap=el('div','calendar-view'),warningCount=v.warnings?.length||0;
  if(warningCount){
   const names=v.warnings.map(w=>w.calendar||w.path?.split('/').pop()).filter(Boolean);
   const warning=el('div','calendar-warning',`Some calendar data could not be read${names.length?': '+names.join(', '):''}. This view may be incomplete.`);
   warning.setAttribute('role','status');wrap.append(warning);
  }
  if(v.truncated)wrap.append(el('div','calendar-warning',`Showing the first ${v.shown} of ${v.total} results. Try a shorter date range.`));
  const controls=el('div','calendar-controls'),prev=el('button','calendar-nav','‹'),label=el('strong','calendar-month-label'),next=el('button','calendar-nav','›');
  prev.type=next.type='button';prev.setAttribute('aria-label','Previous month');next.setAttribute('aria-label','Next month');controls.append(prev,label,next);
  const grid=el('div','calendar-grid'),agenda=el('section','calendar-agenda');wrap.append(controls,grid,agenda);
  if(!keys.length){wrap.append(el('p','empty','No dates in this range.'));return wrap;}
  let monthIndex=selectedDate?keys.indexOf(selectedDate.slice(0,7)):-1;
  if(monthIndex<0)monthIndex=0;
  let selected=selectedDate&&v.days.some(day=>day.date===selectedDate)?selectedDate:months.get(keys[0]).find(day=>day.items.length)?.date||v.start;
  const dateLabel=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const timeLabel=item=>{
   if(item.kind==='task')return (item.dateType==='due'?'Deadline':'Planned')+(item.allDay?' · all day':' · '+item.start.slice(11,16));
   if(item.allDay)return 'All day';
   if(item.start.slice(0,10)<selected)return item.end?.slice(0,10)===selected?'Until '+item.end.slice(11,16):'Continues';
   const start=item.start.slice(11,16),end=item.end?.slice(0,10)===item.start.slice(0,10)?item.end.slice(11,16):null;
   return end?`${start}–${end}`:item.end?.slice(0,10)>selected?'From '+start:start;
  };
  const showAgenda=()=>{
   const day=v.days.find(day=>day.date===selected);agenda.replaceChildren(el('h2',null,dateLabel(selected)));
   if(!day?.items.length){agenda.append(el('p','calendar-empty','Nothing scheduled for this day.'));return;}
   const list=el('ul','calendar-entries');
   day.items.forEach((item,i)=>{
    const row=stagger(el('li',`calendar-entry calendar-${item.kind}`),i),body=el('div','calendar-entry-body');
    const title=item.kind==='task'&&item.path?el('button','source-link calendar-entry-title',item.title):el('strong','calendar-entry-title',item.title);
    if(item.kind==='task'&&item.path)title.onclick=()=>open(item.path);
    body.append(title);
    const detail=[timeLabel(item),item.kind==='event'?item.calendar:item.list,item.kind==='event'?item.location:null].filter(Boolean).join(' · ');
    body.append(el('span','calendar-entry-detail',detail));row.append(el('span','calendar-entry-mark'),body);list.append(row);
   });agenda.append(list);
  };
  const showMonth=()=>{
   const key=keys[monthIndex],days=months.get(key);label.textContent=new Date(key+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
   prev.disabled=monthIndex===0;next.disabled=monthIndex===keys.length-1;grid.replaceChildren();
   for(const name of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])grid.append(el('span','calendar-weekday',name));
   const offset=(new Date(key+'-01T12:00:00Z').getUTCDay()+6)%7;
   for(let i=0;i<offset;i++)grid.append(el('span','calendar-blank'));
   const dayMap=new Map(days.map(day=>[day.date,day]));
   const daysInMonth=new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),0).getDate();
   for(let dayNumber=1;dayNumber<=daysInMonth;dayNumber++){
    const date=`${key}-${String(dayNumber).padStart(2,'0')}`,day=dayMap.get(date);
    if(!day){grid.append(el('span','calendar-blank'));continue;}
    const button=el('button','calendar-day',String(dayNumber));button.type='button';button.dataset.date=date;
    button.setAttribute('aria-label',`${dateLabel(date)}, ${day.items.length} ${day.items.length===1?'entry':'entries'}`);
    button.setAttribute('aria-pressed',String(date===selected));
    if(day.items.length){button.classList.add('has-entries');const dots=el('span','calendar-dots');
      for(const kind of [...new Set(day.items.map(item=>item.kind))])dots.append(el('i',`calendar-${kind}`));button.append(dots);}
    button.onclick=()=>{selected=date;grid.querySelectorAll('.calendar-day').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));showAgenda();};
    grid.append(button);
   }
   showAgenda();
  };
  prev.onclick=()=>{monthIndex--;selected=months.get(keys[monthIndex]).find(day=>day.items.length)?.date||months.get(keys[monthIndex])[0].date;showMonth();};
  next.onclick=()=>{monthIndex++;selected=months.get(keys[monthIndex]).find(day=>day.items.length)?.date||months.get(keys[monthIndex])[0].date;showMonth();};
  showMonth();return wrap;
 }
 window.renderVisual=(host,v,openSource)=>{
  const selectedDate=host.querySelector('.calendar-day[aria-pressed="true"]')?.dataset.date;
  host.replaceChildren();host.append(el('h1',null,v.title),el('p','subtitle',v.subtitle||''));
  if(v.kind==='calendar')host.append(calendar(v,openSource,selectedDate));
  else if(v.kind==='table'){
   if(!v.rows.length)host.append(el('p','empty',v.emptyText||'No rows to show.'));else host.append(isTaskTable(v)?taskList(v,openSource):table(v.columns,v.rows,v.rowPaths,openSource));
  }else{
   const series=v.series,points=v.points,values=points.flatMap(p=>p.values).filter(n=>n!==null),unit=v.unit||'';
   if(series.length===1){
    const known=points.filter(p=>p.values[0]!==null),last=known.at(-1),first=known[0];
    if(last){
     const summary=el('div','chart-summary');summary.append(el('strong',null,fmt(last.values[0],unit)),el('span','summary-label',last.label));
     if(known.length>1&&first.values[0]!==last.values[0]){const change=last.values[0]-first.values[0];summary.append(el('span',`delta ${change>0?'up':'down'}`,`${change>0?'+':'−'}${fmt(Math.abs(change),unit)} since ${first.label}`));}
     host.append(summary);
    }
   }
   if(series.length>1){const legend=el('div','legend');series.forEach((name,i)=>{const span=el('span');const dot=el('i');dot.style.backgroundColor=palette[i%palette.length];span.append(dot,document.createTextNode(name));legend.append(span);});host.append(legend);}
   const W=474,H=v.x_label?262:246;
   const wrap=el('div','chart-wrap'),chart=svg('svg',{viewBox:`0 0 ${W} ${H}`,class:`chart chart-${v.kind}`,role:'img','aria-label':`${v.title}. ${series.join(', ')}. Data table available below.`});
   const defs=svg('defs');chart.append(defs);
   const left=46,right=462,top=22,bottom=212;
   // Round tick values (1, 2, 2.5, 5 × 10ⁿ) so gridlines land on readable numbers.
   const nice=n=>{const e=10**Math.floor(Math.log10(n)),f=n/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;};
   let min=Math.min(0,...values),max=Math.max(0,...values);if(max===min)max=min+1;const tick=nice((max-min)/4);min=Math.floor(min/tick)*tick;max=Math.ceil(max/tick)*tick;const tickCount=Math.round((max-min)/tick);
   const y=n=>bottom-(n-min)/(max-min)*(bottom-top),x=i=>v.kind==='bar'?left+(right-left)*(i+.5)/points.length:points.length===1?(left+right)/2:left+i/(points.length-1)*(right-left);
   if(v.y_label){const t=svg('text',{x:0,y:9,class:'axis-title'});t.textContent=v.y_label;chart.append(t);}
   for(let i=0;i<=tickCount;i++){const val=min+tick*i,yy=y(val);chart.append(svg('line',{x1:left,y1:yy,x2:right,y2:yy,class:i===0||val===0?'grid base':'grid'}));const label=svg('text',{x:left-10,y:yy+3.5,'text-anchor':'end'});label.textContent=fmt(val,unit,true);chart.append(label);}
   // Evenly spaced x labels, always including the first and last.
   const count=Math.min(points.length,points.length>7?6:7),ticks=new Set(Array.from({length:count},(_,k)=>count===1?0:Math.round(k*(points.length-1)/(count-1))));
   const maxChars=points.length>5?10:16;
   ticks.forEach(i=>{const p=points[i];const label=svg('text',{x:x(i),y:233,'text-anchor':v.kind==='bar'?'middle':i===0&&points.length>1?'start':i===points.length-1&&points.length>1?'end':'middle'});label.textContent=p.label.length>maxChars?p.label.slice(0,maxChars-1)+'…':p.label;chart.append(label);});
   if(v.x_label){const t=svg('text',{x:(left+right)/2,y:H-2,'text-anchor':'middle',class:'axis-title'});t.textContent=v.x_label;chart.append(t);}
   const guide=svg('line',{x1:0,y1:top,x2:0,y2:bottom,class:'guide'});
   const marks=[];// marks[i] = elements to highlight at index i
   points.forEach(()=>marks.push([]));
   series.forEach((name,s)=>{
    const color=palette[s%palette.length];
    if(v.kind==='bar'){
     const group=(right-left)/points.length,barW=Math.min(30,group*.7/series.length);
     points.forEach((p,i)=>{const n=p.values[s];if(n===null)return;const xx=left+group*(i+.5)+(s-series.length/2)*barW;const rect=svg('rect',{x:xx+1,y:Math.min(y(n),y(0)),width:Math.max(2,barW-3),height:Math.max(1,Math.abs(y(n)-y(0))),rx:3.5,fill:color,class:n<0?'bar neg':'bar'});stagger(rect,i);chart.append(rect);marks[i].push(rect);});
    }else{
     const segments=[];let segment=[];points.forEach((p,i)=>{if(p.values[s]===null){if(segment.length)segments.push(segment);segment=[];}else segment.push({p,i});});if(segment.length)segments.push(segment);
     if(v.kind==='area'){const gradient=svg('linearGradient',{id:`fill-${v.id}-${s}`,x1:0,y1:0,x2:0,y2:1});gradient.append(svg('stop',{offset:'0%','stop-color':color,'stop-opacity':.28}),svg('stop',{offset:'70%','stop-color':color,'stop-opacity':.06}),svg('stop',{offset:'100%','stop-color':color,'stop-opacity':0}));defs.append(gradient);}
     for(const segment of segments){const line=segment.map(({p,i},j)=>`${j?'L':'M'}${x(i)},${y(p.values[s])}`).join(' ');if(v.kind==='area'&&segment.length>1){const first=segment[0],last=segment[segment.length-1];chart.append(svg('path',{d:`${line} L${x(last.i)},${y(0)} L${x(first.i)},${y(0)} Z`,fill:`url(#fill-${v.id}-${s})`,class:'area-fill'}));}chart.append(svg('path',{d:line,fill:'none',stroke:color,'stroke-width':2.2,'stroke-linejoin':'round','stroke-linecap':'round',pathLength:1,class:'line'}));}
     const lastIndex=points.findLastIndex(p=>p.values[s]!==null);
     points.forEach((p,i)=>{if(p.values[s]===null)return;const cx=x(i),cy=y(p.values[s]);if(i===lastIndex)chart.append(svg('circle',{cx,cy,r:7,fill:color,class:'end-halo'}));const dot=svg('circle',{cx,cy,r:3.6,fill:color,class:i===lastIndex?'chart-dot end':'chart-dot'});chart.append(dot);marks[i].push(dot);});
    }
   });
   // One focusable hit column per point: hover or focus shows a crosshair and every series' value.
   chart.insertBefore(guide,chart.querySelector('.chart-dot,.bar'));
   const tip=el('div','chart-tooltip');tip.hidden=true;
   const activate=i=>{
    marks.flat().forEach(n=>n.classList.remove('active'));chart.classList.toggle('hovering',i!==null);
    if(i===null){tip.hidden=true;guide.classList.remove('on');return;}
    const p=points[i];marks[i].forEach(n=>n.classList.add('active'));
    guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.classList.toggle('on',v.kind!=='bar');
    tip.replaceChildren(el('strong',null,p.label));series.forEach((name,s)=>{const row=el('span','tip-row'),sw=el('i');sw.style.backgroundColor=palette[s%palette.length];row.append(sw,el('span',null,series.length>1?name:v.y_label||name),el('b',null,fmt(p.values[s],unit)));tip.append(row);});
    const top=Math.min(...p.values.filter(n=>n!==null).map(y),bottom);
    tip.style.left=`${x(i)/W*100}%`;tip.style.top=`${top/H*100}%`;tip.dataset.align=x(i)<W*.22?'start':x(i)>W*.78?'end':'middle';tip.hidden=false;
   };
   points.forEach((p,i)=>{
    const span=(right-left)/Math.max(1,v.kind==='bar'?points.length:points.length-1),cx=x(i);
    const hit=svg('rect',{x:Math.max(left-6,cx-span/2),y:top,width:span,height:bottom-top,class:'hit',tabindex:0,'aria-label':`${p.label}: `+series.map((name,s)=>`${name} ${fmt(p.values[s],unit)}`).join(', ')});
    hit.onpointerenter=()=>activate(i);hit.onfocus=()=>activate(i);hit.onblur=()=>activate(null);chart.append(hit);
   });
   chart.onpointerleave=()=>activate(null);
   wrap.append(chart,tip);host.append(wrap);
   const toggle=el('button','data-toggle','View data');toggle.setAttribute('aria-expanded','false');const data=table([v.x_label||'Period',...series],points.map(p=>[p.label,...p.values]),null,openSource);data.hidden=true;toggle.onclick=()=>{data.hidden=!data.hidden;toggle.textContent=data.hidden?'View data':'Hide data';toggle.setAttribute('aria-expanded',String(!data.hidden));};host.append(toggle,data);
  }
  if(v.sources?.length){const footer=el('div','sources');for(const source of v.sources){const b=el('button',null);b.append(icon('i-external'),document.createTextNode(source.path.split('/').pop()+(source.detail?' · '+source.detail:'')));b.title=source.path;b.onclick=()=>openSource(source.path);footer.append(b);}host.append(footer);}
 };
})();
