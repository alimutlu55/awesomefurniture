/** Physical ceiling clearance, separate from the buildable profile used for automatic fitting. */
import type { Placed } from './studio-fit';
import type { Studio } from './studio';
import type { WardrobeShape } from '../wardrobe/shape/wardrobe-shape';
import { roomHeight } from './studio';
import { ceilingFrame } from './studio-ceiling';

type Point = { x: number; z: number };
type Plane = { footprint: Point[]; height: (p: Point) => number };
const EPS = 1e-8;

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
 * Every top board spans the whole depth, so hidden rear contact is checked as well as the front. */
export function ceilingClearance(studio: Studio | undefined, f: Placed): (shape: WardrobeShape) => boolean {
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
    const at = ceiling.run === 'along' ? along : across;
    for (let i = 1; i < ceiling.profile.length; i++) {
      const a = ceiling.profile[i - 1]!, b = ceiling.profile[i]!;
      if (b.t - a.t <= EPS) continue;
      const patch = strip(covered, at, a.t, b.t);
      if (!hasArea(patch)) continue;
      planes.push({ footprint: patch, height: p => a.y + (b.y - a.y) * (at(p) - a.t) / (b.t - a.t) - base });
    }
  }
  return shape => {
    for (let i = 1; i < shape.top.length; i++) {
      const a = shape.top[i - 1]!, b = shape.top[i]!;
      if (b.x - a.x <= EPS) continue;
      for (const plane of planes) {
        const patch = strip(plane.footprint, p => p.x, a.x, b.x);
        // A shared step edge has no volume: touching it is allowed on either side.
        if (!hasArea(patch)) continue;
        // The difference of two planes is linear; its maximum is at a polygon vertex.
        if (patch.some(p => a.y + (b.y - a.y) * (p.x - a.x) / (b.x - a.x) > plane.height(p) + .5 + EPS)) return true;
      }
    }
    return false;
  };
}
