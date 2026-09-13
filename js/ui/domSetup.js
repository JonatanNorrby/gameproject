import { UNIT_CONFIG } from '../units/unitConfig.js';

function byId(doc, id) { return doc?.getElementById?.(id) || null; }

export function ensureRuntimeControls(doc) {
  if (!doc?.createElement) return;
  const unitsMenu = byId(doc, 'unitsMenu');
  if (unitsMenu) {
    for (const [role, config] of Object.entries(UNIT_CONFIG)) {
      const buildType = config.legacyBuildType || role;
      if (unitsMenu.querySelector?.(`.buildBtn[data-type="${buildType}"]`)) continue;
      const button = doc.createElement('button');
      button.className = 'buildBtn';
      button.dataset.type = buildType;
      button.textContent = `${config.displayName} `;
      const small = doc.createElement('small');
      small.textContent = `${config.cost.gold} gold`;
      button.appendChild(small);
      unitsMenu.appendChild(button);
    }
  }

  const utility = byId(doc, 'utilityBar');
  if (utility && !byId(doc, 'mapZoomOutBtn')) {
    const out = doc.createElement('button'); out.id = 'mapZoomOutBtn'; out.textContent = '− ZOOM';
    const label = doc.createElement('span'); label.id = 'mapZoomLabel'; label.textContent = '65%';
    const input = doc.createElement('button'); input.id = 'mapZoomInBtn'; input.textContent = '+ ZOOM';
    utility.append(out, label, input);
  }
}
