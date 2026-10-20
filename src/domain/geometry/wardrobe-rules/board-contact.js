/** The side of an upright board a part is attached to, or null. Section-local
 * rectangles; the same face tolerance governs following and measuring a board. */
export function uprightContact(part, board) {
    if (part.y0 >= board.y1 - .01 || part.y1 <= board.y0 + .01) return null;
    if (Math.abs(part.x1 - board.x0) <= .6) return 'left';
    if (Math.abs(part.x0 - board.x1) <= .6) return 'right';
    return null;
}
