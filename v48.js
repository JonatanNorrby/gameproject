// Alien Planet Defense v48
// Navigation reliability + guaranteed zoom controls + fixed-position unit deselect.
const V48_TITLE='Alien Planet Defense v48';
document.title=V48_TITLE;
window.addEventListener('load',()=>{document.title=V48_TITLE;},{once:true});

(function installV48NavigationAndControls(){
  if(window.__apdV48Installed)return;
  window.__apdV48Installed=true;

  // ---------------------------------------------------------------------------
  // NAVIGATION
  // Forests and hills are traversable. Lakes, resource depots, the Base,
  // buildings and Walls remain physical blockers. A binary-heap A* replaces the
  // old repeatedly-sorted open list so long orders across the 10k x 7.6k map are
  // both reliable and substantially cheaper.
  // ---------------------------------------------------------------------------
  const NAV_CELL=Math.max(36,Math.min(48,Number(CONFIG.PATHFINDING?.CELL_SIZE)||48));
  const NAV_COLS=Math.ceil(WORLD_W/NAV_CELL),NAV_ROWS=Math.ceil(WORLD_H/NAV_CELL);
  const NAV_MAX=Math.max(NAV_COLS*NAV_ROWS+32,Number(CONFIG.PATHFINDING?.MAX_VISITED)||50000);

  function terrainBlocksUnit(x,y,r){
    for(const o of state.terrain||[]){
      // Forests and hills are normal walkable terrain. Lakes remain obstacles.
      if(o?.kind&&o.kind!=='lake')continue;
      try{
        if(Array.isArray(o?.points)&&typeof polyDistance==='function'){
          if(polyDistance(x,y,o.points)<=r+2)return true;
        }else if(Number.isFinite(o?.x)&&Number.isFinite(o?.r)){
          if(Math.hypot(x-o.x,y-o.y)<o.r+r+2)return true;
        }
      }catch{}
    }
    return false;
  }

  function navBlockedV48(x,y,r){
    r=Math.max(4,Number(r)||18);
    if(x<r+5||y<r+5||x>WORLD_W-r-5||y>WORLD_H-r-5)return true;
    if(Math.hypot(x-BASE_X,y-BASE_Y)<BASE_RADIUS+r+4)return true;
    if(terrainBlocksUnit(x,y,r))return true;
    for(const d of state.depots||[]){
      if(!Number.isFinite(d?.x)||!Number.isFinite(d?.y))continue;
      if(Math.hypot(x-d.x,y-d.y)<(Number(d.r)||34)+r+2)return true;
    }
    for(const s of state.structures||[]){
      if(!s||s.hp<=0||s.type==='safespot'||s.type==='bunker')continue;
      if(s.type==='wall'&&Number.isFinite(s.x1)&&Number.isFinite(s.y1)&&Number.isFinite(s.x2)&&Number.isFinite(s.y2)){
        const thick=typeof wallThickness==='function'?(Number(wallThickness(s))||Number(s.thickness)||12):(Number(s.thickness)||12);
        if(typeof pointSegmentDistance==='function'&&pointSegmentDistance(x,y,s.x1,s.y1,s.x2,s.y2)<thick/2+r+3)return true;
      }else if(Number.isFinite(s.x)&&Number.isFinite(s.y)){
        let sr=28;try{if(typeof structureRadius==='function')sr=Number(structureRadius(s))||sr;}catch{}
        if(Math.hypot(x-s.x,y-s.y)<sr+r+3)return true;
      }
    }
    return false;
  }
  navPointBlocked=navBlockedV48;

  function segmentOpen(ax,ay,bx,by,r){
    const d=Math.hypot(bx-ax,by-ay);
    if(d<1)return !navBlockedV48(bx,by,r);
    const step=Math.max(12,NAV_CELL*.42),n=Math.max(1,Math.ceil(d/step));
    for(let i=1;i<=n;i++){
      const t=i/n,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
      if(navBlockedV48(x,y,r))return false;
    }
    return true;
  }

  class MinHeap{
    constructor(){this.a=[];}
    push(n){const a=this.a;a.push(n);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p;}a[i]=n;}
    pop(){const a=this.a;if(!a.length)return null;const root=a[0],last=a.pop();if(a.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=a.length)break;let c=r<a.length&&a[r].f<a[l].f?r:l;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return root;}
    get length(){return this.a.length;}
  }

  const idx=(x,y)=>y*NAV_COLS+x;
  const cx=x=>Math.min(WORLD_W-6,x*NAV_CELL+NAV_CELL/2);
  const cy=y=>Math.min(WORLD_H-6,y*NAV_CELL+NAV_CELL/2);
  function cellForPoint(x,y){return{x:Math.max(0,Math.min(NAV_COLS-1,Math.floor(x/NAV_CELL))),y:Math.max(0,Math.min(NAV_ROWS-1,Math.floor(y/NAV_CELL)))};}
  function nearestOpenGoal(gx,gy,r){
    const g=cellForPoint(gx,gy);let best=null,bd=Infinity;
    for(let ring=0;ring<=7;ring++){
      for(let oy=-ring;oy<=ring;oy++)for(let ox=-ring;ox<=ring;ox++){
        if(ring&&Math.max(Math.abs(ox),Math.abs(oy))!==ring)continue;
        const x=g.x+ox,y=g.y+oy;if(x<0||y<0||x>=NAV_COLS||y>=NAV_ROWS)continue;
        const wx=cx(x),wy=cy(y);if(navBlockedV48(wx,wy,r))continue;
        const d=(wx-gx)*(wx-gx)+(wy-gy)*(wy-gy);if(d<bd){bd=d;best={x,y};}
      }
      if(best)return best;
    }
    return null;
  }

  function smoothPath(sx,sy,path,r){
    if(path.length<2)return path;
    const out=[];let ax=sx,ay=sy,i=0;
    while(i<path.length){
      let best=i;
      for(let j=path.length-1;j>=i;j--){const p=path[j];if(segmentOpen(ax,ay,p.x,p.y,r)){best=j;break;}}
      const p=path[best];out.push(p);ax=p.x;ay=p.y;i=best+1;
    }
    return out;
  }

  function findPathV48(sx,sy,gx,gy,r){
    r=Math.max(4,Number(r)||18);
    // Most orders need no search at all.
    if(!navBlockedV48(gx,gy,r)&&segmentOpen(sx,sy,gx,gy,r))return[{x:gx,y:gy}];
    const start=cellForPoint(sx,sy),goal=nearestOpenGoal(gx,gy,r);if(!goal)return[];
    const total=NAV_COLS*NAV_ROWS,startI=idx(start.x,start.y),goalI=idx(goal.x,goal.y);
    const gScore=new Float64Array(total);gScore.fill(Infinity);gScore[startI]=0;
    const came=new Int32Array(total);came.fill(-1);
    const closed=new Uint8Array(total),heap=new MinHeap();
    const h0=Math.hypot(goal.x-start.x,goal.y-start.y);heap.push({i:startI,x:start.x,y:start.y,g:0,f:h0});
    const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.41421356237],[1,-1,1.41421356237],[-1,1,1.41421356237],[-1,-1,1.41421356237]];
    let visited=0,found=-1;
    while(heap.length&&visited++<NAV_MAX){
      const cur=heap.pop();if(!cur||closed[cur.i])continue;closed[cur.i]=1;if(cur.i===goalI){found=cur.i;break;}
      for(const [dx,dy,cost] of dirs){
        const nx=cur.x+dx,ny=cur.y+dy;if(nx<0||ny<0||nx>=NAV_COLS||ny>=NAV_ROWS)continue;
        const ni=idx(nx,ny);if(closed[ni])continue;
        const wx=cx(nx),wy=cy(ny);if(ni!==goalI&&navBlockedV48(wx,wy,r))continue;
        // Prevent diagonal corner cutting through buildings/lakes/walls.
        if(dx&&dy){const ax=cx(cur.x+dx),ay=cy(cur.y),bx=cx(cur.x),by=cy(cur.y+dy);if(navBlockedV48(ax,ay,r)||navBlockedV48(bx,by,r))continue;}
        const ng=cur.g+cost;if(ng>=gScore[ni])continue;gScore[ni]=ng;came[ni]=cur.i;
        heap.push({i:ni,x:nx,y:ny,g:ng,f:ng+Math.hypot(goal.x-nx,goal.y-ny)});
      }
    }
    if(found<0)return[];
    const rev=[];let cur=found;
    while(cur!==startI&&cur>=0){const x=cur%NAV_COLS,y=(cur/NAV_COLS)|0;rev.push({x:cx(x),y:cy(y)});cur=came[cur];}
    rev.reverse();
    if(!navBlockedV48(gx,gy,r)&&segmentOpen(rev.length?rev[rev.length-1].x:sx,rev.length?rev[rev.length-1].y:sy,gx,gy,r))rev.push({x:gx,y:gy});
    return smoothPath(sx,sy,rev,r);
  }
  findPath=findPathV48;

  setUnitDestination=function(u,x,y,opt={}){
    if(!u||!Number.isFinite(x)||!Number.isFinite(y))return false;
    let air=false;try{air=typeof isFlyingUnit==='function'&&isFlyingUnit(u);}catch{air=u.type==='airunit';}
    const r=typeof uRadius==='function'?(Number(uRadius(u))||18):18;
    if(air){
      if(x<r+5||y<r+5||x>WORLD_W-r-5||y>WORLD_H-r-5){if(els?.message)els.message.textContent='Destination is outside the map.';return false;}
      u.path=[{x,y}];u.moveTarget={x,y};return true;
    }
    if(navBlockedV48(x,y,r)){if(els?.message)els.message.textContent='That destination is physically blocked.';return false;}
    const path=findPathV48(u.x,u.y,x,y,r);
    if(!path.length){if(els?.message)els.message.textContent='No open route to that destination.';return false;}
    u.path=path;u.moveTarget={x,y};if(u.type==='truck'&&!opt.preserveRoute){u.routeActive=false;u.routeLoop=false;}return true;
  };

  // ---------------------------------------------------------------------------
  // GUARANTEED MAP ZOOM CONTROLS
  // v36 previously guaranteed these with inline styles. After consolidating the
  // late patch stack, restore that guarantee without reloading the old runtime.
  // ---------------------------------------------------------------------------
  function zoomV48(){return Math.max(Number(CONFIG.WORLD.MIN_ZOOM)||.18,Math.min(Number(CONFIG.WORLD.MAX_ZOOM)||1.35,Number(state?.camera?.zoom)||1));}
  function refreshZoomControls(){
    const z=zoomV48(),min=Number(CONFIG.WORLD.MIN_ZOOM)||.18,max=Number(CONFIG.WORLD.MAX_ZOOM)||1.35;
    const label=document.getElementById('mapZoomLabel'),out=document.getElementById('mapZoomOutBtn'),inn=document.getElementById('mapZoomInBtn');
    if(label)label.textContent=`${Math.round(z*100)}%`;if(out)out.disabled=z<=min+.0001;if(inn)inn.disabled=z>=max-.0001;
    try{if(typeof zoomLabel!=='undefined'&&zoomLabel)zoomLabel.textContent=`${Math.round(z*100)}%`;if(typeof zoomOutBtn!=='undefined'&&zoomOutBtn)zoomOutBtn.disabled=z<=min+.0001;if(typeof zoomInBtn!=='undefined'&&zoomInBtn)zoomInBtn.disabled=z>=max-.0001;}catch{}
  }
  function installZoomControls(){
    let box=document.getElementById('mapZoomControls');
    if(!box){box=document.createElement('div');box.id='mapZoomControls';box.setAttribute('aria-label','Map zoom controls');box.innerHTML='<button id="mapZoomOutBtn" type="button" aria-label="Zoom out">−</button><span id="mapZoomLabel">100%</span><button id="mapZoomInBtn" type="button" aria-label="Zoom in">+</button>';(document.getElementById('canvasShell')||document.body).appendChild(box);}
    Object.assign(box.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'116',display:'flex',visibility:'visible',opacity:'1',alignItems:'center',gap:'6px',padding:'7px',border:'2px solid rgba(112,214,255,.92)',borderRadius:'11px',background:'rgba(4,14,22,.94)',boxShadow:'0 5px 22px rgba(0,0,0,.55)',pointerEvents:'auto'});
    const label=box.querySelector('#mapZoomLabel'),out=box.querySelector('#mapZoomOutBtn'),inn=box.querySelector('#mapZoomInBtn');
    if(label)Object.assign(label.style,{minWidth:'54px',height:'46px',display:'flex',alignItems:'center',justifyContent:'center',font:'900 12px Arial',color:'#effaff',pointerEvents:'none'});
    for(const b of [out,inn])if(b){Object.assign(b.style,{width:'48px',height:'48px',minWidth:'48px',padding:'0',border:'1px solid #7db7d5',borderRadius:'8px',background:'#123247',color:'#fff',font:'900 30px/1 Arial',cursor:'pointer',touchAction:'manipulation'});b.onpointerdown=e=>e.stopPropagation();b.onpointerup=e=>e.stopPropagation();}
    if(out)out.onclick=e=>{e.preventDefault();e.stopPropagation();setZoom(zoomV48()-(Number(CONFIG.WORLD.ZOOM_STEP)||.10),W/2,H/2);refreshZoomControls();};
    if(inn)inn.onclick=e=>{e.preventDefault();e.stopPropagation();setZoom(zoomV48()+(Number(CONFIG.WORLD.ZOOM_STEP)||.10),W/2,H/2);refreshZoomControls();};
    refreshZoomControls();
  }
  try{updateZoomLabel=refreshZoomControls;}catch{}
  installZoomControls();
  window.addEventListener('resize',()=>{installZoomControls();refreshZoomControls();},{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{installZoomControls();refreshZoomControls();},80),{passive:true});

  // ---------------------------------------------------------------------------
  // UNIT DESELECT
  // Keep the X in one predictable bottom-center location and make Escape the
  // desktop quick-deselect shortcut.
  // ---------------------------------------------------------------------------
  const cancel=els?.cancelUnit||document.getElementById('cancelUnitBtn');
  function clearSelectedUnit(){
    if(!state?.selectedUnit)return false;
    state.selectedUnit=null;state.routeEditing=false;state.attachMode=false;state.platoonAttachMode=false;
    state.v47MedicAttachMode=false;state.v47ApcAttachMode=false;
    if(cancel)cancel.classList.remove('visible');
    if(els?.message)els.message.textContent='Unit deselected.';
    if(typeof updateHud==='function')updateHud();
    return true;
  }
  if(cancel){
    Object.assign(cancel.style,{position:'fixed',left:'50%',right:'auto',top:'auto',bottom:'18px',transform:'translateX(-50%)',zIndex:'117',width:'50px',height:'50px',borderRadius:'50%',pointerEvents:'auto'});
    cancel.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();clearSelectedUnit();};
  }
  updateCancelButtonPosition=function(){
    if(!cancel)return;
    const show=!!state?.selectedUnit&&!state.selectedUnit.garrisonedIn&&!state.selectedUnit.transportedIn;
    cancel.classList.toggle('visible',show);
    cancel.style.position='fixed';cancel.style.left='50%';cancel.style.right='auto';cancel.style.top='auto';cancel.style.bottom='18px';cancel.style.transform='translateX(-50%)';
  };
  window.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!state?.selectedUnit)return;
    e.preventDefault();e.stopImmediatePropagation();clearSelectedUnit();
  },true);

  const hudBeforeV48=updateHud;
  updateHud=function(){const r=hudBeforeV48();updateCancelButtonPosition();refreshZoomControls();return r;};
  updateCancelButtonPosition();
  refreshZoomControls();

  window.__apdAudit={...(window.__apdAudit||{}),version:48,navigation:'heap-a-star-walkable-forest-hills',zoomControls:'guaranteed',unitDeselect:'bottom-center+escape'};
})();
