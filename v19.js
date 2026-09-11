// Alien Planet Defense v19 - main menu
const mainMenu=document.getElementById('mainMenu');
const mainMenuHome=document.getElementById('mainMenuHome');
const optionsPanel=document.getElementById('optionsPanel');
const guidePanel=document.getElementById('guidePanel');
const startGameBtn=document.getElementById('startGameBtn');
const optionsBtn=document.getElementById('optionsBtn');
const guideBtn=document.getElementById('guideBtn');
const optionsBackBtn=document.getElementById('optionsBackBtn');
const guideBackBtn=document.getElementById('guideBackBtn');
const optShowReach=document.getElementById('optShowReach');
const optEnemyArrows=document.getElementById('optEnemyArrows');
const optUnitArrows=document.getElementById('optUnitArrows');

let gameStarted=false;
state.paused=true;

function showMenuPanel(panel){
 mainMenuHome.classList.toggle('hidden',!!panel);
 optionsPanel.classList.toggle('hidden',panel!=='options');
 guidePanel.classList.toggle('hidden',panel!=='guide');
}
function openMainMenu(){mainMenu.classList.remove('hidden');showMenuPanel(null);state.paused=true;}
function closeMainMenu(){mainMenu.classList.add('hidden');state.paused=false;state.last=performance.now();}

startGameBtn.onclick=()=>{
 if(!gameStarted){reset();gameStarted=true;}
 closeMainMenu();els.message.textContent='Survive, expand logistics, and defend the base.';
};
optionsBtn.onclick=()=>showMenuPanel('options');
guideBtn.onclick=()=>showMenuPanel('guide');
optionsBackBtn.onclick=guideBackBtn.onclick=()=>showMenuPanel(null);

// Keep options lightweight and safe: these only affect overlays/visual helpers.
state.v19Options={enemyArrows:true,unitArrows:true};
optShowReach.checked=state.showReach;
optShowReach.onchange=()=>{state.showReach=optShowReach.checked;els.reach.textContent=`SHOW REACH: ${state.showReach?'ON':'OFF'}`;};
optEnemyArrows.onchange=()=>state.v19Options.enemyArrows=optEnemyArrows.checked;
optUnitArrows.onchange=()=>state.v19Options.unitArrows=optUnitArrows.checked;

const v18DrawIncomingEnemyArrowsV19=drawIncomingEnemyArrows;
drawIncomingEnemyArrows=function(){if(state.v19Options?.enemyArrows!==false)v18DrawIncomingEnemyArrowsV19();};
const v18DrawOffscreenUnitIndicatorsV19=drawOffscreenUnitIndicators;
drawOffscreenUnitIndicators=function(){if(state.v19Options?.unitArrows!==false)v18DrawOffscreenUnitIndicatorsV19();};

// Escape opens/closes menu during a run.
window.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 if(mainMenu.classList.contains('hidden'))openMainMenu();else if(gameStarted)closeMainMenu();
});

// Ensure the menu owns the initial state even though older patches call reset().
openMainMenu();
