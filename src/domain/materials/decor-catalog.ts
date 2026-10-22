export type BoardManufacturer = 'Egger' | 'Kronospan' | 'Swiss Krono';
export type DecorCategory = 'woodgrain' | 'unicolor' | 'stone_textile';
export type TargetZone = 'carcass' | 'fronts' | 'worktop' | 'backing';

export interface BoardDecorSKU {
  readonly id: string;
  readonly manufacturer: BoardManufacturer;
  readonly code: string;
  readonly surfaceStructure: string;
  readonly name: string;
  readonly category: DecorCategory;
  readonly allowedZones: readonly TargetZone[];
  readonly thicknessMm: number;
  readonly edgeBandingSpec: string;
  readonly grainDirection: 'vertical' | 'horizontal' | 'none';
  /** Preview approximations, not manufacturer-measured optical values. Only verified swatches belong in textureUrl. */
  readonly pbr: { readonly baseHex: string; readonly roughness: number; readonly metalness: number; readonly textureUrl?: string };
  readonly aiPromptDescriptor: string;
  readonly sourceUrl: string;
}

const egger = 'https://www.egger.com/en/furniture-interior-design/decors/';
const board = (code: string, surfaceStructure: string, name: string, baseHex: string, roughness: number,
  category: DecorCategory, description: string): BoardDecorSKU => ({
  id: `egger-${code.toLowerCase()}-${surfaceStructure.toLowerCase()}`, manufacturer: 'Egger', code, surfaceStructure, name, category,
  allowedZones: ['carcass', 'fronts'], thicknessMm: 18,
  edgeBandingSpec: surfaceStructure === 'PM' ? '1mm matching ABS PerfectSense matte edging' : '1mm matching ABS edge-banding',
  grainDirection: category === 'woodgrain' ? 'vertical' : 'none',
  pbr: { baseHex, roughness, metalness: 0,
    ...(category === 'woodgrain' ? { textureUrl: `/textures/decors/egger-${code.toLowerCase()}-${surfaceStructure.toLowerCase()}.webp` } : {}) },
  aiPromptDescriptor: description,
  sourceUrl: `${egger}${code}_${surfaceStructure.replace('ST', '')}?country=GB`,
});

/** Exact decor/structure combinations; thickness and edging are this configurator's stock specification.
 * PM is a separate lacquered product, never an anti-fingerprint claim attached to an ST9 melamine board.
 * Sourcing and limitations: docs/decor-catalog.md. */
const boardDecors: readonly BoardDecorSKU[] = [
  board('H1318', 'ST10', 'Natural Wild Oak', '#b99a75', .68, 'woodgrain',
    'Egger H1318 ST10 Natural Wild Oak melamine board — warm medium-golden oak with authentic rustic knots, '
    + 'natural open-pore matte woodgrain texture (ST10 Deepskin Rough), vertical grain alignment, and crisp 1mm matching ABS edge-banding'),
  board('H3170', 'ST12', 'Natural Kendal Oak', '#ba9c76', .72, 'woodgrain',
    'Egger H3170 ST12 Natural Kendal Oak — calm linear European oak veneer look with subtle cathedrals, '
    + 'matte pore finish (ST12 Omnipore Matt), vertical grain on doors and upright panels'),
  board('H3734', 'ST9', 'Natural Dijon Walnut', '#79583f', .85, 'woodgrain',
    'Egger H3734 ST9 Natural Dijon Walnut — rich warm brown walnut woodgrain with lively dark grain streaks, '
    + 'smooth matte finish (ST9 Smoothtouch Matt), vertical grain alignment'),
  board('U702', 'ST9', 'Cashmere Grey', '#b5ada3', .85, 'unicolor',
    'Egger U702 ST9 Cashmere Grey — warm greige-taupe unicolor melamine with a smooth matte surface (ST9 Smoothtouch Matt), no woodgrain'),
  board('U702', 'PM', 'Cashmere Grey', '#b5ada3', .94, 'unicolor',
    'Egger U702 PM Cashmere Grey — warm greige-taupe unicolor with an ultra-matte anti-fingerprint velvet '
    + 'lacquered surface (PerfectSense Matt), subdued specular reflection, no woodgrain'),
  { id: 'kronospan-5981-bs', manufacturer: 'Kronospan', code: '5981', surfaceStructure: 'BS', name: 'Cashmere',
    category: 'unicolor', allowedZones: ['carcass', 'fronts'], thicknessMm: 18, edgeBandingSpec: '1mm matching ABS edge-banding', grainDirection: 'none',
    pbr: { baseHex: '#b7afa4', roughness: .8, metalness: 0 },
    aiPromptDescriptor: 'Kronospan 5981 BS Cashmere — soft warm beige-grey solid color board with fine Bureau Structure satin-matte texture, no woodgrain',
    sourceUrl: 'https://www.kronospan.com/en_US/decors/view/kronodesign/color/K5981/' },
  board('U708', 'ST9', 'Light Grey', '#c5c3bd', .85, 'unicolor',
    'Egger U708 ST9 Light Grey — architectural light dove grey unicolor with a smooth matte powdery surface (ST9 Smoothtouch Matt), no woodgrain'),
  board('W1100', 'ST9', 'Alpine White', '#eeeeea', .85, 'unicolor',
    'Egger W1100 ST9 Alpine White — crisp architectural white unicolor with a smooth matte finish (ST9 Smoothtouch Matt), no woodgrain'),
  { id: 'swiss-krono-d3025-ow', manufacturer: 'Swiss Krono', code: 'D3025', surfaceStructure: 'OW', name: 'Sonoma Oak',
    category: 'woodgrain', allowedZones: ['carcass', 'fronts'], thicknessMm: 18, edgeBandingSpec: '1mm matching grain ABS edge-banding', grainDirection: 'vertical',
    pbr: { baseHex: '#c7b38e', roughness: .78, metalness: 0 },
    aiPromptDescriptor: 'Swiss Krono D3025 OW Sonoma Oak — pale natural oak with fine linear grain, subtle cathedrals and matte ONE Wood surface, vertical grain on upright panels',
    sourceUrl: 'https://sklep.swisskrono.pl/produkt/d3025-ow-dab-sonoma-probka-plyty-laminowanej/' },
  board('U999', 'PM', 'Black', '#202123', .94, 'unicolor',
    'Egger U999 PM Black — deep carbon black unicolor with an ultra-matte anti-fingerprint lacquered PerfectSense Matt finish, no woodgrain'),
  board('U963', 'ST9', 'Diamond Grey', '#48494b', .85, 'unicolor',
    'Egger U963 ST9 Diamond Grey — deep anthracite grey unicolor with a smooth matte micro-textured surface (ST9 Smoothtouch Matt), no woodgrain'),
  board('U638', 'ST9', 'Sage Green', '#a3b09b', .85, 'unicolor',
    'Egger U638 ST9 Sage Green — soft muted grey-green unicolor with smooth matte Smoothtouch Matt finish, no woodgrain'),
];

export const decorCatalog: readonly BoardDecorSKU[] = [...boardDecors, {
  ...boardDecors[0]!, id: 'egger-h1318-st10-worktop-38', allowedZones: ['worktop'], thicknessMm: 38, grainDirection: 'horizontal',
  edgeBandingSpec: 'Postformed long edge; 1mm matching ABS on exposed cut ends',
  aiPromptDescriptor: 'Egger H1318 ST10 Natural Wild Oak laminate worktop — warm golden oak with rustic dark knots, '
    + 'matte Deepskin Rough pore texture, grain running along the worktop length',
}];

export function getDecor(id: string): BoardDecorSKU {
  const decor = decorCatalog.find(sku => sku.id === id);
  if (!decor) throw new Error(`Unknown board decor SKU: ${id}`);
  return decor;
}
export const decorBadge = (sku: BoardDecorSKU) => `${sku.manufacturer} · ${sku.code} ${sku.surfaceStructure} · ${sku.thicknessMm}mm`;
export const decorCode = (sku: BoardDecorSKU) => `${sku.manufacturer} ${sku.code} ${sku.surfaceStructure}`;
