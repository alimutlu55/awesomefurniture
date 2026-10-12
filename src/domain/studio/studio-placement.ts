/**
 * Placing wardrobes in a room: against a wall, out of a wall, and snapping to a wall while dragged.
 * The caller supplies `collides`, the scene's own collision test (wardrobes and walls), so these rules
 * never disagree with what dragging allows. Centimetres; angles in degrees, as on a wardrobe.
 */
import { wallFace, wallLine } from './studio';
import { reachAt } from './studio-ceiling';
import type { Studio, StudioWall } from './studio';

export interface Pose { readonly x: number; readonly z: number; readonly angle: number }
export interface Footprint { readonly w: number; readonly d: number }
type Collides = (pose: Pose) => boolean;

const round = (n: number) => Math.round(n * 100) / 100;
/** Half the wardrobe's extent along a floor direction, at its angle. */
function reach(pose: Pose, size: Footprint, dx: number, dz: number) {
  const a = pose.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), vx = Math.sin(a), vz = Math.cos(a);
  return Math.abs(ux * dx + uz * dz) * size.w / 2 + Math.abs(vx * dx + vz * dz) * size.d / 2;
}
/** The pose that puts the wardrobe's back flush against the wall's room face, at `along` cm from corner a. */
function flush(studio: Studio, w: StudioWall, along: number, size: Footprint): Pose | null {
  const line = wallLine(studio, w);
  if (!line) return null;
  const off = w.thickness / 2 + size.d / 2;
  return { x: round(line.a.x + line.ux * along + line.nx * off), z: round(line.a.z + line.uz * along + line.nz * off), angle: line.angle };
}

/** The first free spot flush against a wall, facing into the room: longest walls first, from the middle
 * of each wall outwards. Null when no wall has room. */
export function placeAgainstWall(studio: Studio, size: Footprint, collides: Collides): Pose | null {
  const walls = studio.walls.map(w => ({ w, line: wallLine(studio, w) })).filter(x => x.line && x.line.length >= size.w).sort((p, q) => q.line!.length - p.line!.length);
  for (const { w, line } of walls) {
    const min = size.w / 2, max = line!.length - size.w / 2, mid = line!.length / 2;
    for (let step = 0; mid - step >= min - .01 || mid + step <= max + .01; step += 5) {
      for (const along of step ? [mid - step, mid + step] : [mid]) {
        if (along < min - .01 || along > max + .01) continue;
        const pose = flush(studio, w, along, size);
        if (pose && !collides(pose)) return pose;
      }
    }
  }
  return null;
}

/** Moves a wardrobe that overlaps walls out to their room side, the shortest way. Null if it cannot be
 * freed (the room is too small for it there). */
export function pushOutOfWalls(studio: Studio, pose: Pose, size: Footprint, collides: Collides): Pose | null {
  let current = pose;
  for (let round_ = 0; round_ < 4 && collides(current); round_++) {
    let best: Pose | null = null, bestMove = Infinity;
    for (const w of studio.walls) {
      const line = wallLine(studio, w);
      if (!line) continue;
      const along = (current.x - line.a.x) * line.ux + (current.z - line.a.z) * line.uz;
      const half = reach(current, size, line.ux, line.uz);
      if (along + half < -w.thickness / 2 || along - half > line.length + w.thickness / 2) continue;
      const distance = (current.x - line.a.x) * line.nx + (current.z - line.a.z) * line.nz;
      const needed = w.thickness / 2 + reach(current, size, line.nx, line.nz) - distance;
      if (needed <= 0 || distance < -w.thickness / 2 - reach(current, size, line.nx, line.nz)) continue;
      if (needed < bestMove) { bestMove = needed; best = { ...current, x: round(current.x + line.nx * needed), z: round(current.z + line.nz * needed) }; }
    }
    if (!best) break;
    current = best;
  }
  return collides(current) ? null : current;
}

/** While a wardrobe is dragged: if its back is within `distance` of a wall's room face and it is
 * nearly parallel, the pose that puts it flush and square against that wall. Else null. */
export function snapToWall(studio: Studio, pose: Pose, size: Footprint, distance = 10, maxTurn = 20): Pose | null {
  let best: { pose: Pose; gap: number } | null = null;
  for (const w of studio.walls) {
    const line = wallLine(studio, w);
    if (!line) continue;
    const turn = Math.abs(((pose.angle - line.angle) % 360 + 540) % 360 - 180);
    if (turn > maxTurn) continue;
    const along = (pose.x - line.a.x) * line.ux + (pose.z - line.a.z) * line.uz;
    if (along < -size.w / 2 || along > line.length + size.w / 2) continue;
    const back = (pose.x - line.a.x) * line.nx + (pose.z - line.a.z) * line.nz - size.d / 2 - w.thickness / 2;
    if (back < -1 || back > distance) continue;
    // Only the gap closes and the wardrobe squares up; it keeps its place along the wall.
    const snapped = flush(studio, w, along, size);
    if (snapped && (!best || back < best.gap)) best = { pose: snapped, gap: back };
  }
  return best?.pose ?? null;
}

/** Where a wardrobe stands on the floor, as the room sees it: centre, turn and size. */
export interface Standing extends Pose, Footprint {}
/** Casing beside a door or window: a wardrobe stops short of it. */
const CASING = 7;

/** A wardrobe that fills a wall: the longest stretch of its inside face that is free of doors, windows and
 * the wardrobes already standing there, as wide as it allows (`min`–`max` cm), flush and square against
 * it, `depth` deep or less where the room in front is shallow (a walkway of 50 cm stays clear). Null when
 * no stretch is wide enough. */
export function wallSpot(studio: Studio, wallId: string, standing: readonly Standing[], limits: { min: number; max: number; depth: number }) {
  const w = studio.walls.find(x => x.id === wallId), line = w && wallLine(studio, w), face = w && wallFace(studio, w);
  if (!w || !line || !face) return null;
  let free: [number, number][] = [[face.start, face.end]];
  const cut = (from: number, to: number) => { free = free.flatMap(([s, e]) => to <= s || from >= e ? [[s, e] as [number, number]] : [[s, from], [to, e]].filter(([p, q]) => q! - p! > .5) as [number, number][]); };
  for (const o of studio.openings) if (o.wall === wallId) cut(o.offset - o.width / 2 - CASING, o.offset + o.width / 2 + CASING);
  for (const f of standing) {
    const a = f.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), vx = Math.sin(a), vz = Math.cos(a);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
      const x = f.x + i! * f.w / 2 * ux + j! * f.d / 2 * vx - line.a.x, z = f.z + i! * f.w / 2 * uz + j! * f.d / 2 * vz - line.a.z;
      return { along: x * line.ux + z * line.uz, out: x * line.nx + z * line.nz - w.thickness / 2 };
    });
    if (Math.min(...corners.map(c => c.out)) < limits.depth + 10 && Math.max(...corners.map(c => c.out)) > -1) cut(Math.min(...corners.map(c => c.along)), Math.max(...corners.map(c => c.along)));
  }
  const best = free.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
  if (!best || best[1] - best[0] < limits.min) return null;
  const width = Math.floor(Math.min(limits.max, best[1] - best[0])), along = best[0] + width / 2;
  const room = reachAt(studio, wallId, along), depth = Math.min(limits.depth, room === null ? limits.depth : Math.floor(room - 50));
  if (depth < 35) return null;
  const pose = flush(studio, w, along, { w: width, d: depth });
  return pose && { pose, w: width, d: depth };
}
