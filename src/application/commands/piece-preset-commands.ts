import { piecePreset, presetProfile } from '../../domain/furniture/piece-presets';
import type { EditorCabinet } from '../projects/editor-scene';

/** Name and configure an empty piece before it joins the scene. */
export function applyPiecePreset(cabinet: EditorCabinet, id: string): void {
  const preset = piecePreset(id);
  if (!preset) return;
  cabinet.name = preset.name + ' ' + cabinet.id;
  const state = cabinet.state;
  state.doors = preset.doors;
  state.profile = presetProfile(state.profile, preset);
  state.piecePreset = preset.id;
}
