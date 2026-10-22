import { decorCode, getDecor, type BoardDecorSKU } from '../../domain/materials/decor-catalog';
import { accessoryDescription, hardwareDescription, resolveMaterials, type ConfiguredMaterialsState, type HandleFinish, type LegacyFinish } from '../../domain/materials/configured-materials';
import { materialSurfaceRule } from './material-surface-rules';

const describe = (sku: BoardDecorSKU) => `${sku.aiPromptDescriptor} (${decorCode(sku)}, ${sku.thicknessMm}mm; `
  + `Grain: ${sku.grainDirection}; Edge: ${sku.edgeBandingSpec}).`;

export function serializeDecorPromptManifest(carcass: BoardDecorSKU, fronts: BoardDecorSKU, handleFinish: HandleFinish, moduleSummary: string): string {
  return [
    'TIER 1 — LOCKED CUSTOMER BOARD SKUS & HARDWARE (DO NOT SUBSTITUTE OR UPGRADE):',
    carcass.id === fronts.id
      ? `- Carcass & Exterior Fronts (Unified Decor): ${describe(carcass)}`
      : `- Cabinet Carcass, Open Shelves & Exposed Sides: ${describe(carcass)}\n- ${fronts.category === 'glass_mirror' ? 'Glazed outer door panels' : 'Closed Doors & Drawer Fronts (Contrasting Decor)'}: ${describe(fronts)}`,
    ...[[carcass, 'Carcass and open shelves'], [fronts, 'Exterior door panels']] .map(([sku, zone]) =>
      materialSurfaceRule(sku as BoardDecorSKU, zone as string)).filter(Boolean),
    ...(fronts.category === 'glass_mirror' ? [`- Solid drawer fronts retain the carcass finish ${decorCode(carcass)}; never substitute glass drawer boxes.`] : []),
    `- Hardware / Pulls: ${hardwareDescription(handleFinish)}.`,
    `- Configured Module Layout: ${moduleSummary}`,
  ].join('\n');
}

/** One block per cabinet prevents a finish on one wing leaking into the next. */
export function serializeConfiguredDecorManifest(design: {
  materials?: ConfiguredMaterialsState | undefined;
  finish: LegacyFinish;
  doors?: 'none' | 'solid' | 'glass';
}, moduleSummary: string): string {
  const materials = resolveMaterials(design);
  return serializeDecorPromptManifest(getDecor(materials.carcassDecorId), getDecor(materials.frontDecorId), materials.handleFinish, moduleSummary)
    + `\n- Internal accessory finish: ${accessoryDescription(materials.internalAccessoryFinish)}.`
    + (design.doors === 'glass' && getDecor(materials.frontDecorId).category !== 'glass_mirror'
      ? '\n- Glazed outer doors: retain the configured glass. The front board SKU applies only to solid fronts, drawer panels and framing.' : '')
    + ([['Drawer interiors and drawer boxes', materials.drawerDecorId], ['Back panels', materials.backingDecorId],
      ['Worktop', materials.worktopDecorId], ['Backsplash', materials.backsplashDecorId]] as const).filter(([, id]) => id)
      .map(([zone, id]) => { const sku = getDecor(id!); return `\n- ${zone}: ${describe(sku)} ${materialSurfaceRule(sku, zone)}`; }).join('')
    + (materials.frontProfile === 'micro_shaker' ? '\n- Door profile: shallow Micro-Shaker perimeter framing with recessed center panels; preserve the configured panel outlines.' : '')
    + (materials.integratedLed ? '\n- Integrated lighting: concealed warm 2700K LED strips above hanging rails and inside open compartments, as configured.' : '');
}
