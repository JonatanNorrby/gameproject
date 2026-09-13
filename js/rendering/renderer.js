import { MIGRATION_STATUS } from '../core/config.js';
import { getEnemyRadius, getUnitRadius } from '../core/entities.js';
import { ensureFogState, isPointVisible, FOG_EXPLORED_ALPHA, FOG_UNEXPLORED_ALPHA, FOG_REVEAL_FEATHER_START, FOG_REVEAL_OUTER_ALPHA } from '../fog/fog.js';
import { cameraWorldRect, circleNearView, pointNearView, segmentNearView, worldToScreen, isScreenPointVisible } from './culling.js';

export const RENDERING_SYSTEM_STATUS = MIGRATION_STATUS.MIGRATED;
export const RENDER_ORDER = Object.freeze(['backdrop','base','structures','units','enemies','projectiles','particles','indicators','fog','screen']);

function ctxCall(ctx, name, ...args) { if (typeof ctx?.[name] === 'function') return ctx[name](...args); }
function hook(game, name, ...args) { const fn = game?.services?.rendering?.[name]; return typeof fn === 'function' ? fn(game, ...args) : undefined; }
function viewport(game) { return game?.viewport || { width: game?.canvas?.width || 0, height: game?.canvas?.height || 0 }; }
function camera(game) { return game?.state?.view?.camera || { x: 0, y: 0, zoom: 1 }; }

function drawBackdrop(game, ctx) {
  if (hook(game, 'drawBackdrop', ctx) !== undefined) return;
  ctx.fillStyle = '#10221b'; ctx.fillRect(0, 0, game.config.world.width, game.config.world.height);
  for (const river of game.state.entities.rivers || []) {
    if (!river?.points?.length) continue;
    ctx.strokeStyle = '#1d5570'; ctx.lineWidth = Number(river.width) || 82; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(river.points[0].x, river.points[0].y); for (const p of river.points.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke();
  }
}

function drawBase(game, ctx) {
  if (hook(game, 'drawBase', ctx, game.state.base) !== undefined) return;
  const b = game.state.base; if (!b) return;
  ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = '#263a4c'; ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7895aa'; ctx.lineWidth = 8; ctx.stroke(); ctx.fillStyle = '#7bd6e8'; ctx.beginPath(); ctx.arc(0, 0, b.radius * .35, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawStructure(game, ctx, s) {
  if (hook(game, 'drawStructure', ctx, s) !== undefined) return;
  if (s.type === 'wall' && Number.isFinite(s.x1)) { ctx.strokeStyle = '#8aa6ba'; ctx.lineWidth = Number(s.thickness) || 12; ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke(); return; }
  ctx.save(); ctx.translate(s.x, s.y); ctx.fillStyle = s.built === false ? '#7e7048' : '#31485a'; ctx.fillRect(-20,-16,40,32); ctx.restore();
}

function drawUnit(game, ctx, u) {
  if (hook(game, 'drawUnit', ctx, u) !== undefined) return;
  if (u.transportedIn || u.garrisonedIn) return;
  let r = 20; try { r = getUnitRadius(u); } catch {}
  ctx.save(); ctx.translate(u.x,u.y); ctx.fillStyle = '#5d7387'; ctx.beginPath(); ctx.arc(0,0,Math.max(8,r*.65),0,Math.PI*2); ctx.fill(); ctx.restore();
}

function drawEnemy(game, ctx, e) {
  if (!isPointVisible(game,e.x,e.y)) return;
  if (hook(game, 'drawEnemy', ctx, e) !== undefined) return;
  let r = Number(e.r) || 8; try { r = Number(e.r) || getEnemyRadius(e); } catch {}
  ctx.save(); ctx.translate(e.x,e.y); ctx.fillStyle = e.type === 'spitter' ? '#8d72d8' : e.type === 'brute' ? '#9a526b' : '#75bb62'; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.restore();
}

function drawProjectiles(game, ctx) {
  if (hook(game, 'drawProjectiles', ctx) !== undefined) return;
  for (const p of game.state.entities.projectiles || []) {
    if (!pointNearView(game,p.x,p.y,40)) continue;
    if (p.team === 'enemy') { ctx.fillStyle='#9cff55'; ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill(); }
    else { ctx.strokeStyle=p.type==='laser'?'#ff5967':'#fff0a0'; ctx.lineWidth=p.type==='laser'?4:1.6; ctx.beginPath(); ctx.moveTo(p.x-p.vx*.016,p.y-p.vy*.016); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  }
}

function drawInteractionPreview(game, ctx) {
  if (hook(game, 'drawInteractionPreview', ctx) !== undefined) return;
  const commands = game.state.commands;
  if (commands?.buildType !== 'wall') return;
  const points = commands.wall?.path || [];
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = commands.wall.reviewOpen ? '#ffd66b' : '#72e3ff';
  ctx.lineWidth = 4;
  ctx.setLineDash?.([14, 8]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  const cursor = commands.wall?.cursor;
  if (cursor && !commands.wall.reviewOpen) ctx.lineTo(cursor.x, cursor.y);
  ctx.stroke();
  ctx.setLineDash?.([]);
  for (const point of points) {
    ctx.fillStyle = '#d9f8ff';
    ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function edgePoint(game, dx, dy, margin) {
  const v=viewport(game), cx=v.width/2, cy=v.height/2;
  const scale=Math.min((v.width/2-margin)/Math.max(1,Math.abs(dx)),(v.height/2-margin)/Math.max(1,Math.abs(dy)));
  return {x:cx+dx*scale,y:cy+dy*scale};
}

function drawArrow(ctx, point, angle, fill, { stroke = null, size = 12 } = {}) {
  ctx.save(); ctx.translate(point.x,point.y); ctx.rotate(angle); ctx.fillStyle=fill;
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;}
  ctx.beginPath(); ctx.moveTo(size,0); ctx.lineTo(-size*.58,-size*.58); ctx.lineTo(-size*.58,size*.58); ctx.closePath(); ctx.fill(); if(stroke)ctx.stroke(); ctx.restore();
}

function drawIndicators(game, ctx) {
  if (hook(game, 'drawIndicators', ctx) !== undefined) return;
  const options=game.state.ui?.options||{},v=viewport(game);
  if(options.unitArrows!==false){
    for(const u of game.state.entities.units||[]){
      if(Number(u.hp)<=0||u.transportedIn||u.garrisonedIn)continue;
      const p=worldToScreen(game,u.x,u.y);if(isScreenPointVisible(game,p.x,p.y))continue;
      const dx=p.x-v.width/2,dy=p.y-v.height/2,edge=edgePoint(game,dx,dy,28),a=Math.atan2(dy,dx);
      const selected=game.state.selection?.unitId===u.id,fill=selected?'#ffe47b':u.type==='truck'?'#d2a8ff':u.type==='airunit'?'#9fe8ff':'#7fe6ff';
      drawArrow(ctx,edge,a,fill,{size:12});
    }
  }
  if(options.enemyArrows===false)return;
  const sectors=Array.from({length:12},()=>({count:0,dx:0,dy:0,dist:Infinity}));
  for (const e of game.state.entities.enemies || []) {
    if (Number(e.hp)<=0 || !isPointVisible(game,e.x,e.y)) continue;
    const p=worldToScreen(game,e.x,e.y); if (isScreenPointVisible(game,p.x,p.y)) continue;
    const dx=p.x-v.width/2,dy=p.y-v.height/2,a=Math.atan2(dy,dx),idx=(Math.floor(((a+Math.PI)/(Math.PI*2))*12)+12)%12,d=dx*dx+dy*dy,s=sectors[idx];
    s.count++; if(d<s.dist){s.dist=d;s.dx=dx;s.dy=dy;}
  }
  for(const s of sectors){
    if(!s.count)continue;
    const p=edgePoint(game,s.dx,s.dy,36),a=Math.atan2(s.dy,s.dx);
    drawArrow(ctx,p,a,'#ff4f55',{stroke:'#450b0d',size:16});
    ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText?.(s.count,p.x,p.y+4);
  }
}

function createFogSurface(game) {
  const v=viewport(game), factory=game?.services?.rendering?.createSurface;
  if (typeof factory === 'function') return factory(v.width,v.height);
  if (typeof document !== 'undefined') { const c=document.createElement('canvas'); c.width=v.width;c.height=v.height;return c; }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(v.width,v.height);
  return null;
}

function drawFogFallback(game, ctx) {
  const fog=ensureFogState(game), {cellSize,cols,rows}=fog.grid, rect=cameraWorldRect(game), c0=Math.max(0,Math.floor(rect.x0/cellSize)),c1=Math.min(cols-1,Math.floor(rect.x1/cellSize)),r0=Math.max(0,Math.floor(rect.y0/cellSize)),r1=Math.min(rows-1,Math.floor(rect.y1/cellSize));
  for(let gy=r0;gy<=r1;gy++)for(let gx=c0;gx<=c1;gx++){const cx=gx*cellSize+cellSize/2,cy=gy*cellSize+cellSize/2;if(isPointVisible(game,cx,cy))continue;ctx.fillStyle=fog.explored[gy*cols+gx]?`rgba(1,7,11,${FOG_EXPLORED_ALPHA})`:`rgba(0,1,3,${FOG_UNEXPLORED_ALPHA})`;ctx.fillRect(gx*cellSize,gy*cellSize,cellSize+1,cellSize+1);}
}

export function drawFogOverlay(game, ctx) {
  if (game.state.debug?.allVision) return;
  if (hook(game,'drawFog',ctx)!==undefined)return;
  const surface=createFogSurface(game), fc=surface?.getContext?.('2d');
  if(!fc){drawFogFallback(game,ctx);return;}
  const v=viewport(game),cam=camera(game),z=Math.max(.0001,Number(cam.zoom)||1),fog=ensureFogState(game),{cellSize,cols,rows}=fog.grid,rect=cameraWorldRect(game),c0=Math.max(0,Math.floor(rect.x0/cellSize)-1),c1=Math.min(cols-1,Math.floor(rect.x1/cellSize)+1),r0=Math.max(0,Math.floor(rect.y0/cellSize)-1),r1=Math.min(rows-1,Math.floor(rect.y1/cellSize)+1);
  fc.setTransform(1,0,0,1,0,0);fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,v.width,v.height);fc.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);fc.fillStyle=`rgba(0,1,3,${FOG_UNEXPLORED_ALPHA})`;fc.fillRect(c0*cellSize,r0*cellSize,(c1-c0+1)*cellSize+2/z,(r1-r0+1)*cellSize+2/z);fc.fillStyle=`rgba(1,7,11,${FOG_EXPLORED_ALPHA})`;
  for(let gy=r0;gy<=r1;gy++){let run=-1;for(let gx=c0;gx<=c1+1;gx++){const ex=gx<=c1&&fog.explored[gy*cols+gx];if(ex&&run<0)run=gx;else if(!ex&&run>=0){fc.fillRect(run*cellSize,gy*cellSize,(gx-run)*cellSize+2/z,cellSize+2/z);run=-1;}}}
  fc.globalCompositeOperation='destination-out';fc.fillStyle='#000';for(const s of fog.visionSources){fc.globalAlpha=FOG_REVEAL_OUTER_ALPHA;fc.beginPath();fc.arc(s.x,s.y,s.r,0,Math.PI*2);fc.fill();fc.globalAlpha=1;fc.beginPath();fc.arc(s.x,s.y,s.r*FOG_REVEAL_FEATHER_START,0,Math.PI*2);fc.fill();}fc.globalAlpha=1;fc.globalCompositeOperation='source-over';fc.setTransform(1,0,0,1,0,0);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(surface,0,0);ctx.restore();
}

export function renderWorld(game, ctx = game?.ctx) {
  if (!game || !ctx) return { rendered: false, reason: 'no-context' };
  const cam=camera(game),z=Math.max(.0001,Number(cam.zoom)||1),entities=game.state.entities;
  ctx.clearRect(0,0,viewport(game).width,viewport(game).height);ctx.save();ctx.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);
  drawBackdrop(game,ctx);drawBase(game,ctx);
  for(const s of entities.structures||[]){if(s.type==='wall'?segmentNearView(game,s.x1,s.y1,s.x2,s.y2,720):pointNearView(game,s.x,s.y,720))drawStructure(game,ctx,s);}
  for(const u of entities.units||[]){let r=20;try{r=getUnitRadius(u);}catch{}if(circleNearView(game,u.x,u.y,r,250))drawUnit(game,ctx,u);}
  for(const e of entities.enemies||[]){let r=Number(e.r)||8;if(circleNearView(game,e.x,e.y,r,150))drawEnemy(game,ctx,e);}
  drawProjectiles(game,ctx);if(hook(game,'drawParticles',ctx)===undefined){for(const p of entities.particles||[]){if(!pointNearView(game,p.x,p.y,40))continue;ctx.fillStyle='#b9ff8a';ctx.fillRect(p.x,p.y,3,3);}}
  drawInteractionPreview(game,ctx);
  ctx.restore();drawIndicators(game,ctx);drawFogOverlay(game,ctx);hook(game,'drawScreen',ctx);return {rendered:true,order:RENDER_ORDER};
}

export function renderFrame(game, alpha = 0) { void alpha; return renderWorld(game,game?.ctx); }
