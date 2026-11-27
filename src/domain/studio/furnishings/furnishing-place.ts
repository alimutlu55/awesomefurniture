/**
 * Where furnishings are in the room, and where a new one goes. A furnishing's solid is the same box form as a
 * wardrobe's (middle, turn, size), so wardrobes stop at a bed and a bed at a wardrobe by one collision rule. A rug
 * lies flat: it is drawn and measured but is never in anything's way. Plain data in scene centimetres.
 */
import type { Studio, StudioFurnishing } from '../studio';
import type { Obstacle } from '../studio-obstacles';
import type { Gap, PlacedBox } from '../scene-gaps';
import { placeAgainstWall, placeOnRoomFloor, type Footprint, type Pose } from '../studio-placement';
import { furnishingKind } from './furnishing-kinds';
import { pieceAxes, piecePoint, steadyLine } from '../../pieces/piece-motion';

const round = (n: number) => Math.round(n * 10) / 10;
/** A furnishing's axes and floor points are every piece's (domain/pieces/piece-motion.ts). */
export const furnishingAxes = pieceAxes, furnishingPoint = piecePoint;

export const isFlat = (f: Pick<StudioFurnishing, 'kind'>) => !!furnishingKind(f.kind)?.flat;

/** Its solid, in the collision rules' box form. */
export function furnishingSolid(f: StudioFurnishing): Obstacle {
  return { id: 'furnishing:' + f.id, x: f.x, y: 0, z: f.z, angle: f.angle, state: { w: f.width, d: f.depth, h: f.height } };
}

/** Every furnishing that stands in the way (not a rug): wardrobes, fixtures and other furnishings stop at them. */
export function furnishingObstacles(studio: Studio | undefined): Obstacle[] {
  return (studio?.furnishings ?? []).filter(f => !isFlat(f)).map(furnishingSolid);
}

/** Furnishings that stand up, as the measuring rule's boxes: what a wardrobe's gaps read to (the room in front of it,
 * up to the foot of the bed). Ids are a negative range of their own, apart from wardrobes' and fixtures'. */
export function furnishingBoxes(studio: Studio | undefined): PlacedBox[] {
  return (studio?.furnishings ?? []).filter(f => !isFlat(f)).map((f, i) => ({ id: -2000 - i, x: f.x, z: f.z, y: 0, angle: f.angle, w: f.width, d: f.depth, h: f.height }));
}

/** A gap beside a furnishing, drawn from the middle of its side so it slides with it (every piece's rule). Null for top and bottom. */
export const steadyGap = (f: Pick<StudioFurnishing, 'x' | 'z' | 'angle' | 'width' | 'depth'>, g: Pick<Gap, 'side' | 'distance'>, y = 2) => steadyLine(f, g.side, g.distance, y);

type Collides = (pose: Pose) => boolean;
interface Where { readonly wallId?: string | undefined; readonly near?: number | undefined }

/** Where a new furnishing of `kind` and `size` goes, by its kind's placing: its back flush against the wall in view (or
 * `wallId`) near `near`, else any wall; a bedside table beside a bed, against the same wall; a rug under the bed, else
 * in the middle of the room. `collides` is the scene's own test (walls, wardrobes, fixtures and furnishings). */
export function newFurnishingPose(studio: Studio, kind: string, size: Footprint, collides: Collides, where: Where = {}): Pose | null {
  const k = furnishingKind(kind);
  if (!k) return null;
  const beds = (studio.furnishings ?? []).filter(f => f.kind === 'bed');
  if (k.placing === 'bedside') {
    for (const bed of beds) for (const side of [1, -1]) {
      const at = furnishingPoint(bed, side * (bed.width / 2 + size.w / 2 + 3), -bed.depth / 2 + size.d / 2);
      const pose = { x: round(at.x), z: round(at.z), angle: bed.angle };
      if (!collides(pose)) return pose;
    }
  }
  if (k.placing === 'floor') {
    // Across the lower two thirds of the bed, as a rug is laid, so it shows on both sides; slid sideways off a wall it would run into.
    for (const bed of beds) for (let step = 0; step <= size.d / 2; step += 10) for (const s of step ? [step, -step] : [0]) {
      const at = furnishingPoint(bed, s, bed.depth / 2 - size.w / 2 + 25), pose = { x: round(at.x), z: round(at.z), angle: (bed.angle + 90) % 360 };
      if (!collides(pose)) return pose;
    }
    return placeOnRoomFloor(studio, size, collides, 0);
  }
  return (where.wallId ? placeAgainstWall(studio, size, collides, where.wallId, where.near) : null)
    ?? placeAgainstWall(studio, size, collides)
    ?? placeOnRoomFloor(studio, size, collides, 0);
}
