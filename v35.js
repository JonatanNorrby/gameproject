// Alien Planet Defense v35
// Integrates the EXISTING firing-squad sprite sheet supplied in chat.
// No image generation or replacement art: the original PNG is loaded directly
// and cropped at render time for idle, move and fire frames.
document.title='Alien Planet Defense v35';

const FIRING_SQUAD_SHEET=new Image();
FIRING_SQUAD_SHEET.decoding='async';
FIRING_SQUAD_SHEET.src='assets/firing_squad_sheet.png?v=35';

// Source rectangles in the original 1774x887 sheet. We deliberately crop the
// source image in canvas rather than creating derivative sprite files.
const V35_RIFLE_FRAMES={
 idle:[
  {x:170,y:300,w:130,h:155},{x:395,y:300,w:130,h:155},
  {x:620,y:300,w:130,h:155},{x:835,y:300,w:130,h:155}
 ],
 move:[
  {x:170,y:460,w:130,h:165},{x:395,y:460,w:130,h:165},
  {x:620,y:460,w:130,h:165},{x:835,y:460,w:130,h:165}
 ],
 fire:[
  {x:155,y:640,w:210,h:170},{x:380,y:640,w:210,h:170},
  {x:605,y:640,w:210,h:170},{x:830,y:640,w:210,h:170}
 ]
};

const V35_SQUAD_OFFSETS=[[-16,-13],[16,-13],[-16,14],[16,14],[0,-27],[0,28]];

function v35RiflemanTarget(u){
 try{
  const cfg=typeof roleConfig==='function'?roleConfig(u):CONFIG.SOLDIER;
  const range=Number(cfg?.RANGE)||CONFIG.SOLDIER.RANGE;
  return typeof findTarget==='function'?findTarget(u.x,u.y,range):null;
 }catch{return null;}
}

function v35DrawRifleSprite(frame,dx,dy,angle,stateName){
 ctx.save();
 ctx.translate(dx,dy);
 // The sheet's rifle points approximately to world-right. Rotation happens only
 // in code so the exact supplied pixels remain untouched.
 ctx.rotate(angle||0);
 const h=stateName==='move'?35:stateName==='fire'?34:34;
 const w=h*(frame.w/frame.h);
 ctx.drawImage(FIRING_SQUAD_SHEET,frame.x,frame.y,frame.w,frame.h,-w*.48,-h*.53,w,h);
 ctx.restore();
}

function v35DrawRiflemanSquad(u){
 if(u.garrisonedIn)return;
 ctx.save();ctx.translate(u.x,u.y);

 // Preserve the existing RTS movement-order line.
 if(u.path&&u.path.length){
  ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(96,225,255,.8)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,0);for(const p of u.path)ctx.lineTo(p.x-u.x,p.y-u.y);ctx.stroke();ctx.restore();
 }

 const moving=!!(u.path&&u.path.length);
 const target=moving?null:v35RiflemanTarget(u);
 const stateName=moving?'move':target?'fire':'idle';
 const frames=V35_RIFLE_FRAMES[stateName];
 const speedMs=stateName==='fire'?105:stateName==='move'?145:290;
 const baseFrame=Math.floor(performance.now()/speedMs);
 let facing=Number(u.heading)||0;
 if(target)facing=Math.atan2(target.y-u.y,target.x-u.x);

 const cfg=typeof roleConfig==='function'?roleConfig(u):CONFIG.SOLDIER;
 const members=Math.max(1,Math.min(V35_SQUAD_OFFSETS.length,Number(cfg?.MEMBERS)||CONFIG.SOLDIER.MEMBERS||4));
 for(let i=0;i<members;i++){
  const raw=V35_SQUAD_OFFSETS[i];
  // Rotate the formation with the squad so movement/aim direction reads clearly.
  const c=Math.cos(facing),s=Math.sin(facing);
  const ox=raw[0]*c-raw[1]*s,oy=raw[0]*s+raw[1]*c;
  const frame=frames[(baseFrame+i)%frames.length];
  v35DrawRifleSprite(frame,ox,oy,facing,stateName);
 }

 // Retain existing gameplay overlays instead of baking UI into the sprite art.
 if(u.attachedTo){ctx.strokeStyle='#d2a8ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.stroke();}
 if(state.selectedUnit===u){
  ctx.strokeStyle='#ffe47b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#f7eaa5';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('RIFLEMAN SQUAD',0,-45);
 }
 if(u.hp<u.maxHp){
  ctx.fillStyle='#111';ctx.fillRect(-27,39,54,5);
  ctx.fillStyle='#ef6666';ctx.fillRect(-27,39,54*Math.max(0,u.hp/u.maxHp),5);
 }
 ctx.restore();
}

// Only Rifleman squads are changed. Every other unit keeps its current renderer.
const v34DrawUnitV35=drawUnit;
drawUnit=function(u){
 const role=typeof unitRole==='function'?unitRole(u):(u.role||u.type);
 if(role!=='rifleman'||!FIRING_SQUAD_SHEET.complete||!FIRING_SQUAD_SHEET.naturalWidth)return v34DrawUnitV35(u);
 return v35DrawRiflemanSquad(u);
};

FIRING_SQUAD_SHEET.onerror=()=>console.error('v35: failed to load assets/firing_squad_sheet.png');
