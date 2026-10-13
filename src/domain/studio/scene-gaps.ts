/**
 * What a carpenter measures around a wardrobe: the gap on each side to the wall or the next wardrobe (a
 * filler or a scribe closes it), the gap at the back, the room in front of it (doors need 60 cm to open),
 * and the gap above it to the ceiling (a top filler). Each gap is read at three points along the face, as
 * a tape is at the top, middle and bottom of an opening, and the smallest reading counts: walls are rarely
 * square. Plain data in scene centimetres; a wardrobe's x/z is its centre and its front faces +z at angle 0.
 */
import { roomHeight, wallBox } from './studio';
import type { Studio } from './studio';
import { ceilingAt } from './studio-ceiling';

export type GapSide = 'left' | 'right' | 'back' | 'front' | 'top';
type P3 = { x: number; y: number; z: number };
/** A wardrobe as the room sees it: centre, turn (degrees), height of its base, size, tallest point. */
export interface PlacedBox { readonly id: number; readonly x: number; readonly z: number; readonly y?: number; readonly angle: number; readonly w: number; readonly d: number; readonly h: number }
export interface Gap {
  readonly side: GapSide;
  readonly distance: number;
  /** The line to draw: from the wardrobe's face to the surface, at a sensible height. */
  readonly from: P3; readonly to: P3;
  readonly target: 'wall' | 'wardrobe' | 'ceiling';
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

/** The gaps around wardrobe `box` on the requested sides, to the room's walls and the other wardrobes. */
export function gapsAround(box: PlacedBox, others: readonly PlacedBox[], studio: Studio | undefined, sides: readonly GapSide[]): Gap[] {
  const { u, f } = axes(box.angle), rects: Rect[] = [];
  for (const o of others) if (o.id !== box.id) { const a = axes(o.angle); rects.push({ cx: o.x, cz: o.z, hu: o.w / 2, hf: o.d / 2, u: a.u, f: a.f, target: 'wardrobe', other: o.id }); }
  for (const w of studio?.walls ?? []) {
    const b = wallBox(studio!, w);
    if (b) { const a = axes(b.angle); rects.push({ cx: b.x, cz: b.z, hu: b.length / 2, hf: b.thickness / 2, u: a.u, f: a.f, target: 'wall' }); }
  }
  // Side gaps are drawn high on the wardrobe, clear of its own height and width measurements.
  const y0 = box.y ?? 0, mid = y0 + box.h * .8, at = (s: number, t: number) => ({ x: box.x + u.x * s + f.x * t, z: box.z + u.z * s + f.z * t });
  const out: Gap[] = [];
  for (const side of sides) {
    if (side === 'top') {
      if (!studio) continue;
      // The lowest ceiling over the wardrobe's footprint, less its tallest point.
      let low = roomHeight(studio);
      for (const [s, t] of [[-.45, -.45], [.45, -.45], [0, 0], [-.45, .45], [.45, .45]] as const) low = Math.min(low, ceilingAt(studio, at(s * box.w, t * box.d)));
      const top = y0 + box.h, c = at(box.w / 2 - 6, box.d / 2);
      if (low - top > -SAME && low - top < REACH) out.push({ side, distance: Math.max(0, low - top), from: { ...c, y: top }, to: { ...c, y: low }, target: 'ceiling' });
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

/** What the wardrobe lines up with: centred between the surfaces on its sides, flush against something,
 * its front in line with another wardrobe's, its top level with a neighbour's. */
export function alignments(box: PlacedBox, gaps: readonly Gap[], others: readonly PlacedBox[]): Alignment[] {
  const out: Alignment[] = [], left = gaps.find(g => g.side === 'left'), right = gaps.find(g => g.side === 'right');
  if (left && right && left.distance > SAME && Math.abs(left.distance - right.distance) < SAME) out.push({ kind: 'centred', sides: ['left', 'right'] });
  const touching = gaps.filter(g => g.side !== 'top' && g.distance < SAME).map(g => g.side);
  if (touching.length) out.push({ kind: 'flush', sides: touching });
  const { u, f } = axes(box.angle), front = (b: PlacedBox) => { const a = axes(b.angle); return { x: b.x + a.f.x * b.d / 2, z: b.z + a.f.z * b.d / 2 }; };
  const mine = front(box), y = (box.y ?? 0) + 1;
  for (const o of others) {
    if (o.id === box.id || Math.abs(((o.angle - box.angle) % 360 + 540) % 360 - 180) > .5) continue;
    const theirs = front(o), off = (theirs.x - mine.x) * f.x + (theirs.z - mine.z) * f.z, along = (theirs.x - mine.x) * u.x + (theirs.z - mine.z) * u.z;
    if (Math.abs(off) < SAME) {
      const s0 = Math.min(-box.w / 2, along - o.w / 2), s1 = Math.max(box.w / 2, along + o.w / 2);
      out.push({ kind: 'fronts', other: o.id, a: { x: mine.x + u.x * s0, y, z: mine.z + u.z * s0 }, b: { x: mine.x + u.x * s1, y, z: mine.z + u.z * s1 } });
    }
    const near = Math.abs(along) - (box.w + o.w) / 2;
    if (near < 30 && Math.abs((o.y ?? 0) + o.h - ((box.y ?? 0) + box.h)) < SAME) {
      const top = (box.y ?? 0) + box.h, s0 = Math.min(-box.w / 2, along - o.w / 2), s1 = Math.max(box.w / 2, along + o.w / 2);
      out.push({ kind: 'tops', other: o.id, a: { x: mine.x + u.x * s0, y: top, z: mine.z + u.z * s0 }, b: { x: mine.x + u.x * s1, y: top, z: mine.z + u.z * s1 } });
    }
  }
  return out;
}
