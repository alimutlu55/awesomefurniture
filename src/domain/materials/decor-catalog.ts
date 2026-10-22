import { baseDecors } from './decor-base';
import { libraryDecors, glassDecors } from './decor-library';
import type { BoardDecorSKU } from './decor-types';
export * from './decor-types';

// Decor identity and stock assembly are separate: the same facing can cover 18mm
// furniture boards, a 6mm backing or a 38mm laminate worktop.
const panels = [...baseDecors.filter(s => !s.allowedZones.includes('worktop')), ...libraryDecors, ...glassDecors]
  .map(s => ({ ...s, allowedZones: s.allowedZones.includes('carcass') ? [...s.allowedZones, 'drawers'] as const : s.allowedZones }));
export const decorCatalog: readonly BoardDecorSKU[] = [
  ...panels,
  ...baseDecors.filter(s => s.allowedZones.includes('worktop')),
  ...panels.filter(s => s.category === 'stone_mineral').map(s => ({ ...s, id: `${s.id}-worktop-38`,
    allowedZones: ['worktop'] as const, thicknessMm: 38, grainDirection: 'horizontal' as const,
    edgeBandingSpec: 'Matching laminate on 38mm worktop substrate; sealed exposed cut ends' })),
  ...panels.filter(s => s.category === 'textile_leather' || s.allowedZones.includes('carcass')).map(s => ({ ...s,
    id: `${s.id}-backing-6`, allowedZones: ['backing'] as const, thicknessMm: 6,
    edgeBandingSpec: 'Matching facing on 6mm backing; concealed cut edges' })),
  ...panels.filter(s => s.category === 'stone_mineral').map(s => ({ ...s, id: `${s.id}-backsplash-12`,
    allowedZones: ['backsplash'] as const, thicknessMm: 12, edgeBandingSpec: 'Matching laminate on 12mm panel; sealed exposed edges' })),
  ...panels.filter(s => s.manufacturer === 'Fenix').map(s => ({ ...s, id: `${s.id}-compact-12`, allowedZones: ['worktop'] as const,
    thicknessMm: 12, construction: 'compact_hpl' as const, edgeBandingSpec: 'Exposed black compact HPL core; eased and polished edges' })),
];

export function getDecor(id: string): BoardDecorSKU {
  const decor = decorCatalog.find(sku => sku.id === id);
  if (!decor) throw new Error(`Unknown board decor SKU: ${id}`);
  return decor;
}
export const decorBadge = (sku: BoardDecorSKU) => `${sku.manufacturer} · ${sku.code} ${sku.surfaceStructure} · ${sku.thicknessMm}mm`;
export const decorCode = (sku: BoardDecorSKU) => `${sku.manufacturer} ${sku.code} ${sku.surfaceStructure}`;
