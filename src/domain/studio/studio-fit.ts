/**
 * A wardrobe under a ceiling that comes down (a staircase, a landing, a sloped roof, a beam) takes the
 * ceiling's shape: its top follows the lowest ceiling over its depth, across its width, and fills up to the
 * room's ceiling elsewhere, as a fitted built-in does. The result is an ordinary wardrobe top profile, so
 * fittings, rendering, saving and Auto design treat it like any shaped wardrobe. Centimetres.
 */
import { PANEL } from '../wardrobe/catalog.js';
import { MAX_OUTER_HEIGHT, MAX_SLOPE_DEG, MIN_OUTER_HEIGHT, MIN_SEGMENT, shapeProblems } from '../wardrobe/shape/wardrobe-shape';
import { weightsFor } from '../wardrobe/shape/shape-templates';
import type { ShapePoint, WardrobeShape } from '../wardrobe/shape/wardrobe-shape';
import { roomHeight } from './studio';
import type { Studio } from './studio';
import { ceilingAt } from './studio-ceiling';

/** Where a wardrobe stands and its size: centre, turn (degrees), height of its base above the floor. */
export interface Placed { readonly x: number; readonly z: number; readonly angle: number; readonly y?: number; readonly w: number; readonly d: number }
export type CeilingFit = { readonly shape: WardrobeShape } | { readonly problem: string };

/** Samples across the width (cm). Steps are placed on the safe side of a sample, so a top never rises
 * into the ceiling by more than this. */
const STEP = .5;
/** A step must leave room for its riser and a top panel beside it at each end. */
const END = 2 * PANEL + MIN_SEGMENT;
const STEEP = Math.tan(MAX_SLOPE_DEG * Math.PI / 180) * STEP + .3;
const round = (v: number) => Math.round(v * 10) / 10;

/** The clear height above the wardrobe's base at each sample across its width, from its left side as
 * seen from the front: the lowest ceiling over its depth there. */
function clearHeights(studio: Studio, f: Placed): number[] {
  const a = f.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), fx = Math.sin(a), fz = Math.cos(a);
  const inset = .05, zs: number[] = [];
  for (let z = -f.d / 2 + inset; z < f.d / 2 - inset; z += 2) zs.push(z);
  zs.push(f.d / 2 - inset);
  const n = Math.max(1, Math.round(f.w / STEP)), out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const lx = Math.min(f.w - inset, Math.max(inset, i * f.w / n)) - f.w / 2;
    let low = Infinity;
    for (const lz of zs) low = Math.min(low, ceilingAt(studio, { x: f.x + lx * ux + lz * fx, z: f.z + lx * uz + lz * fz }));
    out.push(low - (f.y ?? 0));
  }
  return out;
}

/** The wardrobe's top under the room's ceilings: a shape when a ceiling comes down over it, a problem
 * when it is too low there for any wardrobe, null when none does (it stays as it is). */
export function ceilingTop(studio: Studio | undefined, f: Placed): CeilingFit | null {
  if (!studio?.ceilings?.length) return null;
  const cap = Math.min(MAX_OUTER_HEIGHT, roomHeight(studio) - (f.y ?? 0));
  const ys = clearHeights(studio, f).map(y => Math.min(cap, y));
  if (ys.every(y => y >= cap - .05)) return null;
  const lowest = Math.min(...ys);
  if (lowest < MIN_OUTER_HEIGHT) return { problem: 'The ceiling is too low here for a wardrobe. Move it where there is more height.' };
  const n = ys.length - 1, x = (i: number) => round(i * f.w / n);
  // Steps too close to a side, or to each other, flatten to the lower height: the top must stay under the ceiling.
  const steps = () => ys.flatMap((y, i) => i < n && Math.abs(ys[i + 1]! - y) > STEEP ? [i] : []);
  const flatten = (i0: number, i1: number) => { const m = Math.min(...ys.slice(i0, i1 + 1)); for (let i = i0; i <= i1; i++) ys[i] = m; };
  for (let guard = 0; guard < 40; guard++) {
    const list = steps(), near = list.find((s, k) => x(s) < END || x(s + 1) > f.w - END || (list[k + 1] !== undefined && x(list[k + 1]!) - x(s + 1) < MIN_SEGMENT + PANEL));
    if (near === undefined) break;
    const k = list.indexOf(near), next = list[k + 1];
    if (x(near) < END) flatten(0, near + 1);
    else if (x(near + 1) > f.w - END) flatten(near, n);
    else flatten(near, next! + 1);
  }
  const shape: WardrobeShape = { template: 'room', top: profile(ys, x) };
  if (!shapeProblems(shape, f.w).length) return { shape };
  // Whatever the ceiling's detail, a flat top at its lowest point always fits under it.
  return { shape: { template: 'room', top: [{ x: 0, y: round(lowest) }, { x: f.w, y: round(lowest) }] } };
}

/** Top points from the samples: runs between steps, simplified to their straight parts. */
function profile(ys: readonly number[], x: (i: number) => number): ShapePoint[] {
  const n = ys.length - 1, runs: [number, number][] = [];
  let from = 0;
  for (let i = 0; i < n; i++) if (Math.abs(ys[i + 1]! - ys[i]!) > STEEP) { runs.push([from, i]); from = i + 1; }
  runs.push([from, n]);
  const out: ShapePoint[] = [];
  runs.forEach(([i0, i1], r) => {
    const pts = simplify(ys, i0, i1).map(i => ({ x: x(i), y: round(ys[i]!) }));
    // The step stands on the safe side: the higher part ends (or starts) a sample early.
    if (r > 0) {
      const down = ys[i0 - 1]! > ys[i0]!;
      if (down) pts[0]!.x = x(i0 - 1); else out[out.length - 1]!.x = x(i0);
    }
    out.push(...pts);
  });
  // A bend closer than a panel's minimum width to the point before it is dropped (steps are kept).
  for (let k = 1; k < out.length - 1; k++) {
    const a = out[k - 1]!, b = out[k]!, c = out[k + 1]!;
    if (b.x - a.x > 1e-6 && b.x - a.x < MIN_SEGMENT && c.x - b.x > 1e-6) out.splice(k--, 1);
  }
  out[0]!.x = 0;
  return out;
}

/** Douglas–Peucker over samples i0..i1: the indices of the points that keep the line within a millimetre or two. */
function simplify(ys: readonly number[], i0: number, i1: number): number[] {
  if (i1 - i0 < 2) return i1 > i0 ? [i0, i1] : [i0];
  let worst = -1, far = .15;
  for (let i = i0 + 1; i < i1; i++) {
    const d = Math.abs(ys[i]! - (ys[i0]! + (ys[i1]! - ys[i0]!) * (i - i0) / (i1 - i0)));
    if (d > far) { far = d; worst = i; }
  }
  if (worst < 0) return [i0, i1];
  return [...simplify(ys, i0, worst).slice(0, -1), ...simplify(ys, worst, i1)];
}

/** Sections for a new wardrobe under a ceiling, as a carpenter would divide it: a partition under each
 * step and each bend of the top, so every section has one simple top (a tall column, the part under a
 * landing, the part under the flight), and long stretches split evenly, about a metre each. At most
 * `maxN` sections, none narrower than 30 cm. */
export function sectionsUnder(shape: WardrobeShape, w: number, maxN: number): { n: number; wt: number[] } {
  const bends = [...new Set(shape.top.slice(1, -1).map(p => p.x))];
  // A partition's left face: under a step its board continues the step's riser, under a bend it is centred.
  const steps = new Set(shape.top.flatMap((p, k, all) => k > 0 && Math.abs(all[k - 1]!.x - p.x) < 1e-6 ? [p.x] : []));
  const face = (x: number) => {
    if (!steps.has(x)) return x - PANEL / 2;
    const k = shape.top.findIndex(p => p.x === x), down = shape.top[k]!.y > shape.top[k + 1]!.y;
    return down ? x - PANEL : x;
  };
  let cuts = bends.map(face).filter(x => x > 30 + PANEL && x < w - 30 - 2 * PANEL);
  cuts = cuts.filter((x, k) => k === 0 || x - cuts[k - 1]! >= 30 + PANEL);
  const edges = [0, ...cuts, w], out: number[] = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const span = edges[k + 1]! - edges[k]!, parts = Math.max(1, Math.round(span / 100));
    for (let j = 1; j < parts; j++) out.push(Math.round((edges[k]! + span * j / parts) * 10) / 10);
    if (k < edges.length - 2) out.push(edges[k + 1]!);
  }
  const chosen = out.slice(0, Math.max(0, maxN - 1)).sort((a, b) => a - b);
  return { n: chosen.length + 1, wt: weightsFor(w, chosen).concat(Array(6).fill(100)).slice(0, 6) };
}
