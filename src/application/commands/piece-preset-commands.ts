import { piecePreset, presetNeeds } from '../../domain/furniture/piece-presets';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { generateDesignedLayouts } from '../../domain/planner/wardrobe-composer';
import type { EditorCabinet } from '../projects/editor-scene';
import { createDesignCommands } from './design-commands';

/**
 * Makes a newly added piece what PIECE_PRESETS says (a chest of drawers, a sideboard, a shoe cabinet...): its name, its
 * fronts, what it is meant to hold, and Auto design's best layout for that already inside. `addCabinet` calls it for a
 * piece added with a preset, before the piece joins the scene, so adding stays one undo step.
 */
export function applyPiecePreset(cabinet: EditorCabinet, id: string): void {
  const preset = piecePreset(id);
  if (!preset) return;
  cabinet.name = preset.name + ' ' + cabinet.id;
  const state = cabinet.state;
  state.doors = preset.doors;
  state.profile = { ...state.profile, needs: presetNeeds(preset), jackets: 0, coats: 0 };
  const best = generateDesignedLayouts(createWardrobeGeometry(() => state).plannerConfig())[0];
  if (best) createDesignCommands(() => state).applyProposal(best as never);
}
