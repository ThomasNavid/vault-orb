(() => {
 const root='4. Knowledge Library/Web Clippings',categories=['Websites','Videos','X Posts','Other'];
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const button=(label,fn,cls='k-button')=>{const el=make('button',cls,label);el.type='button';el.onclick=fn;return el;};
 const defaults=()=>({query:'',category:null,domain:null,topic:null,from:null,to:null,sort:'relevance'});
 let filters=defaults(),generation=0,timer,opened=false,selected=null,data=null,rows=[],scroll=0,returnFocus=null,vaultKey=null,resultQuery=null;
 const panel=make('section','clippings-workspace');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Web Clippings');
 const header=make('header','k-header'),back=button('← Back',()=>selected?backToResults():close()),refresh=button('Refresh',()=>{selected=null;buildList();search(true);});
 header.append(back,make('strong',null,'Web Clippings'),refresh);
 const status=make('div','k-status');status.setAttribute('role','status');
 const content=make('div','clippings-content');panel.append(header,status,content);document.body.append(panel);
 let searchBox,list,count,more,domainSelect,topicSelect;
 function fail(error){status.textContent=error?.message||String(error);}
 function close(){if(!opened)return;opened=false;document.querySelector('.shell').inert=false;generation++;clearTimeout(timer);panel.hidden=true;document.body.classList.remove('clippings-open');returnFocus?.isConnected&&returnFocus.focus();}
 async function open(){
  if(opened)return;
  returnFocus=document.activeElement;
  if(!cardMode&&!chatOpen)showPanel('welcome');
  window.knowledgeUI?.closeWorkspace();
  const key=settings?.vaultPath||'preview';if(key!==vaultKey){vaultKey=key;filters=defaults();rows=[];data=null;}
  opened=true;selected=null;panel.hidden=false;document.querySelector('.shell').inert=true;document.body.classList.add('clippings-open');buildList();searchBox.focus();await search(true);
 }
 function labelled(label,el){const field=make('label','k-field');field.append(make('span',null,label),el);return field;}
 function select(label,values,key){const el=make('select');el.setAttribute('aria-label',label);for(const [v,t] of values)el.add(new Option(t,v));el.value=filters[key]||'';el.onchange=()=>{filters[key]=el.value||null;search();};return el;}
 function facets(){
  for(const [el,key,values,first] of [[domainSelect,'domain',data?.facets.domains||[],[['','All sources']]],[topicSelect,'topic',data?.facets.topics||[],[['','All Topics'],['__unfiled__','Unfiled']]]]){
   el.replaceChildren();const entries=[...first,...values.map(v=>[v,key==='topic'?v.split('/').pop():v])];if(filters[key]&&!entries.some(([v])=>v===filters[key]))entries.push([filters[key],filters[key]]);for(const [v,t] of entries)el.add(new Option(t,v));el.value=filters[key]||'';
  }
 }
 function buildList(){
  content.replaceChildren();content.scrollTop=0;refresh.hidden=false;back.textContent='← Back';
  const heading=make('div','clippings-title');heading.append(make('span','clippings-eyebrow','YOUR SAVED WEB'),make('h1',null,'Find something worth keeping.'),make('p','k-muted','Articles, videos and posts, together in your vault.'));content.append(heading);
  searchBox=make('input','clippings-search');searchBox.type='search';searchBox.maxLength=300;searchBox.placeholder='Search your saved clippings…';searchBox.setAttribute('aria-label','Search web clippings');searchBox.value=filters.query;searchBox.oninput=()=>{filters.query=searchBox.value;generation++;more.disabled=true;clearTimeout(timer);timer=setTimeout(()=>search(),180);};searchBox.onkeydown=e=>{if(e.key==='Enter'){clearTimeout(timer);search();}};content.append(searchBox);
  const tabs=make('nav','clippings-tabs');tabs.setAttribute('aria-label','Clipping category');
  for(const cat of [null,...categories]){const el=button(cat||'All',()=>{filters.category=cat;for(const child of tabs.children)child.setAttribute('aria-pressed',String(child===el));search();});el.setAttribute('aria-pressed',String(filters.category===cat));tabs.append(el);}content.append(tabs);
  const details=make('details','clippings-filters');details.open=!!(filters.domain||filters.topic||filters.from||filters.to||filters.sort==='newest');details.append(make('summary',null,'Filters & sort'));
  const grid=make('div','clippings-filter-grid');domainSelect=select('Source domain',[],'domain');topicSelect=select('Topic',[],'topic');grid.append(labelled('Source',domainSelect),labelled('Topic',topicSelect));
  for(const [key,label] of [['from','Saved from'],['to','Saved through']]){const date=make('input');date.type='date';date.value=filters[key]||'';date.onchange=()=>{filters[key]=date.value||null;search();};grid.append(labelled(label,date));}
  grid.append(labelled('Sort',select('Sort',[['relevance','Relevance'],['newest','Newest']],'sort')),button('Clear filters',()=>{filters=defaults();buildList();search();searchBox.focus();}));details.append(grid,make('p','clippings-help','All search words must match. Use quotes for a phrase. Date filters exclude unknown capture dates.'));content.append(details);facets();
  const toolbar=make('div','clippings-toolbar');count=make('span');toolbar.append(count,make('span',null,'Saved locally'));content.append(toolbar);
  list=make('div','clippings-results');content.append(list);more=button('Load more',()=>search(false,true),'k-button clippings-more');more.hidden=true;content.append(more);
  content.append(make('p','clippings-help','Captured something new? Refresh to pick up changes from Obsidian Web Clipper.'));
 }
 function highlight(el,text,terms){
  // Build text nodes only: clipping HTML and search terms never become markup.
  const lower=text.toLowerCase(),ranges=[];
  for(const term of terms){let start=0,index;while((index=lower.indexOf(term,start))>=0){ranges.push([index,index+term.length]);start=index+Math.max(1,term.length);}}
  ranges.sort((a,b)=>a[0]-b[0]);let end=0;for(const [a,b] of ranges){if(a<end)continue;el.append(document.createTextNode(text.slice(end,a)),make('mark',null,text.slice(a,b)));end=b;}el.append(document.createTextNode(text.slice(end)));
 }
 function renderResults(){
  list.replaceChildren();count.textContent=`${data.total} matching clipping${data.total===1?'':'s'}${data.partial?' · partial library':''}`;
  if(data.partial){const warning=make('details','k-warning');warning.append(make('summary',null,`Coverage incomplete · ${data.indexed} indexed · ${data.skipped} skipped`));for(const w of data.warnings)warning.append(make('p',null,w.path+': '+w.error));warning.append(make('p',null,'Search covers up to 10,000 notes / 64 MB of source text. Fix unreadable notes or narrow your collection, then refresh.'));list.append(warning);}
  if(!rows.length){const empty=make('div','clippings-empty');empty.append(make('h2',null,data.missing||!data.indexed?'Your saved web starts here':'No matching clippings'),make('p',null,data.missing||!data.indexed?`Use Obsidian Web Clipper to save Markdown into ${root}/Websites, Videos, or X Posts.`:'Try fewer words or clear the filters to browse everything.'));empty.append(button('Clipper setup',()=>setup()),button('Clear search & filters',()=>{filters=defaults();buildList();search();}));list.append(empty);}
  for(const note of rows){const row=make('article','clipping-result'),title=button('',()=>previewNote(note),'clipping-title');highlight(title,note.title,data.terms);row.append(make('p','clipping-meta',[note.category,note.domain||'No source URL',note.savedDate||'Unknown capture date'].join(' · ')),title);
   if(note.author||note.topic)row.append(make('p','clipping-byline',[note.author,note.topic?note.topic.split('/').pop():'Unfiled'].filter(Boolean).join(' · ')));
   for(const passage of note.passages){const excerpt=make('p','clipping-passage');highlight(excerpt,passage,data.terms);row.append(excerpt);}if(note.metadataOnly)row.append(make('p','clippings-help','Matched title or metadata'));if(!note.passages.length&&!note.metadataOnly)row.append(make('p','clippings-help','No saved body text'));list.append(row);
  }
  more.hidden=data.nextOffset===null;more.disabled=false;
 }
 async function search(force=false,append=false){
  if(!opened)return;if(append&&(!data||resultQuery!==JSON.stringify(filters)))return search();clearTimeout(timer);const current=++generation;status.textContent=force?'Reading saved clippings…':'Searching…';more.disabled=true;
  const query={...filters,refresh:force,...(append?{offset:data.nextOffset,revision:data.revision}:{})};
  try{const result=await api.clippings(query);if(current!==generation||!opened)return;data=result;resultQuery=JSON.stringify(filters);rows=append?[...rows,...result.results]:result.results;status.textContent=preview?'Fictional preview · nothing is saved or sent.':'';facets();renderResults();}catch(e){if(current!==generation||!opened)return;fail(e);if(!append){list.replaceChildren(make('p','empty','Results could not be loaded. Adjust your search or refresh to try again.'));count.textContent='';more.hidden=true;}else more.disabled=false;}
 }
 function setup(){generation++;selected='setup';refresh.hidden=true;back.textContent='← Results';content.replaceChildren(make('h1',null,'Save with Web Clipper'),make('p','k-muted','Install Obsidian Web Clipper in your browser and choose this vault as the destination.'),make('p',null,`Save notes under ${root}/Websites, Videos, or X Posts.`),make('p',null,'Keep the source URL in source, the capture date in created, and optional author, type and topic properties. Add tags: [knowledge] to include clips in the Knowledge graph.'),make('p',null,'Save the article or selected passage, not just its URL. For videos, save a transcript or your notes if you want Smith to answer questions about the content.'),button('Open setup note in Obsidian',()=>api.openNote('99. System/Web Clipper Setup.md').catch(fail)));}
 async function previewNote(note){
  scroll=content.scrollTop;selected=note;const current=++generation;refresh.hidden=true;back.textContent='← Results';status.textContent='Reading clipping…';content.replaceChildren();content.scrollTop=0;
  try{const full=await api.clippingNote(note.path);if(current!==generation||!opened)return;status.textContent='';
   content.append(make('p','clippings-eyebrow',full.category),make('h1',null,full.title),make('p','k-muted',[full.domain,full.author,full.savedDate||'Unknown capture date'].filter(Boolean).join(' · ')));
   if(full.source)content.append(make('p','clipping-source',full.source));if(full.topic)content.append(make('p','k-muted','Topic: '+full.topic));
   const actions=make('div','k-actions'),original=button('Open original ↗',()=>api.clippingSource(full.path).catch(fail));original.disabled=!full.source;
   actions.append(original,button('Open in Obsidian',()=>api.openNote(full.path).catch(fail)),button('Ask Smith about this',()=>ask(full)));content.append(actions);
   if(!full.knowledge)content.append(make('p','clippings-help','Searchable here. Add the knowledge tag in Obsidian to include this clipping in the Knowledge graph.'));
   if(full.truncated)content.append(make('p','k-warning','Preview limited to 50,000 characters. Open in Obsidian to read the complete clipping. Search includes the full saved body.'));
   content.append(make('h2',null,'Saved content'),make('pre','clipping-body',full.body||'No body text was captured. A URL alone does not provide the source content.'));back.focus();
  }catch(e){if(current===generation&&opened)fail(e);}
 }
 function backToResults(){const previous=selected;selected=null;generation++;buildList();if(data)renderResults();content.scrollTop=scroll;if(previous?.path){const i=rows.findIndex(n=>n.path===previous.path);list.querySelectorAll('.clipping-title')[i]?.focus({preventScroll:true});}status.textContent='';}
 async function ask(note){try{close();if(connected||connecting)endVoice();if(!chatOpen)await openChat();sendChat(`Read my saved web clipping at ${JSON.stringify(note.path)} and explain its main points. Cite that local note path, distinguish source material from my notes and your synthesis, and acknowledge missing or truncated content. Do not fetch the original URL or save changes.`);}catch(e){fail(e);}}
 document.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();selected?backToResults():close();}else if(e.metaKey&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopImmediatePropagation();if(selected)backToResults();searchBox.focus();searchBox.select();}else if(e.key==='Tab'){const items=[...panel.querySelectorAll('button,input,select,summary')].filter(n=>!n.disabled&&n.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}},true);
 api.onActivity(event=>{if(event.kind==='change'&&opened){selected=null;buildList();search(true);}});
 window.clippingsUI={open,close};
 if(preview){
  // Fictional UI fixtures. Retrieval correctness is tested against real temporary vaults.
  let revision=0;
  const fixtures=[
   {title:'Small models, useful work',category:'Websites',domain:'research.example.com',author:'Alex Morgan',topic:'3. Topics/Local AI',savedDate:'2026-09-28',body:'## A practical starting point\n\nLocal AI models can handle focused tasks without sending documents to a remote service. Measure quality against a small set of real questions before choosing a model.\n\n## My notes\n\nTry a local model for tagging saved articles. Keep source attribution with every result.'},
   {title:'A slower way to learn photography',category:'Videos',domain:'video.example.com',author:'Sam Lee',topic:'3. Topics/Photography',savedDate:'2026-09-24',body:'## Saved transcript\n\nStart with light. Watch how shadows change through the afternoon, then photograph the same scene at three different times.\n\n## My notes\n\nPractice with one lens for a week.'},
   {title:'Pricing is a conversation',category:'X Posts',domain:'social.example.com',author:'Jamie Rivers',topic:'',savedDate:'2026-09-20',body:'A useful pricing conversation starts with the customer’s alternatives, not your feature list.\n\nMy note: ask what they use today.'},
   {title:'A clipping without a date',category:'Other',domain:'',author:'',topic:'',savedDate:null,body:'A saved passage about design and attention. <script>alert("inert example")</script>\n![Remote image](https://example.com/image.png)'}
  ].map((n,i)=>({...n,path:`${root}/${n.category}/${n.title}.md`,source:n.domain?`https://${n.domain}/saved`:null,knowledge:i!==3,version:'preview',truncated:false}));
  api.clippings=async input=>{if(input.refresh)revision++;const terms=(input.query?.match(/"[^"]*"|[^\s"]+/g)||[]).map(t=>t.replaceAll('"','').toLowerCase());let found=fixtures.filter(n=>(!input.category||n.category===input.category)&&(!input.domain||n.domain===input.domain)&&(!input.topic||(input.topic==='__unfiled__'?!n.topic:n.topic===input.topic))&&(!input.from||n.savedDate&&n.savedDate>=input.from)&&(!input.to||n.savedDate&&n.savedDate<=input.to)&&terms.every(t=>[n.title,n.author,n.topic,n.body,n.source].join(' ').toLowerCase().includes(t)));return {results:found.map(({body,...n})=>({...n,passages:[body.slice(0,280)],metadataOnly:false})),total:found.length,indexed:fixtures.length,revision:String(revision),nextOffset:null,terms,facets:{domains:fixtures.map(n=>n.domain).filter(Boolean),topics:fixtures.map(n=>n.topic).filter(Boolean)},warnings:[],skipped:0,partial:false,missing:false};};
  api.clippingNote=async p=>fixtures.find(n=>n.path===p);api.clippingSource=async()=>{status.textContent='Preview only. The desktop app opens the saved source in your browser.';};
 }
})();
