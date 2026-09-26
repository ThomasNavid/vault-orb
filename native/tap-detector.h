#pragma once
#include <cmath>
struct TapDetector {
  double pressedAt=-1,lastRelease=-1;
  bool down=false,clean=false;
  void invalidate(){clean=false;lastRelease=-1;}
  bool flags(bool control,bool other,double now){
    if(other){invalidate();}
    if(control&&!down){pressedAt=now;clean=!other;down=true;return false;}
    if(!control&&down){
      down=false;
      const bool tap=clean&&!other&&now-pressedAt<=0.45;
      if(!tap){lastRelease=-1;return false;}
      const bool twice=lastRelease>=0&&now-lastRelease>=0.06&&now-lastRelease<=0.65;
      lastRelease=twice?-1:now;return twice;
    }
    return false;
  }
};
