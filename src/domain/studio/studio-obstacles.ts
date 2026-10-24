import { wallBox, wallLine } from './studio';
import type { Studio } from './studio';
import { ceilingFrame } from './studio-ceiling';
import { ceilingLowerProfile, sectionLowerProfile } from './surface-boundary';
import { fixtureObstacles } from './fixtures/fixture-place';

/** A solid the collision rules keep wardrobes out of, in the same box form as a wardrobe:
 * centre x/z, floor height y, angle in degrees, and width (along), depth (across), height. */
export interface Obstacle {
  readonly id: string;
  readonly x: number; readonly y: number; readonly z: number; readonly angle: number;
  readonly state: { readonly w: number; readonly d: number; readonly h: number };
}

/** Every wall of the room as an obstacle, every part of a shape that stands on the floor (a pillar, a boxing, a stair
 * reaching down to it), and every fixture (a toilet, a basin). Doors and windows do not let a wardrobe through. */
export function studioObstacles(studio: Studio | undefined): Obstacle[] {
  if (!studio) return [];
  return [...wallObstacles(studio), ...groundedShapes(studio), ...fixtureObstacles(studio)];
}

/** Every wall as a solid box. */
export function wallObstacles(studio: Studio): Obstacle[] {
  return studio.walls.flatMap(w => {
    const box = wallBox(studio, w);
    return box ? [{ id: box.id, x: box.x, y: 0, z: box.z, angle: box.angle, state: { w: box.length, d: box.thickness, h: box.height } }] : [];
  });
}

/** A shape's underside that touches the floor, as boxes: along its wall and as deep as the shape reaches. */
export function groundedShapes(studio: Studio): Obstacle[] {
  return (studio.ceilings ?? []).flatMap(c => {
    const frame = ceilingFrame(studio, c), profile = ceilingLowerProfile(c), section = sectionLowerProfile(c);
    if (!frame) return [];
    const top = Math.max(...profile.map(p => p.y), ...(c.outline ?? []).map(p => p.y));
    /** Stretches of an underside that stand on the floor. */
    const grounded = (list: readonly { t: number; y: number }[]) => list.slice(0, -1).flatMap((a, k) => {
      const b = list[k + 1]!;
      return b.t - a.t < 1e-6 || Math.max(a.y, b.y) > GROUNDED ? [] : [{ from: a.t, to: b.t, k }];
    });
    const run = grounded(profile), cross = section ? grounded(section) : [{ ...(c.run === 'along' ? frame.across : frame.along), k: 0 }];
    // On the floor where both sides are: a box for each pair of stretches.
    return run.flatMap(r => cross.map(x => {
      const span = c.run === 'along' ? { s0: r.from, s1: r.to, d0: x.from, d1: x.to } : { s0: x.from, s1: x.to, d0: r.from, d1: r.to };
      const centre = frame.at((span.s0 + span.s1) / 2, (span.d0 + span.d1) / 2);
      return { id: `shape:${c.id}:${r.k}:${x.k}`, x: centre.x, y: 0, z: centre.z, angle: frame.line.angle,
        state: { w: span.s1 - span.s0, d: span.d1 - span.d0, h: top } };
    }));
  });
}
/** An underside this low stands on the floor. */
const GROUNDED = 1;


/** New wardrobes leave access to openings. These reservations are placement
 * constraints; the physical wall remains solid for movement and collision. */
export function studioPlacementObstacles(studio: Studio | undefined): Obstacle[] {
  if (!studio) return [];
  const access = studio.openings.flatMap(o => {
    const wall = studio.walls.find(w => w.id === o.wall), line = wall && wallLine(studio, wall);
    if (!wall || !line) return [];
    const depth = 50, off = wall.thickness / 2 + depth / 2;
    return [{ id: 'opening:' + o.id, x: line.a.x + line.ux * o.offset + line.nx * off,
      z: line.a.z + line.uz * o.offset + line.nz * off, y: o.sill, angle: line.angle,
      state: { w: o.width + 14, d: depth, h: o.height } }];
  });
  return [...studioObstacles(studio), ...access];
}
