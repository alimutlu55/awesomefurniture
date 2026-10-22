import { decorCode, getDecor } from '../materials/decor-catalog';
import { resolveMaterials } from '../materials/configured-materials';
import type { EditorDesign } from '../wardrobe/editor-design';
import { PLINTH } from '../wardrobe/catalog.js';
import { kitchenSpans, unitAxes } from '../kitchen/kitchen-runs';
import { KITCHEN_PLINTH_SETBACK } from '../kitchen/kitchen-units';
import { mm, ROWS_PER_SHEET, type Table } from './drawing';
import type { Board, BoardStock } from './cabinet-boards';
import { pieceBoards } from './unit-detail';
import type { PlacedPiece } from './room-pieces';

/** A kitchen run's plinth board thickness. Centimetres. */
const PLINTH_BOARD = 1.6;
const COLUMNS = ['Mark', 'Part', 'Qty', 'Length', 'Width', 'Thick', 'Material', 'Edges', 'Note'];
const STOCK: Record<BoardStock, string> = { carcass: 'Board', shelf: 'Board', back: 'Back panel', front: 'Front', door: 'Door', plinth: 'Board' };

interface Row { mark: string; part: string; qty: number; length: number; width: number; thick: number; material: string; edges: string; note: string }

/** What a board is cut from, with its finish where it shows ("Board 18 · White", "Back panel 6"). */
function material(b: Pick<Board, 'stock' | 'cut' | 'decorId'>, design: EditorDesign) {
  if (b.stock === 'door' && design.doors === 'glass') return 'Glass ' + mm(b.cut.thickness);
  if (b.stock === 'back') return 'Back panel ' + mm(b.cut.thickness);
  const selected = resolveMaterials(design);
  const id = b.decorId ?? (b.stock === 'door' || b.stock === 'front' ? selected.frontDecorId : selected.carcassDecorId);
  return STOCK[b.stock] + ' ' + mm(b.cut.thickness) + ' · ' + decorCode(getDecor(id));
}

/** A piece's boards as rows, identical boards counted together. */
function rows(p: PlacedPiece): Row[] {
  const out: Row[] = [];
  for (const b of pieceBoards(p)) {
    const row = { mark: p.mark, part: b.name, qty: 1, length: mm(b.cut.length), width: mm(b.cut.width), thick: mm(b.cut.thickness),
      material: material(b, p.design), edges: b.edges, note: b.note ?? '' };
    const same = out.find(r => r.part === row.part && r.length === row.length && r.width === row.width && r.thick === row.thick && r.material === row.material && r.edges === row.edges && r.note === row.note);
    if (same) same.qty++; else out.push(row);
  }
  return out;
}

/**
 * The cutting list: every board of every piece, as the workshop cuts it, piece by piece in mark order, then each kitchen
 * run's worktop and plinth. Length runs with the grain; sizes are finished sizes in whole millimetres. Under it, the
 * area of each material. A list longer than a sheet runs on to the next.
 */
export function cuttingList(pieces: readonly PlacedPiece[]): Table[] {
  const all = pieces.flatMap(rows), markOf = new Map(pieces.map(p => [p.id, p.mark]));
  const poses = pieces.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, angle: p.angle, state: p.design }));
  for (const s of kitchenSpans(poses)) {
    const marks = s.units.map(id => markOf.get(id as number)!).filter(Boolean), run = marks.length > 1 ? marks[0] + '–' + marks[marks.length - 1] : marks[0] ?? '';
    const design = pieces.find(p => p.id === s.units[0])!.design, materials = resolveMaterials(design);
    const fin = decorCode(getDecor(materials.carcassDecorId));
    if (s.kind === 'worktop') {
      // Sinks and hobs standing on this worktop: on its top, within its length and depth.
      const { u, v } = unitAxes(s.angle), on = (p: PlacedPiece) => Math.abs(p.y - (s.y + s.height)) < 1
        && Math.abs((p.x - s.x) * u.x + (p.z - s.z) * u.z) < s.length / 2 && Math.abs((p.x - s.x) * v.x + (p.z - s.z) * v.z) < s.depth / 2;
      const holes = pieces.filter(p => (p.fixture === 'sink' || p.fixture === 'hob') && on(p));
      all.push({ mark: run, part: 'Worktop', qty: 1, length: mm(s.length), width: mm(s.depth), thick: mm(s.height), material: materials.worktopDecorId ? decorCode(getDecor(materials.worktopDecorId)) : 'Worktop ' + mm(s.height),
        edges: 'L1', note: holes.length ? 'cut-outs for ' + holes.map(h => h.mark).join(', ') + ': UNCONFIRMED - obtain manufacturer templates' : '' });
    } else {
      all.push({ mark: run, part: 'Plinth', qty: 1, length: mm(s.length), width: mm(PLINTH), thick: mm(design.materials ? 1.8 : PLINTH_BOARD), material: 'Plinth ' + mm(design.materials ? 1.8 : PLINTH_BOARD) + ' · ' + fin,
        edges: '—', note: 'set back ' + mm(KITCHEN_PLINTH_SETBACK) + ' from the fronts' });
    }
  }
  // Area of each material, for ordering boards.
  const area = new Map<string, number>();
  for (const r of all) area.set(r.material, (area.get(r.material) ?? 0) + r.qty * r.length * r.width / 1e6);
  const notes = [
    'Length runs with the grain. Finished sizes in mm: deduct edge banding before cutting. Edges: L = long edge, W = short edge (L1 = one long edge).',
    'Areas: ' + [...area].map(([m, a]) => m + ' ' + a.toFixed(2) + ' m²').join(' · '),
  ];
  const body = all.map(r => [r.mark, r.part, String(r.qty), String(r.length), String(r.width), String(r.thick), r.material, r.edges, r.note]);
  const pages: Table[] = [];
  for (let k = 0; k < Math.max(1, body.length); k += ROWS_PER_SHEET) {
    const last = k + ROWS_PER_SHEET >= body.length;
    pages.push({ columns: COLUMNS, rows: body.slice(k, k + ROWS_PER_SHEET), numeric: [2, 3, 4, 5], notes: last ? notes : ['Continued on the next sheet.'] });
  }
  return pages;
}
