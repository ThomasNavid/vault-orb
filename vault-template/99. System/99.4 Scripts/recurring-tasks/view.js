// Dataview view. All task data and history remain in Markdown notes.
const base='99. System/99.4 Scripts/recurring-tasks';
try {
  const source=await dv.io.load(base+'/bundle.js');
  if(!source)throw new Error('Install the recurring-tasks bundle and reload this view.');
  // This is the reviewed, vault-local script dependency, like this view itself.
  const recurring=(new Function('return ('+source+');'))();
  const native=window.require;
  if(!native||!app.vault.adapter.getBasePath)throw new Error('Editing recurring tasks currently requires desktop Obsidian. You can still read their Markdown records on mobile.');
  const configText=await dv.io.load(base+'/config.md');
  const match=configText?.match(/```json\s*([\s\S]*?)```/);
  if(!match)throw new Error('Restore the task-folder configuration in '+base+'/config.md');
  const folders=JSON.parse(match[1]);
  const api=recurring.obsidian.adapter(app,{fs:native('fs'),crypto:native('crypto'),folders});
  const style=dv.container.createEl('style');style.textContent=await dv.io.load(base+'/view.css');
  const host=dv.container.createDiv();recurring.ui.mount(host,api,{compact:input?.compact===true});
} catch(e) {dv.container.createEl('p',{text:'Recurring tasks: '+e.message});}
