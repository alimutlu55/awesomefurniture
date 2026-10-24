/** Continuous positions on a closed polygon. No grid, corner margins or minimum edge lengths. */
export interface BoundaryPoint {
  readonly t: number; readonly y: number;
  readonly roof?: boolean | undefined;
  /** Added by + Point and still on its edge: kept until it is moved off it. */
  readonly pinned?: boolean | undefined;
}
const EPS = 1e-9;
/** Two points this close are one point: the same limit the studio validator refuses ("these points meet"). */
export const COINCIDENT = 1e-6;
export const interpolateBoundary = (a: BoundaryPoint, b: BoundaryPoint, f: number): BoundaryPoint =>
  ({ t: a.t + (b.t - a.t) * f, y: a.y + (b.y - a.y) * f });
/** Reject a collapsed or self-intersecting polygon while allowing arbitrarily short, collinear edges. */
export function validBoundary(points: readonly BoundaryPoint[]): boolean {
  if (points.length < 3 || points.some(p => !Number.isFinite(p.t) || !Number.isFinite(p.y))) return false;
  const cross = (a: BoundaryPoint, b: BoundaryPoint, c: BoundaryPoint) => (b.t - a.t) * (c.y - a.y) - (b.y - a.y) * (c.t - a.t);
  const on = (a: BoundaryPoint, b: BoundaryPoint, p: BoundaryPoint) => Math.abs(cross(a, b, p)) < EPS
    && p.t >= Math.min(a.t, b.t) - EPS && p.t <= Math.max(a.t, b.t) + EPS
    && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    if (Math.hypot(a.t - b.t, a.y - b.y) < EPS) return false;
    area += a.t * b.y - b.t * a.y;
    const prev = points[(i + points.length - 1) % points.length]!;
    if (Math.abs(cross(prev, a, b)) < EPS && (prev.t - a.t) * (b.t - a.t) + (prev.y - a.y) * (b.y - a.y) > EPS) return false;
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j]!, d = points[(j + 1) % points.length]!;
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
      if (on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)) return false;
    }
  }
  return Math.abs(area) > EPS;
}

/** Lowest polygon edge at each run coordinate, including both sides of vertical steps. */
export function lowerBoundary(points: readonly BoundaryPoint[]): BoundaryPoint[] {
  const ts = [...new Set(points.map(p => p.t))].sort((a, b) => a - b), out: BoundaryPoint[] = [];
  const add = (p: BoundaryPoint) => { const last = out.at(-1); if (!last || Math.hypot(last.t - p.t, last.y - p.y) > COINCIDENT) out.push(p); };
  for (let k = 0; k < ts.length - 1; k++) {
    const left = ts[k]!, right = ts[k + 1]!, mid = (left + right) / 2;
    let best: { a: BoundaryPoint; b: BoundaryPoint; y: number } | undefined;
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length]!;
      if (mid <= Math.min(a.t, b.t) || mid >= Math.max(a.t, b.t)) return;
      const y = interpolateBoundary(a, b, (mid - a.t) / (b.t - a.t)).y;
      if (!best || y < best.y) best = { a, b, y };
    });
    if (best) {
      const { a, b } = best;
      add(interpolateBoundary(a, b, (left - a.t) / (b.t - a.t)));
      add(interpolateBoundary(a, b, (right - a.t) / (b.t - a.t)));
    }
  }
  return out;
}

/** Clip a face when its supporting wall is divided, preserving angled edges at the cut. */
export function clipBoundary(points: readonly BoundaryPoint[], min: number, max: number): BoundaryPoint[] {
  let result = [...points];
  for (const [limit, sign] of [[min, 1], [max, -1]] as const) {
    const input = result; result = [];
    input.forEach((b, k) => {
      const a = input[(k + input.length - 1) % input.length]!;
      const insideA = (a.t - limit) * sign >= 0, insideB = (b.t - limit) * sign >= 0;
      if (insideA !== insideB) result.push(interpolateBoundary(a, b, (limit - a.t) / (b.t - a.t)));
      if (insideB) result.push(b);
    });
  }
  return result.filter((p, k) => {
    const prev = result[(k + result.length - 1) % result.length]!;
    return Math.hypot(prev.t - p.t, prev.y - p.y) > COINCIDENT;
  });
}
