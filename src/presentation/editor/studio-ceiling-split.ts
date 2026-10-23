import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { roomHeight } from '../../domain/studio/studio';
import { ceilingEdgeSections } from '../../domain/studio/ceiling-edge';
import { ceilingFrame } from '../../domain/studio/studio-ceiling';
import { pointOnEdge } from './studio-ceiling-drag';
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
      for (const { from, to } of ceilingEdgeSections(c, k, roomHeight(room))) {
        const hit = projectBoundary(screen, pointOnEdge(fr, c, k, from), pointOnEdge(fr, c, k, to), target);
        const fraction = hit ? from + (to - from) * hit.fraction : 0;
        if (hit && (!best || hit.distance < best.distance)) best = { distance: hit.distance, t: a.t + (b.t - a.t) * fraction, index: k, fraction };
      }
    }
    if (best) cursor = { id: h.id, t: best.t, index: best.index, fraction: best.fraction };
  }
  function nudge(room: Studio, h: RoomHandle, amount: number) {
    const c = room.ceilings?.find(c => c.id === h.id);
    if (!c) return;
    const fr = ceilingFrame(room, c);
    if (!fr) return;
    const sections = c.profile.slice(0, -1).flatMap((_, index) => ceilingEdgeSections(c, index, roomHeight(room)).map(({ from, to }) => {
      const a = pointOnEdge(fr, c, index, from), b = pointOnEdge(fr, c, index, to);
      return { index, from, to, length: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) };
    }));
    let position = 0;
    for (const section of sections) {
      if (section.index < h.index!) position += section.length;
      else if (section.index === h.index) position += section.length * Math.max(0, Math.min(1, ((h.fraction ?? .5) - section.from) / (section.to - section.from)));
    }
    position = Math.max(0, Math.min(sections.reduce((sum, s) => sum + s.length, 0), position + amount));
    let at = sections[0]!;
    for (const section of sections) { at = section; if (position <= section.length) break; position -= section.length; }
    const fraction = at.from + (at.to - at.from) * (at.length > 0 ? position / at.length : 0);
    const a = c.profile[at.index]!, b = c.profile[at.index + 1]!;
    cursor = { id: h.id, t: a.t + (b.t - a.t) * fraction, index: at.index, fraction };
  }
  return { position, location, move, nudge, begin() { before = cursor && { ...cursor }; }, cancel() { cursor = before; }, clear() { cursor = null; } };
}
