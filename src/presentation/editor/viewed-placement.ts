import type * as THREE from 'three';
import type { Studio } from '../../domain/studio/studio';
import { viewedSpot } from '../../domain/studio/viewed-wall';

/** Where something added now should stand: against the wall the camera looks at, from the point straight ahead.
 * Empty without a room. */
export function viewedPlacement(studio: Studio | null | undefined, camera: THREE.Camera): { placementWall?: string; placementAlong?: number } {
  if (!studio) return {};
  const spot = viewedSpot(studio, camera.position, camera.getWorldDirection(camera.position.clone()));
  if (!spot) return {};
  return spot.along === undefined ? { placementWall: spot.wall } : { placementWall: spot.wall, placementAlong: spot.along };
}
