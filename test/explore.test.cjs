const {test}=require('node:test');
const assert=require('node:assert/strict');
const {connectorState,filterCommands}=require('../src/explore.js');

test('calendar browsing requires all read prerequisites, not a default write calendar',()=>{
 const configured={googleCalendars:[{id:'work'},{id:'home'}],hasCalendarToken:true,fullCalendarServer:true,calendarId:''};
 assert.equal(connectorState(configured).calendar.ready,true);
 for(const missing of [{googleCalendars:[]},{hasCalendarToken:false},{fullCalendarServer:false}])assert.equal(connectorState({...configured,...missing}).calendar.ready,false);
 assert.equal(connectorState({}).calendar.label,'Not connected');
 assert.equal(connectorState({hasCalendarToken:true}).calendar.label,'Finish setup');
});

test('Trading 212 distinguishes missing credentials, saved environments and fictional previews',()=>{
 assert.equal(connectorState({}).trading.ready,false);
 assert.deepEqual(connectorState({trading212:{configured:true,environment:'demo'}}).trading,{ready:true,label:'Configured · Demo'});
 assert.equal(connectorState({trading212:{configured:true,environment:'live'}}).trading.label,'Configured · Live');
 assert.deepEqual(connectorState({},true).trading,{ready:true,label:'Preview'});
});

const commands=[
 {title:'Today',subtitle:'Tasks and goals',group:'Planning'},
 {title:'Trading 212',subtitle:'Investments',group:'Connectors',keywords:'t212 financial portfolio'},
 {title:'Google Calendar',subtitle:'Events',group:'Connectors'},
 {title:'See my schedule',subtitle:'Calendar',group:'Try asking'}
];
test('default discovery excludes prompts while category browsing and search find them',()=>{
 assert.deepEqual(filterCommands(commands).map(c=>c.title),['Today','Trading 212','Google Calendar']);
 assert.deepEqual(filterCommands(commands,'','Try asking').map(c=>c.title),['See my schedule']);
 assert.deepEqual(filterCommands(commands,'calendar').map(c=>c.title),['Google Calendar','See my schedule']);
});
test('search supports aliases, multiple words and the active category',()=>{
 assert.deepEqual(filterCommands(commands,' T212 portfolio ').map(c=>c.title),['Trading 212']);
 assert.deepEqual(filterCommands(commands,'calendar','Connectors').map(c=>c.title),['Google Calendar']);
 assert.deepEqual(filterCommands(commands,'unmatched'),[]);
 assert.deepEqual(filterCommands(commands,'t212','Planning'),[]);
});
