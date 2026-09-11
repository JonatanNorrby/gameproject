// Alien Planet Defense v34
// Main-menu start hotfix: start from the already-initialized paused preview state
// instead of running the entire accumulated reset wrapper chain while the title
// screen is still open. This keeps START/RESUME reliable after late patch layers.
document.title='Alien Planet Defense v34';

(function installV34MainMenuStartFix(){
 const btn=document.getElementById('startGameBtn');
 const menu=document.getElementById('mainMenu');
 if(!btn||!menu)return;

 function stateLooksReady(){
  return typeof state!=='undefined'&&state&&state.camera&&
   Array.isArray(state.enemies)&&Array.isArray(state.units)&&Array.isArray(state.structures);
 }

 function markStarted(){
  try{if(typeof gameStarted!=='undefined')gameStarted=true;}catch(err){console.warn('Could not update legacy gameStarted flag',err);}
  window.__apdGameStarted=true;
 }

 function closeTitleMenuSafely(){
  try{if(typeof showMenuPanel==='function')showMenuPanel(null);}catch(err){console.warn('Menu panel cleanup failed',err);}
  menu.classList.add('hidden');
  try{if(typeof setCommandMenu==='function')setCommandMenu(false);}catch(err){console.warn('Command menu cleanup failed',err);}
  try{if(typeof mobileMenuBtn!=='undefined'&&mobileMenuBtn)mobileMenuBtn.setAttribute('aria-expanded','false');}catch{}
 }

 function startGameFromMenu(e){
  e?.preventDefault?.();
  e?.stopPropagation?.();

  // The title-screen battlefield is already freshly reset and paused by the
  // current engine. Reusing it avoids the fragile second reset that caused START
  // to fail after v33. Only attempt a reset if that preview state is missing.
  closeTitleMenuSafely();
  if(!stateLooksReady()&&typeof reset==='function'){
   try{reset();}catch(err){console.error('Fallback reset failed',err);}
  }

  markStarted();
  if(typeof state!=='undefined'&&state){
   state.paused=false;
   state.last=performance.now();
   if(state.gameOver&&state.baseHp>0)state.gameOver=false;
  }
  btn.textContent='RESUME';
  btn.blur();
  try{if(typeof els!=='undefined'&&els?.message)els.message.textContent='Survive, expand logistics, and defend the base.';}catch{}
  try{if(typeof updateHud==='function')updateHud();}catch(err){console.warn('HUD refresh failed',err);}
 }

 // Replace the inherited v19 START handler. That handler called reset() before
 // closing the title screen; with the long patch chain this became the fragile
 // part of startup. RESUME now uses the same safe path.
 btn.onclick=startGameFromMenu;
 btn.style.pointerEvents='auto';
 btn.removeAttribute('disabled');
 btn.setAttribute('aria-disabled','false');

 // Keep the initial title-screen simulation paused until START is pressed.
 if(typeof state!=='undefined'&&state&&!menu.classList.contains('hidden'))state.paused=true;
})();
