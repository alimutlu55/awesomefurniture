import { decorCode, getDecor, type BoardDecorSKU } from '../../domain/materials/decor-catalog';
import { accessoryDescription, hardwareDescription, resolveMaterials, type ConfiguredMaterialsState, type HandleFinish, type LegacyFinish } from '../../domain/materials/configured-materials';

const describe = (sku: BoardDecorSKU) => `${sku.aiPromptDescriptor} (${decorCode(sku)}, ${sku.thicknessMm}mm; `
  + `Grain: ${sku.grainDirection}; Edge: ${sku.edgeBandingSpec}).`;

export function serializeDecorPromptManifest(carcass: BoardDecorSKU, fronts: BoardDecorSKU, handleFinish: HandleFinish, moduleSummary: string): string {
  return [
    'TIER 1 — LOCKED CUSTOMER BOARD SKUS & HARDWARE (DO NOT SUBSTITUTE OR UPGRADE):',
    carcass.id === fronts.id
      ? `- Carcass & Exterior Fronts (Unified Decor): ${describe(carcass)}`
      : `- Cabinet Carcass, Open Shelves & Exposed Sides: ${describe(carcass)}\n- Closed Doors & Drawer Fronts (Contrasting Decor): ${describe(fronts)}`,
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
    + (design.doors === 'glass' ? '\n- Glazed outer doors: retain the configured glass. The front board SKU applies only to solid fronts, drawer panels and framing.' : '')
    + (materials.worktopDecorId ? `\n- Worktop: ${describe(getDecor(materials.worktopDecorId))}` : '');
}
