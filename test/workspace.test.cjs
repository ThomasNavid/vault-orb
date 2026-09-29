const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createWorkspace,validateWorkspace,KNOWLEDGE}=require('../src/workspace.cjs');
const {Vault}=require('../src/vault.cjs');
const {listHabits}=require('../src/habits.cjs');
const {listGoals}=require('../src/goals.cjs');
const {Agent}=require('../src/agent.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-starter-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('new workspace is complete, empty, portable and immediately usable',async t=>{
 const dir=fixture(t),result=createWorkspace(path.join(dir,'My vault'));
 const vault=new Vault(result.vaultPath,path.join(dir,'state'));validateWorkspace(vault);
 assert.deepEqual(vault.tasks().tasks,[]);assert.deepEqual(listGoals(vault).goals,[]);assert.deepEqual(listHabits(vault).habits,[]);
 for(const folder of Object.values(KNOWLEDGE))assert.ok(fs.statSync(path.join(vault.root,folder)).isDirectory());
 const files=fs.readdirSync(vault.root,{recursive:true});
 assert.ok(!files.some(f=>/finance|\.obsidian|\.gitkeep|\.DS_Store|\.pdf$/i.test(f)));
 assert.match(vault.read('99. System/Obsidian Setup.md').content,/Folder Templates/);
 assert.match(vault.read('0. Home/Home.md').content,/Your knowledge system/);
 assert.doesNotMatch(vault.read('0. Home/Home.md').content,/finance/i);
 const agent=new Agent({vault,getKey:()=>''});
 const life=await agent.execute('create_task',{title:'A personal action',list:'life'});
 const business=await agent.execute('create_task',{title:'A work action',list:'business'});
 assert.equal(vault.tasks().tasks.length,2);
 vault.undo(business.change_id);vault.undo(life.change_id);assert.deepEqual(vault.tasks().tasks,[]);
});
test('creation refuses existing destinations and symlinks without changing their contents',t=>{
 const dir=fixture(t),existing=path.join(dir,'Existing');fs.mkdirSync(existing);fs.writeFileSync(path.join(existing,'keep.md'),'keep');
 assert.throws(()=>createWorkspace(existing),/already exists/);assert.equal(fs.readFileSync(path.join(existing,'keep.md'),'utf8'),'keep');
 const link=path.join(dir,'Link');fs.symlinkSync(existing,link);assert.throws(()=>createWorkspace(link),/already exists/);
 assert.throws(()=>createWorkspace('relative'),/absolute/);
});
test('starter rejects hidden settings and symbolic links before creating a destination',t=>{
 const dir=fixture(t),template=path.join(dir,'template');fs.mkdirSync(template);fs.writeFileSync(path.join(template,'.secret'),'private');
 assert.throws(()=>createWorkspace(path.join(dir,'new'),{template}),/hidden/);assert.ok(!fs.existsSync(path.join(dir,'new')));
 fs.unlinkSync(path.join(template,'.secret'));fs.symlinkSync('/tmp',path.join(template,'escape'));
 assert.throws(()=>createWorkspace(path.join(dir,'new'),{template}),/symbolic/);
});
test('new connections require the standard knowledge structure and reject symlinked areas',t=>{
 const dir=fixture(t),result=createWorkspace(path.join(dir,'new')),vault=new Vault(result.vaultPath,path.join(dir,'state'));
 fs.rmdirSync(path.join(vault.root,KNOWLEDGE.topic));assert.throws(()=>validateWorkspace(vault),/Not found/);
 fs.symlinkSync(dir,path.join(vault.root,KNOWLEDGE.topic));assert.throws(()=>validateWorkspace(vault),/Symbolic/);
});
test('packaging includes the starter and excludes the private reference',()=>{
 const command=require('../package.json').scripts.package,ignore=command.match(/--ignore='([^']+)'/)[1],pattern=new RegExp(ignore);
 assert.ok(pattern.test('/vault-example/README.md'));assert.ok(!pattern.test('/vault-template/README.md'));
 assert.match(fs.readFileSync(path.join(__dirname,'../.gitignore'),'utf8'),/^\/vault-example\/$/m);
});
