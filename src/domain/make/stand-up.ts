/**
 * Standing a piece up. A carcass built lying on its back or its front turns about its bottom edge as it is raised,
 * and its far top corner sweeps a circle: the room must be as high as the piece's diagonal across its height and
 * depth, not just as high as the piece. A 2400 × 600 mm wardrobe needs 2474 mm. Centimetres.
 */

/** Room to spare over the diagonal: the floor is not flat and hands go round the edges. */
export const STAND_UP_CLEARANCE = 1;

/** The ceiling height a piece `h` tall and `d` deep needs to be stood up after being built lying down. */
export const standUpHeight = (h: number, d: number) => Math.hypot(h, d) + STAND_UP_CLEARANCE;

/** The tallest a piece `d` deep can be and still be stood up under a ceiling `ceiling` high; 0 when none can. */
export const tallestToStandUp = (ceiling: number, d: number) => ceiling - STAND_UP_CLEARANCE > d ? Math.sqrt((ceiling - STAND_UP_CLEARANCE) ** 2 - d ** 2) : 0;
