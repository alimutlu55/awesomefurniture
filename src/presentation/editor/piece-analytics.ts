import type { TrackEvent } from '../../application/analytics/analytics-port';
import type { EditorCabinet } from '../../application/projects/editor-scene';
import { furnitureKind } from '../../domain/furniture/furniture';

type Command = (...args: never[]) => unknown;
type Counter = (track: TrackEvent, args: readonly unknown[], result: unknown, pieces: number) => void;
const text = (value: unknown, fallback: string) => typeof value === 'string' && value ? value : fallback;
const room = (action: string): Counter => (track, args) => track('studio_room_edited', { action, detail_kind: text(args[0], action) });

/** The scene commands counted, each only when it changed the design (a truthy result), never while dragging. */
const COUNTED: Readonly<Record<string, Counter>> = {
  addCabinet: (track, [copy, template], result, pieces) => {
    const piece = result && typeof result === 'object' && 'state' in result ? result as EditorCabinet : null;
    track('furniture_piece_added', { product: piece ? furnitureKind(piece.state) : 'wardrobe', preset_id: copy ? null : text(template, 'regular'),
      placement: copy ? 'duplicate' : 'wall', total_pieces_in_scene: pieces });
  },
  addKitchenUnit: (track, [preset, placement], _result, pieces) => track('furniture_piece_added', { product: 'kitchen', preset_id: text(preset, 'unit'),
    placement: (placement as { beside?: boolean } | undefined)?.beside ? 'beside' : 'wall', total_pieces_in_scene: pieces }),
  applyShapeTemplate: (track, [template]) => track('wardrobe_shape_changed', { shape_kind: text(template, 'regular'), method: 'preset' }),
  placeStudio: room('room_preset'),
  addStudioRoom: room('room_added'),
  addStudioWall: (track) => track('studio_room_edited', { action: 'wall_added', detail_kind: 'wall' }),
  addStudioOpening: room('opening_added'),
  addStudioCeiling: room('ceiling_shape'),
  addStudioFixture: room('fixture_added'),
};

/**
 * The scene commands with what people add counted for product analytics: wardrobes and kitchen units (from the Add
 * menu, a preset or a copy), shape presets, and room edits. The commands behave exactly as before.
 */
export function withDesignAnalytics<T extends object>(commands: T, track: TrackEvent, pieces: () => readonly EditorCabinet[]): T {
  // A copy of the commands object (plain functions), so nothing else sees the counting.
  const counted = { ...commands } as Record<string, unknown>;
  for (const [name, count] of Object.entries(COUNTED)) {
    const original = counted[name];
    if (typeof original !== 'function') continue;
    counted[name] = (...args: never[]) => {
      const result = (original as Command).apply(counted, args);
      if (result) { try { count(track, args, result, pieces().length); } catch { /* Counting never breaks an edit. */ } }
      return result;
    };
  }
  return counted as T;
}
