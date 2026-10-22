import { MIN_CABINET_DEPTH } from '../../domain/wardrobe/cabinet-limits';
import { furnitureModule } from '../../domain/furniture/furniture';
import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry';
import { studioPlacementObstacles, studioObstacles } from '../../domain/studio/studio-obstacles';
import { flushAgainst, placeAgainstWall, wallSpot, type Pose } from '../../domain/studio/studio-placement';
import { roomHeight, wallFace } from '../../domain/studio/studio';
import { ceilingClearance } from '../../domain/studio/studio-clearance';
import { resizeShape, resolveShape, shapeProblems } from '../../domain/wardrobe/shape/wardrobe-shape';
import { createCeilingCommands } from './ceiling-commands';

/** `placementWall`: the wall a new piece goes against (the one in view); `placementAlong`: where on it to start looking, cm along it. */
export interface CreationSize { w?: number; h?: number; d?: number; from?: number; placementWall?: string; placementAlong?: number }
/** Prepare detached candidates. A failed search never changes the scene, its
 * selection, identity counters or undo history. Requested dimensions stay exact;
 * unrequested default width/depth can shrink to the available room. */
export function placeCreatedCabinet(scene: EditorScene, original: EditorCabinet, copy: boolean, wall?: string, size: CreationSize = {}): EditorCabinet | null {
  const sizes = furnitureModule(original.state).sizes(original.state);
  const [minW, maxW] = sizes.w, [minD, maxD] = sizes.d;
  if (!Number.isFinite(original.state.w) || original.state.w < minW || original.state.w > maxW) return null;
  if (!Number.isFinite(original.state.d) || original.state.d < minD || original.state.d > maxD) return null;
  const studio = scene.studio;
  const targetWall = wall ?? size.placementWall;
  const collision = createCabinetGeometry(() => scene.wardrobes, () => studioPlacementObstacles(studio));
  if (!studio) return targetWall || collision.cabinetCollides(original) ? null : original;
  const wallsOnly = createCabinetGeometry(() => [], () => studioObstacles(studio));
  const ceilings = createCeilingCommands(() => scene, () => {});
  function prepare(pose: Pose, w: number, d: number): EditorCabinet | null {
    if (w < minW || w > maxW || d < minD || d > maxD) return null;
    const footprint = { ...original, ...pose, state: { ...original.state, w, d } };
    if (wallsOnly.cabinetCollides(footprint)) return null;
    // Even the shortest buildable cabinet cannot occupy an already filled
    // floor footprint. Prune it before sampling the room ceiling.
    if (collision.cabinetCollides({ ...footprint, state: { ...footprint.state, h: 40 } })) return null;
    const candidate = structuredClone(footprint), state = candidate.state;
    if (state.shape && w !== original.state.w) state.shape = resizeShape(state.shape, original.state.w, w, state.h, state.h);
    const cap = Math.min(sizes.h[1], roomHeight(studio!) - (candidate.y || 0));
    if (cap < Math.min(40, sizes.h[0])) return null;
    if (state.h > cap) {
      if (copy || size.h !== undefined) return null;
      if (state.shape) state.shape = resizeShape(state.shape, w, w, state.h, cap);
      state.h = cap;
    }
    state.n = Math.max(1, Math.min(state.n, createWardrobeGeometry(() => state).maxN()));
    state.sel = Math.min(state.sel, state.n - 1);
    if (ceilings.follow(candidate, false)) return null;
    const shape = resolveShape(state);
    if (shapeProblems(shape, w).length || ceilingClearance(studio, { ...candidate, w, d })(shape)) return null;
    return collision.cabinetCollides(candidate) ? null : candidate;
  }
  const standing = scene.wardrobes.map(c => ({ ...c, w: c.state.w, d: c.state.d }));
  let found: EditorCabinet | null = null;
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
  return null;
}
