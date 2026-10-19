import type { Point3 } from './camera-types';

/** The view that shows the whole scene (the studio, or the wardrobes with floor around them): its centre and distance. */
export type Overview = Point3 & { dist: number };

/**
 * Where the view looks after zooming out from `dist` to `next`. Zooming out heads for the centre of the scene and
 * reaches it by the distance at which the whole scene fits, so it always ends on all of the studio (an L-shaped room
 * included), however far the view was panned or zoomed into a corner. Further out it stays on the centre.
 */
export function zoomOutTarget(target: Point3, overview: Overview, dist: number, next: number): Point3 {
  const share = next <= dist ? 0 : dist >= overview.dist || next >= overview.dist ? 1 : (next - dist) / (overview.dist - dist);
  return {
    x: target.x + (overview.x - target.x) * share,
    y: target.y + (overview.y - target.y) * share,
    z: target.z + (overview.z - target.z) * share
  };
}
