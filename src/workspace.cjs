const fs=require('node:fs');
const path=require('node:path');
const {FOLDERS,RULES_PATH,GOALS_FOLDER,HABIT_FOLDER}=require('./vault.cjs');
const {HABIT_SCRIPT,definitions}=require('./habits.cjs');
const TEMPLATE=path.join(__dirname,'../vault-template');
const KNOWLEDGE={portfolio:'1. Portfolio',hub:'2. Hubs',topic:'3. Topics',knowledge:'4. Knowledge Library'};
const DEFAULTS={taskFolders:FOLDERS,rulesPath:RULES_PATH,goalsFolder:GOALS_FOLDER,habitFolder:HABIT_FOLDER,habitScript:HABIT_SCRIPT};

// A new vault is an exclusive directory, never a merge into existing files.
// Materialise only reviewed starter assets; placeholders represent empty folders.
function createWorkspace(destination,{template=TEMPLATE}={}) {
  if(typeof destination!=='string'||!path.isAbsolute(destination))throw new Error('Choose an absolute location for the new vault.');
  const manifest=[];
  function scan(dir,relative='') {
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if(entry.name==='.gitkeep'||entry.name==='.DS_Store')continue;
      if(entry.name.startsWith('.')||entry.isSymbolicLink())throw new Error('The starter contains an unsupported hidden file or symbolic link.');
      const rel=path.join(relative,entry.name),file=path.join(dir,entry.name);
      if(entry.isDirectory()){manifest.push({relative:rel,directory:true});scan(file,rel);}
      else if(entry.isFile()&&['.md','.base','.js','.css'].includes(path.extname(file)))manifest.push({relative:rel,content:fs.readFileSync(file)});
      else throw new Error('The starter contains an unsupported file.');
    }
  }
  scan(template);
  // realpath the parent so subsequent writes use one canonical location.
  const root=path.join(fs.realpathSync(path.dirname(destination)),path.basename(destination));
  try {fs.mkdirSync(root,{mode:0o700});}
  catch(e){if(e.code==='EEXIST')throw new Error('That location already exists. Choose a new vault name; existing folders are never overwritten.');throw e;}
  try {
    for(const item of manifest) {
      const target=path.join(root,item.relative);
      if(item.directory)fs.mkdirSync(target,{mode:0o700});
      else fs.writeFileSync(target,item.content,{flag:'wx',mode:0o600});
    }
  } catch(e) {
    // Only the newly created directory belongs to this operation.
    fs.rmSync(root,{recursive:true,force:true});throw e;
  }
  return {vaultPath:root,...DEFAULTS};
}

function validateWorkspace(vault) {
  vault.validateTaskFolders();
  for(const folder of [...Object.values(KNOWLEDGE),GOALS_FOLDER,HABIT_FOLDER,'5. Archives','99. System/99.1 Templates']) {
    if(!fs.statSync(vault.resolve(folder,{note:false})).isDirectory())throw new Error(`Required folder is missing: ${folder}`);
  }
  vault.read('0. Home/Home.md');
  for(const template of ['1. Portfolio','2. Hub','3. Topic','4. Knowledge','6. Life Task','7. Business Task','9. Goal'])vault.read(`99. System/99.1 Templates/${template} Template.md`);
  definitions(vault);
}
module.exports={createWorkspace,validateWorkspace,DEFAULTS,KNOWLEDGE};
