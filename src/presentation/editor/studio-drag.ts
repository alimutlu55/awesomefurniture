import type { Studio } from '../../domain/studio/studio';
import { wallLine } from '../../domain/studio/studio';
import { moveCorner, moveOpening, moveWall } from '../../domain/studio/studio-edit';
export type RoomSelection = { kind: 'wall' | 'corner' | 'opening'; id: string };
export type GroundPoint = { x: number; z: number };
export type Guide = { a: GroundPoint; b: GroundPoint };

/** Snap in room coordinates. The same grid applies to mouse, touch, and keyboard. */
export function snapRoomPoint(room: Studio, point: GroundPoint, anchor?: GroundPoint, skip?: string, fine = false) {
  const step = fine ? 1 : 5, round = (n: number) => Math.round(n / step) * step;
  const p = { x: round(point.x), z: round(point.z) }, guides: Guide[] = [];
  if (anchor) {
    const dx = p.x - anchor.x, dz = p.z - anchor.z, length = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx), snap = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
    if (Math.abs(angle - snap) < .055) {
      p.x = anchor.x + round(Math.cos(snap) * length);
      p.z = anchor.z + round(Math.sin(snap) * length);
      guides.push({ a: anchor, b: { ...p } });
    }
  }
  for (const axis of ['x', 'z'] as const) {
    const target = room.corners.filter(c => c.id !== skip).sort((a, b) => Math.abs(a[axis] - p[axis]) - Math.abs(b[axis] - p[axis]))[0];
    if (target && Math.abs(target[axis] - p[axis]) <= (fine ? 1 : 3)) {
      p[axis] = target[axis];
      guides.push({ a: target, b: { ...p } });
    }
  }
  return { point: p, guides };
}

export function roomDragEdit(room: Studio, selected: RoomSelection, start: GroundPoint, point: GroundPoint, fine: boolean) {
  const step = fine ? 1 : 5, round = (n: number) => Math.round(n / step) * step;
  const dx = point.x - start.x, dz = point.z - start.z;
  if (selected.kind === 'corner') {
    const c = room.corners.find(c => c.id === selected.id);
    if (!c) return { room: null, guides: [] };
    const wall = room.walls.find(w => w.a === c.id || w.b === c.id);
    const anchor = wall && room.corners.find(p => p.id === (wall.a === c.id ? wall.b : wall.a));
    const snap = snapRoomPoint(room, { x: c.x + dx, z: c.z + dz }, anchor, c.id, fine);
    return { room: moveCorner(room, c.id, snap.point.x, snap.point.z), guides: snap.guides };
  }
  const opening = room.openings.find(o => o.id === selected.id);
  const wall = room.walls.find(w => w.id === (selected.kind === 'wall' ? selected.id : opening?.wall));
  const line = wall && wallLine(room, wall);
  if (!line) return { room: null, guides: [] };
  const next = selected.kind === 'wall' ? moveWall(room, selected.id, round(dx * line.nx + dz * line.nz))
    : moveOpening(room, selected.id, round(opening!.offset + dx * line.ux + dz * line.uz));
  return { room: next, guides: [] };
}
