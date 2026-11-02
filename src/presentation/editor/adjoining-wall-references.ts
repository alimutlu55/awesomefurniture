import type { Vec } from '../../domain/geometry/profile-polygon';
import { surfaceProfile, type SurfaceProfile } from '../../domain/studio/surface-profile';
import { wallLine, type Studio } from '../../domain/studio/studio';

/** Cut a contextual outline to a short strip, keeping the selected wall large enough to edit on phones. */
function strip(points: readonly Vec[], lo: number, hi: number): Vec[] {
  let out = [...points];
  for (const [edge, sign] of [[lo, 1], [hi, -1]] as const) {
    const input = out; out = [];
    input.forEach((b, i) => {
      const a = input[(i + input.length - 1) % input.length]!, ai = (a.x - edge) * sign >= 0, bi = (b.x - edge) * sign >= 0;
      if (ai !== bi) out.push({ x: edge, y: a.y + (b.y - a.y) * (edge - a.x) / (b.x - a.x) });
      if (bi) out.push(b);
    });
  }
  return out;
}

/** Front: unfold the connected walls beside the face. Side: project them into the room's depth.
 * Only walls sharing a real corner count; nearby disconnected walls are not adjoining walls. */
export function adjoiningWallReferences(room: Studio, s: SurfaceProfile): NonNullable<SurfaceProfile['adjoining']> {
  const line = wallLine(room, s.wall);
  if (!line) return [];
  const reach = Math.max(30, Math.min(70, (s.context.to - s.context.from) * .22));
  return room.walls.flatMap(w => {
    if (w.id === s.wall.id) return [];
    const left = w.a === s.wall.a || w.b === s.wall.a, right = w.a === s.wall.b || w.b === s.wall.b;
    if (!left && !right) return [];
    const other = surfaceProfile(room, { kind: 'wall', id: w.id }, 'front'), ol = wallLine(room, w);
    if (!other || !ol) return [];
    const joint = left ? s.wall.a : s.wall.b, atStart = w.a === joint;
    const points = other.points.map(p => {
      if (s.view === 'front') {
        const distance = atStart ? p.x - other.context.from : other.context.to - p.x;
        return { x: left ? s.context.from - distance : s.context.to + distance, y: p.y };
      }
      const x = ol.a.x + ol.ux * p.x + ol.nx * w.thickness / 2 - line.a.x;
      const z = ol.a.z + ol.uz * p.x + ol.nz * w.thickness / 2 - line.a.z;
      return { x: x * line.nx + z * line.nz - s.wall.thickness / 2, y: p.y };
    });
    const clipped = s.view === 'front'
      ? strip(points, left ? s.context.from - reach : s.context.to, left ? s.context.from : s.context.to + reach)
      : strip(points, s.context.from, Math.max(s.context.to, reach));
    // Perpendicular walls can collapse to a line in section; they still give a height reference.
    return clipped.length >= 2 ? [{ id: w.id, points: clipped }] : [];
  });
}
