// Settings section tabs: jump to a section and highlight the one being read.
(()=>{
  let reveal=target=>target.scrollIntoView({block:'start'});
  window.orbSettingsLayout={reveal:target=>reveal(target)};
  function init(){
    const view=document.getElementById('settings-view'),nav=view?.querySelector('.settings-nav');
    if(!nav)return;
    const buttons=[...nav.querySelectorAll('[data-section]')],sections=buttons.map(b=>document.getElementById(b.dataset.section));
    const mark=id=>buttons.forEach(b=>b.setAttribute('aria-current',String(b.dataset.section===id)));
    // Scroll only this pane; scrollIntoView would also shift the panel's clipped ancestors.
    reveal=(target,behavior='auto')=>view.scrollTo({top:view.scrollTop+target.getBoundingClientRect().top-view.getBoundingClientRect().top-nav.offsetHeight+8,behavior});
    buttons.forEach((b,i)=>b.onclick=()=>{mark(b.dataset.section);reveal(sections[i],'smooth');});
    let frame=0;
    view.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const top=view.getBoundingClientRect().top+nav.offsetHeight+24;
      const atEnd=view.scrollTop+view.clientHeight>=view.scrollHeight-4;
      const current=atEnd?sections.at(-1):sections.filter(s=>s.getBoundingClientRect().top<=top).at(-1)||sections[0];
      mark(current.id);
    });},{passive:true});
    mark(sections[0].id);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
