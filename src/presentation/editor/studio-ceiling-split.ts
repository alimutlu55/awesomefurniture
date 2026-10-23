import type { Studio } from '../../domain/studio/studio';
import type { BoundaryLocation } from '../../domain/geometry/boundary';
import type { RoomHandle } from './studio-editor.ports';
import { surfaceSolid } from '../../domain/studio/studio-solid-boundary';
import { solidPoint } from '../../domain/geometry/solid-boundary';
import { createSolidBoundaryCursor } from './solid-boundary-cursor';

/** The insertion cursor follows all rings and return edges of the actual ceiling solid. */
export function createCeilingSplitCursor(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  const cursor = createSolidBoundaryCursor(screen);
  type Position = { id: string; t: number } | null;
  let lastPosition: Position = null, beforePosition: Position = null;
  const location = cursor.location;
  function update(room: Studio, h: RoomHandle, change: (solid: NonNullable<ReturnType<typeof surfaceSolid>>) => void) {
    const solid = surfaceSolid(room, 'ceiling', h.id);
    if (!solid) return;
    change(solid);
    const at = location(h.id), p = at && solidPoint(solid.edges, at);
    if (p) lastPosition = { id: h.id, t: p.t };
  }
  return {
    location,
    place(room: Studio, h: RoomHandle, at: BoundaryLocation) { update(room, h, () => cursor.place(h.id, at)); },
    position: (id: string) => lastPosition?.id === id && location(id) ? lastPosition.t : undefined,
    move(room: Studio, h: RoomHandle, dx: number, dy: number) {
      const origin = screen(h);
      update(room, h, g => cursor.move(h.id, g.edges, g.world, { x: origin.x + dx, y: origin.y + dy }, h.boundary));
    },
    nudge(room: Studio, h: RoomHandle, amount: number) {
      update(room, h, g => cursor.nudge(h.id, g.edges, g.world, h.boundary!, amount));
    },
    begin() { cursor.begin(); beforePosition = lastPosition; },
    cancel() { cursor.cancel(); lastPosition = beforePosition; }, clear: cursor.clear,
  };
}
