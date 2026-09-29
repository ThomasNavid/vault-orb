const path=require('node:path');
const fs=require('node:fs');
const YAML=require('yaml');
const {parseNote,hash,atomicWrite,dateValue}=require('./vault.cjs');
const {KNOWLEDGE}=require('./workspace.cjs');
const templates={portfolio:'1. Portfolio',hub:'2. Hub',topic:'3. Topic',knowledge:'4. Knowledge'};
const STAGES=['Idea','Developing','Ready'];
function kindFolder(kind){if(!Object.hasOwn(KNOWLEDGE,kind))throw new Error('Choose portfolio, hub, topic, or knowledge.');return KNOWLEDGE[kind];}
function record(vault,relative){
 const kind=Object.keys(KNOWLEDGE).find(k=>typeof relative==='string'&&relative.startsWith(KNOWLEDGE[k]+'/'));
 if(!kind||!relative.endsWith('.md'))throw new Error('Choose a note in the knowledge system.');
 const note=vault.read(relative),parsed=parseNote(note.content);
 const tags=values(parsed.data.tags).flatMap(t=>t.split(/[ ,]+/)).map(t=>t.replace(/^#/,''));
 if(!tags.includes(kind)){const error=new Error('The note needs the '+kind+' tag.');error.code='UNTAGGED';throw error;}
 return {...note,...parsed,kind};
}
function sourceLink(vault,relative,kind){
 if(typeof relative!=='string'||/[\[\]|#\r\n]/.test(relative))throw new Error(`Choose an exact ${kind} Markdown note path.`);
 if(record(vault,relative).kind!==kind)throw new Error(`The linked note must be a ${kind} note.`);
 return `[[${relative.slice(0,-3)}]]`;
}
// Fenced code, comments and inline code are reference examples, not graph edges.
function linkText(body){return body.replace(/<!--[^]*?-->/g,'').replace(/^\s*(`{3,}|~{3,})[^\n]*\n[^]*?^\s*\1\s*$/gm,'').replace(/`[^`\n]*`/g,'');}
function links(text){
 const out=[];for(const m of String(text??'').matchAll(/\[\[([^\]\n]+)\]\]|\[[^\]\n]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
  let target=m[1]?m[1].split('|')[0]:m[2].replace(/^<|>$/g,'');
  target=target.split('#')[0].trim();if(!target||/^[a-z][a-z\d+.-]*:/i.test(target))continue;
  if(!m[1])try{target=decodeURIComponent(target);}catch{continue;}
  out.push({target,wiki:!!m[1]});
 }return out;
}
function values(value){return Array.isArray(value)?value.flatMap(values):typeof value==='string'?[value]:[];}
function resolveLink(link,from,records){
 const target=link.target.replace(/\.md$/i,''),exact=target+'.md';
 const relative=path.posix.normalize(path.posix.join(path.posix.dirname(from),exact));
 if(!link.wiki&&records.has(relative))return relative;
 if(records.has(exact))return exact;
 if(link.wiki&&records.has(relative))return relative;
 if(!link.wiki||target.includes('/'))return null;
 const candidates=[...records.keys()].filter(p=>path.posix.basename(p,'.md')===target);
 return candidates.length===1?candidates[0]:null;
}
function stateFile(vault){return path.join(vault.stateDir,`knowledge-${hash(vault.root).slice(0,16)}.json`);}
function readState(vault){try{return JSON.parse(fs.readFileSync(stateFile(vault),'utf8'));}catch(e){if(e.code==='ENOENT')return {dismissed:[]};throw new Error('Knowledge preferences could not be read.');}}
function knowledgeSnapshot(vault){
 const records=new Map(),warnings=[];let total=0;
 for(const [kind,folder] of Object.entries(KNOWLEDGE)) {
  try{for(const relative of vault.walk(folder)){try{const r=record(vault,relative);total++;if(records.size<2000)records.set(relative,r);}catch(e){if(e.code!=='UNTAGGED')warnings.push({path:relative,error:e.message});}}}
  catch(e){warnings.push({path:folder,error:e.message});}
 }
 const edges=[],seen=new Set(),notes=[];
 for(const [relative,r] of records){
  const add=(link,type,property=null)=>{const target=resolveLink(link,relative,records);if(!target){if(property)warnings.push({path:relative,error:`Unresolved or ambiguous ${property} link: ${link.target}`});return;}if(target===relative)return;const key=[relative,target,type,property].join('\0');if(seen.has(key))return;seen.add(key);edges.push({source:relative,target,type,property});};
  for(const [key,value] of Object.entries(r.data))for(const text of values(value))for(const link of links(text))add(link,['hub','topic'].includes(key)?'hierarchy':'reference',key);
  for(const link of links(linkText(r.body)))add(link,'reference');
  const stripped=linkText(r.body).replace(/^#+.*$/gm,'').replace(/[\s*\-]/g,'');
  notes.push({kind:r.kind,path:relative,title:path.basename(relative,'.md'),version:r.version,hub:r.data.hub??null,topic:r.data.topic??null,type:r.data.type??null,stage:r.kind==='portfolio'?(STAGES.includes(r.data.stage)?r.data.stage:'Idea'):null,source:typeof r.data.source==='string'?r.data.source:null,reason:typeof r.data.reason==='string'?r.data.reason:'',revisit:typeof r.data.revisit==='string'?r.data.revisit:null,excerpt:linkText(r.body).trim().slice(0,250),template:!stripped||/A short overview of what this piece is|Write your thoughts, arguments, structures, conclusions/.test(r.body)});
 }
 const byPath=new Map(notes.map(n=>[n.path,n]));
 for(const note of notes){note.parents=edges.filter(e=>e.source===note.path&&e.type==='hierarchy').map(e=>e.target);note.unfiled=note.kind==='knowledge'&&!edges.some(e=>e.source===note.path&&e.property==='topic'&&byPath.get(e.target)?.kind==='topic');}
 let dismissed=[];try{dismissed=readState(vault).dismissed||[];}catch(e){warnings.push({error:e.message});}
 const suggestions=[],connected=new Set(edges.flatMap(e=>[e.source+'\0'+e.target,e.target+'\0'+e.source]));
 const words=t=>new Set(t.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)?.filter(w=>!['this','that','with','from','notes','knowledge','about','your','have','into','their'].includes(w))||[]);
 const candidates=notes.filter(n=>n.kind==='topic'||n.kind==='portfolio'&&!n.template).map(n=>({note:n,words:words(n.title)}));
 for(const note of notes.filter(n=>n.kind==='knowledge')){
  const terms=words(note.title+' '+note.excerpt);
  for(const {note:target,words:targetWords} of candidates){
   if(connected.has(note.path+'\0'+target.path))continue;
   const shared=[...targetWords].filter(w=>terms.has(w));if(!shared.length)continue;
   const id=hash([note.path,note.version,target.path,target.version].join('\0'));
   if(dismissed.includes(id))continue;
   suggestions.push({id,path:note.path,version:note.version,target:target.path,targetVersion:target.version,property:target.kind==='topic'&&note.unfiled?'topic':null,reason:`Shared title terms: ${shared.join(', ')}`,label:target.kind==='portfolio'?'Possible supporting source':note.unfiled?'Suggested Topic':'Related Topic'});
  }
 }
 return {notes,edges,total,truncated:total>2000,warnings,suggestions:suggestions.slice(0,40)};
}
function listKnowledge(vault,{kind='all'}={}){if(kind!=='all')kindFolder(kind);const result=knowledgeSnapshot(vault),notes=result.notes.filter(n=>kind==='all'||n.kind===kind);return {notes:notes.slice(0,200),total:kind==='all'?result.total:notes.length,truncated:result.truncated||notes.length>200,warnings:result.warnings};}
function knowledgeNote(vault,relative){const r=record(vault,relative);return {path:relative,version:r.version,kind:r.kind,body:r.body.slice(0,50000),truncated:r.body.length>50000,properties:r.data};}
function knowledgeContext(vault,{path:relative}){
 const snapshot=knowledgeSnapshot(vault),selected=snapshot.notes.find(n=>n.path===relative);if(!selected)throw new Error('Knowledge note not found in the index.');
 const scope=new Set([relative]);for(const e of snapshot.edges)if(e.target===relative||e.source===relative)scope.add(e.source===relative?e.target:e.source);
 // Hubs include their Topics' Library material as well.
 if(selected.kind==='hub')for(const e of snapshot.edges)if(scope.has(e.target)&&snapshot.notes.find(n=>n.path===e.source)?.kind==='knowledge')scope.add(e.source);
 const paths=[...scope].slice(0,16),budget=60000;let remaining=budget;
 const notes=paths.map(p=>{const n=knowledgeNote(vault,p),body=n.body.slice(0,Math.min(12000,remaining));remaining-=body.length;return {...n,body,truncated:n.truncated||body.length<n.body.length};});
 return {selected,notes,truncated:snapshot.truncated||scope.size>16||notes.some(n=>n.truncated),warnings:snapshot.warnings};
}
function knowledgeSources(vault,{paths}){
 if(!Array.isArray(paths)||!paths.length||paths.length>30)throw new Error('Choose 1–30 Library source paths.');
 let remaining=90000;
 const notes=[...new Set(paths)].map(p=>{const n=knowledgeNote(vault,p);if(n.kind!=='knowledge')throw new Error('Choose Library source notes.');const body=n.body.slice(0,Math.min(12000,remaining));remaining-=body.length;return {...n,body,truncated:n.truncated||body.length<n.body.length};});
 return {notes,truncated:notes.some(n=>n.truncated)};
}
function updateKnowledge(vault,{path:relative,version,stage=null,topic=null,hub=null,reason=null,revisit=null,draft=null,questions=null}){
 if([stage,topic,hub,reason,revisit,draft,questions].every(v=>v===null))throw new Error('No fields to update.');
 const r=record(vault,relative);if(r.version!==version)throw new Error('Note changed. Read it again before editing.');
 if(stage!==null){if(r.kind!=='portfolio'||!STAGES.includes(stage))throw new Error('Choose Idea, Developing, or Ready for Portfolio.');r.doc.set('stage',stage);}
 if(topic!==null){if(!['knowledge','portfolio'].includes(r.kind))throw new Error('Only Library and Portfolio notes have a Topic.');r.doc.set('topic',topic===''?null:sourceLink(vault,topic,'topic'));}
 if(hub!==null){if(!['topic','portfolio'].includes(r.kind))throw new Error('Only Topics and Portfolio notes have a Hub.');r.doc.set('hub',sourceLink(vault,hub,'hub'));}
 for(const [key,value] of Object.entries({reason,revisit})){if(value===null)continue;if(typeof value!=='string'||value.length>2000)throw new Error(`Invalid ${key}.`);if(key==='revisit'&&value&&(value.length!==10||dateValue(value)!==value))throw new Error('Choose a revisit date YYYY-MM-DD.');r.doc.set(key,value||null);}
 let body=r.body;
 for(const [name,value] of [['Working draft',draft],['Open questions',questions]]){
  if(value===null)continue;if(r.kind!=='portfolio'||typeof value!=='string'||value.length>30000)throw new Error('Portfolio draft or questions must be at most 30,000 characters.');
  const start=`<!-- orb:${name} -->`,end=`<!-- /orb:${name} -->`;
  if(value.includes('<!-- orb:')||value.includes('<!-- /orb:'))throw new Error('Reserved draft markers are not allowed.');
  const section=`${start}\n## ${name}\n\n${value.trim()}\n${end}`;
  const a=body.indexOf(start),b=body.indexOf(end);if(a>=0&&b>a)body=body.slice(0,a)+section+body.slice(b+end.length);else body=body.trimEnd()+'\n\n'+section+'\n';
 }
 return vault.commit(relative,r.content,`---\n${r.doc.toString()}---\n${body}`,'Knowledge note updated');
}
function connectKnowledge(vault,{path:relative,version,target,targetVersion,property=null}){
 const r=record(vault,relative),other=record(vault,target);if(r.version!==version||other.version!==targetVersion)throw new Error('A linked note changed. Refresh before connecting it.');if(relative===target)throw new Error('Choose a different note.');
 if(property!==null){if(property!=='topic'||r.kind!=='knowledge'||other.kind!=='topic')throw new Error('Only Library → Topic filing is supported here.');return updateKnowledge(vault,{path:relative,version,topic:target});}
 const link=sourceLink(vault,target,other.kind);
 if(links(linkText(r.body)).some(l=>l.target.replace(/\.md$/i,'')===target.slice(0,-3)))return {path:relative,version,unchanged:true};
 return vault.appendNote({path:relative,version,text:`Related: ${link}`});
}
function dismissSuggestion(vault,{id}){if(typeof id!=='string'||! /^[a-f0-9]{64}$/.test(id))throw new Error('Invalid suggestion.');const state=readState(vault);state.dismissed=[...new Set([...(state.dismissed||[]),id])].slice(-2000);atomicWrite(stateFile(vault),JSON.stringify(state));return {dismissed:true};}
function createKnowledge(vault,{kind,title,text='',hub=null,topic=null,sources=[],source=null,reason='',stage='Idea'}) {
 const folder=kindFolder(kind);
 if(typeof title!=='string'||!title.trim()||title.length>180||/[\r\n]/.test(title))throw new Error('Choose a single-line title up to 180 characters.');
 if(typeof text!=='string'||text.length>30000)throw new Error('Note text must be at most 30,000 characters.');
 if(typeof reason!=='string'||reason.length>2000)throw new Error('Reason must be at most 2,000 characters.');
 if(!Array.isArray(sources)||sources.length>30)throw new Error('Use at most 30 supporting knowledge notes.');
 if(source!==null&&(typeof source!=='string'||source.length>2000||!/^https?:\/\//i.test(source)))throw new Error('Source must be an http(s) URL or null.');
 if(kind==='topic'&&!hub)throw new Error('Choose an existing Hub for this Topic.');
 if(kind==='hub'&&(hub||topic||sources.length||source))throw new Error('A Hub is a broad subject map; attach subjects through Topic notes.');
 if(kind==='topic'&&(topic||sources.length||source))throw new Error('A Topic links to a Hub; create its sources as Knowledge notes.');
 if(kind==='knowledge'&&(hub||sources.length))throw new Error('A Knowledge note links to its main Topic and source URL.');
 if(kind==='portfolio'&&source)throw new Error('Use supporting knowledge notes for Portfolio citations.');
 if(!STAGES.includes(stage))throw new Error('Choose Idea, Developing, or Ready.');
 const data={tags:[kind]};if(reason)data.reason=reason;
 if(hub)data.hub=sourceLink(vault,hub,'hub');if(topic)data.topic=sourceLink(vault,topic,'topic');
 const unique=[...new Set(sources)],support=unique.map(p=>{sourceLink(vault,p,'knowledge');return vault.read(p);});
 if(kind==='knowledge')Object.assign(data,{author:null,type:null,source,topic:data.topic||null});
 if(kind==='portfolio')Object.assign(data,{type:'idea',stage});
 let body='';try{body=parseNote(vault.read(`99. System/99.1 Templates/${templates[kind]} Template.md`).content).body;}catch(e){if(!e.message.startsWith('Not found:'))throw e;}
 const query=body.match(/```dataview\r?\n[\s\S]*?```/)?.[0];
 const related=unique.length?`\n\n## Related Documents\n\n${unique.map(p=>'- '+sourceLink(vault,p,'knowledge')).join('\n')}`:'';
 const listing=query?`\n\n## ${kind==='portfolio'?'Links to Knowledge':kind==='hub'?'Key Topics':'Knowledge Linked to This Topic'}\n\n${query}`:'';
 const safe=title.trim().replace(/[\/\\:*?"<>|\[\]#\x00-\x1f]/g,'-').replace(/^\.+/,'').trim();if(!safe)throw new Error('Choose a valid title.');
 vault.resolve(folder,{note:false});let relative=`${folder}/${safe}.md`,n=2;while(fs.existsSync(path.join(vault.root,relative)))relative=`${folder}/${safe} (${n++}).md`;
 const result=vault.commit(relative,null,`---\n${YAML.stringify(data)}---\n\n# ${title.trim()}\n\n${text.trim()||'## Summary\n\n## Notes'}${related}${listing}\n`,'Knowledge note created');
 // Each write is independently journalled. Return saved work and any failures so retries never duplicate the draft.
 result.changes=[{...result}];result.warnings=[];
 for(const note of support){try{const change=vault.appendNote({path:note.path,version:note.version,text:`Supports: [[${relative.slice(0,-3)}]]`});result.changes.push(change);}catch(e){result.warnings.push({path:note.path,error:`Draft saved; backlink failed: ${e.message}`});}}
 return result;
}
module.exports={listKnowledge,createKnowledge,knowledgeSnapshot,knowledgeNote,knowledgeContext,knowledgeSources,updateKnowledge,connectKnowledge,dismissSuggestion,links,resolveLink};
