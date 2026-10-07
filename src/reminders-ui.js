(()=>{
  const $=id=>document.getElementById(id);
  let settings={enabled:false},busy=false,lists=[];
  function render(value){
    settings=value||settings;
    $('reminders-status').textContent=settings.error||settings.issues?.length?'Needs attention':settings.enabled?'Connected':'Set up';
    $('reminders-status').className='integration-status '+(settings.error||settings.issues?.length?'attention':settings.enabled?'connected':'');
    $('reminders-sync').disabled=busy||!settings.enabled;$('reminders-pause').disabled=busy||!settings.enabled;
    $('reminders-connect').disabled=busy;$('reminders-enable').disabled=busy||!lists.length;
    $('reminders-message').textContent=settings.error||(settings.deferred?'Sync will run when Smith finishes.':settings.lastSync?`Last synced ${new Date(settings.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${settings.imported||0} added to Orb · ${settings.exported||0} added to Reminders · ${settings.updated||0} updated`:settings.enabled?'Syncs every 30 seconds while Orb is running.':'Connect, then choose the existing Life and Business lists.');
    const issues=$('reminders-issues');issues.replaceChildren();
    for(const issue of settings.issues||[]){const li=document.createElement('li');li.textContent=`${issue.title}: ${issue.message}`;issues.append(li);}
    issues.hidden=!issues.childElementCount;
  }
  async function call(input){
    if(!window.orb?.reminders)throw new Error('Apple Reminders connects in the Mac app. This browser is a preview.');
    return window.orb.reminders(input);
  }
  async function action(fn){busy=true;render();try{await fn();}catch(e){$('reminders-message').textContent=e.message;}finally{busy=false;for(const id of ['reminders-connect','reminders-enable','reminders-sync','reminders-pause'])$(id).disabled=id==='reminders-enable'?!lists.length:['reminders-sync','reminders-pause'].includes(id)?!settings.enabled:false;}}
  $('reminders-connect').onclick=()=>action(async()=>{
    const result=await call({action:'connect'});lists=result.lists;settings=result.settings;
    for(const key of ['life','business']){
      const select=$('reminders-'+key);select.replaceChildren(new Option('Choose a list',''));
      for(const list of lists)select.add(new Option(`${list.title} · ${list.account}`,list.id));
      const exact=lists.filter(l=>l.title.toLowerCase()===key);select.value=settings[key]||(exact.length===1?exact[0].id:'');
    }
    $('reminders-lists').hidden=false;render(settings);
  });
  $('reminders-enable').onclick=()=>action(async()=>render(await call({action:'configure',life:$('reminders-life').value,business:$('reminders-business').value})));
  $('reminders-sync').onclick=()=>action(async()=>render(await call({action:'sync'})));
  $('reminders-pause').onclick=()=>action(async()=>render(await call({action:'configure',enabled:false})));
  window.orbReminders={load:async()=>{try{render(await call({action:'status'}));}catch(e){if(window.orb)$('reminders-message').textContent=e.message;}}};
})();
