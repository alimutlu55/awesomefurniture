import { advanceBoundary, boundaryLengths, boundaryPoint, type BoundaryLocation, type BoundaryPoint } from '../../domain/geometry/boundary';

type Point = { x: number; y: number; z: number };
/** Project onto complete segments, then invert perspective to recover the exact physical fraction. */
export function projectBoundary(points: readonly BoundaryPoint[], world: (p: BoundaryPoint) => Point,
  screen: (p: Point) => { x: number; y: number }, target: { x: number; y: number }, previous?: BoundaryLocation): BoundaryLocation | undefined {
  const projected = points.map(p => screen(world(p))), lengths = projected.map((a, k) => {
    const b = projected[(k + 1) % points.length]!; return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const prefix = [0];
  lengths.forEach(length => prefix.push(prefix.at(-1)! + length));
  const total = prefix.at(-1)!;
  const prior = previous && boundaryPoint(points, previous), from = prior && screen(world(prior));
  const start = from && previous ? prefix[previous.edge]! + Math.hypot(from.x - projected[previous.edge]!.x, from.y - projected[previous.edge]!.y) : 0;
  const travel = from ? Math.hypot(target.x - from.x, target.y - from.y) * 2 + 1e-7 : Infinity;
  let best: { distance: number; at: BoundaryLocation; continuity: number } | undefined;
  points.forEach((a, edge) => {
    const b = points[(edge + 1) % points.length]!, p = projected[edge]!, q = projected[(edge + 1) % points.length]!;
    const ux = q.x - p.x, uy = q.y - p.y, length = ux * ux + uy * uy;
    if (length < 1e-16) return;
    const fraction = Math.max(0, Math.min(1, ((target.x - p.x) * ux + (target.y - p.y) * uy) / length));
    // Nearby, non-adjacent edges must not steal a drag across a narrow notch or folded profile.
    const travelled = Math.abs(prefix[edge]! + lengths[edge]! * fraction - start);
    if (from && Math.min(travelled, total - travelled) > travel) return;
    const distance = Math.hypot(target.x - p.x - ux * fraction, target.y - p.y - uy * fraction);
    const delta = previous ? Math.abs(edge - previous.edge) : 0, continuity = Math.min(delta, points.length - delta);
    if (best && (distance > best.distance + 1e-8 || Math.abs(distance - best.distance) <= 1e-8 && continuity >= best.continuity)) return;
    let lo = 0, hi = 1;
    for (let n = 0; n < 44; n++) {
      const mid = (lo + hi) / 2, at = screen(world({ t: a.t + (b.t - a.t) * mid, y: a.y + (b.y - a.y) * mid }));
      const projected = ((at.x - p.x) * ux + (at.y - p.y) * uy) / length;
      if (projected < fraction) lo = mid; else hi = mid;
    }
    best = { distance, continuity, at: { edge, fraction: fraction === 0 || fraction === 1 ? fraction : (lo + hi) / 2 } };
  });
  return best?.at;
}
export function defaultBoundaryLocation(points: readonly BoundaryPoint[], edges = points.length): BoundaryLocation {
  const lengths = boundaryLengths(points).slice(0, edges);
  return { edge: lengths.reduce((best, length, k) => length > lengths[best]! ? k : best, 0), fraction: .5 };
}
export function createBoundaryCursor(screen: (p: Point) => { x: number; y: number }) {
  type Cursor = { owner: string; at: BoundaryLocation } | null;
  let cursor: Cursor = null, before: Cursor = null;
  return {
    location: (owner: string) => cursor?.owner === owner ? cursor.at : undefined,
    begin() { before = cursor && { ...cursor, at: { ...cursor.at } }; },
    cancel() { cursor = before; },
    clear() { cursor = null; },
    move(owner: string, points: readonly BoundaryPoint[], world: (p: BoundaryPoint) => Point, target: { x: number; y: number }, previous?: BoundaryLocation) {
      const at = projectBoundary(points, world, screen, target, cursor?.owner === owner ? cursor.at : previous);
      if (at) cursor = { owner, at };
    },
    nudge(owner: string, points: readonly BoundaryPoint[], from: BoundaryLocation, amount: number) {
      cursor = { owner, at: advanceBoundary(points, from, amount) };
    },
    point(owner: string, points: readonly BoundaryPoint[]) { return cursor?.owner === owner ? boundaryPoint(points, cursor.at) : null; },
  };
}
