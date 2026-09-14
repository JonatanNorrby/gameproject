// Transitional classic-script host for Step 6 buildings/placement migration.
// Input and rendering remain legacy-owned: their mutable building/Wall call seams
// are redirected to clean modules, while the old pointer and preview code stays.
(function installBuildingPlacementLegacyHost(){
  if(window.__apdBuildingPlacementLegacyHost)return;

  const startButton=document.getElementById('startGameBtn');
  let ready=false;
  const blockStart=e=>{
    if(ready)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{if(els?.message)els.message.textContent='Loading migrated building runtime…';}catch{}
  };
  startButton?.addEventListener('click',blockStart,true);

  function releaseStart(){ready=true;startButton?.removeEventListener('click',blockStart,true);}
  function message(text){try{if(els?.message)els.message.textContent=String(text);}catch{}}
  function refreshHud(){try{if(typeof updateHud==='function')updateHud();}catch{}}
  function refreshTowerPanel(){try{if(typeof updateTowerPanel==='function')updateTowerPanel();}catch{}}
  function buildLabel(type){try{return BUILD?.[type]?.label||String(type||'Building');}catch{return String(type||'Building');}}
  function currentBuildType(){try{return buildType;}catch{return null;}}
  function currentBuildDefinition(type){try{return BUILD?.[type]||null;}catch{return null;}}
  function wallModal(show){const el=document.getElementById('wallConfirm');if(el)el.classList.toggle('hidden',!show);}
  function setWallReviewLabels(result){
    const length=document.getElementById('wallLength'),cost=document.getElementById('wallCost'),time=document.getElementById('wallBuildTime');
    if(length)length.textContent=`${Math.round(Number(result?.total)||0)} px`;
    if(cost)cost.textContent=Math.max(0,Number(result?.cost)||0);
    if(time)time.textContent=Math.max(0,Number(result?.buildTime)||0).toFixed(1);
  }
  function placementFailure(type,result){
    const reason=result?.reason;
    if(reason==='no-workers')return `All ${Number(CONFIG?.WORKERS?.COUNT)||3} workers are busy.`;
    if(reason==='cannot-afford'){
      const cost=result?.cost||currentBuildDefinition(type)?.cost||0;
      const metal=Number(cost?.metal),gold=Number(cost?.gold);
      if(Number.isFinite(metal)&&metal>0)return `Need ${metal} metal for ${buildLabel(type)}.`;
      if(Number.isFinite(gold)&&gold>0)return `Need ${gold} gold for ${buildLabel(type)}.`;
      const def=currentBuildDefinition(type),currency=def?.currency==='metal'?'metal':'gold';
      return `Need ${Number(def?.cost)||0} ${currency} for ${buildLabel(type)}.`;
    }
    if(reason==='no-matching-depot')return type==='oremine'?'No open Ore Depot is under the cursor.':'No open Crystal Depot is under the cursor.';
    if(reason==='building-disabled'||reason==='disabled-or-unknown')return type==='bunker'?'Bunkers have been removed.':'That structure is disabled.';
    if(reason==='blocked')return 'That building location is blocked.';
    return `${buildLabel(type)} could not be placed.`;
  }

  function syncWallPreview(draft,{stopPainting=false}={}){
    const path=Array.isArray(draft?.path)?draft.path.map(point=>({x:Number(point.x),y:Number(point.y)})):[];
    try{wallPath=path;}catch{}
    try{wallLastWorld=draft?.cursor?{x:Number(draft.cursor.x),y:Number(draft.cursor.y)}:(path.at(-1)||null);}catch{}
    if(stopPainting){try{wallPainting=false;}catch{}}
    try{if(typeof updateWallModeButtons==='function')updateWallModeButtons();}catch{}
  }

  function installOwners(owners){
    if(!owners||typeof owners!=='object')throw new TypeError('Building placement migration owners are required');
    for(const key of ['placeStructure','updateConstruction','activeConstructionCount','freeWorkers','appendWallPoint','normalizeWallPath','validateWallPath','wallPathLength','reviewWall','confirmWall','cancelWall','upgradeStorage','cleanupDestroyed']){
      if(typeof owners[key]!=='function')throw new TypeError(`${key} owner must be a function`);
    }

    const wallCancelMode=document.getElementById('wallCancelModeBtn');
    const wallConfirmPath=document.getElementById('wallConfirmPathBtn');
    const wallAcceptButton=document.getElementById('wallAccept');
    const wallCancelButton=document.getElementById('wallCancel');
    const storageUpgrade=document.getElementById('storageUpgradeBtn');
    const previous={
      placeBuild,
      updateConstruction,
      activeConstructionCount,
      freeWorkers,
      cleanupDestroyed,
      appendWallPoint:typeof appendWallPoint==='function'?appendWallPoint:null,
      resetWallPath:typeof resetWallPath==='function'?resetWallPath:null,
      normalizeWallPath:typeof normalizeWallPath==='function'?normalizeWallPath:null,
      validateWallPath:typeof validateWallPath==='function'?validateWallPath:null,
      wallPathLength:typeof wallPathLength==='function'?wallPathLength:null,
      wallCancelModeClick:wallCancelMode?.onclick||null,
      wallConfirmPathClick:wallConfirmPath?.onclick||null,
      wallAcceptClick:wallAcceptButton?.onclick||null,
      wallCancelClick:wallCancelButton?.onclick||null,
      storageUpgradeClick:storageUpgrade?.onclick||null,
    };

    function cleanPlaceBuild(x,y){
      const type=currentBuildType(),definition=currentBuildDefinition(type);
      // Step 3 owns movable-unit deployment. Keep its legacy fallback untouched if
      // an old input path somehow reaches placeBuild with a unit type.
      if(!definition||definition.kind!=='structure')return previous.placeBuild(x,y);
      if(type==='wall'){message('Wall path: click bends or drag to paint. Review when ready.');return false;}
      const result=owners.placeStructure(type,x,y);
      if(result?.ok){
        const slot=Number.isFinite(Number(result?.structure?.mineSlot))?` ${Number(result.structure.mineSlot)+1}/3`:'';
        message(`${buildLabel(type)}${slot} construction started.`);
        refreshHud();
        return true;
      }
      message(placementFailure(type,result));refreshHud();return false;
    }

    function cleanResetWallPath(text){
      owners.cancelWall();wallModal(false);if(text)message(text);refreshHud();return true;
    }
    function cleanReviewWall(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      const result=owners.reviewWall();
      if(!result?.ok){message(result?.msg||'Wall path is not valid.');return false;}
      setWallReviewLabels(result);wallModal(true);return true;
    }
    function cleanConfirmWall(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      const result=owners.confirmWall();
      if(!result?.ok){message(result?.msg||'Wall path could not be built.');if(result?.reason==='cannot-afford'||result?.reason==='no-workers')wallModal(false);refreshHud();return false;}
      wallModal(false);message(`Wall path queued for ${result.cost} metal.`);refreshHud();return true;
    }
    function cleanCancelWallReview(e){
      e?.preventDefault?.();e?.stopPropagation?.();wallModal(false);message('Wall build not confirmed — path is still editable.');return true;
    }
    function cleanStorageUpgrade(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      const structure=state?.selectedStorageBuilding||null,result=owners.upgradeStorage(structure);
      if(result?.ok)message(`${structure?.type==='landingpad'?'Landing Pad':'Refinery'} storage upgraded to ${result.level}/3 · capacity ${result.capacity}.`);
      else if(result?.reason==='cannot-afford'){const gold=Number(result?.cost?.gold)||0;message(`Need ${gold} gold for the storage upgrade.`);}
      else if(result?.reason==='max-level')message('Storage is already at 3/3.');
      refreshHud();return Boolean(result?.ok);
    }

    function restore(){
      placeBuild=previous.placeBuild;
      updateConstruction=previous.updateConstruction;
      activeConstructionCount=previous.activeConstructionCount;
      freeWorkers=previous.freeWorkers;
      cleanupDestroyed=previous.cleanupDestroyed;
      if(previous.appendWallPoint)appendWallPoint=previous.appendWallPoint;
      if(previous.resetWallPath)resetWallPath=previous.resetWallPath;
      if(previous.normalizeWallPath)normalizeWallPath=previous.normalizeWallPath;
      if(previous.validateWallPath)validateWallPath=previous.validateWallPath;
      if(previous.wallPathLength)wallPathLength=previous.wallPathLength;
      if(wallCancelMode)wallCancelMode.onclick=previous.wallCancelModeClick;
      if(wallConfirmPath)wallConfirmPath.onclick=previous.wallConfirmPathClick;
      if(wallAcceptButton)wallAcceptButton.onclick=previous.wallAcceptClick;
      if(wallCancelButton)wallCancelButton.onclick=previous.wallCancelClick;
      if(storageUpgrade)storageUpgrade.onclick=previous.storageUpgradeClick;
    }

    try{
      placeBuild=cleanPlaceBuild;
      updateConstruction=function(dt){return owners.updateConstruction(dt);};
      activeConstructionCount=function(){return owners.activeConstructionCount();};
      freeWorkers=function(){return owners.freeWorkers();};
      cleanupDestroyed=function(){return owners.cleanupDestroyed();};
      appendWallPoint=function(point,force=false){return owners.appendWallPoint(point,{force:Boolean(force)});};
      resetWallPath=cleanResetWallPath;
      normalizeWallPath=function(points){return owners.normalizeWallPath(points);};
      validateWallPath=function(points){return owners.validateWallPath(points);};
      wallPathLength=function(points){return owners.wallPathLength(points);};
      if(wallCancelMode)wallCancelMode.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();return cleanResetWallPath('Wall placement cancelled.');};
      if(wallConfirmPath)wallConfirmPath.onclick=cleanReviewWall;
      if(wallAcceptButton)wallAcceptButton.onclick=cleanConfirmWall;
      if(wallCancelButton)wallCancelButton.onclick=cleanCancelWallReview;
      if(storageUpgrade)storageUpgrade.onclick=cleanStorageUpgrade;
      // v18's preview renderer reads these legacy lexical arrays. Keep them as a
      // read-only compatibility mirror driven by the clean Wall state.
      syncWallPreview(owners.getWallState?.()||{path:[]},{stopPainting:true});
    }catch(error){restore();throw error;}
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
    syncWallPreview,
    onConstructionComplete(structure){
      message(structure?.type==='wall'?'Wall construction complete.':`${buildLabel(structure?.type)} construction complete.`);
      refreshHud();
    },
    onStructureDestroyed(structure){
      if(state?.selectedTower===structure)state.selectedTower=null;
      if(state?.selectedStorageBuilding===structure)state.selectedStorageBuilding=null;
      const upgrade=document.getElementById('storageUpgradeBtn'),close=document.getElementById('storageCloseBtn');
      if(!state?.selectedStorageBuilding){if(upgrade)upgrade.style.display='none';if(close)close.style.display='none';}
      refreshTowerPanel();refreshHud();
    },
    markReady(audit){
      releaseStart();
      window.__apdBuildingPlacementMigration=audit||{id:'buildings-placement-step6',active:true,owner:'js/buildings/*'};
    },
    markFailed(error){
      releaseStart();
      window.__apdBuildingPlacementMigration={id:'buildings-placement-step6',active:false,owner:'legacy-fallback',error:String(error?.stack||error)};
      console.error('Clean building/placement runtime failed to install; legacy owners retained.',error);
      message('Building migration failed to load; using legacy placement fallback.');
    },
  };

  window.__apdBuildingPlacementLegacyHost=host;
  window.__apdBuildingPlacementMigration={id:'buildings-placement-step6',active:false,owner:'loading'};
})();
