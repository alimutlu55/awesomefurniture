import { cornerDegree, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioCorner, StudioWall } from '../../domain/studio/studio';
import { alignTo, type Align } from './align-snap';
import { measureNumber } from './editor-format.js';

/** The geometry of dragging a room's corners, walls and openings: where the pointer wants the part to
 * go, the lines it can snap to, and the guides that show why it snapped. Plain data in scene
 * centimetres; the room editor turns it into edits. */

type P = { x: number; z: number };
/** A guide line on the floor and why it shows. `info` is a reading (an angle), not a snap. */
export interface Guide { readonly a: P; readonly b: P; readonly label: string; readonly info?: boolean }
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
  const nbs = [...own].map(id => room.corners.find(c => c.id === id)!).filter(Boolean);
  // Straight: between its two neighbours, the two walls become one straight run.
  if (!x && !z && nbs.length === 2) {
    const [o1, o2] = nbs as [StudioCorner, StudioCorner], len = near(o1, o2);
    if (len > 1) {
      const ux = (o2.x - o1.x) / len, uz = (o2.z - o1.z) / len, t = (raw.x - o1.x) * ux + (raw.z - o1.z) * uz, off = (raw.x - o1.x) * -uz + (raw.z - o1.z) * ux;
      const held = locks.ray?.label === 'straight';
      if (t > 0 && t < len && Math.abs(off) <= tolerance * (held ? 1.6 : 1)) {
        at.x = o1.x + ux * t; at.z = o1.z + uz * t;
        return { at, locks: { x: null, z: null, ray: { v: 0, label: 'straight' }, join: null }, guides: [{ a: o1, b: o2, label: 'Straight' }] };
      }
    }
  }
  if (!x && !z) {
    // A wall from a neighbour at 45°, or parallel to another wall of the room.
    const others = room.walls.filter(w => w.a !== id && w.b !== id).map(w => wallLine(room, w)).filter(l => l !== null).map(l => Math.atan2(l.uz, l.ux));
    for (const o of nbs) {
      const len = near(o, raw);
      if (len < 1) continue;
      const angle = Math.atan2(raw.z - o.z, raw.x - o.x), step = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
      const diagonal = Math.round(step / (Math.PI / 4)) % 2 !== 0;
      const options = [...(diagonal ? [{ v: step, label: '45°' }] : []), ...others.flatMap(a => [a, a + Math.PI, a - Math.PI].map(v => ({ v, label: 'Parallel' })))];
      for (const c of options) {
        const off = len * Math.sin(angle - c.v), held = locks.ray?.label === o.id && Math.abs(locks.ray.v - c.v) < 1e-6;
        if (Math.abs(off) > tolerance * (held ? 1.6 : 1) || Math.cos(angle - c.v) <= 0) continue;
        const along = len * Math.cos(angle - c.v);
        at.x = o.x + Math.cos(c.v) * along; at.z = o.z + Math.sin(c.v) * along;
        ray = { v: c.v, label: o.id };
        guides.push({ a: o, b: at, label: c.label });
        break;
      }
      if (ray) break;
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

/** The angle between the two walls meeting at a corner, as a reading beside it: green when square or
 * straight. Null for a free end. */
export function cornerAngle(room: Studio, id: string): Guide | null {
  const c = room.corners.find(x => x.id === id), nbs = neighbours(room, id).map(n => room.corners.find(x => x.id === n)).filter((n): n is StudioCorner => !!n);
  if (!c || nbs.length !== 2) return null;
  const [p, q] = nbs as [StudioCorner, StudioCorner], a = Math.atan2(p.z - c.z, p.x - c.x), b = Math.atan2(q.z - c.z, q.x - c.x);
  let deg = Math.abs(a - b) * 180 / Math.PI;
  if (deg > 180) deg = 360 - deg;
  const shown = Math.round(deg * 2) / 2, square = Math.abs(shown - 90) < .01, straight = Math.abs(shown - 180) < .01;
  return { a: c, b: c, label: square ? '90° Square' : straight ? '180° Straight' : shown + '°', info: !square && !straight };
}

/** While a wall moves: the nearest wardrobe in front of it (one not going with it) and the gap to it, as a
 * ruler from the wall's face to the wardrobe's nearest corner. Null when none stands within 3 m. */
export function wardrobeGap(room: Studio, w: StudioWall, standing: readonly { id: number; x: number; z: number; angle: number; w: number; d: number }[], skip: ReadonlySet<number>) {
  const line = wallLine(room, w), face = wallFace(room, w);
  if (!line || !face) return null;
  let best: { out: number; along: number } | null = null;
  for (const f of standing) {
    if (skip.has(f.id)) continue;
    const a = f.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), vx = Math.sin(a), vz = Math.cos(a);
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const x = f.x + i * f.w / 2 * ux + j * f.d / 2 * vx - line.a.x, z = f.z + i * f.w / 2 * uz + j * f.d / 2 * vz - line.a.z;
      const along = x * line.ux + z * line.uz, out = x * line.nx + z * line.nz - w.thickness / 2;
      if (along >= face.start && along <= face.end && out > -.5 && out < 300 && (!best || out < best.out)) best = { out, along };
    }
  }
  if (!best) return null;
  const at = (d: number) => ({ x: line.a.x + line.ux * best!.along + line.nx * (w.thickness / 2 + d), y: 100, z: line.a.z + line.uz * best!.along + line.nz * (w.thickness / 2 + d) });
  return { a: at(0), b: at(Math.max(0, best.out)), text: best.out < .5 ? 'Flush' : measureNumber(Math.round(best.out * 10) / 10) + ' cm' };
}
/** `wardrobeGap` for the scene's wardrobes, leaving out those carried with the wall. */
export function wallGap(room: Studio, w: StudioWall, wardrobes: readonly { id: number; x: number; z: number; angle: number; state: { w: number; d: number } }[], carry: { list: readonly { id: number }[] } | null) {
  return wardrobeGap(room, w, wardrobes.map(c => ({ id: c.id, x: c.x, z: c.z, angle: c.angle, w: c.state.w, d: c.state.d })), new Set(carry?.list.map(c => c.id) ?? []));
}
