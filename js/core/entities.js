const define = (label, radius, flags = {}) => Object.freeze({
  label,
  radius,
  flying: false,
  infantry: false,
  mechanical: false,
  support: false,
  repairable: false,
  ...flags,
});

// Stable role IDs come from the active v47/v53 runtime. Runtime `type` is not
// authoritative in the clean architecture; role is.
export const UNIT_DEFINITIONS = Object.freeze({
  rifleman: define('Rifleman Squad', 23, { infantry: true }),
  heavygunner: define('Heavy Gunner', 24, { infantry: true }),
  rocketeer: define('Rocketeer Squad', 23, { infantry: true }),
  medic: define('Medic Squad', 22, { infantry: true, support: true }),
  engineer: define('Engineer Squad', 22, { infantry: true, support: true }),
  scout: define('Scout Squad', 21, { infantry: true }),
  sniper: define('Sniper Squad', 21, { infantry: true }),
  flametrooper: define('Flamethrower Troopers', 22, { infantry: true }),
  spotter: define('Sneaky Spotter Squad', 21, { infantry: true, support: true }),
  minelayer: define('Mine Layer Squad', 23, { infantry: true, support: true }),
  mech: define('Combat Mech', 29, { mechanical: true, repairable: true }),
  combatdrone: define('Combat Drone', 16, { flying: true, mechanical: true, repairable: true }),
  combatship: define('Combat Ship', 27, { flying: true, mechanical: true, repairable: true }),
  tank: define('Tank', 29, { mechanical: true, repairable: true }),
  mobileartillery: define('Mobile Artillery', 28, { mechanical: true, repairable: true }),
  repairvehicle: define('Repair Vehicle', 27, { mechanical: true, support: true, repairable: true }),
  apc: define('APC', 30, { mechanical: true, support: true, repairable: true }),
  mgcar: define('Machinegun Car', 24, { mechanical: true, repairable: true }),
  truck: define('Logistics Truck', 24, { mechanical: true, repairable: true }),
});

export const UNIT_ROLES = Object.freeze(Object.keys(UNIT_DEFINITIONS));

export function getUnitRole(unit) {
  const role = unit?.role;
  if (role && UNIT_DEFINITIONS[role]) return role;
  // Explicit migration compatibility for the two oldest runtime shapes only.
  if (unit?.type === 'truck') return 'truck';
  if (unit?.type === 'soldier' && !role) return 'rifleman';
  return null;
}

export function getUnitDefinition(unit) {
  const role = getUnitRole(unit);
  return role ? UNIT_DEFINITIONS[role] : null;
}

export function isFlyingUnit(unit) {
  return Boolean(getUnitDefinition(unit)?.flying);
}

export function isGroundUnit(unit) {
  const definition = getUnitDefinition(unit);
  return Boolean(definition && !definition.flying);
}

export function isInfantryUnit(unit) {
  return Boolean(getUnitDefinition(unit)?.infantry);
}

export function isMechanicalUnit(unit) {
  return Boolean(getUnitDefinition(unit)?.mechanical);
}

export function isRepairableUnit(unit) {
  return Boolean(getUnitDefinition(unit)?.repairable);
}

export function isSupportUnit(unit) {
  return Boolean(getUnitDefinition(unit)?.support);
}

export function unitRadius(unit, fallback = 20) {
  return getUnitDefinition(unit)?.radius ?? fallback;
}
