#include "tap-detector.h"
#include <cassert>
#include <iostream>
int main(){
 TapDetector d;
 assert(!d.flags(true,false,1));assert(!d.flags(false,false,1.1));assert(!d.flags(true,false,1.2));assert(d.flags(false,false,1.3));
 assert(!d.flags(true,false,2));d.invalidate();assert(!d.flags(false,false,2.1));assert(!d.flags(true,false,2.2));assert(!d.flags(false,false,2.3));
 d={};d.flags(true,false,3);d.flags(false,false,3.1);d.flags(true,false,3.8);assert(!d.flags(false,false,3.9));
 d={};d.flags(true,false,4);assert(!d.flags(false,false,4.8));d.flags(true,false,4.9);assert(!d.flags(false,false,5));
 d={};d.flags(true,true,6);assert(!d.flags(false,false,6.1));d.flags(true,false,6.2);assert(!d.flags(false,false,6.3));
 std::cout<<"Control gesture: double tap accepted; combinations, held keys and slow taps rejected.\n";
}
