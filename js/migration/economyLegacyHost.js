// Transitional classic-script host for the clean economy runtime.
// This file is intentionally tiny: it is the only place where the ES-module
// economy migration is allowed to reach legacy global lexical bindings.
(function installLegacyEconomyHost(){
  if(window.__apdLegacyEconomyHost)return;

  const startButton=document.getElementById('startGameBtn');
  let ready=false;
  const blockStart=e=>{
    if(ready)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{if(els?.message)els.message.textContent='Loading migrated economy runtime…';}catch{}
  };
  startButton?.addEventListener('click',blockStart,true);

  function releaseStart(){
    ready=true;
    startButton?.removeEventListener('click',blockStart,true);
  }

  const host={
    baseX:typeof BASE_X==='number'?BASE_X:0,
    baseY:typeof BASE_Y==='number'?BASE_Y:0,
    baseRadius:typeof BASE_RADIUS==='number'?BASE_RADIUS:0,
    getState:()=>state,
    now:()=>performance.now(),
    random:()=>Math.random(),
    setUpdateMines(fn){if(typeof fn!=='function')throw new TypeError('updateMines owner must be a function');updateMines=fn;},
    setUpdateTruckEconomy(fn){if(typeof fn!=='function')throw new TypeError('updateTruckEconomy owner must be a function');updateTruckEconomy=fn;},
    issueMove(unit,x,y,options={}){return setUnitDestination(unit,x,y,options);},
    attractEnemiesToPad(pad){return typeof attractEnemiesToPad==='function'?attractEnemiesToPad(pad):0;},
    message(text){try{if(els?.message)els.message.textContent=String(text);}catch{}},
    updateHud(){try{if(typeof updateHud==='function')updateHud();}catch{}},
    markReady(audit){
      releaseStart();
      window.__apdEconomyMigration=audit||{id:'economy-logistics-step1',active:true,owner:'js/economy/*'};
    },
    markFailed(error){
      releaseStart();
      window.__apdEconomyMigration={id:'economy-logistics-step1',active:false,owner:'legacy-fallback',error:String(error?.stack||error)};
      console.error('Clean economy runtime failed to install; legacy economy ownership retained.',error);
      try{if(els?.message)els.message.textContent='Economy migration failed to load; using legacy economy fallback.';}catch{}
    }
  };

  window.__apdLegacyEconomyHost=host;
  window.__apdEconomyMigration={id:'economy-logistics-step1',active:false,owner:'loading'};
})();
