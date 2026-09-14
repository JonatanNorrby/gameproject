// Transitional classic-script host for Step 4 enemy/director migration.
// This layer alone is allowed to replace legacy lexical owners that ES modules
// cannot reach directly: updateDirector, updateEnemies, spawnEnemy and hitEnemy.
(function installEnemyLegacyHost(){
  if(window.__apdEnemyLegacyHost)return;

  const startButton=document.getElementById('startGameBtn');
  let ready=false;
  const blockStart=e=>{
    if(ready)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{if(els?.message)els.message.textContent='Loading migrated enemy runtime…';}catch{}
  };
  startButton?.addEventListener('click',blockStart,true);

  function releaseStart(){
    ready=true;
    startButton?.removeEventListener('click',blockStart,true);
  }
  function message(text){try{if(els?.message)els.message.textContent=String(text);}catch{}}

  function installOwners(owners){
    if(!owners||typeof owners!=='object')throw new TypeError('Enemy migration owners are required');
    for(const key of ['updateDirector','updateEnemies','spawnEnemy','hitEnemy']){
      if(typeof owners[key]!=='function')throw new TypeError(`${key} owner must be a function`);
    }
    const previous={updateDirector,updateEnemies,spawnEnemy,hitEnemy};
    function restore(){
      updateDirector=previous.updateDirector;
      updateEnemies=previous.updateEnemies;
      spawnEnemy=previous.spawnEnemy;
      hitEnemy=previous.hitEnemy;
    }
    try{
      updateDirector=function(dt){return owners.updateDirector(dt);};
      updateEnemies=function(dt){return owners.updateEnemies(dt);};
      spawnEnemy=function(type,options){return owners.spawnEnemy(type,options);};
      hitEnemy=function(enemy,amount){return owners.hitEnemy(enemy,amount);};
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
    emitEnemyProjectile(projectile){
      state.enemyBullets=Array.isArray(state.enemyBullets)?state.enemyBullets:[];
      state.enemyBullets.push(projectile);
      return projectile;
    },
    emitEffect(effect){
      const channel=effect?.legacyChannel||'v24Effects';
      state[channel]=Array.isArray(state[channel])?state[channel]:[];
      const duration=Math.max(0,Number(effect?.durationMs)||0);
      const legacy={...effect,expires:performance.now()+duration};
      delete legacy.durationMs;delete legacy.legacyChannel;
      state[channel].push(legacy);
      return legacy;
    },
    onEnemyDestroyed(enemy){
      state.particles=Array.isArray(state.particles)?state.particles:[];
      const count=enemy?.type==='brute'?9:4;
      for(let i=0;i<count;i++)state.particles.push({
        x:Number(enemy?.x)||0,
        y:Number(enemy?.y)||0,
        vx:(Math.random()-.5)*100,
        vy:(Math.random()-.5)*100,
        life:.45,
      });
    },
    onBaseDestroyed(){
      message('THE BASE HAS FALLEN — press RESTART.');
    },
    markReady(audit){
      releaseStart();
      window.__apdEnemyMigration=audit||{id:'enemy-runtime-step4',active:true,owner:'js/enemies/*'};
    },
    markFailed(error){
      releaseStart();
      window.__apdEnemyMigration={id:'enemy-runtime-step4',active:false,owner:'legacy-fallback',error:String(error?.stack||error)};
      console.error('Clean enemy runtime failed to install; legacy enemy owners retained.',error);
      message('Enemy migration failed to load; using legacy enemy fallback.');
    },
  };

  window.__apdEnemyLegacyHost=host;
  window.__apdEnemyMigration={id:'enemy-runtime-step4',active:false,owner:'loading'};
})();
