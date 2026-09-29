// Shared desktop lock: both Orb and the Obsidian adapter use exclusive creation.
const NAME='.orb-task-write.lock';
function acquire(fs,root){
  const file=root.replace(/[\\/]$/,'')+'/'+NAME;
  let fd;try{fd=fs.openSync(file,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new Error('Another task edit is in progress. Retry after it finishes. If both apps crashed, close both and remove .orb-task-write.lock from the vault.');throw e;}
  try{fs.writeFileSync(fd,JSON.stringify({pid:typeof process!=='undefined'?process.pid:null,at:new Date().toISOString()}));}catch(e){fs.closeSync(fd);fs.unlinkSync(file);throw e;}
  return ()=>{fs.closeSync(fd);fs.unlinkSync(file);};
}
module.exports={NAME,acquire};
