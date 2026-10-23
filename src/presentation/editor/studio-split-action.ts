import type { Studio } from '../../domain/studio/studio';
import { surfaceBoundary } from '../../domain/studio/studio-boundary';
import { splitSolidBoundary, surfaceSolid } from '../../domain/studio/studio-solid-boundary';
import type { BoundaryLocation } from '../../domain/geometry/boundary';
import { solidEdge, solidPoint } from '../../domain/geometry/solid-boundary';
import type { RoomHandle } from './studio-editor.ports';

/** Keep the insertion cursor at its exact 3D location through an edit or an already-existing point. */
export function insertProfilePoint({ handle: h, room, edit, cursor, redraw, screenPoint }: {
  handle: RoomHandle; room(): Studio | undefined;
  edit(change: (room: Studio) => Studio | null): boolean;
  cursor: { place(room: Studio, h: RoomHandle, at: BoundaryLocation): void };
  redraw(): void;
  screenPoint(p: { x: number; y: number; z: number }): { x: number; y: number };
}) {
  const kind = h.kind === 'wall-split' ? 'wall' : 'ceiling', before = room();
  if (!before) return;
  let at = h.boundary!;
  const solid = surfaceSolid(before, kind, h.id), edge = solid && solidEdge(solid.edges, at);
  if (solid && edge) {
    const p = screenPoint(solid.world(solidPoint(solid.edges, at)!));
    const a = screenPoint(solid.world(edge.a)), b = screenPoint(solid.world(edge.b));
    // Browser layout rounds label/pointer coordinates. Resolve that floating-point noise only
    // when activating a corner; cursor travel and the geometry's full precision stay unrestricted.
    const precision = Math.max(1, Math.abs(p.x), Math.abs(p.y), Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y)) * 2 ** -22;
    if (Math.hypot(b.x - a.x, b.y - a.y) > precision * 100) {
      if (Math.hypot(p.x - a.x, p.y - a.y) <= precision) at = { ...at, fraction: 0 };
      else if (Math.hypot(p.x - b.x, p.y - b.y) <= precision) at = { ...at, fraction: 1 };
    }
  }
  const points = surfaceBoundary(before, kind, h.id).length;
  edit(s => splitSolidBoundary(s, kind, h.id, at));
  const current = room();
  if (!current) return;
  const inserted = !at.across && surfaceBoundary(current, kind, h.id).length > points;
  cursor.place(current, h, { ...at, fraction: inserted ? 1 : at.fraction });
  redraw();
}
