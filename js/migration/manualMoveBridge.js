import { createGameConfig } from '../core/config.js';
import { issueManualMove } from '../units/commands.js';

const config = createGameConfig();

function createLegacyGameView(legacy) {
  const legacyState = legacy?.state;
  if (!legacyState) return null;
  return {
    config,
    state: {
      base: {
        x: Number(legacy.baseX),
        y: Number(legacy.baseY),
        radius: Number(legacy.baseRadius),
      },
      entities: {
        units: legacyState.units || [],
        structures: legacyState.structures || [],
        terrain: legacyState.terrain || [],
        depots: legacyState.depots || [],
        rivers: legacyState.rivers || [],
      },
      modifiers: {
        unitMove: Number(legacyState.mods?.unitMove) || 1,
      },
      commands: {
        medicFollowAttachMode: Boolean(legacyState.v47MedicAttachMode),
        apcSupportAttachMode: Boolean(legacyState.v47ApcAttachMode),
      },
    },
  };
}

export function issueLegacyManualMove(legacy, unit, x, y) {
  const game = createLegacyGameView(legacy);
  if (!game) return { handled: false, ok: false, reason: 'legacy-state-unavailable' };
  const result = issueManualMove(game, unit, x, y);
  legacy.state.v47MedicAttachMode = game.state.commands.medicFollowAttachMode;
  legacy.state.v47ApcAttachMode = game.state.commands.apcSupportAttachMode;
  return { handled: true, ...result };
}
