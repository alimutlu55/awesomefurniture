/** The smallest view of a piece of furniture, in centimetres. Wardrobes are larger; a 60 cm kitchen unit is not. */
export const FRAME_MIN = { w: 120, h: 200 } as const;

/** What the camera frames for a chosen piece of furniture: the piece itself, at least FRAME_MIN, so a small kitchen
 * cabinet is seen with a little floor and wall around it instead of filling the screen. The view aims at the middle
 * of the piece, so a low cabinet sits in the middle of the screen with its measurements and turn handle below it in
 * view, not under the toolbar. `y` is the height to aim at. */
export function framedExtent(c: { y?: number | undefined; state: { w: number; h: number; d: number } }) {
  return { w: Math.max(c.state.w, FRAME_MIN.w), h: Math.max(c.state.h, FRAME_MIN.h), d: c.state.d, y: (c.y || 0) + c.state.h / 2 };
}
