import { createGameConfig } from '../core/config.js';
import { ASSET_KEYS, ASSET_MANIFEST, createAssetRegistry } from '../assets/assets.js';
import { getStorageCapacity, getStorageLevel } from '../buildings/buildingRuntime.js';
import { wallCost } from '../buildings/buildingConfig.js';
import { refreshFog, isPointVisible } from '../fog/fog.js';
import {
  clampCamera as cleanClampCamera,
  eventToWorld as cleanEventToWorld,
  getCameraZoom,
  setCameraZoom,
  updateCameraFromKeys,
} from '../input/camera.js';
import { renderWorld } from '../rendering/renderer.js';
import { pruneExpiredVisualEffects, VISUAL_EFFECT_CHANNELS } from '../rendering/visualEffects.js';

const MIGRATION_ID='rendering-fog-camera-step7';

function numberOr(value,fallback=0){
  if(value===null||value===''||typeof value==='boolean')return fallback;
  const n=Number(value);return Number.isFinite(n)?n:fallback;
}
function defineLiveProperty(target,key,get,set=()=>{}){
  Object.defineProperty(target,key,{configurable:false,enumerable:true,get,set});
}
function requireHost(host){
  if(!host||typeof host.getState!=='function')throw new TypeError('Visual migration bridge requires getState()');
  if(typeof host.installOwners!=='function')throw new TypeError('Visual migration bridge requires installOwners()');
  return host;
}
function ensureLegacyCamera(state,config){
  state.camera||={};
  if(!Number.isFinite(Number(state.camera.x)))state.camera.x=0;
  if(!Number.isFinite(Number(state.camera.y)))state.camera.y=0;
  if(!Number.isFinite(Number(state.camera.zoom))||Number(state.camera.zoom)<=0)state.camera.zoom=1;
  if(!Number.isFinite(Number(state.camera.speed))||Number(state.camera.speed)<=0)state.camera.speed=config.camera.speed;
  return state.camera;
}
function wallPathLength(points){
  let total=0;for(let i=1;i<(points?.length||0);i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);return total;
}

export function createLegacyVisualGame(hostInput){
  const host=requireHost(hostInput),config=createGameConfig(),entities={},base={},debug={},camera={},selection={},options={},stateView={};
  const current=()=>host.getState();
  const legacyCamera=()=>ensureLegacyCamera(current(),config);

  for(const key of ['units','enemies','structures','terrain','depots','rivers','particles'])defineLiveProperty(entities,key,
    ()=>Array.isArray(current()?.[key])?current()[key]:[],value=>{const s=current();if(s)s[key]=Array.isArray(value)?value:[];});
  defineLiveProperty(entities,'projectiles',()=>[]);

  defineLiveProperty(base,'x',()=>numberOr(host.baseX));
  defineLiveProperty(base,'y',()=>numberOr(host.baseY));
  defineLiveProperty(base,'radius',()=>Math.max(0,numberOr(host.baseRadius)));
  defineLiveProperty(base,'hp',()=>numberOr(current()?.baseHp),v=>{const s=current();if(s)s.baseHp=numberOr(v);});
  defineLiveProperty(base,'maxHp',()=>Math.max(1,numberOr(current()?.maxBaseHp,1)),v=>{const s=current();if(s)s.maxBaseHp=Math.max(1,numberOr(v,1));});

  for(const key of ['x','y','zoom','speed'])defineLiveProperty(camera,key,()=>legacyCamera()[key],v=>{legacyCamera()[key]=numberOr(v,legacyCamera()[key]);});
  defineLiveProperty(debug,'unlimitedCash',()=>Boolean(current()?.debug?.unlimitedCash),v=>{const s=current();if(s){s.debug||={};s.debug.unlimitedCash=Boolean(v);}});
  defineLiveProperty(debug,'unlimitedLives',()=>Boolean(current()?.debug?.unlimitedLives),v=>{const s=current();if(s){s.debug||={};s.debug.unlimitedLives=Boolean(v);}});
  defineLiveProperty(debug,'allVision',()=>Boolean(current()?.debug?.allVision),v=>{const s=current();if(s){s.debug||={};s.debug.allVision=Boolean(v);}});
  defineLiveProperty(selection,'unitId',()=>current()?.selectedUnit?.id??null);
  defineLiveProperty(options,'enemyArrows',()=>current()?.v19Options?.enemyArrows!==false,v=>{const s=current();if(s){s.v19Options||={};s.v19Options.enemyArrows=Boolean(v);}});
  defineLiveProperty(options,'unitArrows',()=>current()?.v19Options?.unitArrows!==false,v=>{const s=current();if(s){s.v19Options||={};s.v19Options.unitArrows=Boolean(v);}});

  defineLiveProperty(stateView,'entities',()=>entities);
  defineLiveProperty(stateView,'base',()=>base);
  defineLiveProperty(stateView,'debug',()=>debug);
  defineLiveProperty(stateView,'view',()=>({camera}));
  defineLiveProperty(stateView,'selection',()=>selection);
  defineLiveProperty(stateView,'ui',()=>({options}));
  defineLiveProperty(stateView,'fog',()=>current()?.v7Fog??null,v=>{const s=current();if(s)s.v7Fog=v;});
  defineLiveProperty(stateView,'legacy',()=>current());

  const assets=createAssetRegistry({ImageCtor:null});
  if(host.firingSquadImage){
    assets.set(ASSET_KEYS.FIRING_SQUAD_SHEET,{
      id:ASSET_KEYS.FIRING_SQUAD_SHEET,
      ...ASSET_MANIFEST[ASSET_KEYS.FIRING_SQUAD_SHEET],
      image:host.firingSquadImage,
      status:'loaded',error:null,
    });
  }

  return {
    config,
    canvas:host.canvas||null,
    ctx:host.ctx||null,
    viewport:{width:numberOr(host.viewportWidth,config.viewport.width),height:numberOr(host.viewportHeight,config.viewport.height)},
    state:stateView,
    assets,
    services:{now:()=>typeof host.now==='function'?host.now():performance.now(),rendering:{}},
  };
}

function drawProjectiles(host,ctx){
  const state=host.getState();
  for(const b of state?.bullets||[]){
    if(!Number.isFinite(b?.x)||!Number.isFinite(b?.y))continue;
    ctx.strokeStyle=b.type==='laser'?'#ff5967':b.type==='antiair'?'#cceeff':b.type==='minigun'?'#ffe28a':b.type==='drone'?'#9fe8ff':'#fff0a0';
    ctx.lineWidth=b.type==='laser'?4:1.6;ctx.beginPath();ctx.moveTo(b.x-(Number(b.vx)||0)*.016,b.y-(Number(b.vy)||0)*.016);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  for(const b of state?.enemyBullets||[]){if(!Number.isFinite(b?.x)||!Number.isFinite(b?.y))continue;ctx.fillStyle='#9cff55';ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();}
  return true;
}
function drawParticles(host,ctx){
  for(const p of host.getState()?.particles||[]){if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))continue;ctx.globalAlpha=Math.max(0,Math.min(1,(Number(p.life)||0)/.45));ctx.fillStyle='#b9ff8a';ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;return true;
}
function drawPlayerMines(host,ctx){
  for(const m of host.getState()?.playerMines||[]){if(!Number.isFinite(m?.x)||!Number.isFinite(m?.y))continue;ctx.fillStyle='#71653b';ctx.beginPath();ctx.arc(m.x,m.y,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d8c474';ctx.lineWidth=1.5;for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.beginPath();ctx.moveTo(m.x+Math.cos(a)*6,m.y+Math.sin(a)*6);ctx.lineTo(m.x+Math.cos(a)*11,m.y+Math.sin(a)*11);ctx.stroke();}}
}
function effectAlpha(effect,now,span,min=.12){return Math.max(min,(Number(effect?.expires)-now)/span);}
function drawEffects(host,ctx,now){
  const state=host.getState();
  for(const f of state?.v17Effects||[]){const a=effectAlpha(f,now,190,.15);ctx.globalAlpha=a;if(f.kind==='rail'){ctx.strokeStyle='#bdefff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}else if(f.kind==='tesla'&&Array.isArray(f.points)){ctx.strokeStyle='#b59cff';ctx.lineWidth=3;for(let i=1;i<f.points.length;i++){const p=f.points[i-1],q=f.points[i];ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}else if(f.kind==='rocket'){ctx.strokeStyle='#ffad58';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(255,125,50,.25)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();}else if(f.kind==='heal'){ctx.strokeStyle='#80f2d3';ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}}
  for(const f of state?.v21Effects||[]){ctx.globalAlpha=effectAlpha(f,now,130);ctx.strokeStyle='#ff6f78';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#fff0f1';ctx.lineWidth=2;ctx.stroke();}
  for(const f of state?.v22Effects||[]){ctx.globalAlpha=effectAlpha(f,now,250);if(f.kind==='cryo'){ctx.strokeStyle='#8cecff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}else if(f.kind==='missile'){ctx.strokeStyle='#ffbf79';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(255,120,55,.22)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle=f.kind==='flak'?'rgba(190,225,255,.18)':'rgba(255,160,70,.20)';ctx.strokeStyle=f.kind==='flak'?'#d5f3ff':'#ff9d55';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r||24,0,Math.PI*2);ctx.fill();ctx.stroke();}}
  for(const f of state?.v24Effects||[]){ctx.globalAlpha=Math.min(1,effectAlpha(f,now,1000)*2.5);if(f.kind==='acid'){ctx.strokeStyle='#9dff4f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.quadraticCurveTo((f.x1+f.x2)/2,(f.y1+f.y2)/2-45,f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(130,255,60,.28)';ctx.beginPath();ctx.arc(f.x2,f.y2,18,0,Math.PI*2);ctx.fill();}else if(f.kind==='charge'){ctx.strokeStyle='#ffd35e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,34,0,Math.PI*2);ctx.stroke();}else if(f.kind==='impact'){ctx.fillStyle='rgba(255,120,65,.28)';ctx.strokeStyle='#ff8658';ctx.lineWidth=4;ctx.beginPath();ctx.arc(f.x,f.y,f.r||46,0,Math.PI*2);ctx.fill();ctx.stroke();}else{ctx.strokeStyle=f.kind==='emerge'?'#d7bd78':'#987443';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(f.x,f.y,24,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}}
  for(const f of state?.v25Effects||[]){ctx.globalAlpha=effectAlpha(f,now,260,.15);if(f.kind==='repair'){ctx.strokeStyle='#ffd65c';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}else if(f.kind==='trooperflame'){ctx.strokeStyle='#ff8a3d';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}else if(f.kind==='shipblast'){ctx.strokeStyle='#9fe8ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle='rgba(110,205,255,.22)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle='rgba(255,180,70,.27)';ctx.strokeStyle='#ffc061';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.r||24,0,Math.PI*2);ctx.fill();ctx.stroke();}}
  for(const f of state?.v26Effects||[]){ctx.globalAlpha=effectAlpha(f,now,260,.15);if(f.kind==='repairvehicle'){ctx.strokeStyle='#ffd55f';ctx.lineWidth=4;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}else{ctx.strokeStyle=f.kind==='artillery'?'#f0bf72':'#c8d7a3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.fillStyle=f.kind==='artillery'?'rgba(240,150,70,.24)':'rgba(190,205,130,.18)';ctx.beginPath();ctx.arc(f.x2,f.y2,f.r||30,0,Math.PI*2);ctx.fill();ctx.stroke();}}
  ctx.globalAlpha=1;ctx.setLineDash([]);
}
function drawWallDraft(host,ctx){
  const draft=host.getState()?.v6WallPlacement,path=Array.isArray(draft?.path)?draft.path:[];if(!path.length)return;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=draft.reviewOpen?'rgba(255,214,107,.72)':'rgba(99,232,137,.62)';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);if(draft.cursor&&!draft.reviewOpen)ctx.lineTo(draft.cursor.x,draft.cursor.y);ctx.stroke();
  const len=wallPathLength(path),p=path.at(-1);if(p){ctx.fillStyle='rgba(5,12,17,.9)';ctx.fillRect(p.x-74,p.y-34,148,20);ctx.fillStyle='#dff7e5';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(`${Math.round(len)}px · ${wallCost(len)} metal`,p.x,p.y-20);}ctx.restore();
}
function drawStorageOverlay(ctx,s){
  if(!s?.built||(s.type!=='refinery'&&s.type!=='landingpad'))return;
  const level=getStorageLevel(s),cap=getStorageCapacity(s),amount=s.type==='landingpad'?numberOr(s.crystalStored):numberOr(s.oreStored);
  ctx.save();ctx.translate(s.x,s.y);ctx.fillStyle='rgba(6,12,18,.92)';ctx.fillRect(-46,26,92,17);ctx.fillStyle='#e8f4ff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(`${level}/3 · ${Math.floor(amount)}/${cap}`,0,38);ctx.restore();
}
function drawScreen(host,ctx){
  const state=host.getState(),W=host.viewportWidth,H=host.viewportHeight;
  if(state?.debug?.unlimitedCash||state?.debug?.unlimitedLives){ctx.fillStyle='#7fe6ff';ctx.font='bold 13px Arial';ctx.textAlign='left';ctx.fillText(`DEBUG ${state.debug.unlimitedCash?'∞ CASH ':''}${state.debug.unlimitedLives?'∞ LIVES':''}`,14,H-14);}
  if(state?.paused&&!state?.gameOver){ctx.fillStyle='rgba(0,0,0,.36)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ffe36b';ctx.font='bold 48px Arial';ctx.textAlign='center';ctx.fillText('PAUSED',W/2,80);ctx.font='16px Arial';ctx.fillText('Orders and building placements can still be queued',W/2,108);}
  if(state?.gameOver){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.fillText('BASE LOST',W/2,H/2);ctx.font='20px Arial';ctx.fillText('Press RESTART to begin a new run',W/2,H/2+38);}
  return true;
}

export function installLegacyRenderingFogCameraBridge(hostInput){
  const host=requireHost(hostInput),game=createLegacyVisualGame(host);
  ensureLegacyCamera(host.getState(),game.config);

  game.services.rendering={
    createSurface:(w,h)=>typeof host.createSurface==='function'?host.createSurface(w,h):null,
    drawBackdrop:()=>{host.drawBackdrop?.();return true;},
    drawBase:()=>{host.drawBase?.();return true;},
    drawStructure:(_game,_ctx,s)=>{host.drawStructure?.(s);drawStorageOverlay(game.ctx,s);return true;},
    drawUnit:(_game,_ctx,u)=>{host.drawUnit?.(u);return true;},
    drawEnemy:(_game,_ctx,e)=>{host.drawEnemy?.(e);return true;},
    drawProjectiles:(_game,ctx)=>drawProjectiles(host,ctx),
    drawParticles:(_game,ctx)=>drawParticles(host,ctx),
    drawInteractionPreview:(_game,ctx)=>{drawPlayerMines(host,ctx);drawEffects(host,ctx,typeof host.now==='function'?host.now():performance.now());drawWallDraft(host,ctx);return true;},
    drawScreen:(_game,ctx)=>drawScreen(host,ctx),
  };

  const owners={
    draw(){return renderWorld(game,game.ctx);},
    updateCamera(dt){
      const state=host.getState();ensureLegacyCamera(state,game.config);
      updateCameraFromKeys(game,dt,typeof host.getKeys==='function'?host.getKeys():{});
      const now=typeof host.now==='function'?host.now():performance.now();
      refreshFog(game,{now});
      pruneExpiredVisualEffects(state,now,VISUAL_EFFECT_CHANNELS);
      host.updateCancelButtonPosition?.();
      return game.state.view.camera;
    },
    clampCamera(){return cleanClampCamera(game);},
    setZoom(next,sx,sy){const z=setCameraZoom(game,next,sx,sy);host.refreshZoomUi?.(z);host.updateCancelButtonPosition?.();return z;},
    zoomValue(){return getCameraZoom(game);},
    worldFromEvent(event){return cleanEventToWorld(game,event);},
    refreshFog({forceExplore=false}={}){return refreshFog(game,{forceExplore,now:typeof host.now==='function'?host.now():performance.now()});},
    pointVisible(x,y){return isPointVisible(game,x,y);},
  };

  // Seed clean visibility before the first clean frame. This is update-side state,
  // not a rendering side effect.
  owners.refreshFog({forceExplore:true});
  cleanClampCamera(game);host.refreshZoomUi?.(owners.zoomValue());

  const restore=host.installOwners(owners);
  const audit={
    id:MIGRATION_ID,active:true,
    renderingOwner:'js/rendering/renderer.js',
    fogOwner:'js/fog/fog.js',
    cameraOwner:'js/input/camera.js',
    assetOwner:'js/assets/assets.js',
    effectLifetimeOwner:'js/rendering/visualEffects.js (update-side)',
    detailedArtCompatibility:'read-only legacy primitive callbacks',
    inputOwner:'legacy-until-step8',
    frameOwner:'legacy-until-step8',
    legacyFallbackAvailable:typeof restore==='function',
  };
  if(typeof globalThis!=='undefined'){
    globalThis.__apdVisualMigration=audit;
    globalThis.__apdAudit={...(globalThis.__apdAudit||{}),renderingOwner:audit.renderingOwner,fogOwner:audit.fogOwner,cameraOwner:audit.cameraOwner,visualMigration:MIGRATION_ID};
  }
  host.markReady?.(audit);
  return {game,owners,restore,audit};
}
