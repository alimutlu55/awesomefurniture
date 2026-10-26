import { ventilationGrille } from '../kitchen/ventilation';
import { plinthOf } from '../wardrobe/carcass';
import { type Item, type Sheet, mm, rect, stops } from './drawing';
import type { PlacedPiece } from './room-pieces';

/** Position and purchased envelope only. Never substitute the grille's outer size for its supplier cut-out or free area. */
export function ventilationDetails(pieces: readonly PlacedPiece[]): Sheet[] {
  return pieces.flatMap(p => {
    const v = ventilationGrille(p.design);
    if (!v) return [];
    const items: Item[] = [rect(0, 0, mm(p.design.w), mm(plinthOf(p.design)), 'thin'),
      rect(mm(v.x0), mm(v.y0), mm(v.x1), mm(v.y1), 'outline'),
      { kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, side: -1, row: 0, clear: 0,
        stops: stops([0, mm(v.x0), mm(v.x1), mm(p.design.w)]) },
      { kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, side: 1, row: 0, clear: 0,
        stops: stops([0, mm(v.y0), mm(v.y1), mm(plinthOf(p.design))]) }];
    for (let y = v.y0 + 1; y < v.y1; y += 1) items.push({ kind: 'line', stroke: 'thin', points: [{ x: mm(v.x0), y: mm(y) }, { x: mm(v.x1), y: mm(y) }] });
    return [{ number: 0, title: p.mark + ' Ventilation grille', legend: [
      'Configured outer envelope and centring in the plinth; dimensions in mm from unit left and local floor.',
      'UNCONFIRMED: supplier cut-out, required free ventilation area and continuous air path. Do not cut this outline as a template.',
    ], views: [{ title: 'Outer envelope and setting out', items }], pieces: [], checks: [],
      table: undefined } satisfies Sheet];
  });
}
