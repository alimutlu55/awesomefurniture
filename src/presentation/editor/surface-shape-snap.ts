import { pointToSegment, profileExtent, type ProfileBounds, type ProfileVertex, type Vec } from '../../domain/geometry/profile-polygon';
import { nearestValue, resolveAlignment } from '../../domain/geometry/alignment';
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
const levels = (bounds: ProfileBounds, top: number, from: number, to: number, points: readonly Vec[] = []) =>
  ({ xs: [bounds.minX, bounds.maxX, from, to, ...points.map(p => p.x)], ys: [bounds.minY, top, ...points.map(p => p.y)] });
/** What a shape is drawn against: the room's levels, and corners of the other parts on the same view (other
 * shapes, doors and windows, wardrobes) that a corner or edge can line up with. */
export interface RoomLevels { top: number; from: number; to: number; points?: readonly Vec[] }
const round = (v: number, grid: number) => Math.round(v / grid) * grid;

/** A corner dragged to `target`: on the grid, square with its neighbours, on the room's levels, or onto a
 * neighbour (which merges the two when the drag ends). */
export function snapCorner(points: readonly ProfileVertex[], index: number, target: Vec, bounds: ProfileBounds, room: RoomLevels, px: number, grid: number) {
  const n = points.length, prev = points[(index - 1 + n) % n]!, next = points[(index + 1) % n]!, tolerance = SHAPE_PX.snap * px;
  const clamp = { x: Math.max(bounds.minX, Math.min(bounds.maxX, target.x)), y: Math.max(bounds.minY, Math.min(bounds.maxY, target.y)) };
  for (const [k, q] of [[index - 1, prev], [index + 1, next]] as const)
    if (Math.hypot(q.x - clamp.x, q.y - clamp.y) <= tolerance) return { at: { x: q.x, y: q.y },
      guides: [{ a: points[index]!, b: q, label: 'Join corners' }] as ShapeGuide[], merge: (k + n) % n };
  const { xs, ys } = levels(bounds, room.top, room.from, room.to, room.points), guides: ShapeGuide[] = [];
  const x = nearestValue(clamp.x, [prev.x, next.x, ...xs], tolerance), y = nearestValue(clamp.y, [prev.y, next.y, ...ys], tolerance);
  const at = { x: x ?? round(clamp.x, grid), y: y ?? round(clamp.y, grid) };
  for (const q of [prev, next, ...room.points ?? []]) {
    if (x !== null && Math.abs(q.x - at.x) < 1e-6 && Math.hypot(q.x - at.x, q.y - at.y) > 1e-6) guides.push({ a: q, b: at });
    if (y !== null && Math.abs(q.y - at.y) < 1e-6 && Math.hypot(q.x - at.x, q.y - at.y) > 1e-6) guides.push({ a: q, b: at });
  }
  // Bounds and room levels are targets too, even when no neighbour vertex supplied the line.
  if (x !== null && !guides.some(g => Math.abs(g.a.x - g.b.x) < 1e-6)) {
    guides.push({ a: { x: at.x, y: bounds.minY }, b: { x: at.x, y: room.top }, label: 'Aligned with boundary' });
  }
  if (y !== null && !guides.some(g => Math.abs(g.a.y - g.b.y) < 1e-6)) {
    guides.push({ a: { x: room.from, y: at.y }, b: { x: room.to, y: at.y }, label: 'Aligned with room level' });
  }
  return { at, guides, merge: undefined };
}

/** An edge slid by `d` along its outward normal: on the grid, or level with another corner or a room level. */
export function snapSlide(points: readonly ProfileVertex[], edge: number, d: number, bounds: ProfileBounds, room: RoomLevels, px: number, grid: number) {
  const n = points.length, a = points[edge]!, b = points[(edge + 1) % n]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const normal = { x: (b.y - a.y) / l, y: -(b.x - a.x) / l }, offset = (p: Vec) => (p.x - a.x) * normal.x + (p.y - a.y) * normal.y;
  const { xs, ys } = levels(bounds, room.top, room.from, room.to, room.points), targets: { v: number; label: string; src?: Vec }[] = [];
  points.forEach((p, k) => { if (k !== edge && k !== (edge + 1) % n) targets.push({ v: offset(p), label: 'corner', src: p }); });
  if (Math.abs(normal.y) > .999) ys.forEach(y => targets.push({ v: (y - a.y) / normal.y, label: 'level' }));
  if (Math.abs(normal.x) > .999) xs.forEach(x => targets.push({ v: (x - a.x) / normal.x, label: 'level' }));
  const hit = resolveAlignment(d, targets, { tolerance: SHAPE_PX.snap * px });
  // A level or upright edge lands on the grid; a sloped one moves by whole steps.
  const onGrid = Math.abs(normal.y) > .999 ? (round(a.y + d * normal.y, grid) - a.y) / normal.y : Math.abs(normal.x) > .999 ? (round(a.x + d * normal.x, grid) - a.x) / normal.x : round(d, grid);
  if (!hit) return { d: onGrid, guides: [] as ShapeGuide[] };
  const moved = { x: (a.x + b.x) / 2 + normal.x * hit.v, y: (a.y + b.y) / 2 + normal.y * hit.v };
  const guide: ShapeGuide = hit.src ? { a: hit.src, b: moved, label: 'Aligned with corner' }
    : Math.abs(normal.y) > .999
      ? { a: { x: room.from, y: moved.y }, b: { x: room.to, y: moved.y }, label: 'Aligned with room level' }
      : { a: { x: moved.x, y: bounds.minY }, b: { x: moved.x, y: room.top }, label: 'Aligned with boundary' };
  return { d: hit.v, guides: [guide] };
}

/** The whole shape moved by (dx, dy): on the grid, or with a side on a room level. */
export function snapMove(points: readonly ProfileVertex[], dx: number, dy: number, bounds: ProfileBounds, room: RoomLevels, px: number, grid: number) {
  const box = profileExtent(points), { xs, ys } = levels(bounds, room.top, room.from, room.to, room.points), tolerance = SHAPE_PX.snap * px;
  const along = (values: readonly number[], lo: number, hi: number, delta: number) =>
    nearestValue(delta, values.flatMap(v => [v - lo, v - hi]), tolerance) ?? round(delta, grid);
  const x = along(xs, box.minX, box.maxX, dx), y = along(ys, box.minY, box.maxY, dy);
  const moved = points.map(p => ({ x: p.x + x, y: p.y + y }));
  return { dx: x, dy: y, guides: profileSmartGuides(moved, bounds, room, px) };
}

/** Read-only guides for whole-profile movement and typed shape fields, using the current applied profile. */
export function profileSmartGuides(points: readonly Vec[], bounds: ProfileBounds, room: RoomLevels, px: number): ShapeGuide[] {
  const { xs, ys } = levels(bounds, room.top, room.from, room.to, room.points), guides: ShapeGuide[] = [];
  for (const axis of ['x', 'y'] as const) {
    let best: { target: number; distance: number } | null = null;
    for (const p of points) for (const target of axis === 'x' ? xs : ys) {
      const distance = Math.abs(p[axis] - target);
      if (distance <= SHAPE_PX.snap * px && (!best || distance < best.distance)) best = { target, distance };
    }
    if (!best) continue;
    const v = best.target;
    guides.push(axis === 'x'
      ? { a: { x: v, y: bounds.minY }, b: { x: v, y: room.top }, label: 'Aligned with boundary / neighbour', delta: best.distance }
      : { a: { x: room.from, y: v }, b: { x: room.to, y: v }, label: 'Aligned with room level / neighbour', delta: best.distance });
  }
  return guides;
}
