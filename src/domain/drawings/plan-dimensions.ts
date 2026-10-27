import { planLevelRows } from './plan-levels';
import { isWallUtility } from '../studio/wall-utilities';
import type { Studio } from '../studio/studio';
import { cornerDegree } from '../studio/studio';
import { type Dimensions, type Item, mm, stops } from './drawing';
import { type PlacedPiece, wallGeometry } from './room-pieces';
import { plan } from './plan-symbols';
import { cornerWidthStops } from './corner-widths';
import { unitAxes } from '../kitchen/kitchen-runs';
import { kitchenUnit, WORKTOP, installationKind } from '../kitchen/kitchen-units';

/** All stops use one finished-wall datum and are rounded once, after projection. The front-side chain is
 * independent of the upper-unit chain outside the wall. Real fillers, panels and empty gaps retain their ticks. */
export function planDimensions(studio: Studio, visible: readonly PlacedPiece[], context: readonly PlacedPiece[], overview: boolean, upper: boolean): Item[] {
  const out: Item[] = [];
  for (const wall of studio.walls) {
    const g = wallGeometry(studio, wall);
    if (!g) continue;
    const { line: l, face } = g, mine = visible.filter(p => p.wall === wall.id);
    const floor = upper ? [] : mine.filter(p => !p.hung && !p.fixture);
    const split = (p: PlacedPiece) => cornerWidthStops(p, context).map(s => p.lo + s);
    const chain = (values: readonly number[], row: number, depth = 0, side: 1 | -1 = 1): Dimensions => ({
      kind: 'dims', origin: plan(face.from.x + l.nx * depth, face.from.z + l.nz * depth),
      dir: { x: l.ux, y: -l.uz }, side, clear: side === 1 ? mm(wall.thickness) : 0, row,
      stops: stops([0, mm(face.length), ...values.map(t => mm(t - face.start))]),
    });
    if (floor.length) {
      const deepest = Math.max(...floor.map(p => p.off + p.design.d));
      // Project actual neighbouring footprints: show the return depth and joint separately, never as one fake cabinet.
      const returns = context.filter(p => p.wall !== wall.id && !p.hung && !p.fixture).flatMap(p => {
        const { u, v } = unitAxes(p.angle);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
          x: p.x + u.x * a! * p.design.w / 2 + v.x * b! * p.design.d / 2,
          z: p.z + u.z * a! * p.design.w / 2 + v.z * b! * p.design.d / 2 }));
        const normal = corners.map(q => (q.x - face.from.x) * l.nx + (q.z - face.from.z) * l.nz);
        const along = corners.map(q => face.start + (q.x - face.from.x) * l.ux + (q.z - face.from.z) * l.uz);
        return Math.min(...normal) < .05 && Math.max(...normal) >= 0 && Math.max(...along) > face.start && Math.min(...along) < face.end
          ? [Math.min(...along), Math.max(...along)] : [];
      });
      const values = overview ? [Math.min(...floor.map(p => p.lo)), Math.max(...floor.map(p => p.hi)),
        ...floor.filter(p => cornerWidthStops(p, context).length > 2).flatMap(split)] : [...floor.flatMap(split), ...returns];
      const top = floor.some(p => p.design.product === 'kitchen' && !installationKind(p.design) && kitchenUnit(p.design.unit).worktop) ? deepest + WORKTOP.overhang : deepest;
      out.push(chain(values, 0, top, -1));
      if (!overview) {
        const left = Math.min(...floor.map(p => p.lo)), right = Math.max(...floor.map(p => p.hi));
        // Put depth setting-out at an open run end, clear of the intersecting corner dimension chains.
        const startDegree = cornerDegree(studio, wall.a), endDegree = cornerDegree(studio, wall.b);
        const atRight = startDegree !== endDegree ? endDegree < startDegree : face.end - right > left - face.start;
        const t = (atRight ? right : left) - face.start;
        out.push({ kind: 'dims', origin: plan(face.from.x + l.ux * t, face.from.z + l.uz * t),
          dir: { x: l.nx, y: -l.nz }, side: atRight ? 1 : -1, clear: 0, row: 0, stops: stops([0, mm(floor.find(p => Math.abs(p.off + p.design.d - deepest) < 1e-7)!.off), mm(deepest), mm(top)]) });
      }
    }
    const hung = (upper ? visible : context).filter(p => p.wall === wall.id && (p.hung || installationKind(p.design)) && (!p.fixture || p.fixture === 'shelf'));
    const rows = overview ? [] : planLevelRows(hung).filter(row => row.some(p => p.hung && !installationKind(p.design)));
    rows.forEach((row, i) => out.push(chain(row.flatMap(split), i)));
    // Structural openings have their own outer setting-out tier; service datums belong on service elevations.
    const openings = g.openings.filter(o => !isWallUtility(o.kind));
    if (openings.length && !overview) out.push(chain(openings.flatMap(o => [o.offset - o.width / 2, o.offset + o.width / 2]), rows.length));
    out.push(chain([], rows.length + Number(openings.length > 0 && !overview)));
  }
  return out;
}
