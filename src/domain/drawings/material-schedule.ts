import { doorThickness } from '../wardrobe/door-layout';
import { decorCode, getDecor } from '../materials/decor-catalog';
import { accessoryDescription, hardwareDescription, resolveMaterials } from '../materials/configured-materials';
import type { PlacedPiece } from './room-pieces';
import { ROWS_PER_SHEET, type Table } from './drawing';

/** Shared table model is drawn by both the technical viewer and PDF writer. */
export function materialSchedule(pieces: readonly PlacedPiece[]): Table[] {
  const rows: string[][] = [];
  for (const piece of pieces.filter(p => !p.fixture || p.fixture === 'shelf')) {
    const materials = resolveMaterials(piece.design);
    for (const [zone, id] of [['Carcass Board', materials.carcassDecorId], ['Fronts Board', materials.frontDecorId], ['Worktop', materials.worktopDecorId]] as const) {
      if (!id || (piece.fixture === 'shelf' && zone !== 'Carcass Board')) continue;
      const sku = getDecor(id);
      const thickness = zone === 'Fronts Board' && !piece.design.product && piece.design.doors === 'hinged' ? doorThickness(piece.design) * 10 : sku.thicknessMm;
      rows.push([piece.mark, zone, `${decorCode(sku)} (${sku.name})`, `${thickness}mm`, `Grain: ${sku.grainDirection}; Edge: ${sku.edgeBandingSpec}`]);
    }
    if (piece.fixture) continue;
    if (piece.design.doors === 'glass') rows.push([piece.mark, 'Glazed outer doors', 'Glass as configured', `${doorThickness(piece.design) * 10}mm`,
      'Front board SKU applies to solid fronts and drawer panels; retain glazed outer doors.']);
    rows.push([piece.mark, 'Hardware Spec', hardwareDescription(materials.handleFinish), '—',
      'Concealed 110° hinges, 35mm cup; full-extension drawer runners where configured. '
      + (materials.handleFinish === 'handleless_tip_on' ? 'Use push-to-open compatible hinges and runners; confirm load rating and drilling with supplier.' : 'Confirm hinge/runner load rating and drilling with supplier.')]);
    rows.push([piece.mark, 'Internal accessories', accessoryDescription(materials.internalAccessoryFinish), '—', 'Rails and internal metal fittings.']);
  }
  const pages: Table[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_SHEET) pages.push({
    columns: ['Mark', 'Zone / component', 'Manufacturer board / hardware', 'Thickness', 'Grain / edging / fitting notes'],
    rows: rows.slice(i, i + ROWS_PER_SHEET), numeric: [],
    notes: ['Board thickness and edge banding are the configured stock specification. Back panels remain the separately dimensioned backing in the cutting list. '
      + 'Verify physical manufacturer samples and local stock availability before ordering.'],
  });
  return pages;
}
