#import <CoreLocation/CoreLocation.h>
#include <node_api.h>

struct LocationResult { double latitude, longitude, accuracy; bool ok; };
@interface OrbLocationRequest : NSObject <CLLocationManagerDelegate>
@property(nonatomic,strong) CLLocationManager *manager;
@property(nonatomic,assign) napi_threadsafe_function callback;
@property(nonatomic,assign) BOOL finished;
- (void)finish:(LocationResult)result;
@end

static NSMutableSet<OrbLocationRequest *> *requests;
@implementation OrbLocationRequest
- (void)finish:(LocationResult)result {
  if(self.finished)return; self.finished=YES;
  [self.manager stopUpdatingLocation]; self.manager.delegate=nil;
  auto copy=new LocationResult(result);
  napi_call_threadsafe_function(self.callback,copy,napi_tsfn_nonblocking);
  napi_release_threadsafe_function(self.callback,napi_tsfn_release);
  [requests removeObject:self];
}
- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager {
  CLAuthorizationStatus status=manager.authorizationStatus;
  if(status==kCLAuthorizationStatusDenied||status==kCLAuthorizationStatusRestricted){[self finish:{0,0,0,false}];return;}
  if(status==kCLAuthorizationStatusAuthorizedAlways)[manager requestLocation];
}
- (void)locationManager:(CLLocationManager *)manager didUpdateLocations:(NSArray<CLLocation *> *)locations {
  CLLocation *location=locations.lastObject;
  if(location&&location.horizontalAccuracy>=0&&fabs(location.timestamp.timeIntervalSinceNow)<60)
    [self finish:{location.coordinate.latitude,location.coordinate.longitude,location.horizontalAccuracy,true}];
}
- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error {
  [self finish:{0,0,0,false}];
}
@end

static void deliverResult(napi_env env,napi_value callback,void *context,void *data){
  auto result=static_cast<LocationResult *>(data);auto deferred=static_cast<napi_deferred>(context);
  if(env){napi_value value;
    if(result->ok){napi_create_object(env,&value);napi_value n;
      napi_create_double(env,result->latitude,&n);napi_set_named_property(env,value,"latitude",n);
      napi_create_double(env,result->longitude,&n);napi_set_named_property(env,value,"longitude",n);
      napi_create_double(env,result->accuracy,&n);napi_set_named_property(env,value,"accuracy",n);
      napi_resolve_deferred(env,deferred,value);
    }else{napi_value message;napi_create_string_utf8(env,"Location is unavailable. Enter an address or neighbourhood.",NAPI_AUTO_LENGTH,&message);napi_create_error(env,nullptr,message,&value);napi_reject_deferred(env,deferred,value);}
  }
  delete result;
}
static napi_value locate(napi_env env,napi_callback_info info){
  napi_value promise,name;napi_deferred deferred;napi_create_promise(env,&deferred,&promise);
  napi_create_string_utf8(env,"Orb location",NAPI_AUTO_LENGTH,&name);napi_threadsafe_function callback;
  napi_create_threadsafe_function(env,nullptr,nullptr,name,0,1,nullptr,nullptr,deferred,deliverResult,&callback);
  dispatch_async(dispatch_get_main_queue(),^{
    if(!requests)requests=[NSMutableSet new];
    OrbLocationRequest *request=[OrbLocationRequest new];request.callback=callback;
    request.manager=[CLLocationManager new];request.manager.delegate=request;request.manager.desiredAccuracy=kCLLocationAccuracyHundredMeters;
    [requests addObject:request];
    if(!CLLocationManager.locationServicesEnabled){[request finish:{0,0,0,false}];return;}
    CLAuthorizationStatus status=request.manager.authorizationStatus;
    if(status==kCLAuthorizationStatusNotDetermined)[request.manager requestWhenInUseAuthorization];
    else if(status==kCLAuthorizationStatusDenied||status==kCLAuthorizationStatusRestricted)[request finish:{0,0,0,false}];
    else [request.manager requestLocation];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,12*NSEC_PER_SEC),dispatch_get_main_queue(),^{[request finish:{0,0,0,false}];});
  });
  return promise;
}
static napi_value init(napi_env env,napi_value exports){napi_value fn;napi_create_function(env,"locate",NAPI_AUTO_LENGTH,locate,nullptr,&fn);napi_set_named_property(env,exports,"locate",fn);return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
