#include <node_api.h>
#include <ApplicationServices/ApplicationServices.h>
#include <atomic>
#include <thread>
#include <chrono>
#include "tap-detector.h"

// Public modifier-state queries require no event-tap or keyboard-content access.
// Event counters tell us that another key was used, never which key it was.
static std::atomic<bool> running{false};
static std::atomic<unsigned int> presses{0},toggles{0};
static std::thread worker;
static napi_threadsafe_function callback=nullptr;
static void deliver(napi_env env,napi_value fn,void*,void*){if(!env||!fn)return;napi_value receiver,result;napi_get_undefined(env,&receiver);napi_call_function(env,receiver,fn,0,nullptr,&result);}
static void cleanup(void*){
 running.store(false);
 if(worker.joinable())worker.join();
 if(callback){napi_release_threadsafe_function(callback,napi_tsfn_abort);callback=nullptr;}
}
static napi_value boolean(napi_env env,bool v){napi_value r;napi_get_boolean(env,v,&r);return r;}
static void poll(){
 using clock=std::chrono::steady_clock;
 const auto state=kCGEventSourceStateCombinedSessionState;
 auto keys=CGEventSourceCounterForEventType(state,kCGEventKeyDown);
 auto clicks=CGEventSourceCounterForEventType(state,kCGEventLeftMouseDown)+CGEventSourceCounterForEventType(state,kCGEventRightMouseDown);
 auto previous=clock::now();TapDetector detector;
 while(running.load()){
  const auto now=clock::now();const double seconds=std::chrono::duration<double>(now.time_since_epoch()).count();
  if(now-previous>std::chrono::milliseconds(250))detector=TapDetector{};
  previous=now;
  const auto flags=CGEventSourceFlagsState(state);
  const auto newKeys=CGEventSourceCounterForEventType(state,kCGEventKeyDown);
  const auto newClicks=CGEventSourceCounterForEventType(state,kCGEventLeftMouseDown)+CGEventSourceCounterForEventType(state,kCGEventRightMouseDown);
  const bool control=flags&kCGEventFlagMaskControl;
  const bool other=flags&(kCGEventFlagMaskShift|kCGEventFlagMaskAlternate|kCGEventFlagMaskCommand);
  if(control&&!detector.down)presses.fetch_add(1);
  // Process flag transitions first, then invalidate on simultaneous unrelated input.
  const bool fire=detector.flags(control,other,seconds);
  const bool interrupted=newKeys!=keys||newClicks!=clicks;
  if(interrupted)detector.invalidate();
  if(fire&&!interrupted){toggles.fetch_add(1);napi_call_threadsafe_function(callback,nullptr,napi_tsfn_nonblocking);}
  keys=newKeys;clicks=newClicks;
  std::this_thread::sleep_for(std::chrono::milliseconds(8));
 }
}
static napi_value start(napi_env env,napi_callback_info info){
 if(running.load())return boolean(env,true);
 size_t count=1;napi_value fn;napi_get_cb_info(env,info,&count,&fn,nullptr,nullptr);
 napi_valuetype type;if(count!=1){napi_throw_type_error(env,nullptr,"Expected callback");return nullptr;}napi_typeof(env,fn,&type);
 if(type!=napi_function){napi_throw_type_error(env,nullptr,"Expected callback");return nullptr;}
 napi_value name;napi_create_string_utf8(env,"Control modifier gesture",NAPI_AUTO_LENGTH,&name);
 if(napi_create_threadsafe_function(env,fn,nullptr,name,4,1,nullptr,nullptr,nullptr,deliver,&callback)!=napi_ok)return boolean(env,false);
 napi_unref_threadsafe_function(env,callback);
 running.store(true);
 try{worker=std::thread(poll);}catch(...){cleanup(nullptr);return boolean(env,false);}
 return boolean(env,true);
}
static napi_value status(napi_env env,napi_callback_info){
 napi_value out,pressCount,toggleCount;napi_create_object(env,&out);napi_set_named_property(env,out,"active",boolean(env,running.load()));
 napi_create_uint32(env,presses.load(),&pressCount);napi_set_named_property(env,out,"controlPresses",pressCount);
 napi_create_uint32(env,toggles.load(),&toggleCount);napi_set_named_property(env,out,"gestures",toggleCount);return out;
}
static napi_value init(napi_env env,napi_value exports){
 napi_property_descriptor props[]={{"start",nullptr,start,nullptr,nullptr,nullptr,napi_default,nullptr},{"status",nullptr,status,nullptr,nullptr,nullptr,napi_default,nullptr}};
 napi_define_properties(env,exports,2,props);napi_add_env_cleanup_hook(env,cleanup,nullptr);return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
