function drawBackdrop(){
 const th=stageTheme();
 ctx.fillStyle=th.ground;ctx.fillRect(0,0,W,H);
 for(let i=0;i<140;i++){
   const x=(i*173+state.stage*31)%W,y=(i*97+state.stage*19)%680;
   ctx.fillStyle=i%4?th.patch:th.accent;ctx.globalAlpha=i%4?.55:.2;
   ctx.fillRect(x,y,1+(i%4),1+(i%3));
 }
 ctx.globalAlpha=1;
 ctx.strokeStyle=th.path;ctx.lineWidth=55;
 ctx.beginPath();ctx.moveTo(W*.18,0);ctx.bezierCurveTo(W*.32,230,W*.65,380,W*.48,BASE_Y);ctx.stroke();
 ctx.beginPath();ctx.moveTo(W*.82,0);ctx.bezierCurveTo(W*.65,190,W*.38,360,W*.55,BASE_Y);ctx.stroke();

 // Natural terrain: these are real collision/building obstacles, not just decoration.
 for(const o of state.terrain){
   if(o.kind==="rock"){
     ctx.fillStyle="#27302d";ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();
     ctx.fillStyle="#3b4943";ctx.beginPath();ctx.arc(o.x-o.r*.22,o.y-o.r*.24,o.r*.62,0,Math.PI*2);ctx.fill();
   }else{
     ctx.fillStyle="#1f3431";ctx.beginPath();ctx.arc(o.x,o.y,o.r*.8,0,Math.PI*2);ctx.fill();
     ctx.fillStyle=th.accent;ctx.globalAlpha=.72;
     ctx.beginPath();ctx.moveTo(o.x,o.y-o.r);ctx.lineTo(o.x-o.r*.35,o.y+o.r*.45);ctx.lineTo(o.x+o.r*.35,o.y+o.r*.45);ctx.closePath();ctx.fill();
     ctx.globalAlpha=1;
   }
 }
}
function drawBase(){
 ctx.fillStyle="#263a4c";ctx.fillRect(0,BASE_Y,W,H-BASE_Y);
 ctx.fillStyle="#6d8799";ctx.fillRect(0,BASE_Y,W,5);
 ctx.fillStyle="#7895aa";ctx.fillRect(W*.36,BASE_Y+20,W*.28,55);
 ctx.fillStyle="#182b3d";ctx.fillRect(W*.38,BASE_Y+10,W*.24,18);
 ctx.fillStyle="#7bd6e8";ctx.fillRect(W*.43,BASE_Y+34,W*.14,22);
 ctx.fillStyle="#07121d";ctx.font="bold 20px Arial";ctx.textAlign="center";ctx.fillText("FORWARD BASE",W/2,BASE_Y+52);
}
function drawTower(t){
 ctx.save();ctx.translate(t.x,t.y);

 if(state.showReach&&t.type!=="blockade"){
   let r=t.range||0;if(t.type==="flame")r*=state.mods.flameRange;
   ctx.strokeStyle=t.protected?"rgba(90,240,255,.32)":"rgba(255,255,255,.22)";
   ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
 }
 if(t.protected){
   ctx.strokeStyle="rgba(90,235,255,.8)";ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.stroke();
 }
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
 }else if(t.type==="laser"){
   ctx.fillStyle="#281d26";ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#ff5c67";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#ff7a83";ctx.fillRect(-4,-20,8,25);
 }else{
   ctx.fillStyle="#33231a";ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#ff8b32";ctx.fillRect(-5,-20,10,20);ctx.fillStyle="#ffd36a";ctx.beginPath();ctx.arc(0,-23,6,0,Math.PI*2);ctx.fill();
 }
 if(t.hp<t.maxHp){
   ctx.fillStyle="#111";ctx.fillRect(-22,27,44,4);
   ctx.fillStyle="#ef6666";ctx.fillRect(-22,27,44*Math.max(0,t.hp/t.maxHp),4);
 }
 ctx.restore();
}
function drawVehicle(){
 const v=state.vehicle;ctx.save();ctx.translate(v.x,v.y);ctx.rotate(v.angle);
 ctx.fillStyle="#25394b";ctx.fillRect(-15,-10,30,20);
 ctx.fillStyle="#6b879b";ctx.fillRect(-8,-12,16,24);
 ctx.fillStyle="#101820";ctx.fillRect(-18,-12,6,7);ctx.fillRect(12,-12,6,7);ctx.fillRect(-18,5,6,7);ctx.fillRect(12,5,6,7);
 ctx.fillStyle="#7fe6ff";ctx.fillRect(4,-2,18,4);
 ctx.restore();
}
function drawEnemy(e){
 ctx.save();
 ctx.translate(e.x,e.y);

 // Small fast aliens use the supplied Skitter sprite strip.
 if((e.type==="swarm"||e.type==="runner") && SKITTER_MOVE.complete && SKITTER_MOVE.naturalWidth){
   const frameCount=6;
   const frame=Math.floor(performance.now()/95 + e.animOffset)%frameCount;
   const drawSize=e.type==="runner" ? 34 : 27;

   ctx.globalAlpha=.24;
   ctx.fillStyle="#000";
   ctx.beginPath();
   ctx.ellipse(0,drawSize*.25,drawSize*.36,drawSize*.14,0,0,Math.PI*2);
   ctx.fill();
   ctx.globalAlpha=1;

   ctx.drawImage(
     SKITTER_MOVE,
     frame*SKITTER_FRAME_SIZE,0,SKITTER_FRAME_SIZE,SKITTER_FRAME_SIZE,
     -drawSize/2,-drawSize/2,drawSize,drawSize
   );

   if(e.burn>0){
     ctx.strokeStyle="#ff9b32";
     ctx.lineWidth=2;
     ctx.beginPath();
     ctx.arc(0,0,drawSize*.36,0,Math.PI*2);
     ctx.stroke();
   }

 // Big Brute now uses the actual supplied Brute artwork.
 }else if(e.type==="brute" && BRUTE_SPRITE.complete && BRUTE_SPRITE.naturalWidth){
   const drawSize=72;

   ctx.globalAlpha=.28;
   ctx.fillStyle="#000";
   ctx.beginPath();
   ctx.ellipse(0,drawSize*.27,drawSize*.35,drawSize*.16,0,0,Math.PI*2);
   ctx.fill();
   ctx.globalAlpha=1;

   // Gentle bob makes the static top-down art feel alive without distorting it.
   const bob=Math.sin(performance.now()/170 + e.animOffset)*1.2;
   ctx.drawImage(BRUTE_SPRITE,-drawSize/2,-drawSize/2+bob,drawSize,drawSize);

   if(e.burn>0){
     ctx.strokeStyle="#ff9b32";
     ctx.lineWidth=3;
     ctx.beginPath();
     ctx.arc(0,0,drawSize*.34,0,Math.PI*2);
     ctx.stroke();
   }

 }else{
   // Temporary fallback art for the ranged Spitter or if an image has not loaded yet.
   ctx.fillStyle=e.type==="spitter"?"#8d72d8":"#75bb62";
   ctx.beginPath();
   ctx.arc(0,0,e.r,0,Math.PI*2);
   ctx.fill();

   if(e.r>=6){
     ctx.fillStyle=e.type==="spitter"?"#a8ff5c":"#d9ffcb";
     ctx.beginPath();
     ctx.arc(-e.r*.35,-e.r*.2,Math.max(1.1,e.r*.18),0,Math.PI*2);
     ctx.arc(e.r*.35,-e.r*.2,Math.max(1.1,e.r*.18),0,Math.PI*2);
     ctx.fill();
   }
   if(e.burn>0){
     ctx.strokeStyle="#ff9b32";
     ctx.lineWidth=2;
     ctx.beginPath();
     ctx.arc(0,0,e.r+3,0,Math.PI*2);
     ctx.stroke();
   }
 }

 if(e.hp<e.maxHp){
   const barWidth=e.type==="brute"?54:Math.max(18,e.r*2);
   const barY=e.type==="brute"?-39:-e.r-9;
   ctx.fillStyle="#111";
   ctx.fillRect(-barWidth/2,barY,barWidth,4);
   ctx.fillStyle="#ef6666";
   ctx.fillRect(-barWidth/2,barY,barWidth*Math.max(0,e.hp/e.maxHp),4);
 }
 ctx.restore();
}

function draw(){
 drawBackdrop();drawBase();
 for(const s of state.safeSpots){
   ctx.fillStyle=s.occupied?"rgba(60,180,205,.24)":"rgba(60,220,245,.16)";
   ctx.strokeStyle=s.occupied?"#4eb6ce":"#72e6ff";ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(s.x,s.y,CONFIG.SAFE_SPOT.RADIUS,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.beginPath();ctx.arc(s.x,s.y,CONFIG.SAFE_SPOT.RADIUS*.55,0,Math.PI*2);ctx.stroke();
 }
 for(const t of state.towers)drawTower(t);drawVehicle();for(const e of state.enemies)drawEnemy(e);
 for(const b of state.bullets){ctx.strokeStyle=b.type==="laser"?"#ff5967":b.type==="pulse"?"#6ff5ff":b.type==="vehicle"?"#ffe49a":"#fff0a0";ctx.lineWidth=b.type==="laser"?4:b.type==="pulse"?3:1.6;ctx.beginPath();ctx.moveTo(b.x-b.vx*.016,b.y-b.vy*.016);ctx.lineTo(b.x,b.y);ctx.stroke()}
 for(const b of state.enemyBullets){ctx.fillStyle="#9cff55";ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill()}
 for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/.5);ctx.fillStyle=p.kind==="fire"?"#ff9a3c":"#b9ff8a";ctx.fillRect(p.x,p.y,3,3);ctx.globalAlpha=1}
 if(totalActiveWaves()>1){ctx.fillStyle="rgba(255,210,90,.9)";ctx.font="bold 15px Arial";ctx.textAlign="left";ctx.fillText(`MULTI-WAVE BONUS ×${(1+(totalActiveWaves()-1)*state.mods.stackBonus).toFixed(2)}`,18,28)}
}
function loop(now){const dt=Math.min(.033,(now-state.last)/1000);state.last=now;update(dt);draw();requestAnimationFrame(loop)}
reset();requestAnimationFrame(loop);
