import { ASSET_KEYS } from '../assets/assets.js';
import { getStorageCapacity, getStorageLevel } from '../buildings/buildingRuntime.js';
import { getEffectiveTowerStats } from '../combat/towerStats.js';
import { getUnitRadius, getUnitRole } from '../core/entities.js';
import { getUnitConfig } from '../units/unitConfig.js';

const TAU = Math.PI * 2;
const RIFLE_FRAMES = Object.freeze({
  idle: Object.freeze([
    { x: 170, y: 300, w: 130, h: 155 }, { x: 395, y: 300, w: 130, h: 155 },
    { x: 620, y: 300, w: 130, h: 155 }, { x: 835, y: 300, w: 130, h: 155 },
  ]),
  move: Object.freeze([
    { x: 170, y: 460, w: 130, h: 165 }, { x: 395, y: 460, w: 130, h: 165 },
    { x: 620, y: 460, w: 130, h: 165 }, { x: 835, y: 460, w: 130, h: 165 },
  ]),
  fire: Object.freeze([
    { x: 155, y: 640, w: 210, h: 170 }, { x: 380, y: 640, w: 210, h: 170 },
    { x: 605, y: 640, w: 210, h: 170 }, { x: 830, y: 640, w: 210, h: 170 },
  ]),
});
const RIFLE_OFFSETS = Object.freeze([[-16, -13], [16, -13], [-16, 14], [16, 14], [0, -27], [0, 28]]);
const INFANTRY_ACCENT = Object.freeze({
  rifleman: '#8fb4c9', heavygunner: '#d3a05a', rocketeer: '#dd8a5c', medic: '#74d39b', engineer: '#d3bd73',
  scout: '#77d8d3', sniper: '#b7c6d8', flametrooper: '#ef8650', spotter: '#9b9dbb', minelayer: '#d3a6ef',
});
const ENEMY_STYLE = Object.freeze({
  ravager: ['#6fbf65', '#29472c'], runner: ['#d4b24e', '#6a4e18'], brute: ['#9e536c', '#482236'], spitter: ['#9176db', '#402a72'],
  flyer: ['#6cc9d1', '#245c66'], siegebeast: ['#a96955', '#4f2b23'], burrower: ['#9f7b59', '#4f3d2c'], climber: ['#72c47e', '#315b39'],
  acidlobber: ['#90c45d', '#3c5f25'], crusher: ['#c06e54', '#663427'], harvesterhunter: ['#e0a74d', '#704d1c'], saboteur: ['#75819a', '#2e3441'],
});

function nowMs(game) {
  const now = game?.services?.now;
  return typeof now === 'function' ? Number(now()) || 0 : (typeof performance !== 'undefined' ? performance.now() : Date.now());
}
function selected(game, kind, id) { return game?.state?.selection?.[kind] === id; }
function hpBar(ctx, entity, radius = 22) {
  if (!Number.isFinite(Number(entity?.hp)) || !Number.isFinite(Number(entity?.maxHp)) || Number(entity.maxHp) <= 0 || Number(entity.hp) >= Number(entity.maxHp)) return;
  const width = Math.max(36, radius * 2);
  const ratio = Math.max(0, Math.min(1, Number(entity.hp) / Number(entity.maxHp)));
  ctx.fillStyle = '#101215'; ctx.fillRect(-width / 2, radius + 9, width, 4);
  ctx.fillStyle = '#ef6666'; ctx.fillRect(-width / 2, radius + 9, width * ratio, 4);
}
function label(ctx, text, y, fill = '#eaf7ff') {
  ctx.fillStyle = 'rgba(4,10,14,.86)'; ctx.fillRect(-48, y - 10, 96, 15);
  ctx.fillStyle = fill; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.fillText(String(text).toUpperCase(), 0, y + 1);
}
function poly(ctx, points) {
  if (!points?.length) return;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
}
function drawPath(ctx, unit) {
  if (!unit?.path?.length) return;
  ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(96,225,255,.78)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(unit.x, unit.y); for (const point of unit.path) ctx.lineTo(point.x, point.y); ctx.stroke(); ctx.restore();
}
function drawRoute(ctx, unit) {
  if (getUnitRole(unit) !== 'truck' || !unit.route?.length) return;
  ctx.save(); ctx.strokeStyle = unit.routeLoop ? 'rgba(210,145,255,.9)' : 'rgba(190,135,240,.55)'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(unit.x, unit.y); for (const point of unit.route) ctx.lineTo(point.x, point.y); if (unit.routeLoop && unit.route.length > 1) ctx.lineTo(unit.route[0].x, unit.route[0].y); ctx.stroke(); ctx.setLineDash([]);
  for (let index = 0; index < unit.route.length; index++) { const point = unit.route[index]; ctx.fillStyle = '#d6a4ff'; ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#17101f'; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.fillText(String(index + 1), point.x, point.y + 3); }
  ctx.restore();
}

function drawCache(game, ctx, cache) {
  ctx.save(); ctx.translate(cache.x, cache.y);
  if (cache.captured) {
    ctx.globalAlpha = .35; ctx.fillStyle = '#39444a'; ctx.fillRect(-25, -18, 50, 36); ctx.strokeStyle = '#75838a'; ctx.strokeRect(-25, -18, 50, 36); ctx.globalAlpha = 1; label(ctx, 'SECURED', 34, '#a7b3b9'); ctx.restore(); return;
  }
  ctx.fillStyle = '#4b3920'; ctx.fillRect(-28, -20, 56, 40); ctx.strokeStyle = '#d7ad57'; ctx.lineWidth = 3; ctx.strokeRect(-28, -20, 56, 40);
  ctx.fillStyle = '#7a5727'; ctx.fillRect(-22, -14, 44, 9); ctx.fillRect(-22, 5, 44, 9); ctx.fillStyle = '#f4cf68'; ctx.fillRect(-4, -20, 8, 40);
  const max = Number(game.config.resourceCaches.captureSeconds) || 4.5; const progress = Math.max(0, Number(cache.capture) || 0); const pct = Math.round(progress / max * 100);
  label(ctx, progress > 0 ? `CAPTURE ${pct}%` : 'RESOURCE CACHE', 39);
  if (progress > 0) { ctx.fillStyle = '#172229'; ctx.fillRect(-29, 48, 58, 5); ctx.fillStyle = '#71e09a'; ctx.fillRect(-29, 48, 58 * Math.min(1, progress / max), 5); }
  ctx.restore();
}

function drawBackdrop(game, ctx) {
  const world = game.config.world;
  ctx.fillStyle = '#10221b'; ctx.fillRect(0, 0, world.width, world.height);
  ctx.save(); ctx.globalAlpha = .22;
  for (let i = 0; i < 540; i++) { const x = (i * 173 + 31) % world.width, y = (i * 97 + 19) % world.height; ctx.fillStyle = i % 4 ? '#234a37' : '#59d49a'; ctx.fillRect(x, y, 2 + i % 3, 2 + i % 2); }
  ctx.restore();
  for (const river of game.state.entities.rivers || []) {
    if (!river.points?.length) continue;
    ctx.strokeStyle = '#173e58'; ctx.lineWidth = Number(river.width) || 82; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(river.points[0].x, river.points[0].y); for (const point of river.points.slice(1)) ctx.lineTo(point.x, point.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(102,196,218,.23)'; ctx.lineWidth = Math.max(4, (Number(river.width) || 82) * .18); ctx.stroke();
  }
  for (const feature of game.state.entities.terrain || []) {
    if (feature.kind === 'lake') { ctx.fillStyle = '#153f54'; poly(ctx, feature.points); ctx.fill(); ctx.strokeStyle = '#2e6b79'; ctx.lineWidth = 5; ctx.stroke(); }
    else if (feature.kind === 'hill') { ctx.fillStyle = '#3a4738'; poly(ctx, feature.points); ctx.fill(); ctx.strokeStyle = '#69705a'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = 'rgba(210,210,160,.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(feature.x, feature.y, feature.rx * .58, feature.ry * .48, 0, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = '#18382b'; poly(ctx, feature.points); ctx.fill(); for (const tree of feature.decor || []) { ctx.fillStyle = '#315c3c'; ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.s, 0, TAU); ctx.fill(); ctx.fillStyle = '#5e9a5e'; ctx.beginPath(); ctx.arc(tree.x - tree.s * .18, tree.y - tree.s * .22, tree.s * .56, 0, TAU); ctx.fill(); } }
  }
  for (const depot of game.state.entities.depots || []) {
    ctx.save(); ctx.translate(depot.x, depot.y); const crystal = depot.resourceType !== 'ore'; ctx.fillStyle = crystal ? 'rgba(35,20,55,.82)' : 'rgba(52,43,29,.85)'; ctx.beginPath(); ctx.arc(0, 0, (Number(depot.r) || 34) + 7, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6, r = 10 + (i % 2) * 7; ctx.fillStyle = Number(depot.stock) > 0 ? (crystal ? '#b46cff' : '#c99650') : '#625e5e'; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r - 12); ctx.lineTo(Math.cos(a) * r - 6, Math.sin(a) * r + 8); ctx.lineTo(Math.cos(a) * r + 6, Math.sin(a) * r + 8); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = crystal ? '#e6c8ff' : '#f0d3a2'; ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillText(`${Math.ceil(Number(depot.stock) || 0)} ${crystal ? 'crystal' : 'ore'}`, 0, (Number(depot.r) || 34) + 18); ctx.restore();
  }
  for (const cache of game.state.entities.resourceCaches || []) drawCache(game, ctx, cache);
  return true;
}

function drawBase(game, ctx, base) {
  if (!base) return true;
  const ratio = Math.max(0, Math.min(1, Number(base.hp) / Number(base.maxHp || 1)));
  ctx.save(); ctx.translate(base.x, base.y);
  const asset = game.assets?.get?.(ASSET_KEYS.MAIN_BASE); const image = asset?.status === 'loaded' ? asset.image : null;
  if (image?.naturalWidth) { ctx.drawImage(image, -112, -88, 224, 176); }
  else { ctx.fillStyle = '#182b3d'; ctx.beginPath(); ctx.arc(0, 0, base.radius + 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7895aa'; ctx.lineWidth = 8; ctx.stroke(); ctx.fillStyle = '#263a4c'; ctx.fillRect(-55, -42, 110, 84); ctx.fillStyle = '#7bd6e8'; ctx.fillRect(-18, -18, 36, 36); }
  const y = -Number(base.radius || 68) - 38, width = 160;
  ctx.fillStyle = '#07111a'; ctx.fillRect(-width / 2 - 7, y - 20, width + 14, 38); ctx.fillStyle = '#eaf7ff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText(game.state.debug?.unlimitedLives ? 'BASE ∞ HP' : `BASE ${Math.ceil(Number(base.hp) || 0)} / ${Math.ceil(Number(base.maxHp) || 0)}`, 0, y - 5);
  ctx.fillStyle = '#111'; ctx.fillRect(-width / 2, y + 2, width, 10); ctx.fillStyle = ratio > .5 ? '#59d878' : ratio > .25 ? '#f0c65a' : '#ef6666'; ctx.fillRect(-width / 2, y + 2, width * (game.state.debug?.unlimitedLives ? 1 : ratio), 10); ctx.restore(); return true;
}

function construction(ctx, structure) {
  const total = Math.max(.001, Number(structure.buildTime) || Number(structure.buildRemaining) || 1); const ratio = Math.max(0, Math.min(1, 1 - (Number(structure.buildRemaining) || 0) / total));
  ctx.strokeStyle = 'rgba(240,210,105,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeRect(-25, -21, 50, 42); ctx.setLineDash([]); ctx.fillStyle = '#171717'; ctx.fillRect(-25, 27, 50, 6); ctx.fillStyle = '#f4d36f'; ctx.fillRect(-25, 27, 50 * ratio, 6); ctx.fillStyle = '#f8e9a8'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(ratio * 100)}%`, 0, 23);
}
function towerBody(ctx, type) {
  ctx.fillStyle = '#283744'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.fill();
  const accents = { laser: '#ff6570', flame: '#ff8b32', railgun: '#74dbff', tesla: '#b177ff', antiair: '#7bc6ff', cryo: '#9ce9ff', mortar: '#d8b06f', minigun: '#d3d8de', missile: '#e98e72', dronebay: '#80d9c6' };
  ctx.strokeStyle = accents[type] || '#8aa6ba'; ctx.lineWidth = 3; ctx.stroke();
  if (type === 'mortar') { ctx.fillStyle = accents[type]; ctx.beginPath(); ctx.arc(0, -5, 7, 0, TAU); ctx.fill(); }
  else if (type === 'dronebay') { for (let i = 0; i < 3; i++) { const a = i * TAU / 3; ctx.fillStyle = accents[type]; ctx.beginPath(); ctx.arc(Math.cos(a) * 27, Math.sin(a) * 27, 4, 0, TAU); ctx.fill(); } }
  else { ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillStyle = accents[type] || '#8aa6ba'; ctx.fillRect(0, -4, 28, 8); ctx.restore(); }
}
function storageText(game, ctx, structure) {
  if (!['mine', 'oremine', 'refinery', 'landingpad'].includes(structure.type)) return;
  let amount = Number(structure.resourceStore?.amount ?? structure.stored ?? structure.oreStored ?? structure.crystalStored) || 0;
  let capacity = 0;
  if (structure.type === 'mine' || structure.type === 'oremine') capacity = Number(structure.resourceStore?.capacity) || Number(game.config.economy?.[structure.type === 'mine' ? 'crystal' : 'ore']?.mineStorage) || 0;
  else capacity = getStorageCapacity(structure);
  ctx.fillStyle = '#d9edf4'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText(`${Math.floor(amount)}/${Math.round(capacity || 0)}`, 0, 33);
  if (structure.type === 'refinery' || structure.type === 'landingpad') ctx.fillText(`${getStorageLevel(structure)}/3`, 0, 44);
}
function landingShip(ctx, structure) {
  const ship = structure.exportShip; if (!ship || ship.state !== 'landed') return;
  ctx.save(); ctx.translate(0, -38); ctx.fillStyle = '#cbd8df'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(-24, 17); ctx.lineTo(-8, 13); ctx.lineTo(0, 22); ctx.lineTo(8, 13); ctx.lineTo(24, 17); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#70d4eb'; ctx.fillRect(-5, -10, 10, 17); hpBar(ctx, ship, 25); ctx.restore();
}
function drawStructure(game, ctx, structure) {
  if (!structure) return true;
  if (structure.type === 'wall' && Number.isFinite(structure.x1)) {
    ctx.strokeStyle = structure.built === false ? 'rgba(240,210,105,.75)' : '#708ca2'; ctx.lineWidth = Number(structure.thickness) || 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(structure.x1, structure.y1); ctx.lineTo(structure.x2, structure.y2); ctx.stroke(); return true;
  }
  ctx.save(); ctx.translate(structure.x, structure.y);
  if (structure.built === false) { construction(ctx, structure); ctx.restore(); return true; }
  try {
    const stats = getEffectiveTowerStats(game, structure);
    if (game.state.view?.showReach && stats?.range) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, stats.range, 0, TAU); ctx.stroke(); }
  } catch {}
  if (['laser', 'flame', 'railgun', 'tesla', 'antiair', 'cryo', 'mortar', 'minigun', 'missile', 'dronebay'].includes(structure.type)) towerBody(ctx, structure.type);
  else if (structure.type === 'mine' || structure.type === 'oremine') { const crystal = structure.type === 'mine'; ctx.fillStyle = crystal ? '#342947' : '#4a3927'; ctx.fillRect(-22, -18, 44, 36); ctx.strokeStyle = crystal ? '#bf89ff' : '#d2a35d'; ctx.strokeRect(-22, -18, 44, 36); ctx.fillStyle = crystal ? '#9f63e8' : '#c58b42'; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(-10, -8); ctx.lineTo(10, -8); ctx.closePath(); ctx.fill(); storageText(game, ctx, structure); }
  else if (structure.type === 'refinery') { ctx.fillStyle = '#39444b'; ctx.fillRect(-28, -22, 56, 44); ctx.fillStyle = '#7f929d'; ctx.fillRect(-22, -16, 28, 27); ctx.fillStyle = '#bd7f48'; ctx.fillRect(12, -32, 8, 43); storageText(game, ctx, structure); }
  else if (structure.type === 'landingpad') { ctx.fillStyle = '#293944'; ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU); ctx.fill(); ctx.strokeStyle = '#6da8bd'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = '#d7e6ec'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); storageText(game, ctx, structure); landingShip(ctx, structure); }
  else { ctx.fillStyle = '#31485a'; ctx.fillRect(-22, -18, 44, 36); }
  if (structure.protected) { ctx.strokeStyle = '#72e6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.stroke(); }
  if (selected(game, 'towerId', structure.id) || selected(game, 'storageBuildingId', structure.id)) { ctx.strokeStyle = '#ffe47b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 35, 0, TAU); ctx.stroke(); }
  hpBar(ctx, structure, 32); ctx.restore(); return true;
}

function person(ctx, x, y, body, accent, heading = 0, longGun = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(heading); ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 1, 5.8, 0, TAU); ctx.fill(); ctx.fillStyle = '#d7d3c8'; ctx.beginPath(); ctx.arc(0, -5.2, 2.8, 0, TAU); ctx.fill(); ctx.fillStyle = accent; ctx.fillRect(2, -1, longGun ? 15 : 10, 3); ctx.restore();
}
function rifleSprite(game, ctx, unit) {
  const entry = game.assets?.get?.(ASSET_KEYS.FIRING_SQUAD_SHEET); const image = entry?.status === 'loaded' ? entry.image : null;
  if (!image || image.naturalWidth !== 1774 || image.naturalHeight !== 887) return false;
  const moving = Boolean(unit.path?.length); const firing = Number(unit.v47FiringUntil) > nowMs(game); const stateName = moving ? 'move' : firing ? 'fire' : 'idle'; const frames = RIFLE_FRAMES[stateName]; const speed = stateName === 'fire' ? 105 : stateName === 'move' ? 145 : 725; const frameIndex = Math.floor(nowMs(game) / speed); const facing = Number(unit.heading) || 0; const count = Math.max(1, Math.min(RIFLE_OFFSETS.length, Number(getUnitConfig('rifleman').members) || 6));
  for (let i = 0; i < count; i++) { const raw = RIFLE_OFFSETS[i], c = Math.cos(facing), s = Math.sin(facing), ox = raw[0] * c - raw[1] * s, oy = raw[0] * s + raw[1] * c, frame = frames[(frameIndex + i) % frames.length], h = stateName === 'move' ? 35 : 34, w = h * frame.w / frame.h; ctx.save(); ctx.translate(ox, oy); ctx.rotate(facing); ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, -w * .48, -h * .53, w, h); ctx.restore(); }
  return true;
}
function infantry(ctx, role, unit) {
  const definition = getUnitConfig(role); const members = Math.max(1, Math.min(6, Number(definition.members) || 3)); const accent = INFANTRY_ACCENT[role] || '#8fb4c9';
  ctx.fillStyle = 'rgba(20,37,48,.75)'; ctx.beginPath(); ctx.arc(0, 0, getUnitRadius(unit) + 1, 0, TAU); ctx.fill();
  for (let i = 0; i < members; i++) { const off = RIFLE_OFFSETS[i]; person(ctx, off[0] * .72, off[1] * .72, '#5d7387', accent, Number(unit.heading) || 0, role === 'sniper' || role === 'rocketeer'); }
  if (role === 'medic') { ctx.strokeStyle = '#7ce3a4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke(); }
  if (role === 'engineer') { ctx.strokeStyle = '#e1c56f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, .2, 4.8); ctx.stroke(); }
  if (role === 'minelayer') { ctx.fillStyle = '#c69ae7'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#2b1937'; ctx.fillRect(-1, -10, 2, 6); }
}
function vehicle(ctx, role, unit) {
  ctx.save(); ctx.rotate(Number(unit.heading) || 0);
  if (role === 'mech') { ctx.fillStyle = '#465b6b'; ctx.fillRect(-18, -17, 36, 34); ctx.fillStyle = '#7f9eaf'; ctx.fillRect(-10, -12, 20, 24); ctx.strokeStyle = '#b8d6e4'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(-20, 27); ctx.moveTo(14, 14); ctx.lineTo(20, 27); ctx.stroke(); ctx.fillStyle = '#80d8ec'; ctx.fillRect(8, -4, 22, 4); }
  else if (role === 'tank') { ctx.fillStyle = '#455247'; ctx.fillRect(-22, -15, 44, 30); ctx.fillStyle = '#728273'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#98a794'; ctx.fillRect(5, -3, 28, 6); }
  else if (role === 'mobileartillery') { ctx.fillStyle = '#4c5147'; ctx.fillRect(-22, -14, 44, 28); ctx.fillStyle = '#72786c'; ctx.fillRect(-4, -7, 18, 14); ctx.fillStyle = '#b4aa83'; ctx.fillRect(8, -3, 35, 6); }
  else if (role === 'repairvehicle') { ctx.fillStyle = '#43576a'; ctx.fillRect(-21, -14, 42, 28); ctx.strokeStyle = '#7bd7a7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke(); }
  else if (role === 'apc') { ctx.fillStyle = '#435667'; ctx.fillRect(-25, -15, 50, 30); ctx.fillStyle = '#718da1'; ctx.fillRect(-10, -10, 20, 20); ctx.fillStyle = '#a9c8d8'; ctx.fillRect(6, -2, 20, 4); }
  else if (role === 'mgcar') { ctx.fillStyle = '#475968'; ctx.fillRect(-19, -12, 38, 24); ctx.fillStyle = '#839dab'; ctx.fillRect(-5, -7, 15, 14); ctx.fillStyle = '#c7d8df'; ctx.fillRect(5, -2, 23, 4); }
  else { ctx.fillStyle = '#425b6d'; ctx.fillRect(-18, -11, 36, 22); ctx.fillStyle = '#7aa0b8'; ctx.fillRect(-9, -13, 18, 26); ctx.fillStyle = '#111'; ctx.fillRect(-20, -14, 6, 8); ctx.fillRect(14, -14, 6, 8); ctx.fillRect(-20, 6, 6, 8); ctx.fillRect(14, 6, 6, 8); }
  ctx.restore();
}
function aircraft(ctx, role, unit) {
  ctx.save(); ctx.rotate(Number(unit.heading) || 0); if (role === 'combatdrone') { ctx.fillStyle = '#4e6978'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-5, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#78d9eb'; ctx.beginPath(); ctx.arc(2, 0, 5, 0, TAU); ctx.fill(); } else { ctx.fillStyle = '#526979'; ctx.beginPath(); ctx.moveTo(29, 0); ctx.lineTo(-18, -19); ctx.lineTo(-8, -4); ctx.lineTo(-26, 0); ctx.lineTo(-8, 4); ctx.lineTo(-18, 19); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#79d8ea'; ctx.fillRect(-2, -6, 16, 12); } ctx.restore();
}
function drawUnit(game, ctx, unit) {
  if (!unit || unit.transportedIn || unit.garrisonedIn) return true;
  drawRoute(ctx, unit); drawPath(ctx, unit); const role = getUnitRole(unit); const radius = getUnitRadius(unit);
  ctx.save(); ctx.translate(unit.x, unit.y);
  if (role === 'rifleman') { if (!rifleSprite(game, ctx, unit)) infantry(ctx, role, unit); }
  else if (['heavygunner', 'rocketeer', 'medic', 'engineer', 'scout', 'sniper', 'flametrooper', 'spotter', 'minelayer'].includes(role)) infantry(ctx, role, unit);
  else if (role === 'combatdrone' || role === 'combatship') aircraft(ctx, role, unit);
  else vehicle(ctx, role, unit);
  if (unit.attachedTo) { ctx.strokeStyle = '#d2a8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius + 4, 0, TAU); ctx.stroke(); }
  if (selected(game, 'unitId', unit.id)) { ctx.strokeStyle = '#ffe47b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, radius + 8, 0, TAU); ctx.stroke(); label(ctx, getUnitConfig(role).displayName, -radius - 18, '#f8ecad'); }
  if (role === 'truck') { const amount = Number(unit.cargoStore?.amount ?? unit.cargo) || 0, capacity = Number(unit.cargoCapacity) || Number(getUnitConfig('truck').logistics.capacity); ctx.fillStyle = '#d2a8ff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText(`${Math.floor(amount)}/${capacity}`, 0, -radius - 7); }
  hpBar(ctx, unit, radius); ctx.restore(); return true;
}

function drawEnemy(_game, ctx, enemy) {
  if (!enemy) return true; const style = ENEMY_STYLE[enemy.type] || ['#75bb62', '#315c31']; const radius = Math.max(7, Number(enemy.r) || 10);
  ctx.save(); ctx.translate(enemy.x, enemy.y); if (enemy.cloaked) ctx.globalAlpha = .55;
  if (enemy.type === 'flyer') { ctx.rotate(Number(enemy.heading) || 0); ctx.fillStyle = style[0]; ctx.beginPath(); ctx.moveTo(radius * 1.7, 0); ctx.lineTo(-radius, -radius); ctx.lineTo(-radius * .35, 0); ctx.lineTo(-radius, radius); ctx.closePath(); ctx.fill(); }
  else if (enemy.type === 'brute' || enemy.type === 'siegebeast' || enemy.type === 'crusher') { ctx.fillStyle = style[1]; ctx.beginPath(); ctx.arc(0, 0, radius + 4, 0, TAU); ctx.fill(); ctx.fillStyle = style[0]; ctx.fillRect(-radius * .75, -radius * .7, radius * 1.5, radius * 1.4); }
  else { ctx.fillStyle = style[1]; ctx.beginPath(); ctx.arc(0, 0, radius + 2, 0, TAU); ctx.fill(); ctx.fillStyle = style[0]; ctx.beginPath(); ctx.arc(0, -1, radius * .78, 0, TAU); ctx.fill(); }
  if (Number(enemy.burn) > 0) { ctx.strokeStyle = '#ff8b32'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius + 5, 0, TAU); ctx.stroke(); }
  if (Number(enemy.slowTime) > 0) { ctx.strokeStyle = '#8eeaff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius + 8, 0, TAU); ctx.stroke(); }
  if (Number(enemy.markTime) > 0 || Number(enemy.markedTime) > 0) { ctx.strokeStyle = '#ffe36b'; ctx.lineWidth = 2; ctx.strokeRect(-radius - 5, -radius - 5, (radius + 5) * 2, (radius + 5) * 2); }
  hpBar(ctx, enemy, radius); ctx.restore(); return true;
}

function effectLine(ctx, effect, stroke, width = 3) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(effect.x1, effect.y1); ctx.lineTo(effect.x2, effect.y2); ctx.stroke(); }
function drawEffect(ctx, effect, now) {
  const expires = Number(effect.expires), duration = Number(effect.durationMs) || 1; const alpha = Number.isFinite(expires) ? Math.max(0, Math.min(1, (expires - now) / duration)) : 1; ctx.save(); ctx.globalAlpha = Math.max(.12, alpha);
  if (effect.kind === 'rail' || effect.kind === 'prism') effectLine(ctx, effect, effect.kind === 'rail' ? '#79e9ff' : '#ff6f78', effect.kind === 'rail' ? 5 : 3);
  else if (effect.kind === 'tesla' && effect.points?.length) { ctx.strokeStyle = '#b881ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(effect.points[0].x, effect.points[0].y); for (const point of effect.points.slice(1)) ctx.lineTo(point.x, point.y); ctx.stroke(); }
  else if (Number.isFinite(effect.x1) && Number.isFinite(effect.x2)) effectLine(ctx, effect, effect.kind?.includes('flame') ? '#ff8b32' : '#ffd36b', 2.5);
  else if (Number.isFinite(effect.x) && Number.isFinite(effect.y)) { ctx.strokeStyle = effect.kind === 'cryo' ? '#8eeaff' : '#ffd36b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, Math.max(8, Number(effect.r) || 18), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawProjectiles(game, ctx) {
  for (const projectile of game.state.entities.projectiles || []) { ctx.strokeStyle = projectile.type === 'laser' ? '#ff5967' : '#fff0a0'; ctx.lineWidth = projectile.type === 'laser' ? 4 : 1.6; ctx.beginPath(); ctx.moveTo(projectile.x - (Number(projectile.vx) || 0) * .016, projectile.y - (Number(projectile.vy) || 0) * .016); ctx.lineTo(projectile.x, projectile.y); ctx.stroke(); }
  for (const projectile of game.state.entities.enemyProjectiles || []) { ctx.fillStyle = '#9cff55'; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 4, 0, TAU); ctx.fill(); }
  for (const mine of game.state.entities.playerMines || []) { ctx.fillStyle = '#2d3339'; ctx.beginPath(); ctx.arc(mine.x, mine.y, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d7a8ef'; ctx.lineWidth = 2; ctx.stroke(); }
  const now = nowMs(game); for (const effect of game.state.entities.effects || []) drawEffect(ctx, effect, now); return true;
}
function drawParticles(game, ctx) {
  for (const particle of game.state.entities.particles || []) { ctx.globalAlpha = Math.max(0, Math.min(1, Number(particle.life) / .45)); ctx.fillStyle = '#b9ff8a'; ctx.fillRect(particle.x, particle.y, 3, 3); } ctx.globalAlpha = 1; return true;
}
function drawScreen(game, ctx) {
  const width = game.viewport.width, height = game.viewport.height;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (game.state.debug?.unlimitedCash || game.state.debug?.unlimitedLives) { ctx.fillStyle = '#7fe6ff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left'; ctx.fillText(`DEBUG ${game.state.debug.unlimitedCash ? '∞ CASH ' : ''}${game.state.debug.unlimitedLives ? '∞ LIVES' : ''}`, 14, height - 14); }
  if (game.state.session?.paused && game.state.ui?.gameStarted && !game.state.session?.gameOver) { ctx.fillStyle = 'rgba(0,0,0,.36)'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#ffe36b'; ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', width / 2, 80); ctx.font = '16px Arial'; ctx.fillText('Orders and building placements can still be queued', width / 2, 108); }
  if (game.state.session?.gameOver) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#fff'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.fillText('BASE LOST', width / 2, height / 2); ctx.font = '20px Arial'; ctx.fillText('Press RESTART to begin a new run', width / 2, height / 2 + 38); }
  ctx.restore(); return true;
}

export function createProductionRenderingServices() {
  return Object.freeze({
    drawBackdrop,
    drawBase,
    drawStructure,
    drawUnit,
    drawEnemy,
    drawProjectiles,
    drawParticles,
    drawScreen,
    createSurface(width, height) {
      if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
      if (typeof document !== 'undefined') { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
      return null;
    },
  });
}
