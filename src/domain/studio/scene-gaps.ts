/**
 * What a carpenter measures around a wardrobe: the gap on each side to the wall or the next wardrobe (a
 * filler or a scribe closes it), the gap at the back, the room in front of it (doors need 60 cm to open),
 * and the gap above it to the ceiling (a top filler). Each gap is read at three points along the face, as
 * a tape is at the top, middle and bottom of an opening, and the smallest reading counts: walls are rarely
 * square. Plain data in scene centimetres; a wardrobe's x/z is its centre and its front faces +z at angle 0.
 */
import { roomHeight, wallBox, wallFace, wallLine } from './studio';
import type { Studio } from './studio';
import { ceilingAt } from './studio-ceiling';

export type GapSide = 'left' | 'right' | 'back' | 'front' | 'top' | 'bottom';
type P3 = { x: number; y: number; z: number };
/** A wardrobe as the room sees it: centre, turn (degrees), height of its base, size, tallest point. */
export interface PlacedBox { readonly id: number; readonly x: number; readonly z: number; readonly y?: number; readonly angle: number; readonly w: number; readonly d: number; readonly h: number }
export interface Gap {
  readonly side: GapSide;
  readonly distance: number;
  /** The line to draw: from the wardrobe's face to the surface, at a sensible height. */
  readonly from: P3; readonly to: P3;
  readonly target: 'wall' | 'wardrobe' | 'ceiling' | 'floor' | 'wall-end';
  /** The wardrobe it reaches, for alignment. */
  readonly other?: number;
}
export interface Alignment { readonly kind: 'centred' | 'flush' | 'fronts' | 'tops'; readonly sides?: readonly GapSide[]; readonly other?: number; readonly a?: P3; readonly b?: P3 }

/** Gaps this far or farther are not worth showing: nothing nearby. */
const REACH = 600;
/** Within this, two faces touch, or two readings are the same. */
const SAME = .5;
const axes = (angle: number) => {
  const a = angle * Math.PI / 180;
  return { u: { x: Math.cos(a), z: -Math.sin(a) }, f: { x: Math.sin(a), z: Math.cos(a) } };
};
type Rect = { cx: number; cz: number; hu: number; hf: number; u: { x: number; z: number }; f: { x: number; z: number }; target: Gap['target']; other?: number };

/** Distance along a ray to a rectangle on the floor, or null if it misses (or starts inside, beyond `SAME`). */
function hit(o: { x: number; z: number }, dir: { x: number; z: number }, r: Rect): number | null {
  const px = o.x - r.cx, pz = o.z - r.cz;
  const lo = [px * r.u.x + pz * r.u.z, px * r.f.x + pz * r.f.z], ld = [dir.x * r.u.x + dir.z * r.u.z, dir.x * r.f.x + dir.z * r.f.z], half = [r.hu, r.hf];
  let t0 = -Infinity, t1 = Infinity;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(ld[k]!) < 1e-9) { if (Math.abs(lo[k]!) > half[k]! - .01) return null; continue; }
    const a = (-half[k]! - lo[k]!) / ld[k]!, b = (half[k]! - lo[k]!) / ld[k]!;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
  }
  if (t1 < t0 || t1 < 0) return null;
  return t0 >= -SAME ? Math.max(0, t0) : null;
}

/** Whether two footprints overlap horizontally on the floor beyond `SAME`. */
function footprintsOverlap(a: PlacedBox, b: PlacedBox): boolean {
  const aa = axes(a.angle), ba = axes(b.angle);
  for (const axis of [aa.u, aa.f, ba.u, ba.f]) {
    const ra = Math.abs(aa.u.x * axis.x + aa.u.z * axis.z) * a.w / 2 + Math.abs(aa.f.x * axis.x + aa.f.z * axis.z) * a.d / 2;
    const rb = Math.abs(ba.u.x * axis.x + ba.u.z * axis.z) * b.w / 2 + Math.abs(ba.f.x * axis.x + ba.f.z * axis.z) * b.d / 2;
    if (Math.abs((a.x - b.x) * axis.x + (a.z - b.z) * axis.z) >= ra + rb - SAME) return false;
  }
  return true;
}

/** Where on `box`'s front face a vertical gap line to `other` (or the ceiling/floor) sits along its width. */
function verticalAnchor(box: PlacedBox, other: PlacedBox | undefined): number {
  if (!other) return box.w / 2 - 6;
  const { u } = axes(box.angle), oa = axes(other.angle), along = (other.x - box.x) * u.x + (other.z - box.z) * u.z;
  const half = Math.abs(oa.u.x * u.x + oa.u.z * u.z) * other.w / 2 + Math.abs(oa.f.x * u.x + oa.f.z * u.z) * other.d / 2;
  const s0 = Math.max(-box.w / 2 + 4, along - half), s1 = Math.min(box.w / 2 - 4, along + half);
  return s0 <= s1 ? (s0 + s1) / 2 : box.w / 2 - 6;
}

/** The gaps around wardrobe `box` on the requested sides, to the room's walls and the other wardrobes. */
export function gapsAround(box: PlacedBox, others: readonly PlacedBox[], studio: Studio | undefined, sides: readonly GapSide[]): Gap[] {
  const { u, f } = axes(box.angle), y0 = box.y ?? 0, y1 = y0 + box.h, rects: Rect[] = [];
  // Broad phase: a piece farther than REACH beyond both footprints can never be hit within REACH, so it is not tested.
  const radius = (b: PlacedBox) => Math.hypot(b.w, b.d) / 2, far = (o: PlacedBox) => Math.hypot(o.x - box.x, o.z - box.z) > REACH + radius(box) + radius(o);
  for (const o of others) {
    const oy0 = o.y ?? 0, oy1 = oy0 + o.h;
    if (o.id !== box.id && oy0 < y1 - SAME && oy1 > y0 + SAME && !far(o)) {
      const a = axes(o.angle);
      rects.push({ cx: o.x, cz: o.z, hu: o.w / 2, hf: o.d / 2, u: a.u, f: a.f, target: 'wardrobe', other: o.id });
    }
  }
  for (const w of studio?.walls ?? []) {
    const b = wallBox(studio!, w);
    if (b) { const a = axes(b.angle); rects.push({ cx: b.x, cz: b.z, hu: b.length / 2, hf: b.thickness / 2, u: a.u, f: a.f, target: 'wall' }); }
  }
  // Side gaps are drawn high on the wardrobe, clear of its own height and width measurements.
  const mid = y0 + box.h * .8, at = (s: number, t: number) => ({ x: box.x + u.x * s + f.x * t, z: box.z + u.z * s + f.z * t });
  const out: Gap[] = [];
  for (const side of sides) {
    if (side === 'top') {
      // The lowest ceiling or upper cabinet over the wardrobe's footprint, less its tallest point.
      let low = studio ? roomHeight(studio) : Infinity, target: Gap['target'] = 'ceiling', otherBox: PlacedBox | undefined;
      if (studio) for (const [s, t] of [[-.45, -.45], [.45, -.45], [0, 0], [-.45, .45], [.45, .45]] as const) low = Math.min(low, ceilingAt(studio, at(s * box.w, t * box.d)));
      for (const o of others) {
        const oy0 = o.y ?? 0;
        if (o.id !== box.id && oy0 >= y1 - SAME && oy0 < low && footprintsOverlap(box, o)) { low = oy0; target = 'wardrobe'; otherBox = o; }
      }
      if (low < Infinity && low - y1 > -SAME && low - y1 < REACH) {
        const c = at(verticalAnchor(box, otherBox), box.d / 2);
        out.push({ side, distance: Math.round(Math.max(0, low - y1) * 10) / 10, from: { ...c, y: y1 }, to: { ...c, y: low }, target, ...(otherBox ? { other: otherBox.id } : {}) });
      }
      continue;
    }
    if (side === 'bottom') {
      if (y0 <= SAME) continue;
      // The highest cabinet below an elevated wardrobe's footprint, else the floor.
      let high = 0, target: Gap['target'] = 'floor', otherBox: PlacedBox | undefined;
      for (const o of others) {
        const oy1 = (o.y ?? 0) + o.h;
        if (o.id !== box.id && oy1 <= y0 + SAME && oy1 > high && footprintsOverlap(box, o)) { high = oy1; target = 'wardrobe'; otherBox = o; }
      }
      if (y0 - high > -SAME && y0 - high < REACH) {
        const c = at(verticalAnchor(box, otherBox), box.d / 2);
        out.push({ side, distance: Math.round(Math.max(0, y0 - high) * 10) / 10, from: { ...c, y: y0 }, to: { ...c, y: high }, target, ...(otherBox ? { other: otherBox.id } : {}) });
      }
      continue;
    }
    const along = side === 'left' || side === 'right', sign = side === 'right' || side === 'front' ? 1 : -1;
    const dir = along ? { x: u.x * sign, z: u.z * sign } : { x: f.x * sign, z: f.z * sign };
    const face = along ? box.w / 2 : box.d / 2, span = (along ? box.d : box.w) / 2 - 1;
    let best: { t: number; o: { x: number; z: number }; r: Rect } | null = null;
    for (const k of [-1, 0, 1]) {
      const o = along ? at(sign * face, k * span) : at(k * span, sign * face);
      for (const r of rects) { const t = hit(o, dir, r); if (t !== null && t < REACH && (!best || t < best.t)) best = { t, o, r }; }
    }
    if (!best) continue;
    // Drawn where the smallest reading was: beside it at the height a person reads it, in front or behind on the floor.
    const o = best.o, end = { x: o.x + dir.x * best.t, z: o.z + dir.z * best.t }, y = along ? mid : y0 + 2;
    out.push({ side, distance: Math.round(best.t * 10) / 10, from: { x: o.x, y, z: o.z }, to: { x: end.x, y, z: end.z }, target: best.r.target, ...(best.r.other !== undefined ? { other: best.r.other } : {}) });
  }
  return out;
}

/** A wall this close behind a wardrobe, or closer, is the one it stands against. */
const AGAINST = 10;

/** The wall a wardrobe stands against: facing the same way as its room side, at most AGAINST behind it, and
 * along it. `t` is where the middle of its back is along the wall's face (from corner `a`, as an opening's
 * offset), `dist` how far its back stands off the face. Null when it stands against none. */
export function wallAgainst(box: Pick<PlacedBox, 'x' | 'z' | 'angle' | 'd'>, studio: Studio | undefined) {
  if (!studio) return null;
  const { f } = axes(box.angle), back = { x: box.x - f.x * box.d / 2, z: box.z - f.z * box.d / 2 };
  let against: { id: string; dist: number; t: number; line: NonNullable<ReturnType<typeof wallLine>>; face: NonNullable<ReturnType<typeof wallFace>> } | null = null;
  for (const w of studio.walls) {
    const line = wallLine(studio, w), face = wallFace(studio, w);
    if (!line || !face || line.nx * f.x + line.nz * f.z < .999) continue;
    const dist = (back.x - face.from.x) * line.nx + (back.z - face.from.z) * line.nz;
    const t = face.start + (back.x - face.from.x) * line.ux + (back.z - face.from.z) * line.uz;
    if (dist < -SAME || dist > AGAINST || t < face.start || t > face.end || (against && against.dist <= dist)) continue;
    against = { id: w.id, dist, t, line, face };
  }
  return against;
}

/** Where the wall a wardrobe stands against stops beside it, on its left and right: the wall's free end, or the
 * edge of a door, window or archway in it at the wardrobe's height. Only read on screen while it is moved or
 * resized (past it a cabinet stands off the wall or in a doorway); a filler never closes it. */
export function wallEndsAround(box: PlacedBox, studio: Studio | undefined, sides: readonly GapSide[]): Gap[] {
  if (!studio) return [];
  const { u } = axes(box.angle), y0 = box.y ?? 0, top = y0 + box.h, against = wallAgainst(box, studio);
  if (!against) return [];
  const { line, face, t, dist } = against, lo = t - box.w / 2, hi = t + box.w / 2;
  // Openings it would stand in front of at its height; one it already covers is not an end.
  const holes = studio.openings.filter(o => o.wall === against.id && o.sill < top - SAME && o.sill + o.height > y0 + SAME)
    .map(o => [o.offset - o.width / 2, o.offset + o.width / 2] as const).filter(([a, b]) => b <= lo + SAME || a >= hi - SAME);
  const up = Math.min(face.end, ...holes.filter(([a]) => a >= hi - SAME).map(([a]) => a));
  const down = Math.max(face.start, ...holes.filter(([, b]) => b <= lo + SAME).map(([, b]) => b));
  const y = y0 + box.h * .8, off = Math.max(0, dist) + 1, at = (s: number) => ({ x: face.from.x + line.ux * (s - face.start) + line.nx * off, y, z: face.from.z + line.uz * (s - face.start) + line.nz * off });
  // The wardrobe's right runs the wall's way or against it.
  const along = u.x * line.ux + u.z * line.uz > 0, out: Gap[] = [];
  for (const side of sides) {
    if (side !== 'left' && side !== 'right') continue;
    const forward = (side === 'right') === along, [from, to] = forward ? [hi, up] : [lo, down], distance = Math.abs(to - from);
    if ((forward ? to < from - SAME : to > from + SAME) || distance >= REACH) continue;
    out.push({ side, distance: Math.round(distance * 10) / 10, from: at(from), to: at(to), target: 'wall-end' });
  }
  return out;
}

/** The side gaps, each replaced by where the wall behind ends when that comes first. */
export function nearerWallEnds(gaps: readonly Gap[], ends: readonly Gap[]): Gap[] {
  const first = (e: Gap) => !gaps.some(g => g.side === e.side && g.distance <= e.distance + SAME);
  return [...gaps.filter(g => !ends.some(e => e.side === g.side && first(e))), ...ends.filter(first)];
}

/** Turned a quarter turn from each other (an L-shaped run): the moves of `box` that put one of its sides in the plane of
 * `o`'s front (along its width, `across`), or its front in the plane of one of `o`'s sides (along its depth, `along`),
 * each with the two face centres that then lie in one plane, for the guide. Only for pieces near each other and at
 * heights that meet. Centimetres; empty when they are not a quarter turn apart. */
export function cornerMoves(box: PlacedBox, o: PlacedBox) {
  const out = { across: [] as { move: number; a: P3; b: P3 }[], along: [] as { move: number; a: P3; b: P3 }[] };
  const turn = Math.abs(((o.angle - box.angle) % 180 + 180) % 180 - 90);
  const y0 = box.y ?? 0, oy0 = o.y ?? 0;
  if (o.id === box.id || turn > .5 || oy0 >= y0 + box.h - SAME || oy0 + o.h <= y0 + SAME) return out;
  if (Math.hypot(o.x - box.x, o.z - box.z) > (box.w + box.d + o.w + o.d) / 2 + 60) return out;
  const { u, f } = axes(box.angle), oa = axes(o.angle), dot = (p: { x: number; z: number }, q: { x: number; z: number }) => p.x * q.x + p.z * q.z;
  const y = y0 + 1, at = (x: number, z: number) => ({ x, y, z });
  // Its sides into the plane of o's front.
  const front = { x: o.x + oa.f.x * o.d / 2, z: o.z + oa.f.z * o.d / 2 }, un = dot(u, oa.f);
  for (const k of [-1, 1]) {
    const side = { x: box.x + u.x * k * box.w / 2, z: box.z + u.z * k * box.w / 2 };
    out.across.push({ move: -dot({ x: side.x - front.x, z: side.z - front.z }, oa.f) / un, a: at(side.x, side.z), b: at(front.x, front.z) });
  }
  // Its front into the plane of one of o's sides.
  const mine = { x: box.x + f.x * box.d / 2, z: box.z + f.z * box.d / 2 }, fn = dot(f, oa.u);
  for (const k of [-1, 1]) {
    const side = { x: o.x + oa.u.x * k * o.w / 2, z: o.z + oa.u.z * k * o.w / 2 };
    out.along.push({ move: -dot({ x: mine.x - side.x, z: mine.z - side.z }, oa.u) / fn, a: at(mine.x, mine.z), b: at(side.x, side.z) });
  }
  return out;
}

/** What the wardrobe lines up with: centred between the surfaces on its sides, flush against something,
 * its front in line with another wardrobe's, its top level with a neighbour's. */
export function alignments(box: PlacedBox, gaps: readonly Gap[], others: readonly PlacedBox[]): Alignment[] {
  const out: Alignment[] = [], left = gaps.find(g => g.side === 'left'), right = gaps.find(g => g.side === 'right');
  if (left && right && left.distance > SAME && Math.abs(left.distance - right.distance) < SAME) out.push({ kind: 'centred', sides: ['left', 'right'] });
  const topGap = gaps.find(g => g.side === 'top'), bottomGap = gaps.find(g => g.side === 'bottom');
  if (topGap && bottomGap && topGap.distance > SAME && Math.abs(topGap.distance - bottomGap.distance) < SAME) out.push({ kind: 'centred', sides: ['top', 'bottom'] });
  const touching = gaps.filter(g => g.side !== 'top' && g.side !== 'bottom' && g.distance < SAME).map(g => g.side);
  if (touching.length) out.push({ kind: 'flush', sides: touching });
  const { u, f } = axes(box.angle), front = (b: PlacedBox) => { const a = axes(b.angle); return { x: b.x + a.f.x * b.d / 2, z: b.z + a.f.z * b.d / 2 }; };
  const mine = front(box), y0 = box.y ?? 0, y = y0 + 1;
  for (const o of others) {
    if (o.id === box.id || Math.abs(((o.angle - box.angle) % 360 + 540) % 360 - 180) > .5) continue;
    const theirs = front(o), off = (theirs.x - mine.x) * f.x + (theirs.z - mine.z) * f.z, along = (theirs.x - mine.x) * u.x + (theirs.z - mine.z) * u.z;
    const oy0 = o.y ?? 0;
    if (Math.abs(off) < SAME && oy0 < y0 + box.h - SAME && oy0 + o.h > y0 + SAME) {
      const s0 = Math.min(-box.w / 2, along - o.w / 2), s1 = Math.max(box.w / 2, along + o.w / 2);
      out.push({ kind: 'fronts', other: o.id, a: { x: mine.x + u.x * s0, y, z: mine.z + u.z * s0 }, b: { x: mine.x + u.x * s1, y, z: mine.z + u.z * s1 } });
    }
    const near = Math.abs(along) - (box.w + o.w) / 2;
    if (near < 30 && Math.abs(oy0 + o.h - (y0 + box.h)) < SAME) {
      const top = y0 + box.h, s0 = Math.min(-box.w / 2, along - o.w / 2), s1 = Math.max(box.w / 2, along + o.w / 2);
      out.push({ kind: 'tops', other: o.id, a: { x: mine.x + u.x * s0, y: top, z: mine.z + u.z * s0 }, b: { x: mine.x + u.x * s1, y: top, z: mine.z + u.z * s1 } });
    }
    if (y0 > SAME && near < 30 && Math.abs(oy0 - y0) < SAME) {
      const s0 = Math.min(-box.w / 2, along - o.w / 2), s1 = Math.max(box.w / 2, along + o.w / 2);
      out.push({ kind: 'tops', other: o.id, a: { x: mine.x + u.x * s0, y: y0, z: mine.z + u.z * s0 }, b: { x: mine.x + u.x * s1, y: y0, z: mine.z + u.z * s1 } });
    }
  }
  // A quarter turn apart: a side in line with the other's front, or its front in line with the other's side.
  for (const o of others) {
    const c = cornerMoves(box, o);
    for (const m of [...c.across, ...c.along]) if (Math.abs(m.move) < SAME) out.push({ kind: 'fronts', other: o.id, a: m.a, b: m.b });
  }
  return out;
}
