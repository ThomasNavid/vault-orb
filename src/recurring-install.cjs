const fs=require('node:fs'),path=require('node:path');
const SCRIPT='99. System/99.4 Scripts/recurring-tasks';
const FILES=['0. Home/Recurring Tasks.md','99. System/Recurring Tasks Setup.md',...['bundle.js','view.js','view.css','config.md'].map(f=>SCRIPT+'/'+f)];
function installRecurring(vault){
  const created=[],existing=[],conflicts=[];
  // Resolve each ancestor through the vault boundary checks, rejecting symlinks.
  function parent(relative){const parts=relative.split('/');for(let n=1;n<parts.length;n++){const p=parts.slice(0,n).join('/'),file=vault.resolve(p,{note:false,missing:true});if(!fs.existsSync(file))fs.mkdirSync(file);else if(!fs.statSync(file).isDirectory())throw new Error('Not a folder: '+p);}}
  return vault.withTaskLock(()=>{
    for(const relative of FILES){parent(relative);const file=vault.resolve(relative,{note:false,missing:true});let content=fs.readFileSync(path.join(__dirname,'../vault-template',relative),'utf8');if(relative.endsWith('/config.md'))content=content.replace(/```json\s*[\s\S]*?```/,'```json\n'+JSON.stringify(vault.folders)+'\n```');
      if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')===content)existing.push(relative);else conflicts.push(relative);continue;}
      fs.writeFileSync(file,content,{flag:'wx',mode:0o600});created.push(relative);
    }
    return {created,existing,conflicts,path:'0. Home/Recurring Tasks.md'};
  });
}
module.exports={installRecurring,FILES};
