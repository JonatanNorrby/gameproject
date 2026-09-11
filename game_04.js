function drawBackdrop(){
 const th=stageTheme();
 ctx.fillStyle=th.ground;ctx.fillRect(0,0,WORLD_W,WORLD_H);
 for(let i=0;i<520;i++){
   const x=(i*173+31)%WORLD_W,y=(i*97+19)%WORLD_H;
   ctx.fillStyle=i%4?th.patch:th.accent;ctx.globalAlpha=i%4?.42:.14;
   ctx.fillRect(x,y,1+(i%4),1+(i%3));
 }
 ctx.globalAlpha=1;
 for(const o of state.terrain){
   if(o.kind==="rock"){
     ctx.fillStyle="#27302d";ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();
     ctx.fillStyle="#3b4943";ctx.beginPath();ctx.arc(o.x-o.r*.22,o.y-o.r*.24,o.r*.62,0,Math.PI*2);ctx.fill();
   }else{
     ctx.fillStyle="#1f3431";ctx.beginPath();ctx.arc(o.x,o.y,o.r*.8,0,Math.PI*2);ctx.fill();
     ctx.fillStyle=th.accent;ctx.globalAlpha=.72;ctx.beginPath();ctx.moveTo(o.x,o.y-o.r);ctx.lineTo(o.x-o.r*.35,o.y+o.r*.45);ctx.lineTo(o.x+o.r*.35,o.y+o.r*.45);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
   }
 }
}
function drawBase(){
 const hpRatio=Math.max(0,state.baseHp/state.maxBaseHp);
 ctx.save();ctx.translate(BASE_X,BASE_Y);
 ctx.fillStyle="#182b3d";ctx.beginPath();ctx.arc(0,0,BASE_RADIUS+10,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#7895aa";ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,BASE_RADIUS,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle="#263a4c";ctx.beginPath();ctx.arc(0,0,BASE_RADIUS-7,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#7bd6e8";ctx.globalAlpha=.75;ctx.beginPath();ctx.arc(0,0,BASE_RADIUS*.35,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 const bw=150,bh=12,y=-BASE_RADIUS-38;
 ctx.fillStyle="rgba(5,10,16,.88)";ctx.fillRect(-bw/2-8,y-22,bw+16,42);
 ctx.fillStyle="#eaf7ff";ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.fillText(state.debug.unlimitedLives?"BASE ∞ HP":`BASE ${Math.ceil(state.baseHp)} / ${state.maxBaseHp}`,0,y-6);
 ctx.fillStyle="#111";ctx.fillRect(-bw/2,y+2,bw,bh);
 ctx.fillStyle=state.debug.unlimitedLives?"#67e8ff":hpRatio>.5?"#59d878":hpRatio>.25?"#f0c65a":"#ef6666";ctx.fillRect(-bw/2,y+2,bw*(state.debug.unlimitedLives?1:hpRatio),bh);
 ctx.strokeStyle="#9eb6c8";ctx.lineWidth=1;ctx.strokeRect(-bw/2,y+2,bw,bh);
 ctx.restore();
}
function drawTower(t){
 ctx.save();ctx.translate(t.x,t.y);

 if(t.type==="soldier"&&t.moveTarget){
   ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle="rgba(96,225,255,.8)";ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(t.moveTarget.x-t.x,t.moveTarget.y-t.y);ctx.stroke();ctx.restore();
 }
 if(state.showReach&&t.type!=="blockade"){
   let r=t.range||0;if(t.type==="flame")r*=state.mods.flameRange;
   ctx.strokeStyle=t.protected?"rgba(90,240,255,.32)":"rgba(255,255,255,.22)";
   ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
 }
 if(t.protected){ctx.strokeStyle="rgba(90,235,255,.8)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.stroke();}

 if(t.type==="blockade"){
   ctx.fillStyle="#263442";ctx.fillRect(-t.w/2,-t.h/2,t.w,t.h);
   ctx.strokeStyle="#8aa6ba";ctx.lineWidth=2;ctx.strokeRect(-t.w/2,-t.h/2,t.w,t.h);
   ctx.fillStyle="#5e7890";ctx.fillRect(-t.w/2+7,-4,t.w-14,8);
   ctx.fillStyle="#73e4ff";ctx.fillRect(-t.w/2+10,-2,8,4);
   ctx.fillStyle="#111";ctx.fillRect(-t.w/2,-t.h/2-8,t.w,3);
   ctx.fillStyle="#ef6666";ctx.fillRect(-t.w/2,-t.h/2-8,t.w*Math.max(0,t.hp/t.maxHp),3);
   ctx.restore();return;
 }
 if(t.type==="soldier"){
   ctx.fillStyle="#172b3d";ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.fill();
   const count=CONFIG.SOLDIER.MEMBERS+state.mods.extraSoldiers;
   for(let i=0;i<count;i++){
     const base=SOLDIER_OFFSETS[i%6],ring=Math.floor(i/6),sx=base[0]*(1+ring*.65),sy=base[1]*(1+ring*.65);
     ctx.fillStyle="#c4d0d9";ctx.beginPath();ctx.arc(sx,sy-5,3.1,0,Math.PI*2);ctx.fill();
     ctx.fillStyle="#5d7387";ctx.fillRect(sx-3,sy-2,6,8);
     ctx.strokeStyle="#e4f5ff";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(sx+2,sy);ctx.lineTo(sx+8,sy-4);ctx.stroke();
   }
   if(state.selectedSquad===t){ctx.strokeStyle="#ffe47b";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.stroke();}
 }else if(t.type==="laser"){
   ctx.fillStyle="#281d26";ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#ff5c67";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#ff7a83";ctx.fillRect(-4,-20,8,25);
 }else{
   ctx.fillStyle="#33231a";ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#ff8b32";ctx.fillRect(-5,-20,10,20);ctx.fillStyle="#ffd36a";ctx.beginPath();ctx.arc(0,-23,6,0,Math.PI*2);ctx.fill();
 }
 if(t.hp<t.maxHp){ctx.fillStyle="#111";ctx.fillRect(-22,27,44,4);ctx.fillStyle="#ef6666";ctx.fillRect(-22,27,44*Math.max(0,t.hp/t.maxHp),4);}
 ctx.restore();
}
function drawEnemy(e){
 ctx.save();ctx.translate(e.x,e.y);
 if((e.type==="swarm"||e.type==="runner")&&SKITTER_MOVE.complete&&SKITTER_MOVE.naturalWidth){
   const frameCount=6,frame=Math.floor(performance.now()/95+e.animOffset)%frameCount,drawSize=e.type==="runner"?34:27;
   ctx.globalAlpha=.24;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(0,drawSize*.25,drawSize*.36,drawSize*.14,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
   ctx.drawImage(SKITTER_MOVE,frame*SKITTER_FRAME_SIZE,0,SKITTER_FRAME_SIZE,SKITTER_FRAME_SIZE,-drawSize/2,-drawSize/2,drawSize,drawSize);
   if(e.burn>0){ctx.strokeStyle="#ff9b32";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,drawSize*.36,0,Math.PI*2);ctx.stroke();}
 }else if(e.type==="brute"&&BRUTE_SPRITE.complete&&BRUTE_SPRITE.naturalWidth){
   const drawSize=72;ctx.globalAlpha=.28;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(0,drawSize*.27,drawSize*.35,drawSize*.16,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
   const bob=Math.sin(performance.now()/170+e.animOffset)*1.2;ctx.drawImage(BRUTE_SPRITE,-drawSize/2,-drawSize/2+bob,drawSize,drawSize);
   if(e.burn>0){ctx.strokeStyle="#ff9b32";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,drawSize*.34,0,Math.PI*2);ctx.stroke();}
 }else{
   ctx.fillStyle=e.type==="spitter"?"#8d72d8":"#75bb62";ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();
   if(e.r>=6){ctx.fillStyle=e.type==="spitter"?"#a8ff5c":"#d9ffcb";ctx.beginPath();ctx.arc(-e.r*.35,-e.r*.2,Math.max(1.1,e.r*.18),0,Math.PI*2);ctx.arc(e.r*.35,-e.r*.2,Math.max(1.1,e.r*.18),0,Math.PI*2);ctx.fill();}
   if(e.burn>0){ctx.strokeStyle="#ff9b32";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.r+3,0,Math.PI*2);ctx.stroke();}
 }
 if(e.hp<e.maxHp){const barWidth=e.type==="brute"?54:Math.max(18,e.r*2),barY=e.type==="brute"?-39:-e.r-9;ctx.fillStyle="#111";ctx.fillRect(-barWidth/2,barY,barWidth,4);ctx.fillStyle="#ef6666";ctx.fillRect(-barWidth/2,barY,barWidth*Math.max(0,e.hp/e.maxHp),4);}
 ctx.restore();
}

function drawOffscreenSquadIndicators(){
 for(const t of state.towers){
  if(t.type!=="soldier")continue;
  const sx=t.x-state.camera.x,sy=t.y-state.camera.y;
  if(sx>=0&&sx<=W&&sy>=0&&sy<=H)continue;
  const cx=W/2,cy=H/2,dx=sx-cx,dy=sy-cy,margin=28;
  const scale=Math.min((W/2-margin)/Math.max(1,Math.abs(dx)),(H/2-margin)/Math.max(1,Math.abs(dy)));
  const ix=cx+dx*scale,iy=cy+dy*scale,a=Math.atan2(dy,dx);
  ctx.save();ctx.translate(ix,iy);ctx.rotate(a);
  ctx.fillStyle=state.selectedSquad===t?"#ffe47b":"#7fe6ff";
  ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle="#07121d";ctx.beginPath();ctx.arc(ix,iy,3.5,0,Math.PI*2);ctx.fill();
 }
}

function draw(){
 ctx.clearRect(0,0,W,H);
 ctx.save();ctx.translate(-state.camera.x,-state.camera.y);
 drawBackdrop();drawBase();
 for(const s of state.safeSpots){ctx.fillStyle=s.occupied?"rgba(60,180,205,.24)":"rgba(60,220,245,.16)";ctx.strokeStyle=s.occupied?"#4eb6ce":"#72e6ff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y,CONFIG.SAFE_SPOT.RADIUS,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(s.x,s.y,CONFIG.SAFE_SPOT.RADIUS*.55,0,Math.PI*2);ctx.stroke();}
 for(const t of state.towers)drawTower(t);
 for(const e of state.enemies)drawEnemy(e);
 for(const b of state.bullets){ctx.strokeStyle=b.type==="laser"?"#ff5967":"#fff0a0";ctx.lineWidth=b.type==="laser"?4:1.6;ctx.beginPath();ctx.moveTo(b.x-b.vx*.016,b.y-b.vy*.016);ctx.lineTo(b.x,b.y);ctx.stroke()}
 for(const b of state.enemyBullets){ctx.fillStyle="#9cff55";ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill()}
 for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/.5);ctx.fillStyle=p.kind==="fire"?"#ff9a3c":"#b9ff8a";ctx.fillRect(p.x,p.y,3,3);ctx.globalAlpha=1}
 ctx.restore();

 drawOffscreenSquadIndicators();
 if(totalActiveWaves()>1){ctx.fillStyle="rgba(255,210,90,.9)";ctx.font="bold 15px Arial";ctx.textAlign="left";ctx.fillText(`MULTI-WAVE BONUS ×${(1+(totalActiveWaves()-1)*state.mods.stackBonus).toFixed(2)}`,18,28)}
 if(state.debug.unlimitedCash||state.debug.unlimitedLives){ctx.fillStyle="rgba(110,230,255,.92)";ctx.font="bold 13px Arial";ctx.textAlign="left";ctx.fillText(`DEBUG: ${state.debug.unlimitedCash?"∞ CASH ":""}${state.debug.unlimitedLives?"∞ LIVES":""}`,18,H-16);}
 ctx.fillStyle="rgba(225,240,250,.65)";ctx.font="12px Arial";ctx.textAlign="right";ctx.fillText("Arrow keys: camera   Click Fire Squad → click destination",W-16,H-16);
}
function loop(now){
 const dt=Math.min(.033,(now-state.last)/1000);state.last=now;
 update(dt);
 if(state.debug&&state.debug.unlimitedLives){state.gameOver=false;state.baseHp=state.maxBaseHp;}
 draw();requestAnimationFrame(loop);
}
reset();requestAnimationFrame(loop);
