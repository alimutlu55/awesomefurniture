import type { BoundaryLocation } from '../../domain/geometry/boundary';
import { interpolateSolid, solidEdge, solidPoint, type SolidEdge, type SolidPoint } from '../../domain/geometry/solid-boundary';
type Point = { x: number; y: number; z: number };
type Screen = { x: number; y: number };

/** Search the connected 3D edge graph, not a single projected polygon. */
export function projectSolidBoundary(edges: readonly SolidEdge[], world: (p: SolidPoint) => Point,
  screen: (p: Point) => Screen, target: Screen, previous?: BoundaryLocation): BoundaryLocation | undefined {
  const projected = edges.map(edge => {
    const a = screen(world(edge.a)), b = screen(world(edge.b));
    return { edge, a, b, length: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  const prior = previous && solidPoint(edges, previous), from = prior && screen(world(prior));
  const previousEdge = previous && solidEdge(edges, previous);
  const distances = new Map<string, number>(), queue: string[] = [];
  const visit = (node: string, distance: number) => {
    if (distance >= (distances.get(node) ?? Infinity)) return;
    distances.set(node, distance); queue.push(node);
  };
  if (from && previous) {
    const edge = solidEdge(edges, previous)!;
    visit(edge.start, Math.hypot(from.x - screen(world(edge.a)).x, from.y - screen(world(edge.a)).y));
    visit(edge.end, Math.hypot(from.x - screen(world(edge.b)).x, from.y - screen(world(edge.b)).y));
    for (let n = 0; n < queue.length; n++) {
      const node = queue[n]!, distance = distances.get(node)!;
      for (const p of projected) {
        if (p.edge.start === node) visit(p.edge.end, distance + p.length);
        if (p.edge.end === node) visit(p.edge.start, distance + p.length);
      }
    }
  }
  const travel = from ? Math.hypot(target.x - from.x, target.y - from.y) * 2 + 1e-7 : Infinity;
  let best: { distance: number; route: number; at: BoundaryLocation } | undefined;
  for (const { edge, a, b, length } of projected) {
    if (length < 1e-8) continue;
    const ux = b.x - a.x, uy = b.y - a.y, length2 = length * length;
    const fraction = Math.max(0, Math.min(1, ((target.x - a.x) * ux + (target.y - a.y) * uy) / length2));
    let route = Math.min((distances.get(edge.start) ?? Infinity) + length * fraction, (distances.get(edge.end) ?? Infinity) + length * (1 - fraction));
    if (from && previousEdge === edge) route = Math.hypot(a.x + ux * fraction - from.x, a.y + uy * fraction - from.y);
    const adjacent = previousEdge && (edge.start === previousEdge.start || edge.start === previousEdge.end || edge.end === previousEdge.start || edge.end === previousEdge.end);
    // A sharp return can have a long path but almost no screen displacement. Shared corners must stay traversable.
    if (from && route > travel && !adjacent) continue;
    const distance = Math.hypot(target.x - a.x - ux * fraction, target.y - a.y - uy * fraction);
    if (best && (distance > best.distance + 1e-8 || Math.abs(distance - best.distance) <= 1e-8 && route >= best.route)) continue;
    let lo = 0, hi = 1;
    for (let n = 0; n < 44; n++) {
      const mid = (lo + hi) / 2, p = screen(world(interpolateSolid(edge.a, edge.b, mid)));
      if (((p.x - a.x) * ux + (p.y - a.y) * uy) / length2 < fraction) lo = mid; else hi = mid;
    }
    best = { distance, route, at: { ...edge.location, fraction: fraction === 0 || fraction === 1 ? fraction : (lo + hi) / 2 } };
  }
  return best?.at ?? previous;
}
export function createSolidBoundaryCursor(screen: (p: Point) => Screen) {
  type Cursor = { owner: string; at: BoundaryLocation } | null;
  let cursor: Cursor = null, before: Cursor = null;
  return {
    location: (owner: string) => cursor?.owner === owner ? cursor.at : undefined,
    begin() { before = cursor && { owner: cursor.owner, at: { ...cursor.at } }; },
    cancel() { cursor = before; }, clear() { cursor = null; },
    move(owner: string, edges: readonly SolidEdge[], world: (p: SolidPoint) => Point, target: Screen, previous?: BoundaryLocation) {
      const at = projectSolidBoundary(edges, world, screen, target, cursor?.owner === owner ? cursor.at : previous);
      if (at) cursor = { owner, at };
    },
    nudge(owner: string, edges: readonly SolidEdge[], world: (p: SolidPoint) => Point, from: BoundaryLocation, amount: number) {
      let at = { ...from }, remaining = Math.abs(amount), direction = Math.sign(amount);
      for (let guard = 0; guard < edges.length * 2 && remaining > 1e-9; guard++) {
        const edge = solidEdge(edges, at);
        if (!edge) break;
        const a = world(edge.a), b = world(edge.b), length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        const room = length * (direction > 0 ? 1 - at.fraction : at.fraction), move = Math.min(room, remaining);
        if (length > 1e-12) at.fraction += direction * move / length;
        remaining -= move;
        if (remaining <= 1e-9) break;
        const node = direction > 0 ? edge.end : edge.start;
        const next = edges.find(e => e !== edge && !e.location.across && (direction > 0 ? e.start === node : e.end === node))
          ?? edges.find(e => e !== edge && (direction > 0 ? e.start === node : e.end === node));
        if (!next) break;
        at = { ...next.location, fraction: direction > 0 ? 0 : 1 };
      }
      cursor = { owner, at };
    },
  };
}
