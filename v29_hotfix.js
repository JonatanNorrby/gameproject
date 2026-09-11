// v29 UI integration: changing build tools cancels pending Platoon attachment.
document.querySelectorAll('.buildBtn').forEach(b=>b.addEventListener('click',()=>{state.platoonAttachMode=false;}));
