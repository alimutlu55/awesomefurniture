import { openingRange } from './studio-validation';
import { openingLimits } from './wall-utilities';
import { addWall, extendFromCorner, mergeCorners } from './studio-edit';
import { wallLine, type Studio, type StudioWall } from './studio';
export type FloorPoint = { x: number; z: number };
export const millimetrePoint = (p: FloorPoint): FloorPoint => ({ x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 });

/** Derived polygon only: intersections of adjoining offset lines, bounded at acute corners. */
export function wallPlanPolygon(room: Studio, wall: StudioWall): FloorPoint[] {
  const l = wallLine(room, wall);
  if (!l) return [];
  function end(id: string, side: number, p: FloorPoint) {
    const base = { x: p.x + l!.nx * wall.thickness / 2 * side, z: p.z + l!.nz * wall.thickness / 2 * side };
    const joined = room.walls.filter(w => w.id !== wall.id && (w.a === id || w.b === id));
    if (joined.length !== 1) return base;
    const other = joined[0]!, ol = wallLine(room, other);
    if (!ol) return base;
    const same = (wall.a === id) !== (other.a === id) ? 1 : -1;
    const q = { x: p.x + ol.nx * other.thickness / 2 * side * same, z: p.z + ol.nz * other.thickness / 2 * side * same };
    const det = l!.ux * ol.uz - l!.uz * ol.ux;
    if (Math.abs(det) < 1e-6) return base;
    const t = ((q.x - base.x) * ol.uz - (q.z - base.z) * ol.ux) / det;
    if (Math.abs(t) > Math.max(wall.thickness, other.thickness) * 4) return base;
    return { x: base.x + l!.ux * t, z: base.z + l!.uz * t };
  }
  return [end(wall.a, 1, l.a), end(wall.b, 1, l.b), end(wall.b, -1, l.b), end(wall.a, -1, l.a)];
}

/** Drawing reuses existing nodes instead of creating coincident disconnected endpoints. */
export function drawPlanWall(room: Studio, from: FloorPoint, to: FloorPoint, tolerance: number): Studio | null {
  const near = (p: FloorPoint) => room.corners.find(c => Math.hypot(c.x - p.x, c.z - p.z) <= tolerance);
  const a = near(from), b = near(to);
  if (a && b && (a.id === b.id || room.walls.some(w => [w.a, w.b].includes(a.id) && [w.a, w.b].includes(b.id)))) return null;
  let next = a ? extendFromCorner(room, a.id, b?.x ?? to.x, b?.z ?? to.z) : addWall(room, from.x, from.z, b?.x ?? to.x, b?.z ?? to.z);
  if (next && b) next = mergeCorners(next, next.corners.at(-1)!.id, b.id);
  return next;
}

/** Keep hosted openings inside an edited host. Impossible hosts are left for validation to reject. */
export function clampPlanOpenings(room: Studio): Studio {
  return { ...room, openings: room.openings.map(o => {
    const w = room.walls.find(w => w.id === o.wall), l = w && wallLine(room, w);
    if (!w || !l) return o;
    const limits = openingLimits(o.kind), available = l.length - 2 * limits.endMargin;
    if (available < limits.minWidth) return o;
    const width = Math.floor(Math.min(o.width, available) * 10 + 1e-7) / 10;
    const range = openingRange(l.length, width, limits.endMargin);
    const height = Math.min(o.height, w.height - limits.topMargin);
    return { ...o, width, height, offset: Math.round(Math.max(range.min, Math.min(range.max, o.offset)) * 10) / 10,
      sill: Math.round(Math.max(0, Math.min(o.sill, w.height - height - limits.topMargin)) * 10) / 10 };
  }) };
}
