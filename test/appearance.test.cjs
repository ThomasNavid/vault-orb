const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../src/appearance.js');
const {createEditor}=require('../src/appearance-settings.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const editor=()=>{let painted;const model=createEditor({paint:colour=>{painted=colour;}});return {model,painted:()=>painted};};

test('appearance defaults safely and validates new input without accepting CSS or malformed hex',()=>{
  for(const config of [undefined,{},null,{appearance:null},{appearance:{orbColour:'red'}},{appearance:{orbColour:123}}])assert.equal(A.readAppearance(config).orbColour,A.DEFAULT_COLOUR);
  assert.equal(A.readAppearance({appearance:{orbColour:'#AABBCC'}}).orbColour,'#aabbcc');
  for(const value of ['#abc','#12345678','#gggggg',' #123456','var(--accent)','url(example)',undefined,null,{},123])assert.throws(()=>A.validateColour(value),/RRGGBB/);
});

test('appearance updates preserve credentials and unrelated settings; omitted input preserves prior appearance',()=>{
  const config={vaultPath:'/fictional/vault',providerKeys:{openai:'encrypted-fixture'},calendarId:'fixture',autoStart:false,appearance:{orbColour:'#ec4899',futureOption:true}};
  const updated=A.withAppearance(config,{orbColour:'#8B5CF6',vaultPath:'/wrong',providerKeys:{}});
  assert.deepEqual(updated,{...config,appearance:{orbColour:'#8b5cf6',futureOption:true}});
  assert.equal(config.appearance.orbColour,'#ec4899');assert.equal(A.withAppearance(config),config);
  assert.throws(()=>A.withAppearance(config,{orbColour:'invalid'}));
});

test('default preserves the four original palettes and decorative colours exactly',()=>{
  const p=A.palette(A.DEFAULT_COLOUR),hex=v=>'#'+v.map(n=>n.toString(16).padStart(2,'0')).join('');
  assert.deepEqual(Object.values(p.states).map(state=>Object.values(state).map(hex)),[
    ['#62d0ff','#1f86ff','#0a4fe3'],['#7ce6ff','#16a0ff','#075fe8'],['#9db4ff','#4f72ff','#3a2fd8'],['#74d8ff','#2a8eff','#0b55f0']
  ]);
  assert.deepEqual([p.rim,p.shadow,p.reflection,p.glow].map(hex),['#001a66','#000a2e','#58c8ff','#2f86ff']);
});

test('custom palettes retain finite channels and light-shadow separation, including grayscale and extremes',()=>{
  const brightness=rgb=>Math.max(...rgb)+Math.min(...rgb);
  for(const colour of [...A.presets.map(p=>p[1]),'#000000','#ffffff','#888888','#ff0000','#00ff00','#0000ff']){
    const p=A.palette(colour);
    for(const state of Object.values(p.states)){
      assert.ok(brightness(state.light)>brightness(state.mid),colour);
      assert.ok(brightness(state.mid)>brightness(state.deep),colour);
      for(const rgb of Object.values(state))assert.ok(rgb.every(c=>Number.isInteger(c)&&c>=0&&c<=255),colour);
      if(['#000000','#ffffff','#888888'].includes(colour))for(const rgb of Object.values(state))assert.equal(new Set(rgb).size,1);
    }
  }
});

test('preview and reset are reversible; invalid editing preserves the last valid preview and prevents saving',async()=>{
  const {model,painted}=editor();model.initialise({orbColour:'#ec4899'});model.open({orbColour:'#ec4899'});
  model.change('#8b5cf6');assert.equal(painted(),'#8b5cf6');assert.equal(model.state().saved,'#ec4899');
  model.change('#bad');assert.equal(painted(),'#8b5cf6');assert.ok(model.state().invalid);
  await assert.rejects(model.save(()=>assert.fail('Invalid input must never be sent')),/RRGGBB/);
  model.change(A.DEFAULT_COLOUR);assert.equal(model.state().invalid,'');assert.equal(painted(),A.DEFAULT_COLOUR);
  model.close();assert.equal(painted(),'#ec4899');
});

test('both save paths commit only on success and failed saves preserve the previous baseline',async()=>{
  const {model,painted}=editor();model.open();model.change('#14b8a6');
  await assert.rejects(model.save(async()=>{throw new Error('Disk full');}),/Disk full/);
  assert.equal(model.state().saved,A.DEFAULT_COLOUR);assert.equal(painted(),'#14b8a6');assert.equal(model.state().message,'Disk full');
  await model.save(async appearance=>({appearance,otherSettings:true}));
  assert.equal(model.state().saved,'#14b8a6');model.close();assert.equal(painted(),'#14b8a6');
  model.open({orbColour:'#14b8a6'});assert.equal(model.state().draft,'#14b8a6');
});

test('pending saves prevent duplicate writes and edits; completion after leaving updates the baseline',async()=>{
  const {model,painted}=editor(),save=deferred();model.open();model.change('#f59e0b');
  const pending=model.save(()=>save.promise);assert.equal(model.state().pending,true);
  await assert.rejects(model.save(()=>assert.fail('Duplicate save')),/Wait/);
  model.change('#8b5cf6');assert.equal(model.state().draft,'#f59e0b');
  model.close();assert.equal(painted(),A.DEFAULT_COLOUR);
  save.resolve({appearance:{orbColour:'#f59e0b'}});await pending;
  assert.equal(painted(),'#f59e0b');assert.equal(model.state().editing,false);assert.equal(model.state().message,'');
});

test('stale save failure does not show errors in a newly opened editor or resurrect its discarded draft',async()=>{
  const {model,painted}=editor(),save=deferred();model.open();model.change('#f59e0b');
  const pending=model.save(()=>save.promise);model.close();model.open();
  save.reject(new Error('Disk full'));await assert.rejects(pending,/Disk full/);
  assert.equal(painted(),A.DEFAULT_COLOUR);assert.equal(model.state().message,'');assert.equal(model.state().pending,false);
});
