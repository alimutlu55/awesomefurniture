import { wallLine, type Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { projectBoundary } from './boundary-cursor';

/** Wall insertion uses the same continuous, perspective-correct cursor as ceiling profiles. */
export function createWallSplitCursor(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  type Cursor = { id: string; t: number } | null;
  let cursor: Cursor = null, before: Cursor = null;
  function handle(room: Studio, id: string): RoomHandle | null {
    const w = room.walls.find(w => w.id === id), line = w && wallLine(room, w);
    if (!w || !line) return null;
    const t = Math.max(0, Math.min(line.length, cursor?.id === id ? cursor.t : line.length / 2));
    return { key: 'wall-split:' + id, kind: 'wall-split', id, position: t,
      x: line.a.x + line.ux * t, y: w.height, z: line.a.z + line.uz * t,
      label: 'Add a wall corner here. Drag along the edge to choose where; tap to divide. Arrow keys move along the boundary' };
  }
  function move(room: Studio, h: RoomHandle, dx: number, dy: number) {
    const w = room.walls.find(w => w.id === h.id), line = w && wallLine(room, w);
    if (!w || !line) return;
    const origin = screen(h), hit = projectBoundary(screen, { ...line.a, y: w.height }, { ...line.b, y: w.height }, { x: origin.x + dx, y: origin.y + dy });
    if (hit) cursor = { id: h.id, t: hit.fraction * line.length };
  }
  function nudge(room: Studio, h: RoomHandle, amount: number) {
    const w = room.walls.find(w => w.id === h.id), line = w && wallLine(room, w);
    if (line) cursor = { id: h.id, t: Math.max(0, Math.min(line.length, (h.position ?? 0) + amount)) };
  }
  return { handle, move, nudge, begin() { before = cursor && { ...cursor }; }, cancel() { cursor = before; }, clear() { cursor = null; } };
}
