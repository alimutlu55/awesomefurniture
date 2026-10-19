import { runReach, unitAxes, type UnitPose } from '../../domain/kitchen/kitchen-runs';
import { isKitchen } from '../../domain/furniture/furniture';

/** The smallest view of a piece of furniture, in centimetres. Wardrobes are larger; a 60 cm kitchen unit is not. */
export const FRAME_MIN = { w: 120, h: 200 } as const;

/** What the camera frames for a piece of furniture: at least FRAME_MIN, so a small kitchen cabinet is seen with the
 * floor and wall around it instead of filling the screen. A kitchen unit is seen with the run it stands in. The view
 * aims at the middle of the piece, so a low cabinet sits in the middle of the screen with its measurements and turn
 * handle below it in view, not under the toolbar. `x`, `z` is the centre to aim at, `y` the height. */
export function framedExtent(c: UnitPose, cabinets: readonly UnitPose[] = []) {
  const [left, right] = isKitchen(c.state) && cabinets.length ? runReach(cabinets, c) : [-c.state.w / 2, c.state.w / 2];
  const { u } = unitAxes(c.angle), mid = (left + right) / 2, base = c.y || 0;
  return { x: c.x + u.x * mid, z: c.z + u.z * mid, w: Math.max(right - left, FRAME_MIN.w), h: Math.max(c.state.h, FRAME_MIN.h),
    d: c.state.d, y: base + c.state.h / 2 };
}
