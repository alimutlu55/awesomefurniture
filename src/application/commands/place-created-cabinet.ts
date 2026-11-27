import { pieceOf, roomOf } from '../../domain/pieces/pieces';
import { furnitureModule } from '../../domain/furniture/furniture';
import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry';
import { studioPlacementObstacles, studioObstacles } from '../../domain/studio/studio-obstacles';
import type { Pose } from '../../domain/pieces/piece-model';
import { roomHeight } from '../../domain/studio/studio';
import { ceilingClearance } from '../../domain/studio/studio-clearance';
import { resizeShape, resolveShape, shapeProblems } from '../../domain/wardrobe/shape/wardrobe-shape';
import { createCeilingCommands } from './ceiling-commands';

/** `placementWall`: the wall a new piece goes against (the one in view); `placementAlong`: where on it to start looking, cm along it. */
export interface CreationSize { w?: number; h?: number; d?: number; from?: number; placementWall?: string; placementAlong?: number;
  /** Add furniture can look elsewhere when the wall in view is full. */
  fallbackToRoom?: boolean;
  /** The piece preset it is added from (piece-presets.ts). */
  preset?: string }
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
  const roomFallback = size.fallbackToRoom && !copy && !wall && size.from === undefined;
  const placementObstacles = studioPlacementObstacles(studio);
  const collision = createCabinetGeometry(() => scene.wardrobes, () => placementObstacles);
  if (!studio) return targetWall || collision.cabinetCollides(original) ? null : original;
  const obstacles = studioObstacles(studio);
  const wallsOnly = createCabinetGeometry(() => [], () => obstacles);
  const ceilings = createCeilingCommands(() => scene, () => {});
  function prepare(pose: Pose, w: number, d: number): EditorCabinet | null {
    if (w < minW || w > maxW || d < minD || d > maxD) return null;
    const footprint = { ...original, x: pose.x, z: pose.z, angle: pose.angle, state: { ...original.state, w, d } };
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
    if ((!roomFallback || size.h === undefined) && ceilings.follow(candidate, false)) return null;
    const shape = resolveShape(state);
    if (shapeProblems(shape, w).length || ceilingClearance(studio, { ...candidate, w, d })(shape)) return null;
    return collision.cabinetCollides(candidate) ? null : candidate;
  }
  let accepted: EditorCabinet | null = null;
  const placement = pieceOf(original).place(roomOf(studio, scene.wardrobes), {
    wallId: targetWall, near: size.placementAlong, from: size.from, copy, fillWall: wall !== undefined, fallback: !!roomFallback,
    specifiedSize: { width: size.w, depth: size.d, height: size.h },
    accept: ({ x, z, angle, size: dimensions }) => {
      accepted = prepare({ x, z, angle }, dimensions.width, dimensions.depth);
      return accepted !== null;
    },
  });
  return placement ? accepted : null;
}
