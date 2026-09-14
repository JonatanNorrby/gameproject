import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createLegacyVisualGame,
  installLegacyRenderingFogCameraBridge,
} from '../js/migration/renderingFogCameraLegacyBridge.js';
import { pruneExpiredVisualEffects } from '../js/rendering/visualEffects.js';

function fakeContext(){
  const fn=()=>{};
  return {save:fn,restore:fn,setTransform:fn,clearRect:fn,fillRect:fn,strokeRect:fn,translate:fn,rotate:fn,beginPath:fn,arc:fn,fill:fn,stroke:fn,moveTo:fn,lineTo:fn,quadraticCurveTo:fn,drawImage:fn,setLineDash:fn,fillText:fn,closePath:fn};
}
function makeState(){
  return {
    baseHp:300,maxBaseHp:300,
    units:[],enemies:[],structures:[],terrain:[],depots:[],rivers:[],particles:[],
    bullets:[],enemyBullets:[],playerMines:[],
    v17Effects:[],v21Effects:[],v22Effects:[],v24Effects:[],v25Effects:[],v26Effects:[],
    camera:{x:0,y:0,zoom:1,speed:1200},
    debug:{unlimitedCash:false,unlimitedLives:false,allVision:false},
    v19Options:{enemyArrows:true,unitArrows:true},
    selectedUnit:null,paused:false,gameOver:false,
  };
}
function harness(initial=makeState()){
  let state=initial,now=1000,installed=null,audit=null;
  const draws={backdrop:0,base:0,structure:0,unit:0,enemy:0};
  const canvas={clientWidth:1280,clientHeight:800,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800})};
  const host={
    baseX:5060,baseY:3795,baseRadius:68,viewportWidth:1280,viewportHeight:800,
    canvas,ctx:fakeContext(),getState:()=>state,getKeys:()=>({}),now:()=>now,createSurface:()=>null,
    installOwners(owners){installed=owners;return()=>{};},
    drawBackdrop(){draws.backdrop++;},drawBase(){draws.base++;},drawStructure(){draws.structure++;},drawUnit(){draws.unit++;},drawEnemy(){draws.enemy++;},
    refreshZoomUi(){},updateCancelButtonPosition(){},markReady(value){audit=value;},
  };
  return {host,draws,get state(){return state;},replace(next){state=next;},setNow(value){now=value;},get installed(){return installed;},get audit(){return audit;}};
}
function install(h=harness()){const bridge=installLegacyRenderingFogCameraBridge(h.host);return{h,...bridge};}

test('Step 7 installs one clean owner for rendering, fog, camera and visual-effect lifetime',()=>{
  const {h,owners,audit}=install();
  assert.equal(h.installed,owners);assert.equal(h.audit,audit);assert.equal(audit.active,true);
  assert.equal(audit.renderingOwner,'js/rendering/renderer.js');
  assert.equal(audit.fogOwner,'js/fog/fog.js');
  assert.equal(audit.cameraOwner,'js/input/camera.js');
  assert.equal(audit.assetOwner,'js/assets/assets.js');
  assert.match(audit.effectLifetimeOwner,/update-side/);
  for(const key of ['draw','updateCamera','clampCamera','setZoom','zoomValue','worldFromEvent','refreshFog','pointVisible'])assert.equal(typeof owners[key],'function');
});

test('visual update prunes expired effects before rendering and draw itself is state-read-only',()=>{
  const {h,owners}=install();
  h.state.v17Effects=[{kind:'rail',expires:900,x1:0,y1:0,x2:1,y2:1},{kind:'rail',expires:1200,x1:0,y1:0,x2:1,y2:1}];
  h.setNow(1000);owners.updateCamera(0);assert.equal(h.state.v17Effects.length,1);assert.equal(h.state.v17Effects[0].expires,1200);
  const explored=[...h.state.v7Fog.explored],effects=h.state.v17Effects;
  owners.draw();assert.equal(h.state.v17Effects,effects);assert.deepEqual([...h.state.v7Fog.explored],explored);
});

test('visual-effect lifecycle removes expired and invalid timestamps but preserves future effects',()=>{
  const state={v21Effects:[{expires:999},{expires:1001},{expires:null},{expires:'bad'}]};
  assert.equal(pruneExpiredVisualEffects(state,1000,['v21Effects']),3);
  assert.deepEqual(state.v21Effects,[{expires:1001}]);
});

test('production visibility is clean-fog owned before detailed enemy art callback runs',()=>{
  const {h,owners}=install();
  h.state.enemies.push({id:'e1',type:'ravager',x:200,y:200,hp:50,maxHp:50,r:12});
  owners.refreshFog({forceExplore:true});owners.draw();assert.equal(h.draws.enemy,0);
  h.state.debug.allVision=true;owners.refreshFog({forceExplore:true});owners.draw();assert.equal(h.draws.enemy,1);
});

test('clean camera preserves zoom-at-cursor and clamps world bounds',()=>{
  const {h,owners}=install();
  h.state.camera={x:100,y:100,zoom:1,speed:1200};
  const worldBefore={x:100+200,y:100+100};owners.setZoom(2,200,100);
  assert.equal(h.state.camera.x,200);assert.equal(h.state.camera.y,150);
  assert.equal(h.state.camera.x+200/2,worldBefore.x);assert.equal(h.state.camera.y+100/2,worldBefore.y);
  h.state.camera.x=99999;h.state.camera.y=99999;owners.clampCamera();
  assert.ok(h.state.camera.x<=10120-1280/2);assert.ok(h.state.camera.y<=7590-800/2);
});

test('pointer world conversion uses the same clean camera transform as rendering',()=>{
  const {h,owners}=install();h.state.camera={x:50,y:75,zoom:.5,speed:1200};
  assert.deepEqual(owners.worldFromEvent({clientX:640,clientY:400}),{x:1330,y:875,sx:640,sy:400});
});

test('Step 7 bridge follows complete legacy state replacement after Restart',()=>{
  const h=harness(),{game,owners}=install(h);const old=h.state;
  const next=makeState();next.camera={x:300,y:400,zoom:.8,speed:1200};h.replace(next);
  owners.setZoom(1,640,400);assert.notEqual(next.camera.zoom,.8);assert.equal(old.camera.zoom,1);
  assert.equal(game.state.entities.units,next.units);assert.equal(game.state.legacy,next);
  owners.refreshFog({forceExplore:true});assert.ok(next.v7Fog);assert.equal(old.v7Fog!==next.v7Fog,true);
});

test('clean asset registry adopts the already-loaded production firing squad image when available',()=>{
  const h=harness(),image={naturalWidth:1774,naturalHeight:887};h.host.firingSquadImage=image;
  const game=createLegacyVisualGame(h.host),entry=game.assets.get('firing-squad-sheet');
  assert.equal(entry.image,image);assert.equal(entry.status,'loaded');assert.equal(entry.src,'firing_squad_sheet.png');
});

test('Step 7 host intercepts wheel zoom before the unremovable v51 canvas listener',async()=>{
  const source=await readFile(new URL('../js/migration/renderingFogCameraLegacyHost.js',import.meta.url),'utf8');
  assert.match(source,/window\.addEventListener\('wheel',wheelCapture/);
  assert.match(source,/e\?\.target!==canvas/);
  assert.match(source,/stopImmediatePropagation/);
});
