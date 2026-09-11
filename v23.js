// Alien Planet Defense v23 - all persistent gameplay UI lives in one command drawer.
const commandDrawer=document.getElementById('commandDrawer');
const commandBackdrop=document.getElementById('commandBackdrop');
const commandCloseBtn=document.getElementById('commandCloseBtn');
const commandMainMenuBtn=document.getElementById('commandMainMenuBtn');

function commandMenuOpen(){return commandDrawer.classList.contains('open');}
function setCommandMenu(open){
 commandDrawer.classList.toggle('open',open);
 commandBackdrop.classList.toggle('open',open);
 mobileMenuBtn.classList.toggle('menu-open',open);
 mobileMenuBtn.setAttribute('aria-expanded',open?'true':'false');
 mobileMenuBtn.textContent=open?'✕ CLOSE':'☰ MENU';
}
function openCommandMenu(){setCommandMenu(true);}
function closeCommandMenu(){setCommandMenu(false);}
function toggleCommandMenu(){setCommandMenu(!commandMenuOpen());}

// Replace the old phone-only behavior: the persistent menu button now owns the
// gameplay UI drawer on every screen size.
mobileMenuBtn.onclick=e=>{e.preventDefault();e.stopPropagation();toggleCommandMenu();};
commandCloseBtn.onclick=e=>{e.preventDefault();closeCommandMenu();};
commandBackdrop.onclick=()=>closeCommandMenu();

// The original title menu is still reachable, but no longer shares the same button.
commandMainMenuBtn.onclick=e=>{e.preventDefault();closeCommandMenu();openMainMenu();};
const v22OpenMainMenuV23=openMainMenu;
openMainMenu=function(){closeCommandMenu();v22OpenMainMenuV23();};

// Selecting something to build immediately returns the user to the battlefield.
// Their chosen build mode remains active, so the next map tap places it.
document.querySelectorAll('.buildBtn').forEach(btn=>btn.addEventListener('click',()=>setTimeout(closeCommandMenu,0)));

// Centering the base is another action where seeing the result immediately is useful.
els.center.addEventListener('click',()=>setTimeout(closeCommandMenu,0));

// Escape now toggles the command drawer during gameplay instead of jumping straight
// to the title screen. If the title screen is already open, the older handler still
// handles Escape normally.
window.addEventListener('keydown',e=>{
 if(e.key!=='Escape'||!mainMenu.classList.contains('hidden'))return;
 e.preventDefault();e.stopImmediatePropagation();toggleCommandMenu();
},{capture:true});

// Keep the drawer closed when a fresh run starts/resumes from the title screen.
const v22CloseMainMenuV23=closeMainMenu;
closeMainMenu=function(){v22CloseMainMenuV23();closeCommandMenu();};

// Make the command button work with keyboard users too and ensure no old v20 state
// leaves it visually expanded on initial load.
mobileMenuBtn.setAttribute('aria-controls','commandDrawer');
mobileMenuBtn.setAttribute('aria-expanded','false');
closeCommandMenu();
