// v18 hotfix: wall melee range must use thickness, not segment length.
const v18StructureOrUnitRadiusBase=structureOrUnitRadius;
structureOrUnitRadius=function(t){
 if(t&&t.type==='wall')return wallThickness(t)/2;
 return v18StructureOrUnitRadiusBase(t);
};
