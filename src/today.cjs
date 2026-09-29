const {localDate,dateValue}=require('./vault.cjs');
const {listGoals}=require('./goals.cjs');
const {listHabits}=require('./habits.cjs');
const {queryCalendar}=require('./calendar.cjs');
const {pluginSettings}=require('./google-calendar.cjs');

// Keep each reader independent: an unavailable calendar or malformed optional
// note must not hide tasks and habits that were read successfully.
async function todaySnapshot(vault,{date=localDate(),getCalendarAccess=()=>({}),fetchImpl}={}) {
  if(typeof date!=='string'||date.length!==10||dateValue(date)!==date)throw new Error('Today requires a local date YYYY-MM-DD.');
  const warnings=[];
  const collect=(section,result)=>{
    for(const warning of result.warnings||[])warnings.push({section,...warning});
    if(result.setup)warnings.push({section,error:result.setup});
    return result;
  };
  const read=(section,fallback,fn)=>{
    try{return collect(section,fn());}
    catch(e){const error=e.message||String(e);warnings.push({section,error});return {...fallback,error};}
  };
  const taskFallback={date,tasks:[],warnings:[]};
  const today=read('today',taskFallback,()=>vault.tasks({scope:'today',date}));
  const overdue=read('overdue',taskFallback,()=>vault.tasks({scope:'overdue',date}));
  const goals=read('goals',{date,scope:'active',goals:[],warnings:[],active_count:0},()=>listGoals(vault,{scope:'active',date}));
  const habits=read('habits',{today:date,date,year:Number(date.slice(0,4)),week_start:null,habits:[],selected:null,weeks:[],records:[],warnings:[]},()=>listHabits(vault,{date}));

  let google={};
  try{google=getCalendarAccess()||{};}
  catch(e){warnings.push({section:'calendar',error:e.message||String(e)});}
  const calendarFallback={start:date,end:date,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,items:[],total:0,truncated:false,warnings:[],calendars:[]};
  let calendar;
  try {
    calendar=collect('calendar',await queryCalendar(vault,{start:date,end:date,include_tasks:false},{google,fetchImpl}));
    let googleConfigured=false;
    try{googleConfigured=pluginSettings(vault).calendars.length>0;}
    catch(e){const warning={calendar:'Google Calendar',error:e.message||String(e)};calendar.warnings.push(warning);warnings.push({section:'calendar',...warning});}
    if(googleConfigured&&!google.token) {
      const warning={calendar:'Google Calendar',error:'Add a Full Calendar access token in Settings to read connected Google calendars.'};
      calendar.warnings.push(warning);
      if(calendar.calendars.length)warnings.push({section:'calendar',...warning});
    }
    if(!calendar.calendars.length&&(!googleConfigured||!google.token)) {
      calendar.setup=googleConfigured?'Add a Full Calendar access token in Settings to read connected Google calendars.':'Connect a calendar in Settings or Obsidian to see events.';
      warnings.push({section:'calendar',error:calendar.setup});
    }
  } catch(e) {
    const error=e.message||String(e);
    warnings.push({section:'calendar',error});
    calendar={...calendarFallback,error};
  }
  return {date,today,overdue,goals,habits,calendar,warnings};
}

module.exports={todaySnapshot};
