import { decorCode, type BoardDecorSKU } from '../../domain/materials/decor-catalog';

/** Locked physical behavior is scoped to its configured zone, never inferred for other panels. */
export function materialSurfaceRule(sku: BoardDecorSKU, zone: string): string {
  const name = `${decorCode(sku)} ${sku.name}`;
  switch (sku.category) {
    case 'textile_leather': return `${zone} use ${name}: render tactile matte ${sku.pbr.relief === 'leather' ? 'pebbled leather grain' : 'woven linen cross-hatch fabric weave'}; never flat painted wood.`;
    case 'glass_mirror': return sku.construction === 'mirror'
      ? `${zone} are full-height architectural ${sku.glassStyle === 'bronze_mirror' ? 'bronze tinted' : 'silver'} mirrors, cleanly reflecting the opposite room wall and floor perspective.`
      : `${zone} use slim 20mm anodized aluminum frames with ${sku.glassStyle === 'fluted' ? 'vertical fluted reeded clear glass' : 'tinted smoked grey glass'}. `
        + 'Render realistic exterior glass specular reflections while softly revealing shelves and garments behind the glass; preserve vertical refraction on fluted glass.';
    case 'unicolor_matte': return sku.surfaceStructure === 'PM' || sku.surfaceStructure === 'NTM'
      ? `${zone} use ${name} ${sku.surfaceStructure === 'NTM' ? 'nanotech super-matte' : 'PerfectSense lacquered ultra-matte'} surface: `
        + 'ultra-flat velvet light absorption, zero plastic specular highlights and razor-sharp 2mm shadow gaps.' : '';
    case 'wood_melamine': return /ST28|ST32|ST36|ST37|ST40/.test(sku.surfaceStructure)
      ? `${zone} use ${name} synchronized-pore timber finish: deep tactile woodgrain relief where angled daylight catches natural pores and knots. Preserve ${sku.grainDirection} grain alignment.` : '';
    case 'natural_veneer': return `${zone} use real ${name} veneer with book-matched leaves, open pores and warm organic reflections. Do not substitute printed melamine.`;
    case 'high_gloss': return `${zone} use ${name} lacquered high-gloss panels with sharp mirror-like architectural highlights and a clear glossy coat; never matte.`;
    case 'metallic_brushed': return `${zone} use ${name} with linear brushed metallic sheen and directional architectural reflections; preserve the configured grain direction.`;
    case 'stone_mineral': return `${zone} use ${name}: preserve the exact mineral veining and honed/pitted surface in the descriptor; never apply woodgrain.`;
  }
}
