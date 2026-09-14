// Transitional classic-script host for Step 5 tower/projectile migration.
// This is the only layer allowed to replace the legacy lexical updateTowers and
// updateProjectiles owners. Rendering/storage stay legacy-compatible for now.
(function installTowerProjectileLegacyHost(){
  if(window.__apdTowerProjectileLegacyHost)return;

  const startButton=document.getElementById('startGameBtn');
  let ready=false;
  const blockStart=e=>{
    if(ready)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{if(els?.message)els.message.textContent='Loading migrated tower/combat runtime…';}catch{}
  };
  startButton?.addEventListener('click',blockStart,true);

  function releaseStart(){
    ready=true;
    startButton?.removeEventListener('click',blockStart,true);
  }
  function message(text){try{if(els?.message)els.message.textContent=String(text);}catch{}}

  function installOwners(owners){
    if(!owners||typeof owners!=='object')throw new TypeError('Tower/projectile migration owners are required');
    for(const key of ['updateTowers','updateProjectiles']){
      if(typeof owners[key]!=='function')throw new TypeError(`${key} owner must be a function`);
    }
    const previous={updateTowers,updateProjectiles};
    function restore(){
      updateTowers=previous.updateTowers;
      updateProjectiles=previous.updateProjectiles;
    }
    try{
      updateTowers=function(dt){return owners.updateTowers(dt);};
      updateProjectiles=function(dt){return owners.updateProjectiles(dt);};
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
    cleanupDestroyed(){return cleanupDestroyed();},
    emitPlayerProjectile(projectile){
      state.bullets=Array.isArray(state.bullets)?state.bullets:[];
      state.bullets.push(projectile);
      return projectile;
    },
    emitEffect(effect){
      const channel=effect?.legacyChannel||'v22Effects';
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
    onShipDestroyed(_pad,detail){
      const lost=Math.max(0,Number(detail?.cargoLost)||0);
      if(lost>0)message(`Export ship destroyed — ${Math.round(lost)} crystal lost.`);
    },
    markReady(audit){
      releaseStart();
      window.__apdTowerProjectileMigration=audit||{id:'tower-projectile-step5',active:true,owner:'js/combat/towerCombat.js + js/combat/projectiles.js'};
    },
    markFailed(error){
      releaseStart();
      window.__apdTowerProjectileMigration={id:'tower-projectile-step5',active:false,owner:'legacy-fallback',error:String(error?.stack||error)};
      console.error('Clean tower/projectile runtime failed to install; legacy owners retained.',error);
      message('Tower/combat migration failed to load; using legacy fallback.');
    },
  };

  window.__apdTowerProjectileLegacyHost=host;
  window.__apdTowerProjectileMigration={id:'tower-projectile-step5',active:false,owner:'loading'};
})();
