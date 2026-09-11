// -----------------------------------------------------------------------------
// DRAWING: terrain, depots, new buildings, logistics labels.
// -----------------------------------------------------------------------------
function polyPath(pts){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();}
function scaledPoly(o,scale){return o.points.map(p=>({x:o.x+(p.x-o.x)*scale,y:o.y+(p.y-o.y)*scale}));}
drawBackdrop=function(){
 ctx.fillStyle='#10221b';ctx.fillRect(0,0,WORLD_W,WORLD_H);
 for(let i=0;i<430;i++){const x=(i*173+31)%WORLD_W,y=(i*97+19)%WORLD_H;ctx.fillStyle=i%5?'#244333':'#5ac99a';ctx.globalAlpha=i%5?.25:.08;ctx.fillRect(x,y,2+(i%3),2+(i%2));}ctx.globalAlpha=1;
 for(const o of state.terrain){
  if(o.kind==='lake'){
   polyPath(o.points);ctx.fillStyle='#17384a';ctx.fill();ctx.strokeStyle='#315f70';ctx.lineWidth=5;ctx.stroke();polyPath(scaledPoly(o,.78));ctx.fillStyle='#1f5064';ctx.globalAlpha=.72;ctx.fill();ctx.globalAlpha=1;
  }else if(o.kind==='hill'){
   polyPath(o.points);ctx.fillStyle='#3a4b32';ctx.fill();ctx.strokeStyle='#63704b';ctx.lineWidth=4;ctx.stroke();for(const sc of [.72,.45]){polyPath(scaledPoly(o,sc));ctx.strokeStyle='rgba(170,180,112,.28)';ctx.lineWidth=3;ctx.stroke();}
  }else{
   polyPath(o.points);ctx.fillStyle='#123b29';ctx.fill();ctx.strokeStyle='#245c3b';ctx.lineWidth=4;ctx.stroke();
   for(const t of o.decor){ctx.fillStyle='#0d251b';ctx.beginPath();ctx.arc(t.x,t.y+t.s*.35,t.s*.58,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2d7045';ctx.beginPath();ctx.moveTo(t.x,t.y-t.s);ctx.lineTo(t.x-t.s*.72,t.y+t.s*.55);ctx.lineTo(t.x+t.s*.72,t.y+t.s*.55);ctx.closePath();ctx.fill();}
  }
 }
 for(const d of state.depots)drawDepot(d);
};
drawDepot=function(d){
 ctx.save();ctx.translate(d.x,d.y);const crystal=d.resourceType==='crystal';
 ctx.fillStyle=crystal?'rgba(48,25,70,.82)':'rgba(60,48,34,.88)';ctx.beginPath();ctx.arc(0,0,d.r+7,0,Math.PI*2);ctx.fill();
 if(crystal){for(let i=0;i<7;i++){const a=i/7*Math.PI*2,rr=9+(i%3)*6;ctx.fillStyle=d.stock>0?'#b46cff':'#62556e';ctx.beginPath();ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr-13);ctx.lineTo(Math.cos(a)*rr-6,Math.sin(a)*rr+8);ctx.lineTo(Math.cos(a)*rr+6,Math.sin(a)*rr+8);ctx.closePath();ctx.fill();}}
 else{for(let i=0;i<8;i++){const a=i/8*Math.PI*2,rr=8+(i%3)*7;ctx.fillStyle=d.stock>0?'#b57848':'#63594f';ctx.beginPath();ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr,6+(i%2)*2,0,Math.PI*2);ctx.fill();}}
 ctx.fillStyle=crystal?'#e8d0ff':'#f2d3b5';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(`${crystal?'CRYSTAL':'ORE'} ${Math.ceil(d.stock)}`,0,d.r+19);ctx.restore();
};

const v15DrawStructureV16=drawStructure;
drawStructure=function(s){
 if(s.type!=='oremine'&&s.type!=='refinery'&&s.type!=='landingpad')return v15DrawStructureV16(s);
 if(!s.built){drawConstruction(s);return;}
 ctx.save();ctx.translate(s.x,s.y);
 if(s.type==='oremine'){
  ctx.fillStyle='#43372c';ctx.fillRect(-23,-19,46,38);ctx.strokeStyle='#c48958';ctx.lineWidth=2;ctx.strokeRect(-23,-19,46,38);ctx.fillStyle='#c98246';ctx.beginPath();ctx.moveTo(0,-30);ctx.lineTo(-11,-8);ctx.lineTo(11,-8);ctx.closePath();ctx.fill();ctx.fillStyle='#f0d0b4';ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText(`${Math.floor(s.stored)}/${CONFIG.ORE.MINE_STORAGE}`,0,31);
 }else if(s.type==='refinery'){
  ctx.fillStyle='#26313a';ctx.fillRect(-34,-25,68,50);ctx.strokeStyle='#8ca0ad';ctx.lineWidth=2;ctx.strokeRect(-34,-25,68,50);ctx.fillStyle='#9c633e';ctx.fillRect(-28,-18,17,34);ctx.fillStyle='#465967';ctx.beginPath();ctx.arc(17,-5,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e0c2a6';ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText(`ORE ${Math.floor(s.oreStored)}/${CONFIG.REFINERY.ORE_CAPACITY}`,0,38);
 }else{
  const r=CONFIG.LANDING_PAD.RADIUS;ctx.fillStyle='#1b2a36';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#74a2ba';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#d8e8ef';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-20,0);ctx.lineTo(20,0);ctx.moveTo(0,-20);ctx.lineTo(0,20);ctx.stroke();
  if(s.shipState==='landed'){ctx.fillStyle='#b8d0da';ctx.beginPath();ctx.moveTo(0,-31);ctx.lineTo(-18,13);ctx.lineTo(-8,10);ctx.lineTo(0,25);ctx.lineTo(8,10);ctx.lineTo(18,13);ctx.closePath();ctx.fill();ctx.fillStyle='#7fe6ff';ctx.fillRect(-4,-13,8,14);}
  ctx.fillStyle='#dce9ef';ctx.font='bold 9px Arial';ctx.textAlign='center';const status=s.shipState==='landed'?`SHIP ${Math.floor(s.shipCargo)}/${CONFIG.LANDING_PAD.SHIP_CAPACITY}`:`SHIP ${Math.ceil(s.shipCooldown)}s`;ctx.fillText(status,0,r+16);ctx.fillStyle='#cda9ff';ctx.fillText(`PAD ${Math.floor(s.crystalStored)} crystal`,0,r+28);
  if(s.landingFlash>0){ctx.strokeStyle=`rgba(255,80,80,${Math.min(1,s.landingFlash/1.3)})`;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,CONFIG.LANDING_PAD.ATTRACT_RADIUS*(1-s.landingFlash/2.5*.15),0,Math.PI*2);ctx.stroke();}
 }
 if(s.hp<s.maxHp){ctx.fillStyle='#111';ctx.fillRect(-25,-39,50,5);ctx.fillStyle='#ef6666';ctx.fillRect(-25,-39,50*Math.max(0,s.hp/s.maxHp),5);}ctx.restore();
};

const v15DrawUnitV16=drawUnit;
drawUnit=function(u){
 v15DrawUnitV16(u);if(u.type!=='truck'||!u.cargoType)return;ctx.save();ctx.translate(u.x,u.y);ctx.fillStyle=u.cargoType==='crystal'?'#d6adff':'#e0a36b';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(u.cargoType==='crystal'?'CRYSTAL':'ORE',0,31);ctx.restore();
};

// Correct v15's wall preview label from credits -> metal.
const v15DrawV16=draw;
draw=function(){
 v15DrawV16();
 if(wallDraft&&wallDraft.start){const end=wallDraft.pending?wallDraft.pending.b:(wallDraft.current||wallDraft.start),mx=(wallDraft.start.x+end.x)/2-state.camera.x,my=(wallDraft.start.y+end.y)/2-state.camera.y,len=Math.hypot(end.x-wallDraft.start.x,end.y-wallDraft.start.y);ctx.fillStyle='rgba(5,12,17,.9)';ctx.fillRect(mx-85,my-34,170,19);ctx.fillStyle='#d9eef5';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText(`${Math.round(len)}px · ${wallPrice(len)} metal`,mx,my-20);}
};

// -----------------------------------------------------------------------------
// HUD / RESET
// -----------------------------------------------------------------------------
const v15UpdateHudV16=updateHud;
updateHud=function(){v15UpdateHudV16();if(metalEl)metalEl.textContent=Math.floor(state.metal||0);};

const v15ResetV16=reset;
reset=function(){
 v15ResetV16();
 state.metal=CONFIG.GAME.STARTING_METAL;
 state.xp=0;state.nextXp=999999;state.xpLevel=1;state.choosing=false;els.overlay.classList.add('hidden');
 for(const u of state.units)if(u.type==='truck'&&u.cargoType===undefined)u.cargoType=null;
 els.message.textContent='Kill aliens for gold. Export crystal for gold. Refine ore into metal for towers and walls.';
 updateHud();
};
els.restart.onclick=reset;

// Rebuild the initial map using the new terrain/depot generators.
reset();
