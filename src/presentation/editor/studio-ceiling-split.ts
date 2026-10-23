import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { ceilingFrame } from '../../domain/studio/studio-ceiling';
import { ceilingHandles, pointAt } from './studio-ceiling-drag';

/** A movable insertion cursor. Moving it changes neither the ceiling nor undo history. */
export function createCeilingSplitCursor(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  type Cursor = { id: string; t: number } | null;
  let cursor: Cursor = null, before: Cursor = null;
  const position = (id: string) => cursor?.id === id ? cursor.t : undefined;
  function move(room: Studio, h: RoomHandle, dx: number, dy: number) {
    const c = room.ceilings?.find(c => c.id === h.id), fr = c && ceilingFrame(room, c);
    if (!c || !fr) return;
    const origin = screen(h), target = { x: origin.x + dx, y: origin.y + dy };
    let best: { distance: number; t: number } | null = null;
    for (let k = 0; k < c.profile.length - 1; k++) {
      const a = c.profile[k]!, b = c.profile[k + 1]!, span = b.t - a.t;
      if (span < 10) continue;
      const start = pointAt(fr, c, k), end = pointAt(fr, c, k + 1);
      const project = (f: number) => screen({ x: start.x + (end.x - start.x) * f, y: start.y + (end.y - start.y) * f, z: start.z + (end.z - start.z) * f });
      let lo = 5 / span, hi = 1 - 5 / span;
      const p = project(lo), q = project(hi), ux = q.x - p.x, uy = q.y - p.y, length = Math.max(1e-8, ux * ux + uy * uy);
      const fraction = Math.max(0, Math.min(1, ((target.x - p.x) * ux + (target.y - p.y) * uy) / length));
      const distance = Math.hypot(target.x - p.x - ux * fraction, target.y - p.y - uy * fraction);
      // Perspective does not put the world midpoint halfway between screen endpoints.
      for (let n = 0; n < 18; n++) {
        const mid = (lo + hi) / 2, at = project(mid), screenFraction = ((at.x - p.x) * ux + (at.y - p.y) * uy) / length;
        if (screenFraction < fraction) lo = mid; else hi = mid;
      }
      if (!best || distance < best.distance) best = { distance, t: a.t + span * (lo + hi) / 2 };
    }
    if (best) cursor = { id: h.id, t: Math.round(best.t * 10) / 10 };
  }
  function nudge(room: Studio, h: RoomHandle, amount: number) {
    const c = room.ceilings?.find(c => c.id === h.id);
    if (!c) return;
    const next = ceilingHandles(room, c, (h.position ?? 0) + amount).find(h => h.kind === 'ceiling-split');
    if (next) cursor = { id: h.id, t: next.position! };
  }
  return { position, move, nudge, begin() { before = cursor && { ...cursor }; }, cancel() { cursor = before; }, clear() { cursor = null; } };
}
