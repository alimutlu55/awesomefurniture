import { wallLine, type Studio } from './studio';

interface FloorVector { readonly x: number; readonly z: number }
/** Wall under the view's floor-plane ray. Only room-facing surfaces count:
 * an outside orbit must see through the near cutaway wall to the far wall. */
export function viewedWall(studio: Studio, origin: FloorVector, direction: FloorVector): string | undefined {
  const length = Math.hypot(direction.x, direction.z);
  if (!Number.isFinite(length) || length < 1e-6) return undefined;
  const dx = direction.x / length, dz = direction.z / length;
  let hit: { id: string; distance: number } | undefined;
  let facing: { id: string; score: number } | undefined;
  for (const wall of studio.walls) {
    const line = wallLine(studio, wall);
    if (!line || line.length < .01) continue;
    const dot = dx * line.nx + dz * line.nz;
    if (dot >= -1e-6) continue;
    // When panning just beyond an edge, retain the most directly faced wall.
    if (!facing || -dot > facing.score) facing = { id: wall.id, score: -dot };
    const side = (origin.x - line.a.x) * line.nx + (origin.z - line.a.z) * line.nz;
    const distance = (wall.thickness / 2 - side) / dot;
    if (distance < 0) continue;
    const along = (origin.x + dx * distance - line.a.x) * line.ux
      + (origin.z + dz * distance - line.a.z) * line.uz;
    if (along < 0 || along > line.length) continue;
    if (!hit || distance < hit.distance) hit = { id: wall.id, distance };
  }
  return hit?.id ?? facing?.id;
}
