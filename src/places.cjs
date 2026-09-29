const fs=require('node:fs'),path=require('node:path'),YAML=require('yaml');
const {parseNote}=require('./vault.cjs');
const FOLDER='6. Life Admin/Places';
const ASSETS=['6. Life Admin/Places.md','6. Life Admin/Places.base','99. System/99.1 Templates/10. Place Template.md'];
function text(value,name,max=500){if(typeof value!=='string'||value.length>max)throw new Error(`Invalid ${name}.`);return value.trim();}
function coordinate(value,latitude){if(value==null||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>(latitude?90:180))throw new Error(`Invalid ${latitude?'latitude':'longitude'}. Use decimal degrees.`);return value;}
function coordinates(value){return {latitude:coordinate(value.latitude,true),longitude:coordinate(value.longitude,false)};}
const pinned=p=>p.latitude!==null&&p.longitude!==null;
function website(value){const s=text(value??'','website',2000);if(!s)return '';let u;try{u=new URL(s);}catch{throw new Error('Website must be an HTTP(S) URL.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Website must be an HTTP(S) URL.');return u.href;}
function eligible(relative){if(typeof relative!=='string'||!relative.startsWith(FOLDER+'/')||!relative.endsWith('.md'))throw new Error('Choose a note inside the Places folder.');return relative;}
function readPlace(vault,relative){
  const note=vault.read(eligible(relative)),{data,body}=parseNote(note.content);if(data.type!=='place')throw new Error('This note is not a place.');
  const warnings=[];let coords={latitude:null,longitude:null};try{coords=coordinates(data);if(!pinned(coords)&&(coords.latitude!==null||coords.longitude!==null))warnings.push('Both coordinates are needed for a pin.');}catch(e){warnings.push(e.message);}
  return {name:path.basename(relative,'.md'),category:typeof data.category==='string'&&data.category.trim()?data.category:'Uncategorized',location:typeof data.location==='string'?data.location:'',website:typeof data.website==='string'?data.website:'',...coords,path:relative,version:note.version,body,warnings};
}
function listPlaces(vault,{query='',category=null}={}){
  query=text(query??'','query',200).toLocaleLowerCase();if(category!==null)category=text(category,'category',100);
  const places=[],warnings=[];
  try{vault.resolve(FOLDER,{note:false});}catch(e){if(e.message.startsWith('Not found:'))return {places,warnings,setup:true};throw e;}
  for(const relative of vault.walk(FOLDER).slice(0,2000)){
    try{const note=vault.read(relative);if(parseNote(note.content).data.type!=='place')continue;const p=readPlace(vault,relative);
      if(category&&p.category.toLocaleLowerCase()!==category.toLocaleLowerCase())continue;
      if(query&&!`${p.name} ${p.category} ${p.location} ${p.body}`.toLocaleLowerCase().includes(query))continue;
      places.push(p);for(const warning of p.warnings)warnings.push(`${p.name}: ${warning}`);
    }catch(e){warnings.push(`${relative}: ${e.message}`);}
  }
  if(vault.walk(FOLDER).length>2000)warnings.push('Only the first 2,000 place notes were read.');
  const setup=ASSETS.some(relative=>{try{return !fs.existsSync(vault.resolve(relative,{note:false}));}catch(e){if(e.message.startsWith('Not found:'))return true;throw e;}});
  return {places,warnings,setup};
}
function ensureFolder(vault,relative){for(const [i] of relative.split('/').entries()){const part=relative.split('/').slice(0,i+1).join('/'),file=vault.resolve(part,{note:false,missing:true});if(!fs.existsSync(file))fs.mkdirSync(file,{mode:0o700});if(!fs.statSync(file).isDirectory())throw new Error(`Not a folder: ${part}`);}}
function filename(value){const name=text(value,'place name',180).normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').replace(/^[. ]+|[. ]+$/g,'');if(!name)throw new Error('Enter a place name.');return name;}
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
function samePlace(a,b){return norm(a.name)===norm(b.name)&&((!!norm(a.location)&&norm(a.location)===norm(b.location))||(pinned(a)&&pinned(b)&&Math.abs(a.latitude-b.latitude)<0.00005&&Math.abs(a.longitude-b.longitude)<0.00005));}
function savePlace(vault,input){
  return vault.withTaskLock(()=>{
    const name=filename(input.name),location=text(input.location??'','location'),category=text(input.category??'Uncategorized','category',100)||'Uncategorized',coords=coordinates(input),url=website(input.website),notes=text(input.notes??'','notes',10000);
    ensureFolder(vault,FOLDER);
    const place={name,category,location,...coords,website:url},existing=listPlaces(vault).places.find(p=>samePlace(p,place));
    if(existing)return {path:existing.path,version:existing.version,duplicate:true};
    const relative=`${FOLDER}/${name}.md`,target=vault.resolve(relative,{missing:true});
    if(fs.existsSync(target))throw new Error('A different place already uses that name. Add a neighbourhood or branch to the name.');
    const data={type:'place',category,location:location||null,...coords,website:url||null};
    const source=input.source==='geoapify'?'\n\nSource: [Geoapify](https://www.geoapify.com/) · [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Retrieved '+new Date().toISOString().slice(0,10)+'.':'';
    return vault.commit(relative,null,`---\n${YAML.stringify(data)}---\n\n# ${name}\n\n## Notes\n\n${notes}${source}\n`,'Place saved');
  });
}
function updateLocation(vault,{path:relative,version,latitude,longitude}){
  return vault.withTaskLock(()=>{readPlace(vault,relative);const note=vault.read(relative);if(note.version!==version)throw new Error('Place changed. Read it again before saving its location.');const {doc,body}=parseNote(note.content),coords=coordinates({latitude,longitude});if(!pinned(coords))throw new Error('Both coordinates are needed.');doc.set('latitude',coords.latitude);doc.set('longitude',coords.longitude);return vault.commit(relative,note.content,`---\n${doc.toString()}---\n${body}`,'Place location saved');});
}
function setupPlaces(vault,{apply=false,template=path.join(__dirname,'../vault-template')}={}){
  const missing=[];
  for(const relative of ASSETS){let exists=false;try{exists=fs.existsSync(vault.resolve(relative,{note:false}));}catch(e){if(!e.message.startsWith('Not found:'))throw e;}if(!exists)missing.push(relative);}
  if(!apply)return {missing,folder:FOLDER,notes:'Adds missing files only. Configure Templater and property types using Obsidian Setup; existing files and plugin settings are preserved.'};
  return vault.withTaskLock(()=>{ensureFolder(vault,FOLDER);const created=[];for(const relative of missing){ensureFolder(vault,path.posix.dirname(relative));const file=vault.resolve(relative,{note:false,missing:true});try{fs.writeFileSync(file,fs.readFileSync(path.join(template,relative)),{flag:'wx',mode:0o600});created.push(relative);}catch(e){if(e.code!=='EEXIST')throw e;}}return {created,folder:FOLDER};});
}
module.exports={FOLDER,ASSETS,listPlaces,readPlace,savePlace,updateLocation,setupPlaces,coordinates,coordinate,pinned,text,website,samePlace};
