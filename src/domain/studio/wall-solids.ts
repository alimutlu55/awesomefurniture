/**
 * Walls are solid: each stands on a rectangle of the floor, its thickness wide (wallBox). Two walls may only
 * share the floor where they meet at a corner; anywhere else one would run into the other, which no room can
 * have. Plain data, scene centimetres.
 */
import { corner, wallBox, wallLine, type Studio, type StudioWall } from './studio';

type P = { x: number; z: number };
/** Walls joined at a corner need this much angle between them, or they would fold into each other. */
export const MIN_CORNER_ANGLE = 20;
/** Shared floor below this (cm²) is rounding, not an overlap. */
const AREA_EPS = 1;

/** A wall's footprint on the floor, counter-clockwise. */
export function wallFootprint(studio: Studio, w: StudioWall): P[] | null {
  const box = wallBox(studio, w), line = wallLine(studio, w);
  if (!box || !line) return null;
  const hl = box.length / 2, ht = box.thickness / 2, u = { x: line.ux, z: line.uz }, n = { x: line.nx, z: line.nz };
  return [[-hl, -ht], [hl, -ht], [hl, ht], [-hl, ht]].map(([s, d]) => ({ x: box.x + u.x * s! + n.x * d!, z: box.z + u.z * s! + n.z * d! }));
}

const area = (poly: readonly P[]) => Math.abs(poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]!; return sum + p.x * q.z - q.x * p.z; }, 0)) / 2;
/** The part of convex polygon `subject` inside convex polygon `clip` (both counter-clockwise or both clockwise). */
function clipConvex(subject: readonly P[], clip: readonly P[]): P[] {
  const sign = Math.sign(clip.reduce((s, p, i) => { const q = clip[(i + 1) % clip.length]!; return s + p.x * q.z - q.x * p.z; }, 0)) || 1;
  let out = [...subject];
  clip.forEach((a, i) => {
    const b = clip[(i + 1) % clip.length]!, side = (p: P) => sign * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
    const input = out; out = [];
    input.forEach((p, k) => {
      const q = input[(k + 1) % input.length]!, sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const f = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * f, z: p.z + (q.z - p.z) * f }); }
    });
  });
  return out;
}

/** Floor two walls would share, cm²: none for walls that meet at a corner at a sound angle. */
export function sharedFloor(studio: Studio, p: StudioWall, q: StudioWall): number {
  const joint = [p.a, p.b].find(c => c === q.a || c === q.b);
  if (joint) return 0;
  const a = wallFootprint(studio, p), b = wallFootprint(studio, q);
  if (!a || !b) return 0;
  const shared = clipConvex(a, b);
  return shared.length >= 3 ? area(shared) : 0;
}

/** The angle at a corner between two walls that meet there, degrees (0 when one folds back onto the other). */
export function cornerAngle(studio: Studio, p: StudioWall, q: StudioWall): number | null {
  const joint = [p.a, p.b].find(c => c === q.a || c === q.b), at = joint && corner(studio, joint);
  if (!joint || !at) return null;
  const far = (w: StudioWall) => corner(studio, w.a === joint ? w.b : w.a);
  const e = far(p), f = far(q);
  if (!e || !f) return null;
  const u = { x: e.x - at.x, z: e.z - at.z }, v = { x: f.x - at.x, z: f.z - at.z }, lu = Math.hypot(u.x, u.z), lv = Math.hypot(v.x, v.z);
  if (lu < 1e-9 || lv < 1e-9) return null;
  return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.z * v.z) / (lu * lv)))) * 180 / Math.PI;
}

/** Every pair of walls that runs into each other, keyed by their ids, with the floor they would share. */
export function wallClashes(studio: Studio): Map<string, number> {
  const out = new Map<string, number>(), walls = studio.walls;
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const p = walls[i]!, q = walls[j]!, key = [p.id, q.id].sort().join('/');
    const angle = cornerAngle(studio, p, q);
    // Joined walls at a corner: they only clash when they fold onto each other.
    if (angle !== null) { if (angle < MIN_CORNER_ANGLE - 1e-6) out.set(key, Infinity); continue; }
    const shared = sharedFloor(studio, p, q);
    if (shared > AREA_EPS) out.set(key, shared);
  }
  return out;
}

/** Why `next` is not physically possible where `before` was: a wall that now runs into another, or further than it
 * did (rooms saved before this rule may already have one; they can still be edited, just not made worse). */
export function newWallClash(before: Studio | undefined, next: Studio): string | null {
  const was = before ? wallClashes(before) : new Map<string, number>();
  for (const [key, shared] of wallClashes(next)) {
    const old = was.get(key);
    if (old === undefined || shared > old + AREA_EPS) {
      return shared === Infinity ? `Walls meeting at a corner need at least ${MIN_CORNER_ANGLE}° between them.`
        : 'Walls cannot run into each other. Stop it at the other wall’s face, or join them at a corner.';
    }
  }
  return null;
}
