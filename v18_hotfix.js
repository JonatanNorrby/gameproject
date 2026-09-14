// v18 hotfix: wall melee range must use thickness, not segment length.
const v18StructureOrUnitRadiusBase=structureOrUnitRadius;
structureOrUnitRadius=function(t){
 if(t&&t.type==='wall')return wallThickness(t)/2;
 return v18StructureOrUnitRadiusBase(t);
};

// Step 2 migration note: the old window-load/dynamic-import manual movement
// bridge has been retired. Production navigation/movement is now installed
// deterministically from index.html after the full legacy compatibility stack.
