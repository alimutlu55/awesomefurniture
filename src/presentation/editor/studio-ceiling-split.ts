import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { ceilingFrame } from '../../domain/studio/studio-ceiling';
import { pointAt } from './studio-ceiling-drag';
import { projectBoundary } from './boundary-cursor';

/** A movable insertion cursor, including vertical steps and corners. Cursor motion never edits the room. */
export function createCeilingSplitCursor(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  type Cursor = { id: string; t: number; index: number; fraction: number } | null;
  let cursor: Cursor = null, before: Cursor = null;
  const position = (id: string) => cursor?.id === id ? cursor.t : undefined;
  const location = (id: string) => cursor?.id === id ? cursor : undefined;
  function move(room: Studio, h: RoomHandle, dx: number, dy: number) {
    const c = room.ceilings?.find(c => c.id === h.id), fr = c && ceilingFrame(room, c);
    if (!c || !fr) return;
    const origin = screen(h), target = { x: origin.x + dx, y: origin.y + dy };
    let best: { distance: number; t: number; index: number; fraction: number } | null = null;
    for (let k = 0; k < c.profile.length - 1; k++) {
      const a = c.profile[k]!, b = c.profile[k + 1]!;
      const hit = projectBoundary(screen, pointAt(fr, c, k), pointAt(fr, c, k + 1), target);
      if (hit && (!best || hit.distance < best.distance)) best = { ...hit, t: a.t + (b.t - a.t) * hit.fraction, index: k };
    }
    if (best) cursor = { id: h.id, t: best.t, index: best.index, fraction: best.fraction };
  }
  function nudge(room: Studio, h: RoomHandle, amount: number) {
    const c = room.ceilings?.find(c => c.id === h.id);
    if (!c) return;
    const lengths = c.profile.slice(1).map((p, k) => Math.hypot(p.t - c.profile[k]!.t, p.y - c.profile[k]!.y));
    let at = lengths.slice(0, h.index ?? 0).reduce((a, b) => a + b, 0) + lengths[h.index ?? 0]! * (h.fraction ?? .5) + amount;
    at = Math.max(0, Math.min(lengths.reduce((a, b) => a + b, 0), at));
    let k = 0;
    while (k < lengths.length - 1 && at > lengths[k]!) at -= lengths[k++]!;
    const fraction = lengths[k]! > 0 ? at / lengths[k]! : 0, a = c.profile[k]!, b = c.profile[k + 1]!;
    cursor = { id: h.id, t: a.t + (b.t - a.t) * fraction, index: k, fraction };
  }
  return { position, location, move, nudge, begin() { before = cursor && { ...cursor }; }, cancel() { cursor = before; }, clear() { cursor = null; } };
}
