/** Within this distance (cm) two faces touch: the part is attached and goes with the board. Half a
 * millimetre absorbs rounding only; any gap the editor shows (0.1 cm and up) keeps two parts apart. */
export const FACE_CONTACT_CM = .05;
/** The side of an upright board a part is attached to, or null. Section-local
 * rectangles; the same face tolerance governs following and measuring a board. */
export function uprightContact(part, board) {
    if (part.y0 >= board.y1 - .01 || part.y1 <= board.y0 + .01) return null;
    if (Math.abs(part.x1 - board.x0) <= FACE_CONTACT_CM) return 'left';
    if (Math.abs(part.x0 - board.x1) <= FACE_CONTACT_CM) return 'right';
    return null;
}

/** The face of a shelf an upright meets. These uprights follow the shelf as it moves. */
export function shelfContact(part, board) {
    if (part.x0 >= board.x1 - .01 || part.x1 <= board.x0 + .01) return null;
    if (Math.abs(part.y0 - board.y1) <= FACE_CONTACT_CM) return 'top';
    if (Math.abs(part.y1 - board.y0) <= FACE_CONTACT_CM) return 'bottom';
    return null;
}
