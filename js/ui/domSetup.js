import { UNIT_CONFIG } from '../units/unitConfig.js';

function byId(doc, id) { return doc?.getElementById?.(id) || null; }

const GUIDE_SECTIONS = Object.freeze([
  Object.freeze({ id: 'cleanGuideCamera', title: 'Camera', text: 'Use − / + or the mouse wheel to zoom from 18% strategic overview to 135% close view. Zoom stays centered on the chosen screen point.' }),
  Object.freeze({ id: 'cleanGuideEconomy', title: 'Logistics', text: 'Place Ore Mines and Crystal Mines, then use Logistics Trucks and recorded routes to move cargo. Refineries turn Ore into Metal; Landing Pads load Crystal into export ships for Gold.' }),
  Object.freeze({ id: 'cleanGuideCaches', title: 'Resource Caches', text: 'Guarded resource caches are scattered through the exploration ring. Clear the local defenders and hold the cache with a ground unit to earn a modest Gold and Metal reward.' }),
  Object.freeze({ id: 'cleanGuideHordes', title: 'Adaptive Enemy Hordes', text: 'Aliens arrive in large slow hordes. Horde size and recovery frequency increase as the battle develops, with special enemy types entering later.' }),
  Object.freeze({ id: 'cleanGuideWalls', title: 'Walls', text: 'Draw multi-segment Walls to shape enemy paths. Walls are physical navigation blockers and can be attacked or bypassed by specialized alien types.' }),
  Object.freeze({ id: 'cleanGuideSupport', title: 'Support Units', text: 'Medics heal infantry, Engineers repair mechanical units and structures, Spotters mark enemies, APCs transport infantry and support nearby units or Platoons, and escorts can attach to Logistics Trucks.' }),
  Object.freeze({ id: 'cleanGuideAdvanced', title: 'Advanced Units', text: 'Tanks, Mobile Artillery, Repair Vehicles, APCs, Machinegun Cars, Combat Drones and the Combat Ship expand your mobile force. Aircraft ignore ground navigation obstacles.' }),
  Object.freeze({ id: 'cleanGuideEnemies', title: 'Special Aliens', text: 'Expect Flyers, Siege Beasts, Burrowers, Climbers, Acid Lobbers, Crushers, Harvester Hunters and Saboteurs alongside Ravagers, Runners, Brutes and Spitters. Different enemies pressure Walls, logistics and defenses in different ways.' }),
]);

function ensureGuideSections(doc) {
  const grid = doc?.querySelector?.('#guidePanel .guide-grid');
  if (!grid) return;
  for (const section of GUIDE_SECTIONS) {
    if (byId(doc, section.id)) continue;
    const box = doc.createElement('div');
    box.className = 'guide-box';
    box.id = section.id;
    const title = doc.createElement('b');
    title.textContent = section.title;
    const paragraph = doc.createElement('p');
    paragraph.textContent = section.text;
    box.append(title, paragraph);
    grid.appendChild(box);
  }
}

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
    const out = doc.createElement('button'); out.id = 'mapZoomOutBtn'; out.textContent = '− ZOOM'; out.setAttribute('aria-label', 'Zoom out');
    const label = doc.createElement('span'); label.id = 'mapZoomLabel'; label.textContent = '65%'; label.setAttribute('aria-live', 'polite');
    const input = doc.createElement('button'); input.id = 'mapZoomInBtn'; input.textContent = '+ ZOOM'; input.setAttribute('aria-label', 'Zoom in');
    utility.append(out, label, input);
  }

  ensureGuideSections(doc);
}
