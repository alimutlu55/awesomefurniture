import type { DecorSwatchReference } from '../../application/projects/design-image';
import type { ConfigurationForImage } from '../../application/projects/configuration-summary';
import { selectedDecors } from '../../application/projects/selected-decors';
import { decorCode } from '../../domain/materials/decor-catalog';

/** Geometry images always come first; swatches supply material appearance and never a camera or layout. */
export function decorSwatchInputs(specification: ConfigurationForImage, swatches: readonly DecorSwatchReference[] = []) {
  const selected = selectedDecors(specification);
  return swatches.flatMap((swatch, i) => {
    const entry = selected.find(({ sku }) => sku.id === swatch.decorId);
    if (!entry?.sku.pbr.textureUrl) return [];
    const { sku, zones } = entry;
    return [
      { type: 'text', text: `Image ${i + 4} is the exact 2D manufacturer board swatch for ${decorCode(sku)} ${sku.name}. `
        + `Apply this color, grain pattern and ${sku.surfaceStructure} surface only to ${zones.join('; ')} in Image 1. `
        + `Respect Grain: ${sku.grainDirection}; rotate the swatch grain to follow that direction. `
        + 'This is a material reference only; preserve the Image 1 camera and geometry.' },
      { type: 'image', mime_type: swatch.mimeType, data: swatch.data },
    ];
  });
}
