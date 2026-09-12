// Temporary Prompt 5 bridge. Loaded after the legacy runtime so only the final
// normal empty-terrain move branch is redirected to the clean command layer.
(function installManualMoveLegacyBridge() {
  if (window.__apdManualMoveBridgeInstalled) return;
  window.__apdManualMoveBridgeInstalled = true;

  const previousHandleTap = handleTap;
  let issueLegacyManualMove = null;
  const moduleUrl = new URL('./manualMoveBridge.js', document.currentScript.src).href;
  import(moduleUrl).then(module => {
    issueLegacyManualMove = module.issueLegacyManualMove;
    window.__apdManualMoveBridgeReady = true;
  }).catch(error => {
    console.error('Prompt 5 manual-move bridge failed to load; legacy move routing remains active.', error);
    window.__apdManualMoveBridgeReady = false;
  });

  handleTap = function prompt5HandleTapBridge(x, y) {
    const selected = state?.selectedUnit;
    const clicked = typeof unitAt === 'function' ? unitAt(x, y) : null;
    const tower = typeof towerAt === 'function' ? towerAt(x, y) : null;
    const special = state?.attachMode
      || state?.platoonAttachMode
      || state?.routeEditing
      || (typeof wallModeActive === 'function' && wallModeActive())
      || state?.v47MedicAttachMode
      || state?.v47ApcAttachMode;

    // Keep every non-movement interaction on the current legacy input path.
    if (!issueLegacyManualMove
      || !selected
      || clicked
      || tower
      || special
      || selected.garrisonedIn
      || selected.transportedIn) {
      return previousHandleTap(x, y);
    }

    if (selected.attachedTo) {
      if (els?.message) els.message.textContent = 'Detach this squad before giving it an independent move order.';
      return false;
    }

    const result = issueLegacyManualMove({
      state,
      baseX: BASE_X,
      baseY: BASE_Y,
      baseRadius: BASE_RADIUS,
    }, selected, x, y);

    if (!result?.handled) return previousHandleTap(x, y);

    if (result.kind === 'platoon') {
      let label = 'Platoon';
      try { if (typeof platoonLabel === 'function') label = platoonLabel(result.platoonId); } catch {}
      let speedText = '';
      try {
        if (typeof platoonBaseSpeed === 'function') {
          const speed = Math.round(platoonBaseSpeed(result.platoonId) * (state.mods?.unitMove || 1));
          speedText = ` · formation speed ${speed}`;
        }
      } catch {}
      if (els?.message) els.message.textContent = result.ok
        ? `${label} move order: ${result.ordered}/${result.total} units${speedText}.`
        : 'Platoon move order could not be completed.';
      if (typeof updateHud === 'function') updateHud();
      return result.ok;
    }

    if (els?.message) els.message.textContent = result.ok
      ? 'Move order queued.'
      : 'No open route to that destination.';
    return result.ok;
  };
})();
