// v32 integration: river slowdown participates in the platoon's slowest-unit rule.
const v32RiverUnitSpeedBase=unitSpeed;
unitSpeed=function(u){
 if(u?.platoonId&&typeof platoonMembers==='function'&&typeof canUsePlatoon==='function'){
  const members=platoonMembers(u.platoonId).filter(canUsePlatoon);
  if(members.length>=2){
   return Math.min(...members.map(m=>{
    const own=typeof v28UnitSpeedV29==='function'?v28UnitSpeedV29(m):v32RiverUnitSpeedBase(m);
    return (!isFlyingUnit(m)&&pointInRiver(m.x,m.y))?own*CONFIG.RIVERS.SLOW_FACTOR:own;
   }));
  }
 }
 return v32RiverUnitSpeedBase(u);
};
