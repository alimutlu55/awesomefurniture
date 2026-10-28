import { installationKind } from '../kitchen/kitchen-units';
import type { PlacedPiece } from './room-pieces';

const EPS = 1e-5;
/** Separate stacked rows and front planes before making a chain. A union of their x stops invents
 * fragments such as 599 + 1 where two different 600 mm cabinets have offset edges. */
export function planLevelRows(pieces: readonly PlacedPiece[]) {
  const cabinets = pieces.filter(p => !installationKind(p.design)), rows: PlacedPiece[][] = [];
  for (const p of cabinets) {
    const row = rows.find(group => group.some(q => Math.abs(p.off + p.design.d - q.off - q.design.d) < EPS
      && Math.min(p.y + p.design.h, q.y + q.design.h) - Math.max(p.y, q.y) > Math.min(p.design.h, q.design.h) / 2));
    if (row) row.push(p); else rows.push([p]);
  }
  return rows.sort((a, b) => a[0]!.off + a[0]!.design.d - b[0]!.off - b[0]!.design.d || a[0]!.y - b[0]!.y).map(row => {
    const boards = pieces.filter(p => installationKind(p.design) && row.some(q =>
      Math.min(p.y + p.design.h, q.y + q.design.h) - Math.max(p.y, q.y) > EPS
      && (Math.abs(p.hi - q.lo) < EPS || Math.abs(p.lo - q.hi) < EPS)
      && Math.abs(p.off - q.off) < EPS));
    return [...row, ...boards];
  });
}
