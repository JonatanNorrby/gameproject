// Alien Planet Defense v52 compatibility shim.
// v52's spawn-only patch is superseded by the v53 advanced-unit revamp.
(function loadV53AdvancedUnitRevamp(){
  if(window.__apdV53Installed||document.querySelector('script[data-apd-v53]'))return;
  const s=document.createElement('script');
  s.src='v53.js?v=53';
  s.async=false;
  s.dataset.apdV53='1';
  s.onerror=()=>console.error('Could not load v53 advanced-unit revamp.');
  (document.head||document.documentElement).appendChild(s);
})();
