/** Physical ceiling clearance, separate from the buildable profile used for automatic fitting. */
import type { Placed } from './studio-fit';
import type { Studio } from './studio';
import type { WardrobeShape } from '../wardrobe/shape/wardrobe-shape';
import { roomHeight } from './studio';
import { ceilingLowerProfile, sectionLowerProfile } from './surface-boundary';
import { ceilingFrame } from './studio-ceiling';
import { topSurface } from '../wardrobe/shape/depth-shape';

type Point = { x: number; z: number };
type Plane = { footprint: Point[]; height: (p: Point) => number };
const EPS = 1e-8;
export const CEILING_CLEARANCE_TOLERANCE = .5;

/** Clips a convex polygon to a half-plane, keeping points with a nonnegative distance. */
function clip(points: Point[], distance: (p: Point) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!, da = distance(a), db = distance(b);
    if (da >= -EPS) out.push(a);
    if ((da < -EPS) !== (db < -EPS)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
}
function strip(points: Point[], at: (p: Point) => number, from: number, to: number) {
  return clip(clip(points, p => at(p) - from), p => to - at(p));
}
function hasArea(points: Point[]) {
  const area = points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]!;
    return sum + a.x * b.z - b.x * a.z;
  }, 0);
  return Math.abs(area) > EPS;
}

/** Prepares ceiling planes in cabinet coordinates. Reuse while a handle edits the same footprint.
 * The front and rear heights are checked together over the actual top surface. */
export function ceilingClearance(studio: Studio | undefined, f: Placed, tolerance = CEILING_CLEARANCE_TOLERANCE): (shape: WardrobeShape) => boolean {
  if (!studio) return () => false;
  const angle = f.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), base = f.y ?? 0;
  const world = (p: Point) => ({ x: f.x + (p.x - f.w / 2) * c + p.z * s, z: f.z - (p.x - f.w / 2) * s + p.z * c });
  const footprint = [{ x: 0, z: -f.d / 2 }, { x: f.w, z: -f.d / 2 }, { x: f.w, z: f.d / 2 }, { x: 0, z: f.d / 2 }];
  const planes: Plane[] = [{ footprint, height: () => roomHeight(studio) - base }];
  for (const ceiling of studio.ceilings ?? []) {
    const frame = ceilingFrame(studio, ceiling);
    if (!frame) continue;
    const along = (p: Point) => frame.local(world(p)).s, across = (p: Point) => frame.local(world(p)).d;
    const covered = strip(strip(footprint, along, frame.along.from, frame.along.to), across, frame.across.from, frame.across.to);
    const at = ceiling.run === 'along' ? along : across, other = ceiling.run === 'along' ? across : along;
    const profile = ceilingLowerProfile(ceiling), section = sectionLowerProfile(ceiling);
    /** Each stretch of an underside, as a plane over its strip of the floor. */
    const pieces = (list: readonly { t: number; y: number }[], coord: (p: Point) => number) => list.slice(1).flatMap((b, i) => {
      const a = list[i]!;
      return b.t - a.t <= EPS ? [] : [{ from: a.t, to: b.t, coord, y: (p: Point) => a.y + (b.y - a.y) * (coord(p) - a.t) / (b.t - a.t) }];
    });
    const sides = section ? pieces(section, other) : [null];
    for (const front of pieces(profile, at)) for (const side of sides) {
      const patch = side ? strip(strip(covered, at, front.from, front.to), other, side.from, side.to) : strip(covered, at, front.from, front.to);
      if (!hasArea(patch)) continue;
      const lift = (p: Point) => (ceiling.run === 'along' ? (ceiling.edgeRise ?? 0) * across(p) / ceiling.depth : 0) - base;
      if (!side) { planes.push({ footprint: patch, height: p => front.y(p) + lift(p) }); continue; }
      // Seen from both sides, the underside is the higher of the two: split where they cross so each part is a plane.
      for (const [high, low] of [[front, side], [side, front]] as const) {
        const part = clip(patch, p => high.y(p) - low.y(p));
        if (hasArea(part)) planes.push({ footprint: part, height: p => high.y(p) + lift(p) });
      }
    }
  }
  return shape => {
    for (const triangle of topSurface(shape, f.d)) {
      const [a, b, c] = triangle as [typeof triangle[number], typeof triangle[number], typeof triangle[number]];
      const det = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
      const mx = ((b.y - a.y) * (c.z - a.z) - (c.y - a.y) * (b.z - a.z)) / det;
      const mz = ((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / det;
      for (const plane of planes) {
        let patch = plane.footprint;
        for (let i = 0; i < 3; i++) {
          const p = triangle[i]!, q = triangle[(i + 1) % 3]!;
          patch = clip(patch, r => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
        }
        if (!hasArea(patch)) continue;
        if (patch.some(p => a.y + mx * (p.x - a.x) + mz * (p.z - a.z) > plane.height(p) + tolerance + EPS)) return true;
      }
    }
    return false;
  };
}
