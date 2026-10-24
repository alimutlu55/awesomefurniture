import { pointToSegment, profileExtent, type ProfileBounds, type ProfileVertex, type Vec } from '../../domain/geometry/profile-polygon';
import type { ShapeGuide, ShapePick } from './surface-shape-drawing';

/** Screen distances of the shape editor, in CSS pixels: what a finger or a pointer catches, and how close
 * something must come to snap. The drawing has one scale, so `px` (centimetres per pixel) turns them into
 * centimetres and snapping is the same at any size of the panel. */
export const SHAPE_PX = Object.freeze({ snap: 12, corner: 22, edge: 14, tap: 4 });

const inside = (points: readonly Vec[], p: Vec) => {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

/** What the pointer is on, nearest first: a corner, then an edge, then the shape's body. */
export function hitShape(points: readonly Vec[], at: Vec, px: number): ShapePick | 'body' | null {
  let best: ShapePick = null, distance = SHAPE_PX.corner * px;
  points.forEach((p, i) => { const d = Math.hypot(p.x - at.x, p.y - at.y); if (d <= distance) { best = { kind: 'vertex', index: i }; distance = d; } });
  if (best) return best;
  distance = SHAPE_PX.edge * px;
  points.forEach((p, i) => { const d = pointToSegment(at, p, points[(i + 1) % points.length]!); if (d <= distance) { best = { kind: 'edge', index: i }; distance = d; } });
  return best ?? (inside(points, at) ? 'body' : null);
}

/** Heights and positions a shape lines up with: the room's floor and ceiling, the wall's ends and the bounds. */
const levels = (bounds: ProfileBounds, top: number, from: number, to: number) => ({ xs: [bounds.minX, bounds.maxX, from, to], ys: [bounds.minY, top] });
const round = (v: number, grid: number) => Math.round(v / grid) * grid;
const nearest = (v: number, targets: readonly number[], tolerance: number) => {
  let best: number | null = null;
  for (const t of targets) if (Math.abs(t - v) <= tolerance && (best === null || Math.abs(t - v) < Math.abs(best - v))) best = t;
  return best;
};

/** A corner dragged to `target`: on the grid, square with its neighbours, on the room's levels, or onto a
 * neighbour (which merges the two when the drag ends). */
export function snapCorner(points: readonly ProfileVertex[], index: number, target: Vec, bounds: ProfileBounds, room: { top: number; from: number; to: number }, px: number, grid: number) {
  const n = points.length, prev = points[(index - 1 + n) % n]!, next = points[(index + 1) % n]!, tolerance = SHAPE_PX.snap * px;
  const clamp = { x: Math.max(bounds.minX, Math.min(bounds.maxX, target.x)), y: Math.max(bounds.minY, Math.min(bounds.maxY, target.y)) };
  for (const [k, q] of [[index - 1, prev], [index + 1, next]] as const)
    if (Math.hypot(q.x - clamp.x, q.y - clamp.y) <= tolerance) return { at: { x: q.x, y: q.y }, guides: [] as ShapeGuide[], merge: (k + n) % n };
  const { xs, ys } = levels(bounds, room.top, room.from, room.to), guides: ShapeGuide[] = [];
  const x = nearest(clamp.x, [prev.x, next.x, ...xs], tolerance), y = nearest(clamp.y, [prev.y, next.y, ...ys], tolerance);
  const at = { x: x ?? round(clamp.x, grid), y: y ?? round(clamp.y, grid) };
  for (const q of [prev, next]) {
    if (x !== null && Math.abs(q.x - at.x) < 1e-6) guides.push({ a: q, b: at });
    if (y !== null && Math.abs(q.y - at.y) < 1e-6) guides.push({ a: q, b: at });
  }
  return { at, guides, merge: undefined };
}

/** An edge slid by `d` along its outward normal: on the grid, or level with another corner or a room level. */
export function snapSlide(points: readonly ProfileVertex[], edge: number, d: number, bounds: ProfileBounds, room: { top: number; from: number; to: number }, px: number, grid: number) {
  const n = points.length, a = points[edge]!, b = points[(edge + 1) % n]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const normal = { x: (b.y - a.y) / l, y: -(b.x - a.x) / l }, offset = (p: Vec) => (p.x - a.x) * normal.x + (p.y - a.y) * normal.y;
  const { xs, ys } = levels(bounds, room.top, room.from, room.to), targets: { d: number; at?: Vec }[] = [];
  points.forEach((p, k) => { if (k !== edge && k !== (edge + 1) % n) targets.push({ d: offset(p), at: p }); });
  if (Math.abs(normal.y) > .999) ys.forEach(y => targets.push({ d: (y - a.y) / normal.y }));
  if (Math.abs(normal.x) > .999) xs.forEach(x => targets.push({ d: (x - a.x) / normal.x }));
  const hit = targets.filter(t => Math.abs(t.d - d) <= SHAPE_PX.snap * px).sort((p, q) => Math.abs(p.d - d) - Math.abs(q.d - d))[0];
  // A level or upright edge lands on the grid; a sloped one moves by whole steps.
  const onGrid = Math.abs(normal.y) > .999 ? (round(a.y + d * normal.y, grid) - a.y) / normal.y : Math.abs(normal.x) > .999 ? (round(a.x + d * normal.x, grid) - a.x) / normal.x : round(d, grid);
  if (!hit) return { d: onGrid, guides: [] as ShapeGuide[] };
  const moved = { x: (a.x + b.x) / 2 + normal.x * hit.d, y: (a.y + b.y) / 2 + normal.y * hit.d };
  return { d: hit.d, guides: hit.at ? [{ a: hit.at, b: moved }] : [] };
}

/** The whole shape moved by (dx, dy): on the grid, or with a side on a room level. */
export function snapMove(points: readonly ProfileVertex[], dx: number, dy: number, bounds: ProfileBounds, room: { top: number; from: number; to: number }, px: number, grid: number) {
  const box = profileExtent(points), { xs, ys } = levels(bounds, room.top, room.from, room.to), tolerance = SHAPE_PX.snap * px;
  const along = (values: readonly number[], lo: number, hi: number, delta: number) => {
    let best: number | null = null;
    for (const v of values) for (const side of [lo, hi]) {
      const want = v - side;
      if (Math.abs(want - delta) <= tolerance && (best === null || Math.abs(want - delta) < Math.abs(best - delta))) best = want;
    }
    return best ?? round(delta, grid);
  };
  return { dx: along(xs, box.minX, box.maxX, dx), dy: along(ys, box.minY, box.maxY, dy) };
}
