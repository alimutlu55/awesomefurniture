import { STUDIO_LIMITS, cornerDegree, nextId, wallLine, type Studio } from '../../domain/studio/studio';
import { mergeCorners, moveCorner, splitWall } from '../../domain/studio/studio-edit';
import { snapCorner } from './studio-drag';

/** A drawn wall shares an existing corner, or splits the wall it ends on. */
export function attachPlanPoint(studio: Studio, point: { x: number; z: number }, zoom: number) {
  const tolerance = 14 / zoom;
  const corner = studio.corners.map(c => ({ c, distance: Math.hypot(c.x - point.x, c.z - point.z) }))
    .filter(h => h.distance <= tolerance).sort((a, b) => a.distance - b.distance)[0]?.c;
  if (corner) return { room: studio, corner };
  const hit = studio.walls.flatMap(w => {
    const line = wallLine(studio, w);
    if (!line) return [];
    const at = (point.x - line.a.x) * line.ux + (point.z - line.a.z) * line.uz;
    const distance = Math.abs((point.x - line.a.x) * line.nx + (point.z - line.a.z) * line.nz);
    return at >= STUDIO_LIMITS.minWallLength && line.length - at >= STUDIO_LIMITS.minWallLength && distance <= tolerance
      ? [{ w, at, distance }] : [];
  }).sort((a, b) => a.distance - b.distance)[0];
  const split = hit && splitWall(studio, hit.w.id, hit.at);
  if (split) return { room: split, corner: split.corners.at(-1)! };
  const added = { id: nextId('c', studio.corners), ...point };
  return { room: { ...studio, corners: [...studio.corners, added] }, corner: added };
}

/** Screen-sized snap targets, including a real shared junction along another wall. */
export function snapPlanCorner(studio: Studio, id: string, raw: { x: number; z: number }, zoom: number) {
  const tolerance = 14 / zoom;
  if (cornerDegree(studio, id) === 1) {
    const neighbours = new Set(studio.walls.flatMap(w => w.a === id ? [w.b] : w.b === id ? [w.a] : []));
    const end = studio.corners.filter(c => c.id !== id && !neighbours.has(c.id))
      .map(c => ({ c, distance: Math.hypot(c.x - raw.x, c.z - raw.z) }))
      .filter(hit => hit.distance <= tolerance).sort((a, b) => a.distance - b.distance)[0]?.c;
    if (end) {
      return { room: mergeCorners(moveCorner(studio, id, end.x, end.z)!, id, end.id),
        guides: [{ a: end, b: end, label: 'Join walls' }] };
    }
    const hit = studio.walls.filter(w => w.a !== id && w.b !== id).flatMap(w => {
      const line = wallLine(studio, w);
      if (!line) return [];
      const at = (raw.x - line.a.x) * line.ux + (raw.z - line.a.z) * line.uz;
      if (at < STUDIO_LIMITS.minWallLength || line.length - at < STUDIO_LIMITS.minWallLength) return [];
      const point = { x: line.a.x + line.ux * at, z: line.a.z + line.uz * at };
      const distance = Math.hypot(point.x - raw.x, point.z - raw.z);
      return distance <= tolerance ? [{ w, at, point, distance }] : [];
    }).sort((a, b) => a.distance - b.distance)[0];
    if (hit) {
      const split = splitWall(studio, hit.w.id, hit.at);
      if (split) return { room: mergeCorners(moveCorner(split, id, hit.point.x, hit.point.z)!, id, split.corners.at(-1)!.id),
        guides: [{ a: hit.point, b: hit.point, label: 'Join walls' }] };
    }
  }
  const snap = snapCorner(studio, id, raw, { x: null, z: null, ray: null, join: null }, 10 / zoom, true);
  const moved = moveCorner(studio, id, snap.at.x, snap.at.z);
  return { room: moved && snap.locks.join ? mergeCorners(moved, id, snap.locks.join) : moved, guides: snap.guides };
}
