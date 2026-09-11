// Alien Planet Defense v45
// Existing-art integration only: replaces the procedural central Base artwork with
// the exact supplied Main Base sprite already uploaded to the repository root.
// No replacement art is generated and gameplay/collision values are untouched.
const V45_TITLE='Alien Planet Defense v45';
document.title=V45_TITLE;
window.addEventListener('load',()=>{document.title=V45_TITLE;},{once:true});

(function installV45MainBaseSprite(){
  const SOURCE_W=1536,SOURCE_H=1024;
  // Runtime crop only. The source file itself is never altered.
  const CROP={x:45,y:1,w:1455,h:976};
  const WORLD_W_PX=230;
  const WORLD_H_PX=WORLD_W_PX*(CROP.h/CROP.w);
  const CANDIDATES=[
    // Exact PNG the user uploaded directly to the repository root.
    'A2D31210-1B7B-4D4F-9C2D-0740047D4008.png?v=46',
    // Friendly root-name fallbacks in case the same existing asset is renamed later.
    'main_base.png?v=46',
    'main_base.jpeg?v=46',
    'main_base.jpg?v=46',
    'assets/main_base.png?v=46',
    'assets/main_base.jpeg?v=46',
    'assets/main_base.jpg?v=46'
  ];

  const img=new Image();
  img.decoding='async';
  let ready=false,processed=null,candidateIndex=0,loadedPath='';

  function backgroundPixel(d,i){
    const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
    if(a<16)return false;
    const lo=Math.min(r,g,b),hi=Math.max(r,g,b);
    // Only near-neutral, near-white pixels CONNECTED TO AN IMAGE EDGE are removed
    // when the source has an opaque white backdrop. Existing PNG transparency and
    // interior white armour details are preserved.
    return lo>=235&&(hi-lo)<=24;
  }

  function prepareSource(source){
    const c=document.createElement('canvas');c.width=SOURCE_W;c.height=SOURCE_H;
    const g=c.getContext('2d',{willReadFrequently:true});
    g.drawImage(source,0,0,SOURCE_W,SOURCE_H);
    const im=g.getImageData(0,0,SOURCE_W,SOURCE_H),d=im.data,n=SOURCE_W*SOURCE_H;

    // If the PNG already contains meaningful transparency, use those pixels as-is
    // and do not reinterpret/redraw the supplied sprite.
    for(let x=0;x<SOURCE_W;x+=8){
      if(d[(x)*4+3]<250||d[((SOURCE_H-1)*SOURCE_W+x)*4+3]<250)return source;
    }
    for(let y=0;y<SOURCE_H;y+=8){
      if(d[(y*SOURCE_W)*4+3]<250||d[(y*SOURCE_W+SOURCE_W-1)*4+3]<250)return source;
    }

    // Opaque white-background version: remove only edge-connected near-white
    // backdrop pixels at runtime. The repository image itself remains unchanged.
    const seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
    const push=(p)=>{if(p<0||p>=n||seen[p])return;const i=p*4;if(!backgroundPixel(d,i))return;seen[p]=1;queue[tail++]=p;};
    for(let x=0;x<SOURCE_W;x++){push(x);push((SOURCE_H-1)*SOURCE_W+x);}
    for(let y=1;y<SOURCE_H-1;y++){push(y*SOURCE_W);push(y*SOURCE_W+SOURCE_W-1);}
    while(head<tail){const p=queue[head++],x=p%SOURCE_W,y=(p/SOURCE_W)|0;
      if(x>0)push(p-1);if(x+1<SOURCE_W)push(p+1);if(y>0)push(p-SOURCE_W);if(y+1<SOURCE_H)push(p+SOURCE_W);
    }
    for(let p=0;p<n;p++)if(seen[p])d[p*4+3]=0;
    g.putImageData(im,0,0);return c;
  }

  function tryCandidate(){
    if(candidateIndex>=CANDIDATES.length){
      console.warn('v45: Main Base sprite not found; keeping procedural Base fallback.');
      return;
    }
    loadedPath=CANDIDATES[candidateIndex++];
    img.src=loadedPath;
  }
  img.onload=()=>{
    if(img.naturalWidth!==SOURCE_W||img.naturalHeight!==SOURCE_H){
      console.warn(`v45: ignoring Main Base candidate ${loadedPath} with unexpected dimensions ${img.naturalWidth}x${img.naturalHeight}; expected ${SOURCE_W}x${SOURCE_H}.`);
      tryCandidate();return;
    }
    try{
      processed=prepareSource(img);ready=true;
      window.__apdMainBaseSpriteReady=true;
      window.__apdMainBaseSpritePath=loadedPath.split('?')[0];
    }catch(err){
      console.error('v45: could not prepare supplied Main Base sprite',err);
      processed=null;ready=false;tryCandidate();
    }
  };
  img.onerror=()=>tryCandidate();
  tryCandidate();

  // v44 wraps drawBase() to capture the literal battlefield transform used by its
  // single-owner fog renderer. Preserve that wrapper: when the sprite is ready we
  // call the old renderer invisibly so transform capture still happens, then paint
  // the supplied sprite and the gameplay-only HP UI.
  const drawBaseBeforeV45=drawBase;
  drawBase=function(){
    if(!ready||!processed){return drawBaseBeforeV45();}

    ctx.save();ctx.globalAlpha=0;drawBaseBeforeV45();ctx.restore();

    const ratio=Math.max(0,state.baseHp/state.maxBaseHp);
    ctx.save();ctx.translate(BASE_X,BASE_Y);ctx.imageSmoothingEnabled=true;
    try{ctx.imageSmoothingQuality='high';}catch{}
    ctx.drawImage(processed,CROP.x,CROP.y,CROP.w,CROP.h,-WORLD_W_PX/2,-WORLD_H_PX/2,WORLD_W_PX,WORLD_H_PX);

    // Keep only the existing gameplay information overlay; the old procedural
    // circles/building art are not drawn visibly once the real sprite is loaded.
    const barW=178,barY=-WORLD_H_PX/2-31;
    ctx.fillStyle='rgba(5,11,16,.88)';ctx.fillRect(-barW/2-7,barY-20,barW+14,38);
    ctx.fillStyle='#eaf7ff';ctx.font='bold 14px Arial';ctx.textAlign='center';
    ctx.fillText(state.debug?.unlimitedLives?'BASE ∞ HP':`BASE ${Math.ceil(state.baseHp)} / ${state.maxBaseHp}`,0,barY-5);
    ctx.fillStyle='#111';ctx.fillRect(-barW/2,barY+2,barW,10);
    ctx.fillStyle=ratio>.5?'#59d878':ratio>.25?'#f0c65a':'#ef6666';
    ctx.fillRect(-barW/2,barY+2,barW*(state.debug?.unlimitedLives?1:ratio),10);
    ctx.restore();
  };

  window.__apdMainBaseSprite={
    expectedPath:'A2D31210-1B7B-4D4F-9C2D-0740047D4008.png',
    sourceWidth:SOURCE_W,sourceHeight:SOURCE_H,
    crop:{...CROP},worldWidth:WORLD_W_PX,worldHeight:WORLD_H_PX,
    sourceIsPng:true,runtimeBackgroundMask:'only-if-opaque'
  };
})();
