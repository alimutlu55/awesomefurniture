import { ventilationGrille } from '../kitchen/ventilation';
import { plinthOf } from '../wardrobe/carcass';
import { resolveMaterials } from '../materials/configured-materials';
import { getDecor } from '../materials/decor-catalog';
import { drawerExtension } from '../wardrobe/drawer-runners';
import { hinge, hingeFor, hingesFor } from '../wardrobe/hinges';
import { handleLabel, resolveHandle } from '../wardrobe/handles';
import { madeStyle } from '../wardrobe/front-styles';
import { fitting, FITTING_HARDWARE, type FittingHardware } from '../wardrobe/fittings';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { kitchenUnit, installationKind } from '../kitchen/kitchen-units';
import { isKitchen } from '../furniture/furniture';
import { mm, ROWS_PER_SHEET, type Table } from './drawing';
import { innerFrontBehindDoor, isFrontBoard, piecefronts, type Front } from './fronts';
import type { Board } from './cabinet-boards';
import { pieceBoards } from './unit-detail';
import type { PlacedPiece } from './room-pieces';
import { cornerFaceWidths } from './corner-widths';

/** A wall shelf's brackets: one at each end, one more every 800 mm. */
const bracketsFor = (width: number) => 2 + Math.floor((width - 1) / 800);

interface Line { item: string; size: string; qty: number; marks: string[] }
/** A door's height: its cut board's (a door up to a sloped or flat top is cut to it), else the front's own. */
const doorHeight = (f: Front, boards: readonly Board[]) => { const b = boards.find(x => (x.stock === 'door' || x.stock === 'front') && isFrontBoard(f, x)); return (b ? b.y1 : f.y1) - f.y0; };

/**
 * The hardware list: every hinge, runner, rail, fitting and handle the pieces need, added up across the job, with the
 * marks of the pieces each goes to. Fittings name their own hardware in the registry (FITTING_HARDWARE); doors take
 * hinges by height, every cut front a handle; kitchen floor units stand on legs, wall units hang on hangers, tall
 * pieces are fixed to the wall.
 */
export function hardwareList(pieces: readonly PlacedPiece[]): Table[] {
  const lines: Line[] = [];
  const add = (p: PlacedPiece, item: string, size: string, qty: number) => {
    if (qty <= 0) return;
    const same = lines.find(l => l.item === item && l.size === size);
    if (same) { same.qty += qty; if (!same.marks.includes(p.mark)) same.marks.push(p.mark); } else lines.push({ item, size, qty, marks: [p.mark] });
  };
  for (const p of pieces) {
    const d = p.design;
    if (p.fixture === 'shelf') { add(p, 'Shelf bracket', 'for ' + mm(d.d) + ' deep', bracketsFor(mm(d.w))); continue; }
    if (p.fixture || installationKind(d)) continue;
    const vent = ventilationGrille(d);
    if (vent) add(p, 'Ventilation grille', mm(vent.width) + ' × ' + mm(vent.height) + ' overall; confirm cut-out/free area', 1);
    const kitchen = isKitchen(d), unit = kitchen ? kitchenUnit(d.unit) : null;
    const boards = pieceBoards(p, pieces);
    for (const f of piecefronts(d, cornerFaceWidths(p, pieces)).fronts) {
      if (f.own || f.opens === 'open' || f.opens === 'fixed') continue;
      if (f.opens === 'side' && !f.label) {
        const glass = f.glass ?? getDecor(resolveMaterials(d).frontDecorId).category === 'glass_mirror', kind = hinge(hingeFor(f, d, glass, p.sides));
        add(p, kind.name, kind.cup ? kind.cup.d + ' mm cup' : 'compatible with frame/carrier; no cup drilling in glass', hingesFor(mm(doorHeight(f, boards))));
      }
      if (f.label && (f.opens === 'side' || f.opens === 'down')) add(p, 'Appliance door fixing kit', 'with the appliance', 1);
      // A handle-rail door is its own grip: its profile, as long as the door is wide, in place of a handle.
      if (f.opens === 'side' && !f.label && madeStyle({ ...d, materials: resolveMaterials(d) }, f.decorId).grip) { add(p, 'Handle rail profile', mm(f.x1 - f.x0) + ' mm long', 1); continue; }
      const handle = resolveHandle(resolveMaterials(d));
      if (handle.none) add(p, 'Push-to-open mechanism', 'compatible with hinge/runner; 2mm shadow gaps', 1);
      else add(p, 'Handle', handleLabel(handle), 1);
    }
    // Fittings: what each is built with, sized to its place.
    const editing = { ...d, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing);
    const runner = mm(drawerExtension(d.d));
    geometry.widths().forEach((_, i) => geometry.computeLayout(i).forEach((pos, j) => {
      const it = d.secs[i]![j]!;
      // A drawer's own front takes a handle, unless it is behind closed doors (a finger grip, D4).
      if (!kitchen && fitting(it.k)?.innerFront && !innerFrontBehindDoor(d, it)) {
        const handle = resolveHandle(resolveMaterials(d));
        if (handle.none) add(p, 'Push-to-open mechanism', 'compatible with hinge/runner; 2mm shadow gaps', 1);
        else add(p, 'Handle', handleLabel(handle), 1);
      }
      for (const h of (fitting(it.k)?.hardware ?? []) as readonly FittingHardware[]) {
        if (h === 'runners') add(p, 'Drawer runners, full extension, pair', runner + ' mm', 1);
        else if (h === 'rail') { add(p, 'Hanging rail, oval', mm(pos.w) - 4 + ' mm long', 1); add(p, 'Rail end support', 'oval rail', 2); }
        else if (h === 'shelfSupports') continue;
        else add(p, FITTING_HARDWARE[h].replace(/, one .*$/, ''), 'for ' + mm(pos.w) + ' wide', 1);
      }
    }));
    const shelves = boards.filter(b => b.note === 'adjustable').length;
    add(p, 'Shelf support', '5 mm pin', 4 * shelves);
    if (unit?.plinth && plinthOf(d) > 0) add(p, 'Adjustable leg', 'for ' + mm(plinthOf(d)) + ' plinth', 4);
    if (p.hung) add(p, 'Cabinet hanger, adjustable', 'pair', 1);
    if (!kitchen || (unit && !unit.worktop && unit.plinth)) add(p, 'Wall fixing bracket', 'anti-tip', 2);
  }
  const body = lines.map(l => [l.item, l.size, String(l.qty), l.marks.join(', ')]);
  const notes = ['Quantities follow common practice (hinges by door height: up to 900 mm two, 1600 mm three, 2000 mm four, above five). Check against your hardware maker\'s guide.',
    'Runner length is the longest standard length that fits the clear depth less 10 mm. Screws, connectors and edge banding are not listed.'];
  const pages: Table[] = [];
  for (let k = 0; k < Math.max(1, body.length); k += ROWS_PER_SHEET) {
    pages.push({ columns: ['Item', 'Size', 'Qty', 'For'], rows: body.slice(k, k + ROWS_PER_SHEET), numeric: [2], notes: k + ROWS_PER_SHEET >= body.length ? notes : ['Continued on the next sheet.'] });
  }
  return pages;
}
