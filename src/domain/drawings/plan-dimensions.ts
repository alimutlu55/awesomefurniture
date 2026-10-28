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
    const chain = (values: readonly number[], row: number, depth = 0, side: 1 | -1 = 1, from = face.start, to = face.end): Dimensions => ({
      kind: 'dims', origin: plan(face.from.x + l.nx * depth, face.from.z + l.nz * depth),
      dir: { x: l.ux, y: -l.uz }, side, clear: side === 1 ? mm(wall.thickness) : 0, row,
      stops: stops([mm(from - face.start), mm(to - face.start), ...values.map(t => mm(t - face.start))]),
    });
    if (floor.length) {
      const deepest = Math.max(...floor.map(p => p.off + p.design.d));
      const left = Math.min(...floor.map(p => p.lo)), right = Math.max(...floor.map(p => p.hi));
      // Project actual neighbouring footprints: start the front chain at a corner return face rather than cutting through the perpendicular cabinet.
      const returns = context.filter(p => p.wall !== wall.id && !p.hung && !p.fixture).flatMap(p => {
        const { u, v } = unitAxes(p.angle);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
          x: p.x + u.x * a! * p.design.w / 2 + v.x * b! * p.design.d / 2,
          z: p.z + u.z * a! * p.design.w / 2 + v.z * b! * p.design.d / 2 }));
        const normal = corners.map(q => (q.x - face.from.x) * l.nx + (q.z - face.from.z) * l.nz);
        const along = corners.map(q => face.start + (q.x - face.from.x) * l.ux + (q.z - face.from.z) * l.uz);
        return Math.min(...normal) < .05 && Math.max(...normal) >= 0 && Math.max(...along) > face.start && Math.min(...along) < face.end
          ? [[Math.min(...along), Math.max(...along)] as const] : [];
      });
      const startReturn = returns.some(([a, b]) => a <= face.start + .5 && b <= left + .5) ? left : face.start;
      const endReturn = returns.some(([a, b]) => b >= face.end - .5 && a >= right - .5) ? right : face.end;
      const midReturns = returns.filter(([a, b]) => a > face.start + .5 && b < face.end - .5).flatMap(([a, b]) => [a, b]);
      const values = overview ? [left, right,
        ...floor.filter(p => cornerWidthStops(p, context).length > 2).flatMap(split)] : [...floor.flatMap(split), ...midReturns];
      const top = floor.some(p => p.design.product === 'kitchen' && !installationKind(p.design) && kitchenUnit(p.design.unit).worktop) ? deepest + WORKTOP.overhang : deepest;
      out.push(chain(values, 0, top, -1, startReturn, endReturn));
      if (!overview) {
        // Put depth setting-out at an open run end, clear of the intersecting corner dimension chains.
        const startDegree = cornerDegree(studio, wall.a), endDegree = cornerDegree(studio, wall.b);
        const atRight = startDegree !== endDegree ? endDegree < startDegree : face.end - right > left - face.start;
        const t = (atRight ? right : left) - face.start;
        const endPiece = [...floor].filter(p => !installationKind(p.design)).sort((a, b) => atRight ? b.hi - a.hi : a.lo - b.lo)[0] ?? floor[0]!;
        const endDepth = endPiece.off + endPiece.design.d;
        const endTop = endPiece.design.product === 'kitchen' && !installationKind(endPiece.design) && kitchenUnit(endPiece.design.unit).worktop ? endDepth + WORKTOP.overhang : endDepth;
        out.push({ kind: 'dims', origin: plan(face.from.x + l.ux * t, face.from.z + l.uz * t),
          dir: { x: l.nx, y: -l.nz }, side: atRight ? 1 : -1, clear: 0, row: 0, stops: stops([0, mm(endPiece.off), mm(endDepth), mm(endTop)]) });
      }
    }
    const hung = (upper ? visible : context).filter(p => p.wall === wall.id && (p.hung || installationKind(p.design))
      && (!p.fixture || (upper && p.fixture === 'shelf'))
      && (upper || !floor.some(q => Math.abs(p.lo - q.lo) < .2 && Math.abs(p.hi - q.hi) < .2 && Math.abs(p.off + p.design.d - q.off - q.design.d) < .2)));
    const rawRows = overview ? [] : planLevelRows(hung).filter(row => row.some(p => p.hung && !installationKind(p.design)));
    // Combine non-overlapping upper rows into one chain and drop stacked rows whose bays are already dimensioned.
    const rows: PlacedPiece[][] = [];
    for (const row of rawRows) {
      const cabs = row.filter(p => !installationKind(p.design));
      const novel = cabs.filter(p => !rows.some(r => r.some(q => !installationKind(q.design) && Math.abs(p.lo - q.lo) < .2 && Math.abs(p.hi - q.hi) < .2)));
      if (!novel.length) continue;
      const boards = row.filter(p => installationKind(p.design) && (upper || p.hung)
        && novel.some(q => Math.abs(p.off + p.design.d - q.off - q.design.d) < .2));
      const target = rows.find(r => r.filter(q => !installationKind(q.design)).every(q => novel.every(p => Math.min(p.hi, q.hi) - Math.max(p.lo, q.lo) <= .2)));
      if (target) target.push(...novel, ...boards.filter(b => !target.some(t => Math.abs(b.lo - t.lo) < .2 && Math.abs(b.hi - t.hi) < .2)));
      else rows.push([...novel, ...boards]);
    }
    rows.forEach((row, i) => out.push(chain(row.flatMap(split), i)));
    // Structural openings have their own outer setting-out tier; service datums belong on service elevations.
    const openings = g.openings.filter(o => !isWallUtility(o.kind));
    if (openings.length && !overview) out.push(chain(openings.flatMap(o => [o.offset - o.width / 2, o.offset + o.width / 2]), rows.length));
    out.push(chain([], rows.length + Number(openings.length > 0 && !overview)));
  }
  return out;
}
