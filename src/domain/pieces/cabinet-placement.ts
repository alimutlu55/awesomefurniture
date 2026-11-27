import { MIN_CABINET_DEPTH } from '../wardrobe/cabinet-limits';
import { studioPlacementObstacles } from '../studio/studio-obstacles';
import { flushAgainst, placeAgainstWall, placeOnRoomFloor, wallSpot } from '../studio/studio-placement';
import { wallFace, wallLine } from '../studio/studio';
import { createCabinetGeometry } from '../geometry/cabinet-geometry';
import type { CabinetData } from './cabinet-piece';
import type { Placement, PlaceHint, Pose, Room, Size, SizeLimits } from './piece-model';

export interface CabinetPlaceHint extends PlaceHint {
  readonly specifiedSize?: { readonly [K in keyof Size]?: number | undefined } | undefined;
  readonly from?: number | undefined;
  readonly copy?: boolean | undefined;
  readonly fillWall?: boolean | undefined;
  readonly fallback?: boolean | undefined;
}

/** Searches the cabinet's legal footprints. The probe can fit its construction to the ceiling before accepting a pose. */
export function placeCabinet(room: Room, original: CabinetData, limits: SizeLimits, hint: CabinetPlaceHint): Placement | null {
  const [minW, maxW] = limits.width, [minD, maxD] = limits.depth;
  const studio = room.studio, targetWall = hint.wallId, wall = hint.fillWall, copy = hint.copy;
  const size = { w: hint.specifiedSize?.width, d: hint.specifiedSize?.depth, from: hint.from, placementWall: wall ? undefined : targetWall, placementAlong: hint.near };
  const roomFallback = hint.fallback && !copy && !wall && size.from === undefined;
  const collision = createCabinetGeometry(() => room.cabinets ?? [], () => studioPlacementObstacles(studio));
  const prepare = (pose: Pose, w: number, d: number): Placement | null => {
    if (!Number.isFinite(w) || w < minW || w > maxW || !Number.isFinite(d) || d < minD || d > maxD) return null;
    const placement = { x: pose.x, y: original.y, z: pose.z, angle: pose.angle, size: { width: w, depth: d, height: original.state.h } };
    const accepted = hint.accept ? hint.accept(placement) : !collision.cabinetCollides({ ...original, ...placement, state: { ...original.state, w, d } });
    return accepted ? placement : null;
  };
  if (!Number.isFinite(original.state.w) || original.state.w < minW || original.state.w > maxW
    || !Number.isFinite(original.state.d) || original.state.d < minD || original.state.d > maxD) return null;
  if (!studio) return targetWall || collision.cabinetCollides(original) ? null : prepare(original, original.state.w, original.state.d);
  const standing = room.bodies.filter(body => body.key.family === 'cabinet').map(body => ({ ...body, w: body.width, d: body.depth }));
  let found: Placement | null = null;
  function search(w: number, d: number, wallId?: string) {
    if (wallId && size.from !== undefined) {
      const pose = flushAgainst(studio!, wallId, size.from, { w, d });
      return pose ? prepare(pose, w, d) : null;
    }
    placeAgainstWall(studio!, { w, d }, pose => {
      found = prepare(pose, w, d);
      return found === null;
    }, wallId, wallId !== undefined && wallId === size.placementWall ? size.placementAlong : undefined);
    return found;
  }
  // Preserve the normal default size whenever it can actually fit.
  if (!wall || copy) {
    const same = search(original.state.w, original.state.d, targetWall);
    if (same || copy) return same;
  }
  const walls = studio.walls.filter(w => targetWall === undefined || w.id === targetWall)
    .sort((a, b) => (wallFace(studio, b)?.length ?? 0) - (wallFace(studio, a)?.length ?? 0));
  const depths = size.d !== undefined ? [size.d] : [...new Set([original.state.d, 55, 50, 45, 40, 35, 30, 25, 20, MIN_CABINET_DEPTH].filter(d => d <= original.state.d && d >= minD))];
  for (const d of depths) for (const roomWall of walls) {
    const face = wallFace(studio, roomWall);
    if (!face) continue;
    const spot = wallSpot(studio, roomWall.id, standing, { min: size.w ?? minW, max: size.w ?? (wall ? maxW : original.state.w), depth: d });
    const max = size.w ?? Math.floor(Math.min(face.length, spot?.w ?? (wall ? maxW : original.state.w)));
    const min = size.w ?? minW;
    for (let width = max; width >= min; width -= 10) {
      const result = search(width, d, roomWall.id);
      if (result) return result;
      if (size.from !== undefined) break;
    }
    if (min !== max && (max - min) % 10 !== 0) {
      const result = search(min, d, roomWall.id);
      if (result) return result;
    }
  }
  if (roomFallback) {
    const { w, d } = original.state;
    const elsewhere = targetWall ? search(w, d) : null;
    if (elsewhere) return elsewhere;
    const viewed = studio.walls.find(roomWall => roomWall.id === targetWall);
    const angle = viewed ? wallLine(studio, viewed)?.angle ?? 0 : 0;
    placeOnRoomFloor(studio, { w, d }, pose => {
      found = prepare(pose, w, d);
      return found === null;
    }, angle);
    return found;
  }
  return null;
}
