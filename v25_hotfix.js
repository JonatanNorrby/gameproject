// v25 integration hotfix: explicit roles should win over legacy base unit types.
const v25LegacyUnitRole=unitRole;
unitRole=function(u){return u?.role||v25LegacyUnitRole(u);};
updateUnitActions();
