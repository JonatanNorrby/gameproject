import { MIGRATION_STATUS } from '../core/config.js';
import { BUILDING_CONFIG, wallBuildTime, wallCost } from '../buildings/buildingConfig.js';
import { freeWorkers, wallPathLength } from '../buildings/placement.js';
import { getStorageCapacity, getStorageLevel, getStorageUpgradeCost } from '../buildings/buildingRuntime.js';
import { getEffectiveTowerStats } from '../combat/towerStats.js';
import { getResource } from '../economy/resources.js';
import { TOWER_CONFIG } from '../towers/towerConfig.js';
import { UNIT_CONFIG, normalizeUnitType } from '../units/unitConfig.js';
import { getUnitRole } from '../core/entities.js';
import { centerCameraOnBase, getCameraZoom, zoomCameraStep } from '../input/camera.js';
import {
  beginApcSupport,
  beginMedicFollow,
  beginOrFinishTruckRoute,
  beginPlatoonAttach,
  beginTruckAttach,
  cancelBuildMode,
  cancelWallReview,
  chooseBuildType,
  clearSelection,
  clearTruckRoute,
  confirmWallPath,
  detachFromTruck,
  detachSelectedSupport,
  disbandSelectedPlatoon,
  dropSelectedMine,
  leavePlatoon,
  loadSelectedApc,
  reviewWallPath,
  selectedStorage,
  selectedTower,
  selectedUnit,
  unloadSelectedApc,
  upgradeSelectedStorage,
  upgradeSelectedTower,
} from '../input/interaction.js';

export const UI_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;

function byId(doc, id) { return doc?.getElementById?.(id) || null; }
function show(element, visible) { if (element) element.style.display = visible ? '' : 'none'; }
function text(element, value) { if (element) element.textContent = String(value ?? ''); }
function toggle(element, name, value) { element?.classList?.toggle?.(name, Boolean(value)); }

function formatCost(cost) {
  if (!cost || typeof cost !== 'object') return '';
  if (Number(cost.gold) > 0) return `${cost.gold} gold`;
  if (Number(cost.metal) > 0) return `${cost.metal} metal`;
  return '';
}

function unitCostForButton(type) {
  const role = normalizeUnitType(type);
  return UNIT_CONFIG[role]?.cost || null;
}

function buildCostForButton(type) {
  if (TOWER_CONFIG[type]) return TOWER_CONFIG[type].cost;
  if (BUILDING_CONFIG[type]?.cost && !BUILDING_CONFIG[type].cost.metalPer100) return BUILDING_CONFIG[type].cost;
  return null;
}

function ensureButton(doc, parent, id, label) {
  let button = byId(doc, id);
  if (!button && parent && doc?.createElement) {
    button = doc.createElement('button');
    button.id = id;
    button.textContent = label;
    parent.appendChild(button);
  }
  return button;
}

function ensureStoragePanel(doc, commandBody) {
  let panel = byId(doc, 'storageActions');
  if (!panel && commandBody && doc?.createElement) {
    panel = doc.createElement('div'); panel.id = 'storageActions';
    panel.innerHTML = '<div><b id="storageActionName">STORAGE</b> <span id="storageActionLevel">1/3</span></div><div id="storageActionStats"></div><button id="storageUpgradeBtn">UPGRADE STORAGE</button><button id="storageUpgradeCloseBtn">✕</button>';
    commandBody.appendChild(panel);
  }
  return panel;
}

function bind(target, event, handler, disposers, options = false) {
  if (!target?.addEventListener) return;
  target.addEventListener(event, handler, options);
  disposers.push(() => target.removeEventListener(event, handler, options));
}

function action(game, fn) {
  return event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    fn();
    renderUI(game);
  };
}

function sessionStart(game) {
  const ui = game.state.ui;
  ui.titleMenuOpen = false;
  ui.titlePanel = null;
  ui.commandMenuOpen = false;
  ui.gameStarted = true;
  game.state.session.paused = false;
  game.state.session.lastFrameTime = typeof game.services.now === 'function' ? game.services.now() : 0;
  if (game.state.session.gameOver && game.state.base.hp > 0) game.state.session.gameOver = false;
  ui.message = 'Survive, expand logistics, and defend the base.';
}

export function initUI(game) {
  if (!game) throw new TypeError('initUI requires a game context');
  const doc = typeof document !== 'undefined' ? document : game?.services?.ui?.document;
  const disposers = [];
  if (!doc?.getElementById) return Object.freeze({ dispose() {}, render: () => renderUI(game) });

  const commandBody = doc.querySelector?.('.command-body');
  ensureStoragePanel(doc, commandBody);
  const unitActions = byId(doc, 'unitActions');
  const buttons = {
    platoonAdd: ensureButton(doc, unitActions, 'platoonAttachBtn', 'ADD TO PLATOON'),
    platoonLeave: ensureButton(doc, unitActions, 'platoonLeaveBtn', 'LEAVE PLATOON'),
    platoonDisband: ensureButton(doc, unitActions, 'platoonDisbandBtn', 'DISBAND PLATOON'),
    apcLoad: ensureButton(doc, unitActions, 'apcLoadBtn', 'LOAD INFANTRY'),
    apcUnload: ensureButton(doc, unitActions, 'apcUnloadBtn', 'UNLOAD'),
    medicFollow: ensureButton(doc, unitActions, 'medicFollowBtn', 'FOLLOW SQUAD'),
    supportAttach: ensureButton(doc, unitActions, 'apcSupportBtn', 'SUPPORT UNIT / PLATOON'),
    supportDetach: ensureButton(doc, unitActions, 'supportDetachBtn', 'DETACH SUPPORT'),
  };

  const start = byId(doc, 'startGameBtn');
  const options = byId(doc, 'optionsBtn');
  const guide = byId(doc, 'guideBtn');
  const optionsBack = byId(doc, 'optionsBackBtn');
  const guideBack = byId(doc, 'guideBackBtn');
  bind(start, 'click', action(game, () => sessionStart(game)), disposers);
  bind(options, 'click', action(game, () => { game.state.ui.titlePanel = 'options'; }), disposers);
  bind(guide, 'click', action(game, () => { game.state.ui.titlePanel = 'guide'; }), disposers);
  bind(optionsBack, 'click', action(game, () => { game.state.ui.titlePanel = null; }), disposers);
  bind(guideBack, 'click', action(game, () => { game.state.ui.titlePanel = null; }), disposers);

  bind(byId(doc, 'mobileMenuBtn'), 'click', action(game, () => { game.state.ui.commandMenuOpen = !game.state.ui.commandMenuOpen; game.input?.cancelGesture?.(); }), disposers);
  bind(byId(doc, 'commandCloseBtn'), 'click', action(game, () => { game.state.ui.commandMenuOpen = false; game.input?.cancelGesture?.(); }), disposers);
  bind(byId(doc, 'commandBackdrop'), 'click', action(game, () => { game.state.ui.commandMenuOpen = false; game.input?.cancelGesture?.(); }), disposers);
  bind(byId(doc, 'commandMainMenuBtn'), 'click', action(game, () => { game.state.ui.commandMenuOpen = false; game.state.ui.titleMenuOpen = true; game.state.ui.titlePanel = null; game.state.session.paused = true; game.input?.cancelGesture?.(); }), disposers);
  bind(byId(doc, 'pauseBtn'), 'click', action(game, () => { game.state.session.paused = !game.state.session.paused; }), disposers);

  for (const tab of doc.querySelectorAll?.('.menuTab') || []) bind(tab, 'click', action(game, () => { game.state.ui.activeBuildTab = tab.dataset.menu; }), disposers);
  for (const button of doc.querySelectorAll?.('.buildBtn') || []) {
    bind(button, 'click', action(game, () => {
      const result = chooseBuildType(game, button.dataset.type);
      if (result.ok) game.state.ui.commandMenuOpen = false;
    }), disposers);
  }

  bind(byId(doc, 'routeRecordBtn'), 'click', action(game, () => beginOrFinishTruckRoute(game)), disposers);
  bind(byId(doc, 'routeClearBtn'), 'click', action(game, () => clearTruckRoute(game)), disposers);
  bind(byId(doc, 'attachBtn'), 'click', action(game, () => beginTruckAttach(game)), disposers);
  bind(byId(doc, 'detachBtn'), 'click', action(game, () => detachFromTruck(game)), disposers);
  bind(byId(doc, 'dropMineBtn'), 'click', action(game, () => dropSelectedMine(game)), disposers);
  bind(buttons.platoonAdd, 'click', action(game, () => beginPlatoonAttach(game)), disposers);
  bind(buttons.platoonLeave, 'click', action(game, () => leavePlatoon(game)), disposers);
  bind(buttons.platoonDisband, 'click', action(game, () => disbandSelectedPlatoon(game)), disposers);
  bind(buttons.apcLoad, 'click', action(game, () => loadSelectedApc(game)), disposers);
  bind(buttons.apcUnload, 'click', action(game, () => unloadSelectedApc(game)), disposers);
  bind(buttons.medicFollow, 'click', action(game, () => beginMedicFollow(game)), disposers);
  bind(buttons.supportAttach, 'click', action(game, () => beginApcSupport(game)), disposers);
  bind(buttons.supportDetach, 'click', action(game, () => detachSelectedSupport(game)), disposers);

  bind(byId(doc, 'towerUpgradeBtn'), 'click', action(game, () => upgradeSelectedTower(game)), disposers);
  bind(byId(doc, 'towerUpgradeCloseBtn'), 'click', action(game, () => { game.state.selection.towerId = null; }), disposers);
  bind(byId(doc, 'storageUpgradeBtn'), 'click', action(game, () => upgradeSelectedStorage(game)), disposers);
  bind(byId(doc, 'storageUpgradeCloseBtn'), 'click', action(game, () => { game.state.selection.storageBuildingId = null; }), disposers);
  bind(byId(doc, 'cancelUnitBtn'), 'click', action(game, () => clearSelection(game, { message: 'Unit deselected.' })), disposers);

  bind(byId(doc, 'wallCancelModeBtn'), 'click', action(game, () => cancelBuildMode(game)), disposers);
  bind(byId(doc, 'wallConfirmPathBtn'), 'click', action(game, () => reviewWallPath(game)), disposers);
  bind(byId(doc, 'wallAccept'), 'click', action(game, () => confirmWallPath(game)), disposers);
  bind(byId(doc, 'wallCancel'), 'click', action(game, () => cancelWallReview(game)), disposers);

  bind(byId(doc, 'reachBtn'), 'click', action(game, () => { game.state.view.showReach = !game.state.view.showReach; }), disposers);
  bind(byId(doc, 'centerBtn'), 'click', action(game, () => { centerCameraOnBase(game); game.state.ui.commandMenuOpen = false; }), disposers);
  bind(byId(doc, 'restartBtn'), 'click', action(game, () => {
    const restart = game.services.ui?.restart;
    if (typeof restart === 'function') restart(game); else game.reset();
  }), disposers);
  bind(byId(doc, 'mapZoomOutBtn'), 'click', action(game, () => zoomCameraStep(game, -1)), disposers);
  bind(byId(doc, 'mapZoomInBtn'), 'click', action(game, () => zoomCameraStep(game, 1)), disposers);

  const optReach = byId(doc, 'optShowReach');
  const optEnemy = byId(doc, 'optEnemyArrows');
  const optUnit = byId(doc, 'optUnitArrows');
  bind(optReach, 'change', action(game, () => { game.state.view.showReach = Boolean(optReach.checked); }), disposers);
  bind(optEnemy, 'change', action(game, () => { game.state.ui.options.enemyArrows = Boolean(optEnemy.checked); }), disposers);
  bind(optUnit, 'change', action(game, () => { game.state.ui.options.unitArrows = Boolean(optUnit.checked); }), disposers);

  const debugCash = byId(doc, 'debugCash'), debugLives = byId(doc, 'debugLives');
  bind(debugCash, 'change', action(game, () => { game.state.debug.unlimitedCash = Boolean(debugCash.checked); }), disposers);
  bind(debugLives, 'change', action(game, () => { game.state.debug.unlimitedLives = Boolean(debugLives.checked); }), disposers);
  bind(byId(doc, 'debugHeal'), 'click', action(game, () => { game.state.base.hp = game.state.base.maxHp; }), disposers);
  bind(byId(doc, 'debugBtn'), 'click', action(game, () => { byId(doc, 'debugPanel')?.classList?.toggle?.('open'); }), disposers);

  game.ui = { document: doc, render: () => renderUI(game) };
  renderUI(game);
  return Object.freeze({
    render: () => renderUI(game),
    dispose() { for (const dispose of disposers.splice(0)) dispose(); },
  });
}

export function renderUI(game) {
  const doc = game?.ui?.document || (typeof document !== 'undefined' ? document : game?.services?.ui?.document);
  if (!doc?.getElementById) return;
  const ui = game.state.ui;
  const mainMenu = byId(doc, 'mainMenu');
  toggle(mainMenu, 'hidden', !ui.titleMenuOpen);
  toggle(byId(doc, 'mainMenuHome'), 'hidden', Boolean(ui.titlePanel));
  toggle(byId(doc, 'optionsPanel'), 'hidden', ui.titlePanel !== 'options');
  toggle(byId(doc, 'guidePanel'), 'hidden', ui.titlePanel !== 'guide');
  text(byId(doc, 'startGameBtn'), ui.gameStarted ? 'RESUME' : 'START GAME');

  const drawer = byId(doc, 'commandDrawer'), backdrop = byId(doc, 'commandBackdrop'), menuButton = byId(doc, 'mobileMenuBtn');
  toggle(drawer, 'open', ui.commandMenuOpen); toggle(backdrop, 'open', ui.commandMenuOpen); toggle(menuButton, 'menu-open', ui.commandMenuOpen);
  menuButton?.setAttribute?.('aria-expanded', ui.commandMenuOpen ? 'true' : 'false');
  text(menuButton, ui.commandMenuOpen ? '✕ CLOSE' : '☰ MENU');

  text(byId(doc, 'baseHp'), Math.ceil(Math.max(0, game.state.base.hp)));
  text(byId(doc, 'baseMax'), Math.ceil(game.state.base.maxHp));
  text(byId(doc, 'credits'), Math.floor(getResource(game, 'gold')));
  text(byId(doc, 'metal'), Math.floor(getResource(game, 'metal')));
  text(byId(doc, 'workers'), `${freeWorkers(game)}/${game.config.workers.count} free`);
  text(byId(doc, 'aliens'), (game.state.entities.enemies || []).filter(enemy => Number(enemy.hp) > 0).length);
  const elapsed = Math.max(0, Number(game.state.time.elapsed) || 0), minutes = Math.floor(elapsed / 60), seconds = Math.floor(elapsed % 60);
  text(byId(doc, 'survival'), `${minutes}:${String(seconds).padStart(2, '0')}`);
  text(byId(doc, 'message'), ui.message);
  text(byId(doc, 'pauseBtn'), game.state.session.paused ? '▶ RESUME' : '⏸ PAUSE');

  for (const tab of doc.querySelectorAll?.('.menuTab') || []) toggle(tab, 'active', tab.dataset.menu === ui.activeBuildTab);
  for (const menu of doc.querySelectorAll?.('.buildMenu') || []) toggle(menu, 'active', menu.id === ui.activeBuildTab);
  for (const button of doc.querySelectorAll?.('.buildBtn') || []) {
    const type = button.dataset.type, role = normalizeUnitType(type), unit = UNIT_CONFIG[role], definition = unit || TOWER_CONFIG[type] || BUILDING_CONFIG[type];
    if (!definition) continue;
    button.disabled = definition.enabled === false;
    const small = button.querySelector?.('small');
    if (small) {
      if (type === 'wall') small.textContent = `${BUILDING_CONFIG.wall.cost.metalPer100} metal / 100px`;
      else small.textContent = formatCost(unit ? unitCostForButton(type) : buildCostForButton(type));
    }
    toggle(button, 'selected', game.state.commands.buildType === type);
  }

  text(byId(doc, 'reachBtn'), `SHOW REACH: ${game.state.view.showReach ? 'ON' : 'OFF'}`);
  const zoom = getCameraZoom(game);
  text(byId(doc, 'mapZoomLabel'), `${Math.round(zoom * 100)}%`);
  const zoomOut = byId(doc, 'mapZoomOutBtn'), zoomIn = byId(doc, 'mapZoomInBtn');
  if (zoomOut) zoomOut.disabled = zoom <= game.config.camera.minZoom + .0001;
  if (zoomIn) zoomIn.disabled = zoom >= game.config.camera.maxZoom - .0001;

  const unit = selectedUnit(game), role = getUnitRole(unit), unitActions = byId(doc, 'unitActions');
  show(unitActions, Boolean(unit));
  const routeRecord = byId(doc, 'routeRecordBtn'), routeClear = byId(doc, 'routeClearBtn'), attach = byId(doc, 'attachBtn'), detach = byId(doc, 'detachBtn'), dropMine = byId(doc, 'dropMineBtn');
  show(routeRecord, unit?.type === 'truck'); show(routeClear, unit?.type === 'truck');
  if (routeRecord) text(routeRecord, game.state.commands.routeEditing ? 'FINISH ROUTE' : 'RECORD ROUTE');
  show(attach, Boolean(unit && unit.type !== 'truck' && !unit.attachedTo)); show(detach, Boolean(unit?.attachedTo));
  show(dropMine, role === 'minelayer');
  const dynamic = {
    platoonAttachBtn: Boolean(unit && UNIT_CONFIG[role]?.traits?.includes('platoonCapable')),
    platoonLeaveBtn: Boolean(unit?.platoonId),
    platoonDisbandBtn: Boolean(unit?.platoonId),
    apcLoadBtn: role === 'apc' && !unit?.passengerId,
    apcUnloadBtn: role === 'apc' && Boolean(unit?.passengerId),
    medicFollowBtn: role === 'medic',
    apcSupportBtn: role === 'apc' && !unit?.passengerId,
    supportDetachBtn: Boolean((role === 'medic' && unit?.v47FollowId) || (role === 'apc' && (unit?.v47SupportUnitId || unit?.v47SupportPlatoonId))),
  };
  for (const [id, visible] of Object.entries(dynamic)) show(byId(doc, id), visible);
  toggle(byId(doc, 'cancelUnitBtn'), 'visible', Boolean(unit));

  const tower = selectedTower(game), towerActions = byId(doc, 'towerActions');
  show(towerActions, Boolean(tower));
  if (tower) {
    const stats = getEffectiveTowerStats(tower);
    text(byId(doc, 'towerActionName'), TOWER_CONFIG[tower.type]?.displayName || tower.type);
    text(byId(doc, 'towerActionLevel'), `${stats.level}/3`);
    text(byId(doc, 'towerActionStats'), `${Math.round(stats.range)} range${Number.isFinite(stats.damage) ? ` · ${Number(stats.damage).toFixed(1)} dmg` : ''}`);
    text(byId(doc, 'towerUpgradeName'), stats.nextUpgradeName || 'MAX LEVEL');
    text(byId(doc, 'towerUpgradeDesc'), stats.level >= 3 ? 'Fully upgraded.' : `Next upgrade: ${stats.nextUpgradeCost} metal`);
    const upgrade = byId(doc, 'towerUpgradeBtn');
    if (upgrade) { upgrade.disabled = stats.level >= 3 || getResource(game, 'metal') < stats.nextUpgradeCost; text(upgrade, stats.level >= 3 ? 'MAX LEVEL' : `UPGRADE · ${stats.nextUpgradeCost} METAL`); }
  }

  const storage = selectedStorage(game), storagePanel = byId(doc, 'storageActions');
  show(storagePanel, Boolean(storage));
  if (storage) {
    const level = getStorageLevel(storage), cap = getStorageCapacity(storage), next = getStorageUpgradeCost(storage);
    text(byId(doc, 'storageActionName'), storage.type === 'landingpad' ? 'LANDING PAD STORAGE' : 'REFINERY STORAGE');
    text(byId(doc, 'storageActionLevel'), `${level}/3`);
    text(byId(doc, 'storageActionStats'), `Capacity ${cap}`);
    const upgrade = byId(doc, 'storageUpgradeBtn');
    if (upgrade) { upgrade.disabled = !next || getResource(game, 'gold') < Number(next.gold || 0); text(upgrade, next ? `UPGRADE · ${next.gold} GOLD` : 'MAX LEVEL'); }
  }

  const wall = game.state.commands.wall, wallMode = game.state.commands.buildType === 'wall';
  toggle(byId(doc, 'wallCancelModeBtn'), 'visible', wallMode);
  toggle(byId(doc, 'wallConfirmPathBtn'), 'visible', wallMode && wall.path.length >= 2);
  toggle(byId(doc, 'wallConfirm'), 'hidden', !wall.reviewOpen);
  if (wall.reviewOpen) {
    const total = wallPathLength(wall.path);
    text(byId(doc, 'wallLength'), Math.round(total));
    text(byId(doc, 'wallCost'), wallCost(total));
    text(byId(doc, 'wallBuildTime'), wallBuildTime(total).toFixed(1));
  }

  const optReach = byId(doc, 'optShowReach'), optEnemy = byId(doc, 'optEnemyArrows'), optUnit = byId(doc, 'optUnitArrows');
  if (optReach) optReach.checked = Boolean(game.state.view.showReach);
  if (optEnemy) optEnemy.checked = Boolean(ui.options.enemyArrows);
  if (optUnit) optUnit.checked = Boolean(ui.options.unitArrows);
  const debugCash = byId(doc, 'debugCash'), debugLives = byId(doc, 'debugLives');
  if (debugCash) debugCash.checked = Boolean(game.state.debug.unlimitedCash);
  if (debugLives) debugLives.checked = Boolean(game.state.debug.unlimitedLives);
}
