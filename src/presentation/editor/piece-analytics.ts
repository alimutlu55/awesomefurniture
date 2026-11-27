import type { TrackEvent } from '../../application/analytics/analytics-port';

type Command = (...args: never[]) => unknown;
type Counter = (track: TrackEvent, args: readonly unknown[]) => void;
const text = (value: unknown, fallback: string) => typeof value === 'string' && value ? value : fallback;
const room = (action: string): Counter => (track, args) => track('studio_room_edited', { action, detail_kind: text(args[0], action) });

/** The scene commands counted, each only when it changed the design (a truthy result), never while dragging. */
const COUNTED: Readonly<Record<string, Counter>> = {
  applyShapeTemplate: (track, [template]) => track('wardrobe_shape_changed', { shape_kind: text(template, 'regular'), method: 'preset' }),
  placeStudio: room('room_preset'),
  addStudioRoom: room('room_added'),
  addStudioWall: (track) => track('studio_room_edited', { action: 'wall_added', detail_kind: 'wall' }),
  addStudioOpening: room('opening_added'),
  addStudioCeiling: room('ceiling_shape'),
};

/**
 * Counts shape presets and room construction after the corresponding command succeeds.
 */
export function withDesignAnalytics<T extends object>(commands: T, track: TrackEvent): T {
  // A copy of the commands object (plain functions), so nothing else sees the counting.
  const counted = { ...commands } as Record<string, unknown>;
  for (const [name, count] of Object.entries(COUNTED)) {
    const original = counted[name];
    if (typeof original !== 'function') continue;
    counted[name] = (...args: never[]) => {
      const result = (original as Command).apply(counted, args);
      if (result) { try { count(track, args); } catch { /* Counting never breaks an edit. */ } }
      return result;
    };
  }
  return counted as T;
}
