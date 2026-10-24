import { wallBox, wallLine } from './studio';
import type { Studio } from './studio';
import { ceilingFrame } from './studio-ceiling';
import { ceilingLowerProfile } from './surface-boundary';

/** A solid the collision rules keep wardrobes out of, in the same box form as a wardrobe:
 * centre x/z, floor height y, angle in degrees, and width (along), depth (across), height. */
export interface Obstacle {
  readonly id: string;
  readonly x: number; readonly y: number; readonly z: number; readonly angle: number;
  readonly state: { readonly w: number; readonly d: number; readonly h: number };
}

/** Every wall of the room as an obstacle, and every part of a shape that stands on the floor (a pillar, a stair
 * reaching down to it). Doors and windows do not let a wardrobe through. */
export function studioObstacles(studio: Studio | undefined): Obstacle[] {
  if (!studio) return [];
  const walls = studio.walls.flatMap(w => {
    const box = wallBox(studio, w);
    return box ? [{ id: box.id, x: box.x, y: 0, z: box.z, angle: box.angle, state: { w: box.length, d: box.thickness, h: box.height } }] : [];
  });
  return [...walls, ...groundedShapes(studio)];
}

/** A shape's underside that touches the floor, as boxes: along its wall and as deep as the shape reaches. */
function groundedShapes(studio: Studio): Obstacle[] {
  return (studio.ceilings ?? []).flatMap(c => {
    const frame = ceilingFrame(studio, c), profile = ceilingLowerProfile(c);
    if (!frame) return [];
    const top = Math.max(...profile.map(p => p.y), ...(c.outline ?? []).map(p => p.y));
    return profile.slice(0, -1).flatMap((a, k) => {
      const b = profile[k + 1]!;
      if (b.t - a.t < 1e-6 || Math.max(a.y, b.y) > GROUNDED) return [];
      const span = c.run === 'along' ? { s0: a.t, s1: b.t, d0: 0, d1: c.depth } : { s0: frame.along.from, s1: frame.along.to, d0: a.t, d1: b.t };
      const centre = frame.at((span.s0 + span.s1) / 2, (span.d0 + span.d1) / 2);
      return [{ id: `shape:${c.id}:${k}`, x: centre.x, y: 0, z: centre.z, angle: frame.line.angle,
        state: { w: span.s1 - span.s0, d: span.d1 - span.d0, h: top } }];
    });
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
