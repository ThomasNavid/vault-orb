const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {parseNote,dateValue,localDate}=require('./vault.cjs');
const ROOT='4. Knowledge Library/Web Clippings';
const DASHBOARD=ROOT+'/Web Clippings.md';
const CATEGORIES=['Websites','Videos','X Posts','Other'];
const LIMITS={notes:10000,bytes:64*1024*1024,entries:100000,depth:24};
const caches=new WeakMap();
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const strings=value=>Array.isArray(value)?value.flatMap(strings):typeof value==='string'?[value]:[];
const text=value=>typeof value==='string'?value.trim():'';
function sourceURL(value){
 if(typeof value!=='string'||value.length>8000)return null;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
function captureDate(value){
 if(typeof value!=='string')return null;
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value))return null;
 try{dateValue(value.slice(0,10));}catch{return null;}
 if(value.length===10)return {day:value,time:Date.parse(value+'T00:00:00')};
 if(!/T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d/.test(value))return null;
 const time=Date.parse(value);return Number.isFinite(time)?{day:localDate(new Date(time)),time}:null;
}
function topicName(value){return text(value).replace(/^\[\[|\]\]$/g,'').split('|')[0].split('#')[0].replace(/\.md$/i,'');}
function category(relative,type){
 const folder=relative.slice(ROOT.length+1).split('/')[0];
 if(CATEGORIES.includes(folder))return folder;
 const aliases={website:'Websites',websites:'Websites',article:'Websites',web:'Websites',video:'Videos',videos:'Videos',youtube:'Videos','x post':'X Posts','x posts':'X Posts',tweet:'X Posts',twitter:'X Posts',x:'X Posts'};
 return Object.hasOwn(aliases,text(type).toLowerCase())?aliases[text(type).toLowerCase()]:'Other';
}
function clippingPath(relative){
 if(typeof relative!=='string'||!relative.startsWith(ROOT+'/')||!relative.toLowerCase().endsWith('.md')||relative===DASHBOARD)throw new Error('Choose a Markdown note inside Web Clippings.');
 return relative;
}
function record(vault,relative){
 clippingPath(relative);
 const note=vault.read(relative),{data,body}=parseNote(note.content);
 const source=sourceURL(data.source)||sourceURL(data.url),date=captureDate(data.created);
 const tags=strings(data.tags).flatMap(v=>v.split(/[ ,]+/)).map(v=>v.replace(/^#/,''));
 const meta={path:relative,version:note.version,title:(text(data.title)||path.basename(relative,path.extname(relative))).slice(0,500),source,domain:source?new URL(source).hostname:'',category:category(relative,data.type),type:text(data.type).slice(0,200),author:strings(data.author).join(', ').slice(0,1000),topic:topicName(strings(data.topic)[0]).slice(0,1000),tags:tags.slice(0,100).map(v=>v.slice(0,200)),created:date?data.created:null,savedDate:date?.day||null,knowledge:tags.includes('knowledge')};
 return {meta,body,time:date?.time??-Infinity,bytes:Buffer.byteLength(note.content),title:meta.title.toLowerCase(),metadata:[meta.author,meta.source,meta.topic,...meta.tags].filter(Boolean).join('\n').toLowerCase(),lower:body.toLowerCase()};
}
function readClipping(vault,relative){const r=record(vault,relative);return {...r.meta,body:r.body.slice(0,50000),truncated:r.body.length>50000};}
function queryTerms(query){
 if(typeof query!=='string'||query.length>300)throw new Error('Search must be text up to 300 characters.');
 if((query.match(/"/g)||[]).length%2)throw new Error('Close the quotation marks around your search phrase.');
 return [...new Set((query.match(/"[^"]*"|[^\s"]+/g)||[]).map(v=>v.replace(/^"|"$/g,'').trim().toLowerCase()).filter(Boolean))];
}
function options(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid clipping search.');
 const query=input.query??'',terms=queryTerms(query),category=input.category||null,domain=input.domain||null,topic=input.topic||null,from=input.from||null,to=input.to||null,sort=input.sort||'relevance',offset=input.offset??0,revision=input.revision||null;
 if(category&&!CATEGORIES.includes(category))throw new Error('Choose a valid clipping category.');
 for(const [name,value] of Object.entries({domain,topic,revision}))if(value&&(typeof value!=='string'||value.length>1000))throw new Error('Invalid '+name+' filter.');
 for(const value of [from,to])if(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Use YYYY-MM-DD for saved-date filters.');dateValue(value);}
 if(from&&to&&from>to)throw new Error('The start date must be on or before the end date.');
 if(!['relevance','newest'].includes(sort))throw new Error('Choose Relevance or Newest.');
 if(!Number.isSafeInteger(offset)||offset<0||offset>LIMITS.notes)throw new Error('Invalid result offset.');
 if(input.refresh!==undefined&&typeof input.refresh!=='boolean')throw new Error('Invalid refresh option.');
 return {query,terms,category,domain,topic,from,to,sort,offset,revision,refresh:!!input.refresh};
}
function passages(r,terms){
 if(!terms.length)return r.body.trim()?[r.body.trim().slice(0,280)]:[];
 const positions=terms.map(t=>r.lower.indexOf(t)).filter(i=>i>=0).sort((a,b)=>a-b),out=[];let end=-1;
 for(const pos of positions){if(pos<end)continue;const start=Math.max(0,pos-85);end=Math.min(r.body.length,pos+195);out.push((start?'…':'')+r.body.slice(start,end)+(end<r.body.length?'…':''));if(out.length===2)break;}
 return out;
}
class ClippingIndex{
 constructor(vault){this.vault=vault;this.epoch=0;this.snapshot=null;this.pending=null;}
 invalidate(){this.epoch++;this.snapshot=null;this.pending=null;}
 async build(){
  const epoch=this.epoch,records=[],warnings=[];let bytes=0,entries=0,limited=false,missing=false,skipped=0;
  const warn=(relative,error)=>{skipped++;if(warnings.length<100)warnings.push({path:relative,error});};
  const visit=async(relative,depth=0)=>{
   if(depth>LIMITS.depth){limited=true;warn(relative,'Folder depth limit reached.');return;}
   let dir;
   try{dir=await fs.promises.opendir(this.vault.resolve(relative,{note:false}));}catch(e){if(relative===ROOT&&(e.code==='ENOENT'||e.message.startsWith('Not found:')))missing=true;else warn(relative,e.message);return;}
   for await(const entry of dir){
    if(epoch!==this.epoch)throw new Error('Clipping index changed. Refresh and try again.');
    if(++entries>LIMITS.entries||records.length>=LIMITS.notes||bytes>=LIMITS.bytes){limited=true;break;}
    if(entry.name.startsWith('.')||entry.isSymbolicLink()||['node_modules','dist'].includes(entry.name))continue;
    const child=relative+'/'+entry.name;
    if(entry.isDirectory())await visit(child,depth+1);
    else if(entry.isFile()&&/\.md$/i.test(entry.name)&&child!==DASHBOARD){
     try{const r=record(this.vault,child);if(bytes+r.bytes>LIMITS.bytes){limited=true;break;}bytes+=r.bytes;records.push(r);}catch(e){warn(child,e.message);}
    }
    if(entries%10===0)await tick();
    if(limited&&(records.length>=LIMITS.notes||bytes>=LIMITS.bytes||entries>LIMITS.entries))break;
   }
  };
  await visit(ROOT);
  if(epoch!==this.epoch)throw new Error('Clipping index changed. Refresh and try again.');
  return {revision:randomUUID(),records,warnings,skipped,limited,missing,indexedAt:new Date().toISOString(),bytes};
 }
 async get(refresh=false){
  if(this.pending)return this.pending;
  if(this.snapshot&&!refresh)return this.snapshot;
  const epoch=this.epoch;
  const pending=this.build().then(snapshot=>{if(epoch===this.epoch)this.snapshot=snapshot;return snapshot;});this.pending=pending;
  try{return await pending;}finally{if(this.pending===pending)this.pending=null;}
 }
 async search(input){
  const o=options(input),s=await this.get(o.refresh);
  if((o.revision&&o.revision!==s.revision)||(o.offset&&!o.revision))throw new Error('Clipping results changed. Refresh before loading more.');
  const matches=[];let scanned=0;
  for(const r of s.records){
   const m=r.meta;
   if(o.category&&m.category!==o.category||o.domain&&m.domain!==o.domain||o.topic&&(o.topic==='__unfiled__'?!!m.topic:m.topic!==o.topic))continue;
   if((o.from||o.to)&&(!m.savedDate||o.from&&m.savedDate<o.from||o.to&&m.savedDate>o.to))continue;
   if(o.terms.every(t=>r.title.includes(t)||r.metadata.includes(t)||r.lower.includes(t))){
    const score=o.terms.reduce((sum,t)=>sum+(r.title.includes(t)?20:0)+(r.metadata.includes(t)?5:0)+(r.lower.includes(t)?1:0),0);
    matches.push({r,score});
   }
   if(++scanned%100===0)await tick();
  }
  // A refresh/invalidation during a search must not return a now-stale page.
  if(this.snapshot!==s)throw new Error('Clipping results changed. Refresh and try again.');
  matches.sort((a,b)=>(o.sort==='relevance'&&o.terms.length?b.score-a.score:0)||(a.r.time===b.r.time?0:a.r.time>b.r.time?-1:1)||a.r.meta.path.localeCompare(b.r.meta.path));
  const results=matches.slice(o.offset,o.offset+30).map(({r,score})=>({...r.meta,score,passages:passages(r,o.terms),metadataOnly:!!o.terms.length&&!o.terms.some(t=>r.lower.includes(t))}));
  return {results,total:matches.length,indexed:s.records.length,revision:s.revision,nextOffset:o.offset+results.length<matches.length?o.offset+results.length:null,terms:o.terms,facets:{domains:[...new Set(s.records.map(r=>r.meta.domain).filter(Boolean))].sort(),topics:[...new Set(s.records.map(r=>r.meta.topic).filter(Boolean))].sort()},warnings:s.warnings,skipped:s.skipped,partial:s.limited||s.skipped>0,missing:s.missing,indexedAt:s.indexedAt,unknownDates:s.records.filter(r=>!r.meta.savedDate).length};
 }
}
function clippings(vault){if(!vault)throw new Error('Choose a valid vault in Settings.');if(!caches.has(vault))caches.set(vault,new ClippingIndex(vault));return caches.get(vault);}
function invalidateClippings(vault){if(vault)caches.get(vault)?.invalidate();}
module.exports={ROOT,CATEGORIES,LIMITS,clippings,invalidateClippings,readClipping,sourceURL,captureDate,queryTerms};
