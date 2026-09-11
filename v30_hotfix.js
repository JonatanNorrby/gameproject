// v30 integration cleanup

// Never allow an old unit build mode to fall back to arbitrary battlefield spawning.
const v30PlaceBuildGuardBase=placeBuild;
placeBuild=function(x,y){
 const type=buildType,def=type?BUILD[type]:null;
 if(def?.kind==='unit'){buildType=null;const ok=spawnUnitAtBase(type);updateHud();return ok;}
 return v30PlaceBuildGuardBase(x,y);
};
for(const b of document.querySelectorAll('.buildBtn')){
 const type=b.dataset.type;if(!BUILD[type]||BUILD[type].kind!=='unit')continue;
 b.addEventListener('click',()=>setTimeout(()=>{if(buildType===type)buildType=null;updateHud();},1));
}

// Cover obsolete fixed-capacity text from older renderer layers before drawing the
// current per-building 1/3 storage value.
const v30DrawStructureCapacityBase=drawStructure;
drawStructure=function(s){
 v30DrawStructureCapacityBase(s);if(!s.built||(s.type!=='refinery'&&s.type!=='landingpad'))return;
 initStorageBuilding(s);ctx.save();ctx.translate(s.x,s.y);const cap=storageCap(s),stored=s.type==='refinery'?s.oreStored:s.crystalStored;
 if(s.type==='refinery'){
  ctx.fillStyle='rgba(5,14,20,.96)';ctx.fillRect(-52,27,104,31);ctx.fillStyle='#e6f6fc';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(`ORE STORAGE ${storageLevel(s)}/3`,0,39);ctx.fillText(`${Math.floor(stored)}/${cap}`,0,51);
 }else{
  const y=CONFIG.LANDING_PAD.RADIUS+29;ctx.fillStyle='rgba(5,14,20,.96)';ctx.fillRect(-55,y,110,30);ctx.fillStyle='#e6f6fc';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(`PAD STORAGE ${storageLevel(s)}/3`,0,y+11);ctx.fillText(`${Math.floor(stored)}/${cap} CRYSTAL`,0,y+23);
 }
 ctx.restore();
};
