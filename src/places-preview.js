(() => {
 // Fictional destinations for UI development; never connected to a real vault or provider key.
 function attach(api,preview){if(!preview)return;
  let configured=true;
  const sample=[
   {name:'Chapter Coffee · example',category:'Café',location:'Soho, London',latitude:51.5142,longitude:-.1359,walkingSeconds:300,evidence:'Your note: “Quiet upstairs in the mornings.”',path:'6. Life Admin/Places/Chapter Coffee.md'},
   {name:'Little Courtyard · example',category:'Café',location:'Fitzrovia, London',latitude:51.5184,longitude:-.1382,walkingSeconds:480,evidence:'Quietness not verified'},
   {name:'Sunday Espresso · example',category:'Café',location:'Soho, London',latitude:51.5128,longitude:-.1308,walkingSeconds:660,evidence:'Quietness not verified'}
  ];
  const view=args=>({kind:'places',schema:1,id:'places-preview',title:'Coffee nearby',query:args.query||'',mode:args.action==='list'?'saved':'nearby',radius:args.radius||1500,originId:'preview-origin',origin:{latitude:51.5155,longitude:-.1325},originLabel:'Soho · fictional places for UI preview',vaultId:'preview',createdAt:new Date().toISOString(),configured,directionsApp:'apple',previewTiles:true,results:sample.filter(p=>args.action!=='list'||p.path).map((p,i)=>({...p,id:'example-'+i})),warnings:['Example places and walking times. The street map is real.'],state:'ready'});
  api.places=async args=>{
   if(args.action==='cancel')return true;
   if(args.action==='origin')return {originId:'preview-origin'};
   if(args.action==='save'){const p=sample[Number(args.id.split('-')[1])];p.path=`6. Life Admin/Places/${p.name}.md`;return {path:p.path};}
   if(['directions','note','save-location'].includes(args.action))return true;
   return view(args);
  };
  api.placesLocation=async()=>({originId:'preview-origin'});
  api.savePlaces=async input=>({places:{configured:configured=!input.disconnect,defaultArea:input.defaultArea,directionsApp:input.directionsApp}});
  const original=api.settings;api.settings=async()=>({...await original(),places:{configured,defaultArea:'Soho, London',directionsApp:'apple'}});
 }
 window.placesPreview={attach};
})();
