import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/core/game.js';
import { createAssetRegistry, ASSET_KEYS, ASSET_MANIFEST } from '../js/assets/assets.js';
import {
  ensureFogState, refreshFog, isPointVisible, isPointExplored,
  unitVisionRadius, structureVisionRadius,
  FOG_EXPLORED_ALPHA, FOG_UNEXPLORED_ALPHA,
} from '../js/fog/fog.js';
import { cameraWorldRect, pointNearView, worldToScreen } from '../js/rendering/culling.js';
import { renderWorld, RENDER_ORDER } from '../js/rendering/renderer.js';

function unit(role,x,y){return {id:`u-${role}`,type:role==='combatdrone'||role==='combatship'?'airunit':'soldier',role,x,y,hp:100,maxHp:100};}
function fakeContext(){
  const fn=()=>{};
  return {save:fn,restore:fn,setTransform:fn,clearRect:fn,fillRect:fn,strokeRect:fn,translate:fn,rotate:fn,beginPath:fn,arc:fn,fill:fn,stroke:fn,moveTo:fn,lineTo:fn,drawImage:fn,setLineDash:fn,fillText:fn,createRadialGradient:()=>({addColorStop:fn})};
}

test('final v47 fog radii are canonical in the clean runtime',()=>{
  const game=createGame();
  assert.equal(game.config.fog.cellSize,96);
  assert.equal(game.config.fog.baseVision,390);
  assert.equal(unitVisionRadius(game,unit('scout',0,0)),460);
  assert.equal(unitVisionRadius(game,unit('spotter',0,0)),440);
  assert.equal(unitVisionRadius(game,unit('sniper',0,0)),520);
  assert.equal(unitVisionRadius(game,unit('combatdrone',0,0)),350);
  assert.equal(unitVisionRadius(game,unit('rifleman',0,0)),290);
  assert.equal(structureVisionRadius(game,{type:'laser',built:true,hp:100,level:1}),455);
  assert.equal(structureVisionRadius(game,{type:'landingpad',built:true,hp:100}),330);
  assert.equal(structureVisionRadius(game,{type:'refinery',built:true,hp:100}),275);
  assert.equal(structureVisionRadius(game,{type:'mine',built:true,hp:100}),210);
  assert.equal(structureVisionRadius(game,{type:'wall',built:true,hp:100}),0);
});

test('exploration persists while current visibility follows live sources',()=>{
  let now=0; const game=createGame({now:()=>now});
  const scout=unit('scout',1200,1200); game.state.entities.units.push(scout);
  refreshFog(game,{forceExplore:true,now});
  assert.equal(isPointVisible(game,1200,1200),true);
  assert.equal(isPointExplored(game,1200,1200),true);
  scout.x=2200;scout.y=2200;now=150;refreshFog(game,{now});
  assert.equal(isPointVisible(game,1200,1200),false);
  assert.equal(isPointExplored(game,1200,1200),true);
  assert.equal(isPointVisible(game,2200,2200),true);
});

test('exploration marking is throttled to the final 120ms cadence while sources refresh immediately',()=>{
  let now=0; const game=createGame({now:()=>now}); const scout=unit('scout',1000,1000);game.state.entities.units.push(scout);
  refreshFog(game,{forceExplore:true,now}); scout.x=3000;scout.y=3000;now=50;refreshFog(game,{now});
  assert.equal(isPointVisible(game,3000,3000),true);
  assert.equal(isPointExplored(game,3000,3000),false);
  now=121;refreshFog(game,{now});assert.equal(isPointExplored(game,3000,3000),true);
});

test('allVision bypass reveals and explores the whole fog grid',()=>{
  const game=createGame();game.state.debug.allVision=true;refreshFog(game,{forceExplore:true,now:0});
  assert.equal(isPointVisible(game,5,5),true);assert.equal(isPointExplored(game,5,5),true);
  assert.ok(ensureFogState(game).explored.every(v=>v===1));
});

test('fog overlay constants preserve the final v47 opacity values',()=>{
  assert.equal(FOG_EXPLORED_ALPHA,.62);assert.equal(FOG_UNEXPLORED_ALPHA,.985);
});

test('camera culling uses zoom-aware world bounds',()=>{
  const game=createGame();game.viewport={width:1000,height:500};game.state.view.camera={x:100,y:200,zoom:.5};
  assert.deepEqual(cameraWorldRect(game,0),{x0:100,y0:200,x1:2100,y1:1200,zoom:.5});
  assert.equal(pointNearView(game,2050,1100,0),true);assert.equal(pointNearView(game,2200,1100,0),false);
  assert.deepEqual(worldToScreen(game,1100,700),{x:500,y:250});
});

test('renderer suppresses enemies outside current fog visibility before draw hooks',()=>{
  let enemyDraws=0; const rendering={drawEnemy:()=>{enemyDraws++;return true;},drawBackdrop:()=>true,drawBase:()=>true,drawProjectiles:()=>true,drawParticles:()=>true,drawIndicators:()=>true,drawFog:()=>true,drawScreen:()=>true};
  const game=createGame({services:{rendering}});game.ctx=fakeContext();game.viewport={width:1280,height:800};
  game.state.view.camera={x:0,y:0,zoom:1};game.state.entities.enemies.push({type:'ravager',x:200,y:200,hp:10,maxHp:10,r:10});
  refreshFog(game,{forceExplore:true,now:0});renderWorld(game,game.ctx);assert.equal(enemyDraws,0);
  game.state.entities.units.push(unit('scout',200,200));refreshFog(game,{forceExplore:true,now:200});renderWorld(game,game.ctx);assert.equal(enemyDraws,1);
});

test('renderer exposes final world-to-fog-to-screen ordering',()=>{
  assert.deepEqual(RENDER_ORDER,['backdrop','base','structures','units','enemies','projectiles','particles','indicators','fog','screen']);
});

test('asset registry owns exactly the two tracked sprite PNGs and is Node-safe',async()=>{
  assert.deepEqual(Object.keys(ASSET_MANIFEST).sort(),[ASSET_KEYS.MECH_STRIDER,ASSET_KEYS.RIFLE_SOLDIER].sort());
  assert.equal(ASSET_MANIFEST[ASSET_KEYS.RIFLE_SOLDIER].src,'rifle_soldier.png');
  assert.equal(ASSET_MANIFEST[ASSET_KEYS.MECH_STRIDER].src,'mech_strider.png');
  const registry=createAssetRegistry({ImageCtor:null});const entries=await registry.loadAll();
  assert.equal(entries.length,2);assert.ok(entries.every(entry=>entry.status==='unsupported'&&entry.image===null));
});
