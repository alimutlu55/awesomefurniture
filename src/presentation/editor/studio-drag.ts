import { cornerDegree, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioWall } from '../../domain/studio/studio';
import { alignTo, type Align } from './align-snap';

/** The geometry of dragging a room's corners, walls and openings: where the pointer wants the part to
 * go, the lines it can snap to, and the guides that show why it snapped. Plain data in scene
 * centimetres; the room editor turns it into edits. */

type P = { x: number; z: number };
export interface Guide { readonly a: P; readonly b: P; readonly label: string }
export interface CornerLocks { x: Align | null; z: Align | null; ray: Align | null; join: string | null }

/** A free wall end dropped this close to another (centimetres) joins it: people aim at the end of the
 * wall they see, which from above can be a few wall thicknesses from its corner. */
const JOIN = 36;
const near = (p: P, q: P) => Math.hypot(p.x - q.x, p.z - q.z);
const neighbours = (room: Studio, id: string) => room.walls.flatMap(w => w.a === id ? [w.b] : w.b === id ? [w.a] : []);

/** Where a dragged corner goes: squared with the corners at the other ends of its walls, aligned with any
 * other corner, along a 45° line from a neighbour, or onto a free wall end it can join. `tolerance` is
 * in centimetres (about 8 screen pixels at the current zoom). */
export function snapCorner(room: Studio, id: string, raw: P, locks: CornerLocks, tolerance: number) {
  const own = new Set(neighbours(room, id)), guides: Guide[] = [];
  const others = room.corners.filter(c => c.id !== id);
  // A free end can join another free end: the room closes there.
  const free = cornerDegree(room, id) === 1;
  const join = free ? others.filter(c => cornerDegree(room, c.id) === 1 && !own.has(c.id)).find(c => near(c, raw) <= Math.max(JOIN, tolerance * 2.5) * (locks.join === c.id ? 1.35 : 1)) : undefined;
  if (join) return { at: { x: join.x, z: join.z }, locks: { x: null, z: null, ray: null, join: join.id }, guides: [{ a: join, b: join, label: 'Join walls' }] };
  const name = (cid: string) => own.has(cid) ? 'Square' : 'Aligned with corner';
  const xs = others.map(c => ({ v: c.x, label: name(c.id) })), zs = others.map(c => ({ v: c.z, label: name(c.id) }));
  const x = alignTo(raw.x, xs, locks.x, tolerance), z = alignTo(raw.z, zs, locks.z, tolerance);
  const at = { x: x?.v ?? raw.x, z: z?.v ?? raw.z };
  const source = (axis: 'x' | 'z', v: number) => others.filter(c => Math.abs(c[axis] - v) < 1e-6).sort((p, q) => Number(own.has(q.id)) - Number(own.has(p.id)) || near(p, at) - near(q, at))[0]!;
  if (x) guides.push({ a: source('x', x.v), b: at, label: x.label });
  if (z) guides.push({ a: source('z', z.v), b: at, label: z.label });
  let ray: Align | null = null;
  if (!x && !z) {
    // A diagonal: 45° or 135° from a neighbour.
    for (const nid of own) {
      const o = room.corners.find(c => c.id === nid)!, len = near(o, raw);
      if (len < 1) continue;
      const angle = Math.atan2(raw.z - o.z, raw.x - o.x), step = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
      if (Math.round(step / (Math.PI / 4)) % 2 === 0) continue;
      const off = len * Math.sin(angle - step), held = locks.ray?.label === nid && Math.abs(locks.ray.v - step) < 1e-6;
      if (Math.abs(off) > tolerance * (held ? 1.6 : 1)) continue;
      const along = len * Math.cos(angle - step);
      at.x = o.x + Math.cos(step) * along; at.z = o.z + Math.sin(step) * along;
      ray = { v: step, label: nid };
      guides.push({ a: o, b: at, label: '45°' });
      break;
    }
  }
  return { at, locks: { x, z, ray, join: null }, guides };
}

/** Distances a wall can move to so its line passes through another corner (lining it up with a wall
 * elsewhere in the room), measured along its room side from where it is now. */
export function wallTargets(room: Studio, w: StudioWall): Align[] {
  const line = wallLine(room, w);
  if (!line) return [];
  return room.corners.filter(c => c.id !== w.a && c.id !== w.b).map(c => ({ v: (c.x - line.a.x) * line.nx + (c.z - line.a.z) * line.nz, label: 'Aligned with corner' }));
}

/** The opening's centre along its wall when it is centred on the wall's inside face. */
export function centredOffset(room: Studio, w: StudioWall) {
  const face = wallFace(room, w);
  return face ? (face.start + face.end) / 2 : null;
}

/** Moves toward `want` as far as the room allows: the whole way if valid, else the furthest valid point
 * between `from` (valid) and `want`, found by halving. `at(t)` builds the room at fraction t. */
export function furthestValid<T>(at: (t: number) => T | null, valid: (room: T) => boolean): { room: T | null; whole: boolean } {
  const whole = at(1);
  if (whole && valid(whole)) return { room: whole, whole: true };
  let lo = 0, hi = 1, best: T | null = null;
  for (let n = 0; n < 14; n++) {
    const mid = (lo + hi) / 2, cand = at(mid);
    if (cand && valid(cand)) { lo = mid; best = cand; } else hi = mid;
  }
  return { room: best, whole: false };
}
