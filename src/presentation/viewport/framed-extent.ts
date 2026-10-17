/** The smallest view of a piece of furniture, in centimetres. Wardrobes are larger; a 60 cm kitchen unit is not. */
export const FRAME_MIN = { w: 120, h: 200 } as const;

/** What the camera frames for a piece of furniture: at least FRAME_MIN, so a small kitchen cabinet is seen with the
 * floor and wall around it instead of filling the screen. A piece on the floor keeps the floor at the bottom of the
 * view; a wall unit is centred on itself. `y` is the height to aim at. */
export function framedExtent(c: { y?: number | undefined; state: { w: number; h: number; d: number } }) {
  const w = Math.max(c.state.w, FRAME_MIN.w), h = Math.max(c.state.h, FRAME_MIN.h), base = c.y || 0;
  return { w, h, d: c.state.d, y: base > 1 ? base + c.state.h / 2 : h / 2 };
}
