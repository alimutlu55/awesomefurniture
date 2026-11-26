import { KITCHEN_UNITS } from '../kitchen/kitchen-units';
import { MAX_CABINET_DEPTH, MAX_WARDROBE_WIDTH, MIN_CABINET_DEPTH, MIN_WARDROBE_WIDTH } from '../wardrobe/cabinet-limits';
import { MAX_OUTER_HEIGHT } from '../wardrobe/shape/wardrobe-shape';

type Range = readonly [number, number];
const span = (ranges: readonly Range[]): Range => [Math.min(...ranges.map(r => r[0])), Math.max(...ranges.map(r => r[1]))];

/** The smallest and largest any piece can be, whatever its kind: every wardrobe and kitchen unit size range sits
 * inside it. Centimetres. Saved designs outside it are not furniture (a 1 km wardrobe), and are refused. */
export const PIECE_ENVELOPE: { readonly w: Range; readonly h: Range; readonly d: Range } = Object.freeze({
  w: span([[MIN_WARDROBE_WIDTH, MAX_WARDROBE_WIDTH], ...KITCHEN_UNITS.map(u => u.sizes.w)]),
  h: span([[MIN_WARDROBE_WIDTH, MAX_OUTER_HEIGHT], ...KITCHEN_UNITS.map(u => u.sizes.h)]),
  d: span([[MIN_CABINET_DEPTH, MAX_CABINET_DEPTH], ...KITCHEN_UNITS.map(u => u.sizes.d)]),
});

/** How far a piece may stand from the scene's origin, across the floor and up: 50 m, a whole house. Centimetres. */
export const SCENE_EXTENT = 5000;

/** Whether a size and pose are inside what can physically be built and stood in a home. */
export function withinPieceEnvelope(size: { w: number; h: number; d: number }, pose: { x: number; y?: number | undefined; z: number }) {
  const inside = (v: number, [lo, hi]: Range) => Number.isFinite(v) && v >= lo - 1e-6 && v <= hi + 1e-6;
  return inside(size.w, PIECE_ENVELOPE.w) && inside(size.h, PIECE_ENVELOPE.h) && inside(size.d, PIECE_ENVELOPE.d)
    && inside(pose.x, [-SCENE_EXTENT, SCENE_EXTENT]) && inside(pose.z, [-SCENE_EXTENT, SCENE_EXTENT]) && inside(pose.y ?? 0, [0, SCENE_EXTENT]);
}
