// v26 integration hotfix: Engineers should see the new vehicle roster even while
// the v25 combat pass temporarily filters v26-special units out of state.units.
const v26RepairTargetBase=repairTargetFor;
repairTargetFor=function(u){
 const units=state.v26AllUnitsForRepair||state.units;
 let best=null,ratio=1;
 const candidates=[
  ...state.structures.filter(s=>s.built),
  ...units.filter(v=>v!==u&&(v.type==='truck'||isFlyingUnit(v)||['mech','tank','mobileartillery','repairvehicle'].includes(unitRole(v))))
 ];
 for(const t of candidates){
  if(!t.maxHp||t.hp>=t.maxHp||Math.hypot(t.x-u.x,t.y-u.y)>CONFIG.ENGINEER.REPAIR_RANGE)continue;
  const r=t.hp/t.maxHp;if(r<ratio){best=t;ratio=r;}
 }
 return best||v26RepairTargetBase(u);
};

const v26CombatWithVehicles=updateUnitCombat;
updateUnitCombat=function(dt){
 state.v26AllUnitsForRepair=state.units;
 try{v26CombatWithVehicles(dt);}finally{state.v26AllUnitsForRepair=null;}
};
