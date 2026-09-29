const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createWorkspace}=require('../src/workspace.cjs');
const {Vault,parseNote}=require('../src/vault.cjs');
const {createKnowledge,listKnowledge}=require('../src/knowledge.cjs');
const {Agent}=require('../src/agent.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orb-knowledge-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new Vault(createWorkspace(path.join(dir,'vault')).vaultPath,path.join(dir,'state'));}
test('knowledge workflow links exact records, preserves backlink queries, journals and undoes creation',async t=>{
 const vault=fixture(t),agent=new Agent({vault,getKey:()=>''});
 assert.deepEqual(listKnowledge(vault).notes,[]);
 const hub=await agent.execute('create_knowledge',{kind:'hub',title:'Computing'});
 const topic=createKnowledge(vault,{kind:'topic',title:'Architecture',hub:hub.path});
 const source=createKnowledge(vault,{kind:'knowledge',title:'Course notes',topic:topic.path,text:'Notes supplied by the user.',source:'https://example.com/course'});
 const before=vault.read(source.path).content;
 const portfolio=createKnowledge(vault,{kind:'portfolio',title:'My explanation',hub:hub.path,topic:topic.path,sources:[source.path],text:'A requested draft.'});
 assert.equal(parseNote(vault.read(topic.path).content).data.hub,'[[2. Hubs/Computing]]');
 assert.match(vault.read(portfolio.path).content,/\[\[4. Knowledge Library\/Course notes\]\]/);
 assert.match(vault.read(portfolio.path).content,/WHERE contains\(file.outlinks, this.file.link\)/);
 assert.match(vault.read(source.path).content,/Supports: \[\[1. Portfolio\/My explanation\]\]/);
 assert.equal(portfolio.changes.length,2);
 vault.undo(portfolio.changes[1].change_id);assert.equal(vault.read(source.path).content,before);
 assert.equal((await agent.execute('list_knowledge',{kind:'all'})).notes.length,4);
 assert.equal(listKnowledge(vault,{kind:'topic'}).notes[0].path,topic.path);
 vault.undo(portfolio.change_id);assert.equal(listKnowledge(vault).notes.length,3);
});
test('invalid parent links and missing hierarchy cannot create or overwrite records',t=>{
 const vault=fixture(t);
 assert.throws(()=>createKnowledge(vault,{kind:'topic',title:'Missing'}),/Hub/);
 const unfiled=createKnowledge(vault,{kind:'knowledge',title:'Unfiled'});assert.equal(listKnowledge(vault).notes.find(n=>n.path===unfiled.path).unfiled,true);vault.undo(unfiled.change_id);
 assert.throws(()=>createKnowledge(vault,{kind:'topic',title:'Bad',hub:'2. Hubs/../../README.md'}));
 assert.throws(()=>createKnowledge(vault,{kind:'constructor',title:'Bad'}),/Choose/);
 const first=createKnowledge(vault,{kind:'hub',title:'Subject'}),before=vault.read(first.path).content;
 const second=createKnowledge(vault,{kind:'hub',title:'Subject'});assert.notEqual(second.path,first.path);assert.equal(vault.read(first.path).content,before);
 assert.throws(()=>createKnowledge(vault,{kind:'portfolio',title:'Bad source',sources:[first.path]}),/knowledge/);
 assert.equal(listKnowledge(vault).total,2);
});

const {knowledgeSnapshot,knowledgeNote,knowledgeContext,updateKnowledge,connectKnowledge,dismissSuggestion}=require('../src/knowledge.cjs');
function put(v,p,body){fs.mkdirSync(path.dirname(path.join(v.root,p)),{recursive:true});fs.writeFileSync(path.join(v.root,p),body);}
test('graph resolves exact/short/relative links, aliases and headings while ignoring examples and ambiguous names',t=>{
 const v=fixture(t);
 put(v,'2. Hubs/Computing.md','---\ntags: [hub]\n---\n');
 put(v,'3. Topics/CPU.md','---\ntags: [topic]\nhub: "[[Computing|Computing Hub]]"\n---\n');
 put(v,'3. Topics/Other/CPU.md','---\ntags: [topic]\n---\n');
 put(v,'4. Knowledge Library/Lecture.md','---\ntags: [knowledge]\ntopic: "[[3. Topics/CPU#Registers|CPU]]"\n---\n[[Computing]]\n[CPU](../3.%20Topics/CPU.md#Registers)\n`[[3. Topics/Other/CPU]]`\n```dataview\n[[3. Topics/Other/CPU]]\n```\n<!-- [[3. Topics/Other/CPU]] -->\n[[CPU]]\n');
 const s=knowledgeSnapshot(v),edges=s.edges.filter(e=>e.source.endsWith('/Lecture.md'));
 assert.equal(edges.length,3);assert.ok(edges.some(e=>e.type==='hierarchy'&&e.target==='3. Topics/CPU.md'));
 assert.ok(edges.some(e=>e.type==='reference'&&e.target==='2. Hubs/Computing.md'));
 assert.equal(edges.some(e=>e.target.includes('Other')),false);
 assert.equal(s.notes.find(n=>n.title==='Lecture').unfiled,false);
 assert.equal(s.notes.length,4);
 assert.deepEqual(v.history(),[]);
 const context=knowledgeContext(v,{path:'3. Topics/CPU.md'});assert.ok(context.notes.some(n=>n.path.endsWith('/Lecture.md')));
});
test('Portfolio edits preserve unknown YAML, original prose and Dataview, check versions and undo',t=>{
 const v=fixture(t),p='1. Portfolio/Work.md';put(v,p,'---\ntags: [portfolio]\ncustom: keep # comment\n---\nOriginal prose.\n```dataview\nLIST\n```\n');
 const original=v.read(p),updated=updateKnowledge(v,{path:p,version:original.version,stage:'Developing',draft:'My explanation.',questions:'Why?',revisit:'2026-10-01'});
 let note=v.read(p);assert.match(note.content,/custom: keep # comment/);assert.match(note.content,/Original prose/);assert.match(note.content,/```dataview/);assert.equal(parseNote(note.content).data.stage,'Developing');
 assert.throws(()=>updateKnowledge(v,{path:p,version:original.version,stage:'Ready'}),/changed/);
 assert.throws(()=>updateKnowledge(v,{path:p,version:note.version,revisit:'2026-02-30'}));
 assert.throws(()=>updateKnowledge(v,{path:p,version:note.version,stage:'Finished'}));
 const second=updateKnowledge(v,{path:p,version:note.version,draft:'Revised.'});assert.equal((v.read(p).content.match(/## Working draft/g)||[]).length,1);
 v.undo(second.change_id);v.undo(updated.change_id);assert.equal(v.read(p).content,original.content);
});
test('unfiled captures, suggestion dismissal and accepted links are explicit and version checked',t=>{
 const v=fixture(t),hub=createKnowledge(v,{kind:'hub',title:'Computing'}),topic=createKnowledge(v,{kind:'topic',title:'Computer Architecture',hub:hub.path}),note=createKnowledge(v,{kind:'knowledge',title:'Computer Architecture lecture',text:'Registers and CPUs.'});
 let snap=knowledgeSnapshot(v),suggestion=snap.suggestions.find(s=>s.path===note.path&&s.target===topic.path);assert.ok(suggestion);assert.equal(suggestion.property,'topic');
 dismissSuggestion(v,{id:suggestion.id});assert.equal(knowledgeSnapshot(v).suggestions.length,0);assert.ok(knowledgeSnapshot(v).notes.find(n=>n.path===note.path).unfiled);
 assert.throws(()=>connectKnowledge(v,{...suggestion,targetVersion:'stale'}),/changed/);
 const result=connectKnowledge(v,suggestion);assert.equal(knowledgeSnapshot(v).notes.find(n=>n.path===note.path).unfiled,false);v.undo(result.change_id);
 assert.equal(knowledgeSnapshot(v).notes.find(n=>n.path===note.path).unfiled,true);
 assert.throws(()=>knowledgeNote(v,'../private.md'));assert.throws(()=>dismissSuggestion(v,{id:'../bad'}));
});
test('Portfolio partial backlink failure returns saved draft and every successful change',t=>{
 const v=fixture(t),a=createKnowledge(v,{kind:'knowledge',title:'One'}),b=createKnowledge(v,{kind:'knowledge',title:'Two'}),append=v.appendNote.bind(v);v.appendNote=args=>{if(args.path===b.path)throw new Error('Source changed');return append(args);};
 const result=createKnowledge(v,{kind:'portfolio',title:'Draft',sources:[a.path,b.path]});assert.equal(result.changes.length,2);assert.equal(result.warnings.length,1);assert.match(result.warnings[0].error,/Draft saved/);assert.ok(v.read(result.path));assert.match(v.read(a.path).content,/Supports:/);assert.doesNotMatch(v.read(b.path).content,/Supports:/);
});
test('agent exposes grounded context, graph and versioned writes to both voice and typed tools',async t=>{
 const v=fixture(t),events=[],agent=new Agent({vault:v,getKey:()=>'',onActivity:e=>events.push(e)}),hub=await agent.execute('create_knowledge',{kind:'hub',title:'Computing'});
 const context=await agent.execute('knowledge_context',{path:hub.path});assert.equal(context.notes[0].path,hub.path);
 await agent.execute('knowledge_graph',{path:hub.path});assert.ok(events.some(e=>e.kind==='knowledge-graph'&&e.path===hub.path));
 const source=await agent.execute('create_knowledge',{kind:'knowledge',title:'Evidence'}),portfolio=await agent.execute('create_knowledge',{kind:'portfolio',title:'Synthesis',sources:[source.path]});
 assert.ok(events.some(e=>e.kind==='change'&&e.change_id===portfolio.changes[1].change_id));
 await agent.execute('update_knowledge',{path:portfolio.path,version:portfolio.version,stage:'Ready'});assert.equal(parseNote(v.read(portfolio.path).content).data.stage,'Ready');
});

test('typed synthesis carries selected source citations through the model tool loop',async t=>{
 const v=fixture(t),hub=createKnowledge(v,{kind:'hub',title:'Computing'}),topic=createKnowledge(v,{kind:'topic',title:'Architecture',hub:hub.path}),source=createKnowledge(v,{kind:'knowledge',title:'Lecture',topic:topic.path,text:'Registers store operands.'});let calls=0;
 const agent=new Agent({vault:v,getKey:()=> 'test-key',fetchImpl:async(_url,options)=>{const body=JSON.parse(options.body);calls++;
  if(calls===1){assert.ok(body.tools.some(t=>t.name==='knowledge_context'));return {ok:true,json:async()=>({output:[{type:'function_call',call_id:'context',name:'knowledge_context',arguments:JSON.stringify({path:topic.path})}]})};}
  const output=body.input.find(i=>i.type==='function_call_output');assert.ok(JSON.parse(output.output).notes.some(n=>n.path===source.path&&n.body.includes('Registers')));
  return {ok:true,json:async()=>({output:[{type:'message',content:[{text:`Registers store operands. [Lecture](<${source.path}>)`}]}]})};
 }});
 const result=await agent.respond([{role:'user',content:'Explain registers from my notes.'}]);assert.ok(result.sources.includes(source.path));assert.match(result.text,/\[Lecture\]/);
});

test('graph filters preserve local depth, Hub scope, orphan and note-type semantics',()=>{
 const vm=require('node:vm'),sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/knowledge-graph.js'),'utf8'),sandbox);
 const filter=sandbox.window.KnowledgeGraph.filter,data={notes:[{path:'h',title:'Hub',kind:'hub'},{path:'t',title:'Topic',kind:'topic'},{path:'k',title:'Source',kind:'knowledge'},{path:'p',title:'Draft',kind:'portfolio'},{path:'o',title:'Orphan',kind:'knowledge'}],edges:[{source:'t',target:'h',type:'hierarchy'},{source:'k',target:'t',type:'hierarchy'},{source:'k',target:'p',type:'reference'}]};
 const paths=o=>Array.from(filter(data,o).nodes,n=>n.path).sort();assert.deepEqual(paths({focus:'h',depth:1}),['h','t']);assert.deepEqual(paths({focus:'h',depth:2}),['h','k','t']);assert.deepEqual(paths({hub:'h'}),['h','k','t']);assert.deepEqual(paths({orphans:true}),['o']);assert.deepEqual(paths({kind:'portfolio',query:'dra'}),['p']);
});

test('selected source reader preserves the explicit selection and reports bounded/truncated content',t=>{
 const {knowledgeSources}=require('../src/knowledge.cjs'),v=fixture(t),a=createKnowledge(v,{kind:'knowledge',title:'Chosen',text:'a'.repeat(15000)}),b=createKnowledge(v,{kind:'knowledge',title:'Unselected',text:'Private unrelated material.'}),hub=createKnowledge(v,{kind:'hub',title:'Map'});
 const result=knowledgeSources(v,{paths:[a.path,a.path]});assert.equal(result.notes.length,1);assert.equal(result.notes[0].path,a.path);assert.equal(result.notes[0].body.length,12000);assert.equal(result.truncated,true);assert.ok(!result.notes.some(n=>n.path===b.path));
 assert.throws(()=>knowledgeSources(v,{paths:[]}));assert.throws(()=>knowledgeSources(v,{paths:[hub.path]}),/Library/);assert.throws(()=>knowledgeSources(v,{paths:Array(31).fill(a.path)}));
});

test('knowledge writes do not reopen a stale goal or habit panel',async t=>{
 const v=fixture(t),events=[],agent=new Agent({vault:v,getKey:()=>'',onActivity:e=>events.push(e)});agent.goalView={scope:'all'};agent.habitView={};
 const result=await agent.execute('create_knowledge',{kind:'knowledge',title:'New capture'});assert.ok(result.change_id);assert.ok(events.some(e=>e.kind==='change'));assert.equal(events.some(e=>e.kind==='visual'||e.kind==='visual-error'),false);
});
