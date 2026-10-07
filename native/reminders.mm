#import <EventKit/EventKit.h>
#include <node_api.h>
#include <memory>
#include <string>

// EventKit deliberately exposes neither Reminders sections nor their membership.
// All store access stays on the main queue. Only the explicit connect action asks
// macOS for access; background sync never opens a permission prompt.
static EKEventStore *store;
struct Request { napi_threadsafe_function callback; bool finished=false; };
struct Result { std::string json; std::string error; };
static NSString *json(id object) {
  NSData *data=[NSJSONSerialization dataWithJSONObject:object options:NSJSONWritingSortedKeys error:nil];
  return data?[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]:@"{}";
}
static void finish(std::shared_ptr<Request> request,id value,NSString *error=nil) {
  if(request->finished)return;request->finished=true;
  auto result=new Result{value?std::string(json(value).UTF8String):"",error?std::string(error.UTF8String):""};
  napi_call_threadsafe_function(request->callback,result,napi_tsfn_nonblocking);
  napi_release_threadsafe_function(request->callback,napi_tsfn_release);
}
static NSString *dateText(NSDateComponents *c) {
  if(!c)return nil;
  NSString *day=[NSString stringWithFormat:@"%04ld-%02ld-%02ld",(long)c.year,(long)c.month,(long)c.day];
  if(c.hour==NSDateComponentUndefined)return day;
  // Convert zoned reminders to the Mac's local wall time, matching vault dates.
  NSCalendar *calendar=[[NSCalendar alloc] initWithCalendarIdentifier:NSCalendarIdentifierGregorian];
  calendar.timeZone=c.timeZone?:NSTimeZone.localTimeZone;
  NSDate *date=[calendar dateFromComponents:c];
  NSDateFormatter *formatter=[NSDateFormatter new];formatter.locale=[[NSLocale alloc] initWithLocaleIdentifier:@"en_US_POSIX"];
  formatter.calendar=calendar;formatter.timeZone=NSTimeZone.localTimeZone;formatter.dateFormat=@"yyyy-MM-dd'T'HH:mm:ss";
  return date?[formatter stringFromDate:date]:nil;
}
static NSDateComponents *components(id value) {
  if(![value isKindOfClass:NSString.class]||![value length])return nil;
  NSArray *parts=[[value stringByReplacingOccurrencesOfString:@"T" withString:@"-"] componentsSeparatedByCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"-:"]];
  if(parts.count!=3&&parts.count!=6)return nil;
  NSDateComponents *c=[NSDateComponents new];c.calendar=[[NSCalendar alloc] initWithCalendarIdentifier:NSCalendarIdentifierGregorian];
  c.year=[parts[0] integerValue];c.month=[parts[1] integerValue];c.day=[parts[2] integerValue];
  if(parts.count==6){c.hour=[parts[3] integerValue];c.minute=[parts[4] integerValue];c.second=[parts[5] integerValue];c.timeZone=NSTimeZone.localTimeZone;}
  return c;
}
static NSDictionary *record(EKReminder *r) {
  NSMutableDictionary *data=[@{@"id":r.calendarItemIdentifier,@"listId":r.calendar.calendarIdentifier,@"title":r.title?:@"",@"notes":r.notes?:@"",@"due":dateText(r.dueDateComponents)?:NSNull.null,@"completed":@(r.completed),@"recurring":@(r.hasRecurrenceRules),@"modified":@(r.lastModifiedDate.timeIntervalSince1970)} mutableCopy];
  data[@"version"]=json(data);return data;
}
static void run(std::shared_ptr<Request> request,NSDictionary *input) {
  @try {
    if(!store)store=[EKEventStore new];
    NSString *operation=input[@"operation"];
    if([operation isEqual:@"connect"]){
      if(![NSBundle.mainBundle objectForInfoDictionaryKey:@"NSRemindersFullAccessUsageDescription"]){finish(request,nil,@"Use the packaged Vault Orb app to connect Reminders; this development host has no Reminders permission description.");return;}
      if(@available(macOS 14.0,*)){
        [store requestFullAccessToRemindersWithCompletion:^(BOOL granted,NSError *error){dispatch_async(dispatch_get_main_queue(),^{finish(request,@{@"granted":@(granted)},granted?nil:@"Allow Vault Orb in System Settings → Privacy & Security → Reminders.");});}];
      }else{finish(request,nil,@"Apple Reminders sync requires macOS 14 or later.");}
      return;
    }
    if([EKEventStore authorizationStatusForEntityType:EKEntityTypeReminder]!=EKAuthorizationStatusFullAccess){finish(request,nil,@"Reminders access is unavailable. Connect in Settings, or allow Vault Orb in System Settings → Privacy & Security → Reminders.");return;}
    [store refreshSourcesIfNecessary];
    if([operation isEqual:@"lists"]){
      NSMutableArray *lists=[NSMutableArray new];
      for(EKCalendar *c in [store calendarsForEntityType:EKEntityTypeReminder])if(c.allowsContentModifications)[lists addObject:@{@"id":c.calendarIdentifier,@"title":c.title?:@"",@"account":c.source.title?:@""}];
      finish(request,lists);return;
    }
    if([operation isEqual:@"read"]){
      NSArray *ids=input[@"listIds"];if(![ids isKindOfClass:NSArray.class]||ids.count!=2){finish(request,nil,@"Choose two reminder lists.");return;}
      NSMutableArray *calendars=[NSMutableArray new];
      for(NSString *identifier in ids){EKCalendar *c=[store calendarWithIdentifier:identifier];if(!c||!c.allowsContentModifications||!(c.allowedEntityTypes&EKEntityMaskReminder)){finish(request,nil,@"A connected Reminders list is missing or read-only. Reconnect in Settings.");return;}[calendars addObject:c];}
      id fetch=[store fetchRemindersMatchingPredicate:[store predicateForRemindersInCalendars:calendars] completion:^(NSArray<EKReminder *> *reminders){dispatch_async(dispatch_get_main_queue(),^{
        if(!reminders){finish(request,nil,@"Reminders could not be read. Nothing was inferred as deleted.");return;}
        NSMutableArray *rows=[NSMutableArray new];for(EKReminder *r in reminders)[rows addObject:record(r)];finish(request,rows);
      });}];
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW,20*NSEC_PER_SEC),dispatch_get_main_queue(),^{if(!request->finished){[store cancelFetchRequest:fetch];finish(request,nil,@"Reminders took too long to respond. Try Sync now again.");}});
      return;
    }
    if([operation isEqual:@"save"]){
      NSString *identifier=input[@"id"],*listId=input[@"listId"];
      EKCalendar *calendar=[store calendarWithIdentifier:listId];
      if(!calendar||!calendar.allowsContentModifications||!(calendar.allowedEntityTypes&EKEntityMaskReminder)){finish(request,nil,@"The selected Reminders list is unavailable.");return;}
      EKReminder *r;
      if([identifier isKindOfClass:NSString.class]&&identifier.length){
        EKCalendarItem *item=[store calendarItemWithIdentifier:identifier];
        if(![item isKindOfClass:EKReminder.class]||![item.calendar.calendarIdentifier isEqual:listId]){finish(request,nil,@"Reminder was removed or moved. Sync again before editing.");return;}
        r=(EKReminder *)item;
        if(![r refresh]){finish(request,nil,@"Reminder is no longer available. Sync again before editing.");return;}
        if(![record(r)[@"version"] isEqual:input[@"expected"]]){finish(request,nil,@"Reminder changed during sync. Try Sync now again.");return;}
        if(r.hasRecurrenceRules){finish(request,nil,@"Repeating reminders are not synced yet.");return;}
      }else{r=[EKReminder reminderWithEventStore:store];r.calendar=calendar;}
      NSDictionary *fields=input[@"fields"];
      if(fields[@"title"])r.title=fields[@"title"];
      if(fields[@"notes"])r.notes=fields[@"notes"];
      if(fields[@"due"]){r.dueDateComponents=components(fields[@"due"]);}
      if(fields[@"completed"])r.completed=[fields[@"completed"] boolValue];
      // Preserve existing alarms. New timed reminders get an alarm at their due time.
      if(![identifier isKindOfClass:NSString.class]&&r.dueDateComponents.hour!=NSDateComponentUndefined&&r.dueDateComponents){[r addAlarm:[EKAlarm alarmWithRelativeOffset:0]];}
      NSError *error=nil;
      if(![store saveReminder:r commit:YES error:&error]){finish(request,nil,error.localizedDescription?:@"Reminder could not be saved.");return;}
      finish(request,record(r));return;
    }
    finish(request,nil,@"Unknown Reminders operation.");
  }@catch(NSException *exception){finish(request,nil,exception.reason?:@"Reminders failed.");}
}
static void deliver(napi_env env,napi_value callback,void *context,void *data){
  auto result=static_cast<Result *>(data);auto deferred=static_cast<napi_deferred>(context);
  if(env){napi_value value;napi_create_string_utf8(env,result->error.empty()?result->json.c_str():result->error.c_str(),NAPI_AUTO_LENGTH,&value);
    if(result->error.empty())napi_resolve_deferred(env,deferred,value);else{napi_value error;napi_create_error(env,nullptr,value,&error);napi_reject_deferred(env,deferred,error);}}
  delete result;
}
static napi_value request(napi_env env,napi_callback_info info){
  size_t argc=1;napi_value args[1];napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);size_t length=0;
  if(argc!=1||napi_get_value_string_utf8(env,args[0],nullptr,0,&length)!=napi_ok||length>1024*1024){napi_throw_type_error(env,nullptr,"Expected bounded JSON input.");return nullptr;}
  std::string text(length+1,'\0');napi_get_value_string_utf8(env,args[0],text.data(),text.size(),&length);
  NSData *data=[NSData dataWithBytes:text.data() length:length];id input=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if(![input isKindOfClass:NSDictionary.class]){napi_throw_type_error(env,nullptr,"Expected a JSON object.");return nullptr;}
  napi_value promise,name;napi_deferred deferred;napi_create_promise(env,&deferred,&promise);
  napi_create_string_utf8(env,"Orb Reminders",NAPI_AUTO_LENGTH,&name);auto req=std::make_shared<Request>();
  napi_create_threadsafe_function(env,nullptr,nullptr,name,0,1,nullptr,nullptr,deferred,deliver,&req->callback);
  dispatch_async(dispatch_get_main_queue(),^{run(req,input);});return promise;
}
static napi_value init(napi_env env,napi_value exports){napi_value fn;napi_create_function(env,"request",NAPI_AUTO_LENGTH,request,nullptr,&fn);napi_set_named_property(env,exports,"request",fn);return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
