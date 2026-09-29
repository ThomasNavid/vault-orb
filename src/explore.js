(function(root){
 'use strict';
 function connectorState(settings={},preview=false){
  const calendars=settings.googleCalendars||[];
  const calendarReady=!!(calendars.length&&settings.fullCalendarServer&&settings.hasCalendarToken);
  return {
   trading:{ready:preview||!!settings.trading212?.configured,label:preview?'Preview':settings.trading212?.configured?'Configured · '+(settings.trading212.environment==='demo'?'Demo':'Live'):'Not connected'},
   calendar:{ready:calendarReady,label:calendarReady?'Configured':calendars.length||settings.hasCalendarToken?'Finish setup':'Not connected'}
  };
 }
 function filterCommands(commands,query='',category='All'){
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter(c=>(category==='All'?words.length||c.group!=='Try asking':c.group===category)&&words.every(w=>`${c.title} ${c.subtitle} ${c.group} ${c.keywords||''}`.toLowerCase().includes(w)));
 }
 const api={connectorState,filterCommands};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.orbExplore=api;
})(typeof window==='object'?window:globalThis);
