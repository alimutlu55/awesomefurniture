import { kitchenSpans, unitAxes } from '../kitchen/kitchen-runs';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { installedCorners, type InstalledCorner } from './corner-joints';
import { type Dimensions, type Item, mm } from './drawing';
import { plan } from './plan-symbols';
import { type PlacedPiece, wallGeometry } from './room-pieces';
import type { Studio } from '../studio/studio';

/** Intersection of the two carcass front planes, separate from the shorter strip's stock bounds. */
function frontIntersection(j: InstalledCorner) {
  const { u, v } = unitAxes(j.owner.angle);
  const along = j.side * (j.owner.design.w / 2 + j.bodyGap);
  return { x: j.owner.x + u.x * along + v.x * j.owner.design.d / 2,
    z: j.owner.z + u.z * along + v.z * j.owner.design.d / 2 };
}

/** Show the specified corner allocation on the overview, with actual witness lines retained.
 * Actual missing space is stated in the detail/check report, separately from installation labels. */
export function cornerChainLabels(d: Dimensions, wallId: string | null, pieces: readonly PlacedPiece[], along: (x: number, z: number) => number): Dimensions {
  const labels: Record<number, string> = {};
  for (const j of installedCorners(pieces).filter(j => j.blind && !j.owner.hung && j.owner.wall === wallId)) {
    if (Math.abs(j.bodyGap - j.requiredGap) <= .05) continue;
    const p = frontIntersection(j), { u } = unitAxes(j.owner.angle);
    const body = mm(along(p.x, p.z));
    const end = mm(along(p.x - u.x * j.side * j.bodyGap, p.z - u.z * j.side * j.bodyGap));
    const a = Math.min(body, end), b = Math.max(body, end);
    const k = d.stops.findIndex((s, i) => s === a && d.stops[i + 1] === b);
    if (k >= 0) labels[k] = String(mm(j.requiredGap));
  }
  return Object.keys(labels).length ? { ...d, labels } : d;
}

function worktopCorners(pieces: readonly PlacedPiece[]) {
  const spans = kitchenSpans(pieces.map(p => ({ ...p, state: p.design })));
  return installedCorners(pieces).filter(j => j.blind && !j.other.hung && kitchenUnit(j.other.design.unit).worktop).flatMap(j => {
    const span = spans.find(s => s.kind === 'worktop' && s.units.includes(j.other.id));
    if (!span) return [];
    const { v } = unitAxes(j.other.angle), intersection = frontIntersection(j);
    const projection = (span.x - intersection.x) * v.x + (span.z - intersection.z) * v.z + span.depth / 2;
    return projection > 1e-5 ? [{ ...j, projection }] : [];
  });
}

/** Local 20 mm worktop projection at the inside corner. This belongs next to the actual edge;
 * the full corner allowance remains on the main installation chain. Values follow the worktop rule. */
export function cornerPlanSetout(pieces: readonly PlacedPiece[]): Item[] {
  return worktopCorners(pieces).map(j => {
    const intersection = frontIntersection(j), { v } = unitAxes(j.other.angle), own = unitAxes(j.owner.angle);
    const inset = Math.min(20, j.owner.design.d / 2);
    const dir = { x: v.x, y: -v.z }, front = { x: own.v.x, y: -own.v.z };
    const side = -dir.y * front.x + dir.x * front.y >= 0 ? 1 : -1;
    return { kind: 'dims', origin: plan(intersection.x - own.v.x * inset, intersection.z - own.v.z * inset),
      dir, side, clear: 0, row: 0, stops: [0, mm(j.projection)] };
  });
}

/** Elevation counterpart of the local projection: inside the return face, below the countertop.
 * It never replaces the 40 mm installation dimension along the bottom of the elevation. */
export function cornerElevationSetout(studio: Studio, wallId: string, pieces: readonly PlacedPiece[]): Item[] {
  const wall = studio.walls.find(w => w.id === wallId), g = wall && wallGeometry(studio, wall);
  if (!g) return [];
  return worktopCorners(pieces).filter(j => j.owner.wall === wallId).map(j => {
    const intersection = frontIntersection(j), { v } = unitAxes(j.other.angle);
    const start = (intersection.x - g.face.from.x) * g.line.ux + (intersection.z - g.face.from.z) * g.line.uz;
    const end = start + j.projection * (v.x * g.line.ux + v.z * g.line.uz);
    return { kind: 'dims', origin: { x: mm(Math.min(start, end)), y: mm(j.other.y + j.other.design.h - 12) },
      dir: { x: 1, y: 0 }, side: 1, clear: 0, row: 0, stops: [0, mm(Math.abs(end - start))] };
  });
}
