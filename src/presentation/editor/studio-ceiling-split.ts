import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { ceilingFrame } from '../../domain/studio/studio-ceiling';
import { ceilingBoundary } from '../../domain/studio/studio-boundary';
import { boundaryPoint, type BoundaryLocation, type BoundaryPoint } from '../../domain/geometry/boundary';
import { createBoundaryCursor, defaultBoundaryLocation } from './boundary-cursor';

/** A movable insertion cursor. Moving it changes neither the ceiling nor undo history. */
export function createCeilingSplitCursor(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  const cursor = createBoundaryCursor(screen);
  type Position = { id: string; t: number } | null;
  let lastPosition: Position = null, beforePosition: Position = null;
  const location = (id: string) => cursor.location(id);
  function geometry(room: Studio, h: RoomHandle) {
    const c = room.ceilings?.find(c => c.id === h.id), fr = c && ceilingFrame(room, c);
    if (!c || !fr) return null;
    const points = ceilingBoundary(room, c);
    const world = (p: BoundaryPoint) => ({ ...(c.run === 'along' ? fr.at(p.t, c.depth) : fr.at((fr.along.from + fr.along.to) / 2, p.t)), y: p.y });
    return { points, world, initial: h.boundary ?? defaultBoundaryLocation(points, c.profile.length - 1) };
  }
  function update(room: Studio, h: RoomHandle, change: (g: NonNullable<ReturnType<typeof geometry>>) => void) {
    const g = geometry(room, h);
    if (!g) return;
    change(g);
    const at = location(h.id), p = at && boundaryPoint(g.points, at);
    if (p) lastPosition = { id: h.id, t: p.t };
  }
  return {
    location,
    position: (id: string) => lastPosition?.id === id && location(id) ? lastPosition.t : undefined,
    move(room: Studio, h: RoomHandle, dx: number, dy: number) {
      const origin = screen(h);
      update(room, h, g => cursor.move(h.id, g.points, g.world, { x: origin.x + dx, y: origin.y + dy }, g.initial));
    },
    nudge(room: Studio, h: RoomHandle, amount: number) {
      update(room, h, g => cursor.nudge(h.id, g.points, g.initial, amount));
    },
    begin() { cursor.begin(); beforePosition = lastPosition; },
    cancel() { cursor.cancel(); lastPosition = beforePosition; },
    clear: cursor.clear,
  };
}
export type CeilingCursorLocation = BoundaryLocation;
