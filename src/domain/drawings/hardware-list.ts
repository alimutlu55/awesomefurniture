import { makePlacedPiece } from '../make/make-parts';
import {
  HANDLE_ENTRY,
  HINGE_ENTRY,
  PLATE_ENTRY,
  PUSH_TO_OPEN_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  RUNNER_ENTRY,
  SHELF_PIN_ENTRY,
} from '../hardware/hardware-registry';
import { HINGES } from '../wardrobe/hinges';
import type { FittingKind } from '../make/make-joints';
import { ventilationGrille } from '../kitchen/ventilation';
import { resolveMaterials } from '../materials/configured-materials';
import { handleLabel, resolveHandle } from '../wardrobe/handles';
import { madeStyle } from '../wardrobe/front-styles';
import { fitting, FITTING_HARDWARE, type FittingHardware } from '../wardrobe/fittings';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { installationKind } from '../kitchen/kitchen-units';
import { isKitchen } from '../furniture/furniture';
import { mm, ROWS_PER_SHEET, type Table } from './drawing';
import { innerFrontBehindDoor, piecefronts } from './fronts';
import type { PlacedPiece } from './room-pieces';
import { cornerFaceWidths } from './corner-widths';

/** A wall shelf's brackets: one at each end, one more every 800 mm. */
const bracketsFor = (width: number) => 2 + Math.floor((width - 1) / 800);

interface Line { item: string; size: string; qty: number; marks: string[] }

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
    const kitchen = isKitchen(d);
    for (const f of piecefronts(d, cornerFaceWidths(p, pieces)).fronts) {
      if (f.own || f.opens === 'open' || f.opens === 'fixed') continue;
      if (f.label && (f.opens === 'side' || f.opens === 'down')) add(p, 'Appliance door fixing kit', 'with the appliance', 1);
      // A handle-rail door is its own grip: its profile, as long as the door is wide, in place of a handle.
      if (f.opens === 'side' && !f.label && madeStyle({ ...d, materials: resolveMaterials(d) }, f.decorId).grip) { add(p, 'Handle rail profile', mm(f.x1 - f.x0) + ' mm long', 1); continue; }
      const handle = resolveHandle(resolveMaterials(d));
      if (handle.none) add(p, PUSH_TO_OPEN_ENTRY.display.listLine.label, PUSH_TO_OPEN_ENTRY.display.listLine.defaultSpec, 1);

    }
    // Fittings: what each is built with, sized to its place.
    const editing = { ...d, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing);
    geometry.widths().forEach((_, i) => geometry.computeLayout(i).forEach((pos, j) => {
      const it = d.secs[i]![j]!;
      // A drawer's own front takes a handle, unless it is behind closed doors (a finger grip, D4).
      if (!kitchen && fitting(it.k)?.innerFront && !innerFrontBehindDoor(d, it)) {
        const handle = resolveHandle(resolveMaterials(d));
        if (handle.none) add(p, PUSH_TO_OPEN_ENTRY.display.listLine.label, PUSH_TO_OPEN_ENTRY.display.listLine.defaultSpec, 1);

      }
      for (const h of (fitting(it.k)?.hardware ?? []) as readonly FittingHardware[]) {
        if (h === 'runners' || h === 'rail' || h === 'shelfSupports') continue;
        else add(p, FITTING_HARDWARE[h].replace(/, one .*$/, ''), 'for ' + mm(pos.w) + ' wide', 1);
      }
    }));
    const names: Record<FittingKind, string> = {
      confirmat: 'Connector screw', cam: 'Cam connector', bolt: 'Cam bolt', dowel: 'Dowel', screw: 'Screw', nail: 'Nail',
      pin: SHELF_PIN_ENTRY.display.listLine.label, hinge: HINGE_ENTRY.display.listLine.label, plate: PLATE_ENTRY.display.listLine.label,
      runner: `${RUNNER_ENTRY.display.listLine.label}, full extension, ${RUNNER_ENTRY.display.listLine.unit}`,
      handle: HANDLE_ENTRY.display.listLine.label, rail: RAIL_ENTRY.display.listLine.label, support: RAIL_SUPPORT_ENTRY.display.listLine.label,
      leg: 'Adjustable leg', hanger: 'Cabinet hanger, adjustable', bracket: 'Wall fixing bracket',
    };
    for (const line of makePlacedPiece(p,pieces)?.buy ?? []) {
      const def = line.kind === 'hinge' ? HINGES.find(h=>h.size===line.size) : undefined;
      const size = line.kind === 'handle' ? handleLabel(resolveHandle(resolveMaterials(d)))
        : def ? def.cup ? def.cup.d+' mm cup' : 'compatible with frame/carrier; no cup drilling in glass' : line.kind==='runner' ? line.size+' mm' : line.size ?? '';
      let name = def?.name ?? names[line.kind];
      let itemSize = size;
      if (line.size?.includes('cargo frame') || (line.kind === 'support' && line.size?.includes('cargo'))) {
        name = 'Cargo pull-out frame';
        itemSize = 'vertical steel chassis + 4 slide brackets (2–3 pręt)';
      } else if (line.size?.includes('cargo basket')) {
        const style = line.size.includes('solid') ? 'solid Arena' : 'wire';
        name = `Cargo storage basket, ${style}`;
        itemSize = 'clip-on basket + wire separator (Separatory)';
      } else if ((line.kind === 'bracket' || line.kind === 'plate') && line.size?.includes('cargo')) {
        name = 'Cargo front fixing bracket';
        itemSize = '103.5 × 36.5 mm 3D mount + GTV move cover';
      } else if (line.kind === 'screw' && line.size === 'M4 × 6') {
        name = 'Cargo slide locking screw';
        itemSize = 'M4 × 6 mm machine screw';
      }
      add(p, name, itemSize, line.qty);
    }
  }
  const body = lines.map(l => [l.item, l.size, String(l.qty), l.marks.join(', ')]);
  const notes = ['Quantities follow common practice (hinges by door height: up to 900 mm two, 1600 mm three, 2000 mm four, above five). Check against your hardware maker\'s guide.',
    'Modeled fittings, screws and connectors come from the construction schedule. Proprietary kits require the manufacturer template; edge banding is listed separately.'];
  const pages: Table[] = [];
  for (let k = 0; k < Math.max(1, body.length); k += ROWS_PER_SHEET) {
    pages.push({ columns: ['Item', 'Size', 'Qty', 'For'], rows: body.slice(k, k + ROWS_PER_SHEET), numeric: [2], notes: k + ROWS_PER_SHEET >= body.length ? notes : ['Continued on the next sheet.'] });
  }
  return pages;
}
