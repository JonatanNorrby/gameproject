// v18 hotfix: wall melee range must use thickness, not segment length.
const v18StructureOrUnitRadiusBase=structureOrUnitRadius;
structureOrUnitRadius=function(t){
 if(t&&t.type==='wall')return wallThickness(t)/2;
 return v18StructureOrUnitRadiusBase(t);
};

// Prompt 5 migration loader. The bridge installs only after the full legacy
// handleTap stack exists, and delegates every non-movement interaction unchanged.
window.addEventListener('load',()=>{
 if(document.querySelector('script[data-prompt5-manual-move-bridge]'))return;
 const script=document.createElement('script');
 script.src='js/migration/manualMoveLegacyBridge.js?v=1';
 script.dataset.prompt5ManualMoveBridge='true';
 document.head.appendChild(script);
},{once:true});
