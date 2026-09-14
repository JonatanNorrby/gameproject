import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(match => match[1]);
const stripVersion = src => src.split('?')[0];
const ordered = scripts.map(stripVersion);

function indexOf(path) {
  const index = ordered.indexOf(path);
  assert.notEqual(index, -1, `Expected production script ${path}`);
  return index;
}

const migrationPairs = [
  ['js/migration/economyLegacyHost.js', 'js/migration/economyLegacyBootstrap.js'],
  ['js/migration/navigationMovementLegacyHost.js', 'js/migration/navigationMovementLegacyBootstrap.js'],
  ['js/migration/unitCombatLegacyHost.js', 'js/migration/unitCombatLegacyBootstrap.js'],
  ['js/migration/enemyLegacyHost.js', 'js/migration/enemyLegacyBootstrap.js'],
  ['js/migration/towerProjectileLegacyHost.js', 'js/migration/towerProjectileLegacyBootstrap.js'],
  ['js/migration/buildingPlacementLegacyHost.js', 'js/migration/buildingPlacementLegacyBootstrap.js'],
  ['js/migration/renderingFogCameraLegacyHost.js', 'js/migration/renderingFogCameraLegacyBootstrap.js'],
];

test('production migration hosts/bootstrap pairs remain after the legacy patch chain and in step order', () => {
  const legacyEnd = indexOf('v53.js');
  let previous = legacyEnd;
  for (const [host, bootstrap] of migrationPairs) {
    const hostIndex = indexOf(host);
    const bootstrapIndex = indexOf(bootstrap);
    assert.ok(hostIndex > legacyEnd, `${host} must stay after v53.js`);
    assert.ok(hostIndex > previous, `${host} must stay after the previous migration step`);
    assert.equal(bootstrapIndex, hostIndex + 1, `${bootstrap} must immediately follow its classic host`);
    previous = bootstrapIndex;
  }
});

test('Step 7 production cutover remains the final migration layer before body close', () => {
  assert.deepEqual(
    ordered.slice(-2),
    ['js/migration/renderingFogCameraLegacyHost.js', 'js/migration/renderingFogCameraLegacyBootstrap.js'],
  );
});
