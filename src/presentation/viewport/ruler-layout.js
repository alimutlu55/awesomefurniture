/** Dimension endpoints are projected geometry; only their annotation spacing is in CSS pixels. */
export function rulerScreenPlacement(a, b, axis, ew, eh, bounds) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    let nx = len > .01 ? -dy / len : 0, ny = len > .01 ? dx / len : -1;
    const preferred = axis === 'height' ? [1, 0] : axis === 'height-left' || axis === 'depth' ? [-1, 0]
        : axis === 'under' ? [0, 1] : [0, -1];
    if (nx * preferred[0] + ny * preferred[1] < 0) { nx = -nx; ny = -ny; }
    const gap = 8, radius = Math.abs(nx) * ew / 2 + Math.abs(ny) * eh / 2;
    const la = { x: a.x + nx * gap, y: a.y + ny * gap }, lb = { x: b.x + nx * gap, y: b.y + ny * gap };
    const anchor = { x: (la.x + lb.x) / 2, y: (la.y + lb.y) / 2 };
    const x = anchor.x + nx * (radius + 6), y = anchor.y + ny * (radius + 6);
    return { a: la, b: lb, anchor, normal: { x: nx, y: ny },
        x: Math.max(bounds.left + ew / 2, Math.min(bounds.right - ew / 2, x)),
        y: Math.max((bounds.top ?? 6) + eh / 2, Math.min(bounds.bottom - eh / 2, y)) };
}
