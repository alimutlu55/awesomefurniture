import type { BoardDecorSKU, DecorCategory, BoardManufacturer, TargetZone } from './decor-types';
import { decorAssets } from './decor-assets';

const physics: Record<DecorCategory, BoardDecorSKU['pbr']> = {
  wood_melamine: { baseHex: '#b49a78', roughness: .68, metalness: 0, relief: 'pores' },
  natural_veneer: { baseHex: '#ac967b', roughness: .52, metalness: 0, relief: 'pores' },
  unicolor_matte: { baseHex: '#c9bfb5', roughness: .9, metalness: 0 },
  high_gloss: { baseHex: '#f4f5f0', roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .05 },
  textile_leather: { baseHex: '#c5bba8', roughness: .88, metalness: 0, relief: 'weave' },
  stone_mineral: { baseHex: '#c8c4ba', roughness: .55, metalness: 0 },
  metallic_brushed: { baseHex: '#a7a69f', roughness: .38, metalness: .75, relief: 'brushed' },
  glass_mirror: { baseHex: '#c8d2d4', roughness: .08, metalness: 0, transmission: .82, ior: 1.5, thickness: .6 },
};
export function materialSku(manufacturer: BoardManufacturer, code: string, surfaceStructure: string, name: string,
  category: DecorCategory, description: string, options: Partial<BoardDecorSKU> = {}): BoardDecorSKU {
  const id = `${manufacturer.toLowerCase().replaceAll(' ', '-')}-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${surfaceStructure.toLowerCase()}`;
  const asset = decorAssets[id], wood = category === 'wood_melamine' || category === 'natural_veneer';
  const zones: readonly TargetZone[] = category === 'glass_mirror' || category === 'high_gloss' || category === 'natural_veneer'
    ? ['fronts'] : ['carcass', 'fronts', 'drawers'];
  const pbr = { ...physics[category], ...(asset ? { baseHex: asset.hex,
    ...(category === 'unicolor_matte' || category === 'high_gloss' ? { swatchUrl: asset.url } : { textureUrl: asset.url }) } : {}),
    ...options.pbr, ...(asset ? { baseHex: asset.hex } : {}) };
  return { id, manufacturer, code, surfaceStructure, name, category, allowedZones: zones, thicknessMm: 18,
    grainDirection: wood ? 'vertical' : 'none', edgeBandingSpec: '1mm matching ABS edge-banding',
    construction: 'melamine', sourceUrl: asset?.source ?? '',
    aiPromptDescriptor: `${manufacturer} ${code} ${surfaceStructure} ${name} — ${description}`,
    ...options, pbr };
}
