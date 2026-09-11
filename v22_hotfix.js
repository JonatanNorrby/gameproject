// v22 integration fixes
const v22EnemyGoldRewardBase=enemyGoldReward;
enemyGoldReward=function(e){return e.type==='flyer'?CONFIG.FLYER.GOLD_REWARD:v22EnemyGoldRewardBase(e);};

const v22UpdateEnemiesBase=updateEnemies;
updateEnemies=function(dt){
 const slowed=[];
 for(const e of state.enemies){
  if(e.type==='flyer')continue;
  if((e.slowTime||0)>0){
   e.slowTime=Math.max(0,e.slowTime-dt);
   if(e.slowTime>0){slowed.push([e,e.speed]);e.speed*=e.slowFactor||1;}
   else e.slowFactor=1;
  }
 }
 v22UpdateEnemiesBase(dt);
 for(const [e,baseSpeed] of slowed)if(state.enemies.includes(e))e.speed=baseSpeed;
};
