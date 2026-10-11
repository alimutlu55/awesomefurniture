import { wallBox } from './studio';
import type { Studio } from './studio';

/** A solid the collision rules keep wardrobes out of, in the same box form as a wardrobe:
 * centre x/z, floor height y, angle in degrees, and width (along), depth (across), height. */
export interface Obstacle {
  readonly id: string;
  readonly x: number; readonly y: number; readonly z: number; readonly angle: number;
  readonly state: { readonly w: number; readonly d: number; readonly h: number };
}

/** Every wall of the room as an obstacle. Doors and windows do not let a wardrobe through. */
export function studioObstacles(studio: Studio | undefined): Obstacle[] {
  if (!studio) return [];
  return studio.walls.flatMap(w => {
    const box = wallBox(studio, w);
    return box ? [{ id: box.id, x: box.x, y: 0, z: box.z, angle: box.angle, state: { w: box.length, d: box.thickness, h: box.height } }] : [];
  });
}
