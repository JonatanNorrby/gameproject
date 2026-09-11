// v28 transport integration: passengers inside APCs are fully inactive.
const v28ConstructionBase=updateConstruction;
updateConstruction=function(dt){
 const all=state.units;
 state.units=all.filter(u=>!u.transportedIn);
 try{v28ConstructionBase(dt);}finally{state.units=all;}
};
