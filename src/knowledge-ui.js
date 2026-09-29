(() => {
 const names={hub:'Hubs',topic:'Topics',knowledge:'Library',portfolio:'Portfolio'},singular={hub:'Hub',topic:'Topic',knowledge:'Library note',portfolio:'Portfolio'};
 const k={data:null,scope:'hub',path:null,query:'',selected:new Set(),generation:0,workspace:false,graph:false,focus:null,graphKind:'all',graphQuery:'',hub:'',depth:1,spacing:100,orphans:false};
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,cls='k-button')=>{const n=make('button',cls,text);n.type='button';n.onclick=fn;return n;};
 const field=(label,input)=>{const n=make('label','k-field');n.append(make('span',null,label),input);return n;};
 const input=(placeholder='',value='')=>{const n=make('input');n.placeholder=placeholder;n.value=value;return n;};
 const select=(items,value)=>{const n=make('select');for(const [id,title] of items)n.add(new Option(title,id));n.value=value;return n;};
 const textArea=(placeholder,value='')=>{const n=make('textarea');n.rows=5;n.placeholder=placeholder;n.value=value;return n;};
 const noteBy=p=>k.data?.notes.find(n=>n.path===p),related=p=>new Set((k.data?.edges||[]).filter(e=>e.source===p||e.target===p).flatMap(e=>[e.source,e.target]).filter(x=>x!==p));
 const workspace=make('section','knowledge-workspace');workspace.hidden=true;workspace.setAttribute('aria-label','Knowledge workspace');
 const heading=make('header','k-header'),content=make('div','k-content'),status=make('div','k-status');status.setAttribute('role','status');
 heading.append(button('← Back',()=>closeWorkspace()),make('strong',null,'Knowledge'),button('+ Capture',()=>capture()),button('Graph ↗',()=>expand()));workspace.append(heading,status,content);document.body.append(workspace);
 const dock=button('',()=>expand(),'graph-dock');dock.hidden=true;dock.setAttribute('aria-label','Expand knowledge graph');dock.title='Expand knowledge graph';
 const mini=make('div','graph-mini'),miniLabel=make('span','graph-mini-label','Knowledge graph ↗');dock.append(mini,miniLabel);document.body.append(dock);
 const graph=make('section','graph-expanded');graph.hidden=true;graph.setAttribute('role','dialog');graph.setAttribute('aria-modal','true');graph.setAttribute('aria-label','Knowledge graph');
 const graphHead=make('header','k-header'),graphControls=make('div','graph-controls'),graphMain=make('div','graph-main'),canvas=make('div','graph-canvas'),inspector=make('aside','graph-inspector'),graphFooter=make('div','graph-footer');
 graphHead.append(make('strong',null,'Knowledge graph'),button('Refresh',()=>refresh().catch(fail)),button('Collapse ↙',()=>collapse()));graphMain.append(canvas,inspector);graph.append(graphHead,graphControls,graphMain,graphFooter);document.body.append(graph);
 let graphDrawing,returnFocus=null,refreshTimer;
 new ResizeObserver(()=>{if(k.graph&&k.data)drawGraph();}).observe(canvas);
 function fail(e){status.textContent=(e?.message||String(e)).replace(/^Error invoking remote method '[^']+': Error: /,'');if(!k.workspace&&!k.graph)error(e);else if(k.graph)inspector.replaceChildren(make('p','k-warning',status.textContent));}
 async function refresh(){const generation=++k.generation;const data=await api.knowledge();if(generation!==k.generation)return;k.data=data;for(const p of k.selected)if(!noteBy(p))k.selected.delete(p);if(k.path&&!noteBy(k.path))k.path=null;renderMini();if(k.workspace&&!k.form)render();if(k.graph){renderGraphControls();drawGraph();}}
 function visibility(){const vaultKey=settings?.vaultPath||'';if(k.vaultKey!==vaultKey){k.vaultKey=vaultKey;k.generation++;k.data=null;k.path=null;k.focus=null;k.selected.clear();mini.replaceChildren();miniLabel.textContent='Knowledge graph ↗';}
 const hidden=!(k.workspace||cardMode||chatOpen)||k.graph;if(dock.hidden!==hidden)dock.hidden=hidden;if(!dock.hidden&&!k.data&&!refreshTimer){refreshTimer=setTimeout(()=>{refreshTimer=null;refresh().catch(()=>{miniLabel.textContent='Set up knowledge ↗';});},50);}}
 new MutationObserver(visibility).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class']});
 function renderMini(){if(!k.data)return;miniLabel.textContent=`Knowledge graph · ${k.data.notes.length} ↗`;window.KnowledgeGraph.draw(mini,k.data,{mini:true,focus:k.path});}
 async function open(scope='hub',relative=null){
  if(!cardMode&&!chatOpen)showPanel('welcome');
  k.workspace=true;k.form=false;k.scope=scope;k.path=relative;k.query='';workspace.hidden=false;document.body.classList.add('knowledge-open');status.textContent='';content.replaceChildren(make('p','empty','Loading your knowledge…'));visibility();
  try{await refresh();}catch(e){fail(e);}heading.querySelector('button').focus();
 }
 function closeWorkspace(){k.workspace=false;workspace.hidden=true;document.body.classList.remove('knowledge-open');visibility();}
 function row(note,{choose=false}={}){
  const item=make('div','k-note-row');item.dataset.kind=note.kind;
  if(choose){const check=make('input');check.type='checkbox';check.checked=k.selected.has(note.path);check.setAttribute('aria-label',`Select ${note.title}`);check.onchange=()=>{if(check.checked&&k.selected.size>=30){check.checked=false;status.textContent='Choose up to 30 supporting notes.';return;}check.checked?k.selected.add(note.path):k.selected.delete(note.path);updateSelection();};item.append(check);}
  const link=button('',()=>{k.path=note.path;render();renderMini();},'k-note-link');link.append(make('strong',null,note.title),make('small',null,[singular[note.kind],note.stage,note.unfiled?'Unfiled':null,note.template?'Needs content':null].filter(Boolean).join(' · ')));item.append(link);return item;
 }
 function render(){
  k.renderGeneration=(k.renderGeneration||0)+1;k.form=false;content.replaceChildren();content.scrollTop=0;if(!k.data)return;
  const nav=make('nav','k-tabs');nav.setAttribute('aria-label','Knowledge sections');
  for(const [id,title] of Object.entries({...names,review:'Connections'})){const b=button(title,()=>{k.scope=id;k.path=null;k.query='';render();renderMini();});b.setAttribute('aria-pressed',String(k.scope===id&&!k.path));nav.append(b);}content.append(nav);
  const warnings=k.data.warnings||[];if(warnings.length||k.data.truncated){const details=make('details','k-warning');details.append(make('summary',null,k.data.truncated?'Showing up to 2,000 notes; some connections may be missing.':`${warnings.length} knowledge warning${warnings.length===1?'':'s'}`));for(const w of warnings)details.append(make('p',null,[w.path,w.error].filter(Boolean).join(': ')));content.append(details);}
  if(k.path){renderNote(k.path);return;}
  const title=make('div','k-title');title.append(make('h1',null,names[k.scope]||'Connections'),make('p',null,k.scope==='portfolio'?'Turn what you learn into something of your own.':k.scope==='review'?'Review possible connections and file captured notes.':'Capture → Explore → Create'));content.append(title);
  if(k.scope==='review'){renderSuggestions();return;}
  const search=input('Find a note…',k.query);search.type='search';search.setAttribute('aria-label','Search knowledge');content.append(search);
  const list=make('div','k-note-list');content.append(list);
  const populate=()=>{list.replaceChildren();const notes=k.data.notes.filter(n=>n.kind===k.scope&&n.title.toLowerCase().includes(k.query.toLowerCase()));if(!notes.length)list.append(make('p','empty','Nothing here yet. Capture a note to get started.'));for(const n of notes)list.append(row(n,{choose:k.scope==='knowledge'}));};search.oninput=()=>{k.query=search.value;populate();};populate();
  if(k.scope==='knowledge'){const selection=make('div','k-selection');selection.id='knowledge-selection';content.append(selection);updateSelection();}
 }
 function updateSelection(){const box=document.getElementById('knowledge-selection');if(!box)return;box.replaceChildren(make('span',null,`${k.selected.size} selected`));const create=button('Create from these notes',()=>creation());create.disabled=!k.selected.size;box.append(create);if(k.selected.size)box.append(button('Clear',()=>{k.selected.clear();render();}));}
 async function renderNote(relative){
  const generation=k.renderGeneration;const n=noteBy(relative);if(!n)return;
  const crumb=make('div','k-breadcrumb');crumb.append(button('All '+names[n.kind],()=>{k.path=null;k.scope=n.kind;render();renderMini();}));
  for(const p of n.parents||[])if(noteBy(p))crumb.append(make('span',null,'›'),button(noteBy(p).title,()=>{k.path=p;render();renderMini();}));content.append(crumb);
  content.append(make('h1',null,n.title));const meta=make('p','k-muted',[singular[n.kind],n.stage,n.unfiled?'Unfiled':null].filter(Boolean).join(' · '));content.append(meta);
  if(n.reason)content.append(make('p','k-reason','Why saved: '+n.reason));
  if(n.source)content.append(make('p','k-source','Source: '+n.source));
  const actions=make('div','k-actions');actions.append(button('Open in Obsidian',()=>api.openNote(relative).catch(fail)),button('Local graph',()=>expand(relative)));content.append(actions);
  if(['hub','topic'].includes(n.kind)){
   const ask=input('Ask a question about this subject…');ask.setAttribute('aria-label','Question about '+n.title);const form=make('form','k-inline-form');const submitQuestion=button('Ask Orb',()=>{});submitQuestion.type='submit';form.append(ask,submitQuestion);form.onsubmit=e=>{e.preventDefault();if(ask.value.trim())request(`Use my subject note ${JSON.stringify(relative)} and its linked material. Answer this question with source citations and distinguish your explanation from source claims: ${ask.value}`);};content.append(form);
   actions.append(button('Quiz me',()=>request(`Quiz me on ${n.title}. Use my subject note ${JSON.stringify(relative)} and its linked material. Ask one question at a time from my notes, wait for my answer, then give feedback with source paths. Do not save progress.`)),button('5-minute refresher',()=>request(`Give me a roughly five-minute refresher on ${n.title}. Use my subject note ${JSON.stringify(relative)} and its linked material, cite the notes, and finish with a recall question.`)),button('+ Capture here',()=>capture(n.kind==='topic'?'knowledge':'topic',relative)));
  }
  if(n.kind==='portfolio'){
   const stage=select(['Idea','Developing','Ready'].map(s=>[s,s]),n.stage);stage.setAttribute('aria-label','Portfolio stage');stage.onchange=()=>write('update_knowledge',{path:relative,version:n.version,stage:stage.value}).catch(fail);actions.append(stage,button('Continue working',()=>request(`Continue working on my Portfolio note ${JSON.stringify(relative)}. Read the draft, supporting sources, and open questions. If it is an empty template, help establish its purpose first. Discuss the next revision with me; save only when I ask.`)),button('Edit draft & questions',()=>editDraft(relative)));
  }
  if(['knowledge','portfolio'].includes(n.kind)){
   const placement=select([['','Unfiled / no primary Topic'],...k.data.notes.filter(x=>x.kind==='topic').map(x=>[x.path,x.title])],n.parents?.find(p=>noteBy(p)?.kind==='topic')||'');placement.setAttribute('aria-label','Primary Topic');placement.onchange=()=>write('update_knowledge',{path:relative,version:n.version,topic:placement.value}).catch(fail);content.append(field('Primary Topic',placement));
   const date=input('',n.revisit||'');date.type='date';date.setAttribute('aria-label','Revisit date');const revisit=make('div','k-inline-form');revisit.append(field('Revisit on Today',date),button('Save date',()=>write('update_knowledge',{path:relative,version:n.version,revisit:date.value}).catch(fail)));content.append(revisit);
  }
  const previewBox=make('div','k-note-preview');previewBox.textContent='Reading note…';content.append(previewBox);
  try{const full=await api.knowledgeNote(relative);if(k.path!==relative||!k.workspace||generation!==k.renderGeneration)return;previewBox.replaceChildren(markdown(full.body.replace(/```dataview\r?\n[^]*?```/g,'').replace(/<!--[^]*?-->/g,'')));if(full.truncated)previewBox.append(make('p','k-warning','Preview truncated. Open in Obsidian for the full note.'));}catch(e){previewBox.textContent=e.message;}
  if(k.path!==relative||generation!==k.renderGeneration)return;
  const linked=related(relative),groups=n.kind==='hub'?['topic','knowledge','portfolio']:n.kind==='topic'?['knowledge','portfolio']:['knowledge','portfolio','topic'];
  for(const kind of groups){const items=k.data.notes.filter(x=>x.kind===kind&&linked.has(x.path));if(!items.length)continue;content.append(make('h2',null,kind==='knowledge'&&n.kind==='portfolio'?'Supporting knowledge':names[kind]));for(const x of items)content.append(row(x,{choose:x.kind==='knowledge'}));}
  if(n.kind==='topic'||n.kind==='portfolio'){const selection=make('div','k-selection');selection.id='knowledge-selection';content.append(selection);updateSelection();}
 }
 async function write(action,args){status.textContent='Saving…';const result=await api.knowledgeWrite({action,args});status.textContent=preview?'Saved in preview memory only.':result.warnings?.length?'Saved. '+result.warnings.map(w=>w.error).join(' '):'Saved to your vault. You can undo note edits in Recent changes.';await refresh();return result;}
 function formFrame(title){k.renderGeneration=(k.renderGeneration||0)+1;k.form=true;content.replaceChildren();content.scrollTop=0;content.append(button('← Cancel',()=>render()),make('h1',null,title));const form=make('form','k-form');content.append(form);return form;}
 function capture(kind='knowledge',parent=null){
  const form=formFrame('Capture something'),type=select(Object.entries(singular),kind),title=input('Give it a name'),text=textArea('Your notes or idea…'),reason=input('Why is this useful?'),source=input('https://…');title.required=true;title.maxLength=180;text.maxLength=30000;reason.maxLength=2000;source.maxLength=2000;
  const topic=select([['','Keep unfiled'],...k.data.notes.filter(n=>n.kind==='topic').map(n=>[n.path,n.title])],kind==='knowledge'?parent||'':''),hub=select([['','Choose a Hub'],...k.data.notes.filter(n=>n.kind==='hub').map(n=>[n.path,n.title])],kind==='topic'?parent||'':'');
  const tf=field('Topic',topic),hf=field('Hub',hub),sf=field('Source URL (optional)',source),rf=field('Why I saved this (optional)',reason);
  form.append(field('Save as',type),field('Title',title),field('Content',text),tf,hf,sf,rf);
  const update=()=>{tf.hidden=!['knowledge','portfolio'].includes(type.value);hf.hidden=!['topic','portfolio'].includes(type.value);sf.hidden=type.value!=='knowledge';hub.required=type.value==='topic';};type.onchange=update;update();
  const save=button('Save to vault',()=>{});save.type='submit';form.append(save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const role=type.value,result=await write('create_knowledge',{kind:role,title:title.value,text:text.value,topic:['knowledge','portfolio'].includes(role)?topic.value||null:null,hub:['topic','portfolio'].includes(role)?hub.value||null:null,source:role==='knowledge'?source.value||null:null,reason:reason.value,sources:[],stage:'Idea'});k.path=result.path;k.scope=role;render();renderMini();}catch(e){fail(e);save.disabled=false;}};title.focus();
 }
 function creation(){
  const paths=[...k.selected].filter(p=>noteBy(p)?.kind==='knowledge');if(!paths.length)return;
  const form=formFrame('Create from your knowledge'),type=select([['explanation','Explanation'],['comparison','Comparison'],['framework','Framework'],['cheat sheet','Cheat sheet']],'explanation'),title=input('What will you call it?'),angle=textArea('What should someone understand? Add your perspective.');title.required=true;title.maxLength=180;angle.required=true;angle.maxLength=3000;
  form.append(make('p','k-muted',`${paths.length} supporting notes. Saving the draft will also add backlinks to these notes.`),field('Format',type),field('Portfolio title',title),field('Your angle',angle));for(const p of paths)form.append(make('small',null,noteBy(p).title));
  const save=button('Draft with Orb',()=>{});save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();request(`Draft ${JSON.stringify(title.value)} as an AI-assisted Portfolio ${type.value}. My angle: ${angle.value}\n\nRead these Library notes and cite them as supporting sources:\n${paths.map(p=>'- '+p).join('\n')}\n\nSave the draft at stage Developing and add backlinks from those sources. Distinguish source claims from the draft's synthesis. Let me know where it was saved and whether any source links could not be added.`);};
 }
 async function editDraft(relative){
  try{const full=await api.knowledgeNote(relative);const part=name=>full.body.match(new RegExp(`<!-- orb:${name} -->\\n## ${name}\\n\\n([^]*?)\\n<!-- /orb:${name} -->`))?.[1]||'';const form=formFrame('Develop your draft'),draft=textArea('Write a working draft…',part('Working draft')),questions=textArea('What still needs answering?',part('Open questions'));draft.maxLength=30000;questions.maxLength=30000;form.append(make('p','k-muted','These sections sit alongside your existing note and preserve its original content.'),field('Working draft',draft),field('Open questions',questions));const save=button('Save draft',()=>{});save.type='submit';form.append(save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await write('update_knowledge',{path:relative,version:full.version,draft:draft.value,questions:questions.value});render();}catch(e){fail(e);save.disabled=false;}};}catch(e){fail(e);}
 }
 function renderSuggestions(){
  const unfiled=k.data.notes.filter(n=>n.unfiled);content.append(make('h2',null,`${unfiled.length} unfiled captures`));for(const n of unfiled)content.append(row(n));
  content.append(make('h2',null,'Possible connections'),make('p','k-muted','Suggestions use shared title words. Review the notes before accepting.'));
  if(!k.data.suggestions.length)content.append(make('p','empty','No new suggestions.'));
  for(const s of k.data.suggestions){const box=make('div','k-suggestion');box.append(make('strong',null,s.label),button(noteBy(s.path)?.title||s.path,()=>{k.path=s.path;render();}),make('span',null,'→'),button(noteBy(s.target)?.title||s.target,()=>{k.path=s.target;render();}),make('p','k-muted',s.reason));const accept=button(s.property?'File under Topic':'Add connection',async()=>{accept.disabled=true;try{await write('connect_knowledge',s);}catch(e){fail(e);accept.disabled=false;}}),dismiss=button('Dismiss',async()=>{try{await api.knowledgeDismiss({id:s.id});await refresh();}catch(e){fail(e);}});box.append(accept,dismiss);content.append(box);}
 }
 async function request(text){closeWorkspace();collapse();if(connected||connecting)endVoice();if(!chatOpen)await openChat();sendChat(text);}
 async function expand(relative){returnFocus=document.activeElement;if(relative!==undefined)k.focus=relative;else if(k.path)k.focus=k.path;if(!cardMode&&!chatOpen&&!k.workspace)showPanel('welcome');k.graph=true;graph.hidden=false;workspace.inert=true;document.querySelector('.shell').inert=true;visibility();try{if(!k.data)await refresh();else {renderGraphControls();drawGraph();}}catch(e){fail(e);}graphHead.querySelector('button').focus();}
 function collapse(){if(!k.graph)return;k.graph=false;graph.hidden=true;workspace.inert=false;document.querySelector('.shell').inert=false;canvas._dispose?.();visibility();returnFocus?.focus();}
 function renderGraphControls(){
  graphControls.replaceChildren();const mode=select([['full','Full graph'],['local','Local graph']],k.focus?'local':'full');mode.setAttribute('aria-label','Graph scope');mode.onchange=()=>{k.focus=mode.value==='local'?(k.path||k.data.notes[0]?.path||null):null;renderGraphControls();drawGraph();};
  const kind=select([['all','All types'],...Object.entries(names)],k.graphKind);kind.setAttribute('aria-label','Graph note type');kind.onchange=()=>{k.graphKind=kind.value;drawGraph();};
  const hubs=select([['','All Hubs'],...k.data.notes.filter(n=>n.kind==='hub').map(n=>[n.path,n.title])],k.hub);hubs.setAttribute('aria-label','Filter graph by Hub');hubs.onchange=()=>{k.hub=hubs.value;drawGraph();};
  const search=input('Search nodes…',k.graphQuery);search.type='search';search.setAttribute('aria-label','Search graph');search.oninput=()=>{k.graphQuery=search.value;drawGraph();};
  const depth=select([['1','1 step'],['2','2 steps']],String(k.depth));depth.setAttribute('aria-label','Local graph depth');depth.hidden=!k.focus;depth.onchange=()=>{k.depth=Number(depth.value);drawGraph();};
  const orphan=make('input');orphan.type='checkbox';orphan.checked=k.orphans;orphan.onchange=()=>{k.orphans=orphan.checked;drawGraph();};
  const spacing=input('',String(k.spacing));spacing.type='range';spacing.min=40;spacing.max=180;spacing.setAttribute('aria-label','Connection spacing');spacing.onchange=()=>{k.spacing=Number(spacing.value);drawGraph();};
  graphControls.append(mode,kind,hubs,search,depth,field('Unlinked only',orphan),field('Spacing',spacing));
 }
 function drawGraph(){
  if(!k.data)return;const options={focus:k.focus,depth:k.depth,kind:k.graphKind,hub:k.hub,query:k.graphQuery,orphans:k.orphans,spacing:k.spacing,selected:k.graphSelected,onSelect:inspect,onFocus:n=>{k.focus=n.path;renderGraphControls();drawGraph();}};
  graphDrawing=window.KnowledgeGraph.draw(canvas,k.data,options);graphFooter.replaceChildren();
  for(const [kind,name] of Object.entries(names)){const label=make('span','graph-key',name);label.style.setProperty('--node-color',window.KnowledgeGraph.colors[kind]);graphFooter.append(label);}
  graphFooter.append(make('span',null,`${graphDrawing.shown}/${graphDrawing.total} notes${k.data.truncated?' · Index limited':''}${k.data.warnings.length?' · '+k.data.warnings.length+' source warnings':''}`),button('−',()=>graphDrawing.zoom(.8)),button('+',()=>graphDrawing.zoom(1.25)),button('Reset',()=>graphDrawing.reset()));
  if(k.focus&&noteBy(k.focus))inspect(noteBy(k.focus));else inspector.replaceChildren(make('h2',null,'Follow an idea'),make('p','k-muted','Select a note to preview it. Double-click to explore its neighbourhood. Drag nodes or the background; scroll to zoom.'),make('p','k-muted','Solid lines: Hub and Topic properties. Dotted lines: references.'));
 }
 let inspectGeneration=0;
 async function inspect(n){const generation=++inspectGeneration;k.graphSelected=n.path;inspector.replaceChildren(make('span','k-muted',singular[n.kind]),make('h2',null,n.title));inspector.append(button('Explore note',()=>{collapse();open(n.kind,n.path);}),button('Focus here',()=>{k.focus=n.path;renderGraphControls();drawGraph();}),button('Open in Obsidian',()=>api.openNote(n.path).catch(fail)));const p=make('p','graph-note');inspector.append(p);try{const full=await api.knowledgeNote(n.path);if(generation===inspectGeneration)p.textContent=full.body.replace(/```dataview\r?\n[^]*?```/g,'').replace(/<!--[^]*?-->/g,'').slice(0,1500)||'No content yet.';}catch(e){if(generation===inspectGeneration)p.textContent=e.message;}}
 document.addEventListener('keydown',e=>{if(k.graph){if(e.metaKey&&['j','k'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();return;}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();collapse();}else if(e.key==='Tab'){const items=[...graph.querySelectorAll('button,input,select,[tabindex="0"]')].filter(n=>!n.disabled&&!n.hidden&&n.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}else if(k.workspace&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeWorkspace();}},true);
 api.onActivity(data=>{if(data.kind==='change'){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{refreshTimer=null;refresh().catch(fail);},100);}if(data.kind==='knowledge-view'){if(!chatOpen)open(data.scope==='all'?'hub':data.scope);else refresh().catch(fail);}if(data.kind==='knowledge-graph')expand(data.path);});
 window.knowledgeUI={open,expand,closeWorkspace,refresh};
 // Fictional preview state is isolated in memory; it never reads or writes a vault.
 if(preview){
  const data={notes:[],edges:[],warnings:[],suggestions:[],total:0,truncated:false},bodies=new Map();
  const add=(kind,title,body,props={})=>{const folders={hub:'2. Hubs',topic:'3. Topics',knowledge:'4. Knowledge Library',portfolio:'1. Portfolio'},p=`${folders[kind]}/${title}.md`,n={path:p,title,kind,version:crypto.randomUUID(),parents:[],stage:kind==='portfolio'?'Developing':null,excerpt:body,template:false,...props};data.notes.push(n);bodies.set(p,body);return n;};
  const computing=add('hub','Computing','A map of computing subjects.'),business=add('hub','Business','Ideas for building useful products.'),architecture=add('topic','Computer Architecture','How computers execute instructions.'),network=add('topic','Networking','How systems communicate.'),products=add('topic','Product Thinking','How to build useful products.'),cpu=add('knowledge','Foundations of Computing','## CPUs and registers\n\nA CPU executes instructions. Registers hold values used by those instructions.',{source:'https://example.com/course',reason:'Explain the basics clearly.'}),memory=add('knowledge','Memory and instruction sets','## Memory\n\nMemory stores instructions and data. An instruction set defines the operations a processor supports.'),tcp=add('knowledge','Networking essentials','Packets carry data between connected systems.'),idea=add('portfolio','How CPUs work','## Summary\n\nAI-assisted draft: a beginner’s guide to instructions and registers.'),vuba=add('portfolio','A product idea','## Open questions\n\nWho is this useful for?',{stage:'Idea'}),unfiled=add('knowledge','Computer Architecture lecture','A captured lecture awaiting a Topic.',{unfiled:true});
  const edge=(a,b,type='hierarchy',property='topic')=>{data.edges.push({source:a.path,target:b.path,type,property});if(type==='hierarchy')a.parents.push(b.path);};
  edge(architecture,computing,'hierarchy','hub');edge(network,computing,'hierarchy','hub');edge(products,business,'hierarchy','hub');edge(cpu,architecture);edge(memory,architecture);edge(tcp,network);edge(idea,architecture);edge(vuba,products);edge(cpu,idea,'reference',null);edge(idea,memory,'reference',null);
  data.suggestions.push({id:'a'.repeat(64),path:unfiled.path,version:unfiled.version,target:architecture.path,targetVersion:architecture.version,property:'topic',reason:'Shared title terms: computer, architecture',label:'Suggested Topic'});data.total=data.notes.length;
  api.knowledge=async()=>structuredClone(data);
  api.knowledgeNote=async p=>{const n=data.notes.find(n=>n.path===p);if(!n)throw new Error('Note not found.');return {path:p,version:n.version,kind:n.kind,body:bodies.get(p)||'',properties:{},truncated:false};};
  api.knowledgeDismiss=async({id})=>{data.suggestions=data.suggestions.filter(s=>s.id!==id);};
  api.knowledgeWrite=async({action,args:a})=>{if(action==='create_knowledge'){const n=add(a.kind,a.title,a.text,{stage:a.kind==='portfolio'?a.stage:null,source:a.source,reason:a.reason,unfiled:a.kind==='knowledge'&&!a.topic});for(const [key,p] of [['topic',a.topic],['hub',a.hub]])if(p)edge(n,data.notes.find(x=>x.path===p),'hierarchy',key);data.total=data.notes.length;return {path:n.path};}const n=data.notes.find(n=>n.path===a.path);if(!n||n.version!==a.version)throw new Error('Note changed. Refresh first.');if(action==='connect_knowledge'){edge(n,data.notes.find(x=>x.path===a.target),a.property?'hierarchy':'reference',a.property);if(a.property)n.unfiled=false;data.suggestions=data.suggestions.filter(s=>s.path!==a.path);}else{if(a.stage)n.stage=a.stage;if(a.revisit!==undefined)n.revisit=a.revisit;if(a.topic!==undefined){data.edges=data.edges.filter(e=>!(e.source===n.path&&e.property==='topic'));n.parents=n.parents.filter(p=>data.notes.find(x=>x.path===p)?.kind!=='topic');if(a.topic)edge(n,data.notes.find(x=>x.path===a.topic));n.unfiled=n.kind==='knowledge'&&!a.topic;}for(const [name,v] of [['Working draft',a.draft],['Open questions',a.questions]])if(v!==undefined)bodies.set(n.path,bodies.get(n.path)+`\n<!-- orb:${name} -->\n## ${name}\n\n${v}\n<!-- /orb:${name} -->`);}n.version=crypto.randomUUID();return {path:n.path};};
 }
 visibility();
})();
