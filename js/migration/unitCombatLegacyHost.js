// Transitional classic-script host for Step 3 unit lifecycle/combat migration.
// This is the only layer allowed to replace legacy lexical owners such as
// spawnUnitAtBase, updateUnitCombat and the unit portion of cleanupDestroyed.
(function installUnitCombatLegacyHost(){
  if(window.__apdUnitCombatLegacyHost)return;

  const startButton=document.getElementById('startGameBtn');
  let ready=false;
  const blockStart=e=>{
    if(ready)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{if(els?.message)els.message.textContent='Loading migrated unit runtime…';}catch{}
  };
  startButton?.addEventListener('click',blockStart,true);

  function releaseStart(){
    ready=true;
    startButton?.removeEventListener('click',blockStart,true);
  }
  function message(text){try{if(els?.message)els.message.textContent=String(text);}catch{}}
  function refreshHud(){try{if(typeof updateHud==='function')updateHud();}catch{}}
  function unitLabel(unit,type){
    try{if(unit&&typeof unitDisplayName==='function')return unitDisplayName(unit);}catch{}
    try{if(typeof BUILD==='object'&&BUILD?.[type]?.label)return BUILD[type].label;}catch{}
    return String(type||'Unit');
  }

  function installOwners(owners){
    if(!owners||typeof owners!=='object')throw new TypeError('Unit migration owners are required');
    for(const key of ['updateUnitCombat','deployUnit','cleanupUnits','loadApc','unloadApc']){
      if(typeof owners[key]!=='function')throw new TypeError(`${key} owner must be a function`);
    }

    const loadButton=document.getElementById('apcLoadBtn');
    const unloadButton=document.getElementById('apcUnloadBtn');
    const previous={
      updateUnitCombat,
      spawnUnitAtBase:typeof spawnUnitAtBase==='function'?spawnUnitAtBase:null,
      cleanupDestroyed,
      loadClick:loadButton?.onclick||null,
      unloadClick:unloadButton?.onclick||null,
    };

    function finalizeDeployment(type,result){
      if(!result?.ok){
        const label=unitLabel(null,type);
        if(result?.reason==='max-active')message(`Only ${result.maxActive||1} ${label}${(result.maxActive||1)===1?' can':'s can'} be active at a time.`);
        else if(result?.reason==='cannot-afford')message(`Need ${Math.max(0,Number(result?.cost?.gold)||0)} gold for ${label}.`);
        else message(`Could not deploy ${label}.`);
        refreshHud();
        return false;
      }
      const unit=result.unit;
      try{buildType=null;}catch{}
      state.routeEditing=false;
      state.attachMode=false;
      state.platoonAttachMode=false;
      state.v47MedicAttachMode=false;
      state.v47ApcAttachMode=false;
      state.selectedUnit=unit;
      if('selectedTower' in state)state.selectedTower=null;
      if('selectedStorageBuilding' in state)state.selectedStorageBuilding=null;
      try{if(typeof resetWallPath==='function')resetWallPath();}catch{}
      try{if(typeof updateTowerPanel==='function')updateTowerPanel();}catch{}
      message(`${unitLabel(unit,type)} deployed from the base.`);
      refreshHud();
      try{if(typeof closeCommandMenu==='function')setTimeout(()=>closeCommandMenu(),0);}catch{}
      return true;
    }

    function deployThroughOwner(type){return finalizeDeployment(type,owners.deployUnit(type));}

    function unitPurchaseCapture(e){
      const button=e.target?.closest?.('#unitsMenu .buildBtn[data-type]');
      if(!button||button.disabled)return;
      const type=button.dataset.type;
      let isUnit=false;
      try{isUnit=typeof BUILD==='object'&&BUILD?.[type]?.kind==='unit';}catch{}
      if(!isUnit)return;
      // Document capture runs before v53's menu capture listener and the older
      // button onclick handlers, so exactly one clean deployment path executes.
      e.preventDefault();
      e.stopImmediatePropagation();
      deployThroughOwner(type);
    }

    function cleanLoadClick(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      const apc=state?.selectedUnit;
      const result=owners.loadApc(apc);
      if(result?.ok)message(`${unitLabel(result.passenger,result.passenger?.role||result.passenger?.type)} loaded into APC.`);
      else if(result?.reason==='already-loaded')message('APC is already carrying an infantry formation.');
      else message('Move an eligible infantry squad within loading range of the APC first.');
      refreshHud();
      return result?.ok||false;
    }

    function cleanUnloadClick(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      const apc=state?.selectedUnit;
      const result=owners.unloadApc(apc);
      if(result?.ok)message(`${unitLabel(result.passenger,result.passenger?.role||result.passenger?.type)} unloaded.`);
      else if(result?.reason==='no-open-unload-point')message('No safe unload point is open around the APC. Move it to clear ground first.');
      else message('APC is empty.');
      refreshHud();
      return result?.ok||false;
    }

    function restore(){
      updateUnitCombat=previous.updateUnitCombat;
      if(previous.spawnUnitAtBase)spawnUnitAtBase=previous.spawnUnitAtBase;
      cleanupDestroyed=previous.cleanupDestroyed;
      document.removeEventListener('click',unitPurchaseCapture,true);
      if(loadButton)loadButton.onclick=previous.loadClick;
      if(unloadButton)unloadButton.onclick=previous.unloadClick;
    }

    try{
      updateUnitCombat=function(dt){return owners.updateUnitCombat(dt);};
      spawnUnitAtBase=function(type){return deployThroughOwner(type);};
      cleanupDestroyed=function(){owners.cleanupUnits();return previous.cleanupDestroyed();};
      document.addEventListener('click',unitPurchaseCapture,true);
      if(loadButton)loadButton.onclick=cleanLoadClick;
      if(unloadButton)unloadButton.onclick=cleanUnloadClick;
    }catch(error){
      restore();
      throw error;
    }
    return restore;
  }

  const host={
    baseX:typeof BASE_X==='number'?BASE_X:0,
    baseY:typeof BASE_Y==='number'?BASE_Y:0,
    baseRadius:typeof BASE_RADIUS==='number'?BASE_RADIUS:0,
    getState:()=>state,
    now:()=>performance.now(),
    random:()=>Math.random(),
    installOwners,
    emitProjectile(projectile){
      state.bullets=Array.isArray(state.bullets)?state.bullets:[];
      state.bullets.push(projectile);
      return projectile;
    },
    emitEffect(effect){
      const channel=effect?.legacyChannel||'v25Effects';
      state[channel]=Array.isArray(state[channel])?state[channel]:[];
      const duration=Math.max(0,Number(effect?.durationMs)||0);
      const legacy={...effect,expires:performance.now()+duration};
      delete legacy.durationMs;delete legacy.legacyChannel;
      state[channel].push(legacy);
      return legacy;
    },
    isEnemyVisible(enemy){
      try{return typeof pointVisibleV32==='function'?pointVisibleV32(enemy.x,enemy.y):true;}catch{return true;}
    },
    isEnemyRevealed(enemy){
      if(!enemy?.cloaked)return true;
      try{return typeof saboteurDetected==='function'?saboteurDetected(enemy):false;}catch{return false;}
    },
    markReady(audit){
      releaseStart();
      window.__apdUnitCombatMigration=audit||{id:'unit-combat-step3',active:true,owner:'js/units + js/combat/unitCombat.js'};
    },
    markFailed(error){
      releaseStart();
      window.__apdUnitCombatMigration={id:'unit-combat-step3',active:false,owner:'legacy-fallback',error:String(error?.stack||error)};
      console.error('Clean unit lifecycle/combat runtime failed to install; legacy unit owners retained.',error);
      message('Unit migration failed to load; using legacy unit/combat fallback.');
    }
  };

  window.__apdUnitCombatLegacyHost=host;
  window.__apdUnitCombatMigration={id:'unit-combat-step3',active:false,owner:'loading'};
})();
