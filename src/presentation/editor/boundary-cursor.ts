type Point = { x: number; y: number; z: number };
type Screen = (p: Point) => { x: number; y: number };

/** Closest point on a projected edge, inverted back to its physical fraction.
 * A perspective projection preserves a straight edge, but not distances along it. */
export function projectBoundary(screen: Screen, a: Point, b: Point, target: { x: number; y: number }) {
  const p = screen(a), q = screen(b), ux = q.x - p.x, uy = q.y - p.y, length = ux * ux + uy * uy;
  if (!Number.isFinite(length) || length < 1e-10) return null;
  const fraction = Math.max(0, Math.min(1, ((target.x - p.x) * ux + (target.y - p.y) * uy) / length));
  let lo = 0, hi = 1;
  for (let n = 0; n < 32; n++) {
    const mid = (lo + hi) / 2;
    const at = screen({ x: a.x + (b.x - a.x) * mid, y: a.y + (b.y - a.y) * mid, z: a.z + (b.z - a.z) * mid });
    if (((at.x - p.x) * ux + (at.y - p.y) * uy) / length < fraction) lo = mid; else hi = mid;
  }
  return { fraction: fraction === 0 || fraction === 1 ? fraction : (lo + hi) / 2,
    distance: Math.hypot(target.x - p.x - ux * fraction, target.y - p.y - uy * fraction) };
}
