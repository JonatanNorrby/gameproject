// Transitional classic-script host for Step 2 navigation/movement migration.
// It is the only layer allowed to assign legacy lexical owners such as
// navPointBlocked, setUnitDestination, updateUnitMovement and handleTap.
(function installNavigationMovementLegacyHost(){
  if(window.__apdNavigationMovementHost)return;

  const startButton=document.getElementById('startGameBtn');
  let ready=false;
  const blockStart=e=>{
    if(ready)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{if(els?.message)els.message.textContent='Loading migrated navigation runtime…';}catch{}
  };
  startButton?.addEventListener('click',blockStart,true);

  function releaseStart(){
    ready=true;
    startButton?.removeEventListener('click',blockStart,true);
  }

  function message(text){
    try{if(els?.message)els.message.textContent=String(text);}catch{}
  }

  function installOwners(owners){
    if(!owners||typeof owners!=='object')throw new TypeError('Navigation migration owners are required');
    for(const key of ['navPointBlocked','findPath','setUnitDestination','updateUnitMovement','manualMove']){
      if(typeof owners[key]!=='function')throw new TypeError(`${key} owner must be a function`);
    }

    const previous={navPointBlocked,findPath,setUnitDestination,updateUnitMovement,handleTap};
    try{
      navPointBlocked=function(x,y,r){return owners.navPointBlocked(x,y,r);};
      findPath=function(sx,sy,gx,gy,r){return owners.findPath(sx,sy,gx,gy,r);};
      setUnitDestination=function(unit,x,y,options={}){return owners.setUnitDestination(unit,x,y,options);};
      updateUnitMovement=function(dt){return owners.updateUnitMovement(dt);};

      const previousHandleTap=previous.handleTap;
      handleTap=function cleanMovementHandleTap(x,y){
        const selected=state?.selectedUnit;
        const clicked=typeof unitAt==='function'?unitAt(x,y):null;
        const tower=typeof towerAt==='function'?towerAt(x,y):null;
        const special=state?.attachMode
          ||state?.platoonAttachMode
          ||state?.routeEditing
          ||(typeof wallModeActive==='function'&&wallModeActive())
          ||state?.v47MedicAttachMode
          ||state?.v47ApcAttachMode;

        // Selection, build placement, route recording and special attach modes
        // remain on the existing input stack until the final input/UI migration.
        if(!selected||clicked||tower||special||selected.garrisonedIn||selected.transportedIn){
          return previousHandleTap(x,y);
        }
        if(selected.attachedTo){
          message('Detach this squad before giving it an independent move order.');
          return false;
        }

        const result=owners.manualMove(selected,x,y);
        if(!result?.handled)return previousHandleTap(x,y);
        if(result.kind==='platoon'){
          let label='Platoon';
          try{if(typeof platoonLabel==='function')label=platoonLabel(result.platoonId);}catch{}
          message(result.ok
            ?`${label} move order: ${result.ordered}/${result.total} units.`
            :'Platoon move order could not be completed.');
          try{if(typeof updateHud==='function')updateHud();}catch{}
          return result.ok;
        }
        message(result.ok?'Move order queued.':'No open route to that destination.');
        return result.ok;
      };
    }catch(error){
      navPointBlocked=previous.navPointBlocked;
      findPath=previous.findPath;
      setUnitDestination=previous.setUnitDestination;
      updateUnitMovement=previous.updateUnitMovement;
      handleTap=previous.handleTap;
      throw error;
    }

    return ()=>{
      navPointBlocked=previous.navPointBlocked;
      findPath=previous.findPath;
      setUnitDestination=previous.setUnitDestination;
      updateUnitMovement=previous.updateUnitMovement;
      handleTap=previous.handleTap;
    };
  }

  const host={
    baseX:typeof BASE_X==='number'?BASE_X:0,
    baseY:typeof BASE_Y==='number'?BASE_Y:0,
    baseRadius:typeof BASE_RADIUS==='number'?BASE_RADIUS:0,
    getState:()=>state,
    installOwners,
    markReady(audit){
      releaseStart();
      window.__apdNavigationMigration=audit||{id:'navigation-movement-step2',active:true,owner:'js/navigation + js/movement'};
    },
    markFailed(error){
      releaseStart();
      window.__apdNavigationMigration={id:'navigation-movement-step2',active:false,owner:'legacy-fallback',error:String(error?.stack||error)};
      console.error('Clean navigation/movement runtime failed to install; legacy movement ownership retained.',error);
      message('Navigation migration failed to load; using legacy movement fallback.');
    }
  };

  window.__apdNavigationMovementHost=host;
  window.__apdNavigationMigration={id:'navigation-movement-step2',active:false,owner:'loading'};
})();
