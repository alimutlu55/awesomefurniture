import type { Studio } from '../studio/studio';
import { isWallUtility, openingNoun } from '../studio/wall-utilities';
import { serviceStatus } from '../studio/service-status';
import { cabinetLighting } from '../kitchen/cabinet-lighting';
import { type Item, type Sheet, line, mm, note, rect, ROWS_PER_SHEET, stops } from './drawing';
import { elevationOpeningItems } from './opening-notes';
import { type PlacedPiece, wallGeometry } from './room-pieces';

/** Service symbols and dimensions retain their finished-wall/floor datum independently of furniture. */
export function serviceDrawings(studio: Studio | undefined, pieces: readonly PlacedPiece[]): Sheet[] {
  if (!studio) return [];
  const sheets: Sheet[] = [], rows: string[][] = [];
  for (const [index, w] of studio.walls.entries()) {
    const g = wallGeometry(studio, w);
    if (!g) continue;
    const letter = String.fromCharCode(65 + index), services = g.openings.filter(o => isWallUtility(o.kind));
    const lighting = pieces.filter(p => p.wall === w.id).flatMap(p => cabinetLighting(p.design).map(s => ({ p, s })));
    if (!services.length && !lighting.length) continue;
    const items: Item[] = [rect(0, 0, mm(g.face.length), mm(w.height), 'thin')];
    for (const [i, o] of services.entries()) {
      const x = o.offset - g.face.start, cy = o.sill + o.height / 2, ref = 'S' + (index + 1) + '.' + (i + 1);
      items.push(...elevationOpeningItems(o, x - o.width / 2, x + o.width / 2));
      items.push(note({ x: mm(x), y: mm(o.sill) - 60 }, ref + ' · CL ' + mm(x) + ' / FFL ' + mm(cy)));
      rows.push([ref + ' ' + (o.label || openingNoun(o.kind)), serviceStatus(o.status)?.label ?? 'Unconfirmed', 'Wall ' + letter,
        String(mm(x)), String(mm(cy)), mm(o.width) + ' × ' + mm(o.height)]);
    }
    for (const { p, s } of lighting) {
      items.push(line({ x: mm(p.lo - g.face.start + s.a.x), y: mm(p.y + s.a.y) },
        { x: mm(p.lo - g.face.start + s.b.x), y: mm(p.y + s.b.y) }, 'lighting'));
      rows.push([p.mark + ' LED', 'Configured', 'Wall ' + letter, mm(p.lo - g.face.start + s.a.x) + '–' + mm(p.lo - g.face.start + s.b.x),
        String(mm(p.y + s.a.y)), mm(s.length) + ' length']);
    }
    items.push({ kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, side: -1, clear: 0, row: 0,
      stops: stops([0, mm(g.face.length), ...services.map(o => mm(o.offset - g.face.start))]) },
    { kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, side: 1, clear: 0, row: 0,
      stops: stops([0, mm(w.height), ...services.map(o => mm(o.sill + o.height / 2))]) });
    sheets.push({ number: 0, title: 'Services elevation ' + letter, purpose: 'Installation',
      legend: ['Green: new · blue: existing / retain · red dashed: remove / relocate · orange: configured LED',
        'CL dimensions from finished wall left and finished floor; unclassified points stay unconfirmed. LED wiring/driver route requires confirmation.'],
      views: [{ title: 'Wall ' + letter + ' services', items }], pieces: [], checks: [] });
  }
  for (let i = 0; i < rows.length; i += ROWS_PER_SHEET) sheets.push({ number: 0, title: 'Service & lighting schedule', views: [], pieces: [], checks: [],
    table: { columns: ['Reference / item', 'Status', 'Datum', 'CL from left (mm)', 'CL from FFL (mm)', 'Size (mm)'], numeric: [], rows: rows.slice(i, i + ROWS_PER_SHEET),
      notes: ['Positions describe modeled points. Cable routes, circuit ratings, driver access, ventilation areas and appliance cut-outs require project/manufacturer confirmation.',
        'Do not infer new or relocated services from cabinet placement. Existing designs without a recorded status remain unconfirmed.'] } });
  return sheets;
}
