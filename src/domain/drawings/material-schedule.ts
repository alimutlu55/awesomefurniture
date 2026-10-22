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
    for (const [zone, id] of [['Carcass Board', materials.carcassDecorId], ['Fronts Board', materials.frontDecorId],
      ['Drawer interiors', materials.drawerDecorId], ['Backing', materials.backingDecorId],
      ['Worktop', materials.worktopDecorId], ['Backsplash', materials.backsplashDecorId]] as const) {
      if (!id || (piece.fixture === 'shelf' && zone !== 'Carcass Board')) continue;
      const sku = getDecor(id);
      const thickness = zone === 'Fronts Board' && !piece.design.product && piece.design.doors === 'hinged' ? doorThickness(piece.design) * 10 : sku.thicknessMm;
      rows.push([piece.mark, zone, `${decorCode(sku)} (${sku.name})`, `${thickness}mm`, `Grain: ${sku.grainDirection}; Edge: ${sku.edgeBandingSpec}`
        + (sku.construction ? `; ${sku.construction.replaceAll('_', ' ')}` : '')]);
    }
    if (piece.fixture) continue;
    const glazed = getDecor(materials.frontDecorId).category === 'glass_mirror';
    if (piece.design.doors === 'glass' && !glazed) rows.push([piece.mark, 'Glazed outer doors', 'Glass as configured', `${doorThickness(piece.design) * 10}mm`,
      'Front board SKU applies to solid fronts and drawer panels; retain glazed outer doors.']);
    rows.push([piece.mark, 'Hardware Spec', hardwareDescription(materials.handleFinish), '—',
      (glazed ? 'Frame/carrier-compatible glass or mirror door hinges; glazing rebates and safety backing confirmed by fabricator. '
        : 'Concealed 110° hinges, 35mm cup; ') + 'Full-extension drawer runners where configured. '
      + (materials.handleFinish === 'handleless_tip_on' ? 'Use push-to-open compatible hinges and runners; confirm load rating and drilling with supplier.' : 'Confirm hinge/runner load rating and drilling with supplier.')]);
    rows.push([piece.mark, 'Internal accessories', accessoryDescription(materials.internalAccessoryFinish), '—', 'Rails and internal metal fittings.']);
    if (materials.frontProfile === 'micro_shaker') rows.push([piece.mark, 'Front profile', 'Micro-Shaker', '—', 'Shallow matching perimeter rails; preserve the configured door outlines.']);
    if (materials.integratedLed) rows.push([piece.mark, 'Lighting', 'Concealed warm LED, 2700K', '—', 'Under upper panels and above rails; driver and wiring by supplier.']);
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
