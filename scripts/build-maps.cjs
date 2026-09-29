const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),source=path.join(root,'node_modules/maplibre-gl'),target=path.join(root,'src/vendor/maplibre');
fs.mkdirSync(target,{recursive:true});
for(const file of ['maplibre-gl.mjs','maplibre-gl-shared.mjs','maplibre-gl-worker.mjs','maplibre-gl.css'])fs.copyFileSync(path.join(source,'dist',file),path.join(target,file));
fs.copyFileSync(path.join(source,'LICENSE.txt'),path.join(target,'LICENSE.txt'));
