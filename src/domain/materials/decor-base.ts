// Existing IDs remain stable for saved designs.
import type { BoardDecorSKU, DecorCategory } from './decor-types';

const egger = 'https://www.egger.com/en/furniture-interior-design/decors/';
const board = (code: string, surfaceStructure: string, name: string, baseHex: string, roughness: number,
  category: DecorCategory, description: string): BoardDecorSKU => ({
  id: `egger-${code.toLowerCase()}-${surfaceStructure.toLowerCase()}`, manufacturer: 'Egger', code, surfaceStructure, name, category,
  allowedZones: ['carcass', 'fronts'], thicknessMm: 18,
  edgeBandingSpec: surfaceStructure === 'PM' ? '1mm matching ABS PerfectSense matte edging' : '1mm matching ABS edge-banding',
  grainDirection: category === 'wood_melamine' ? 'vertical' : 'none',
  pbr: { baseHex, roughness, metalness: 0,
    ...(category === 'wood_melamine' ? { textureUrl: `/textures/decors/egger-${code.toLowerCase()}-${surfaceStructure.toLowerCase()}.webp` }
      : { swatchUrl: `/textures/decors/egger-${code.toLowerCase()}-${surfaceStructure.toLowerCase()}.webp` }) },
  aiPromptDescriptor: description,
  sourceUrl: `${egger}${code}_${surfaceStructure.replace('ST', '')}?country=GB`,
});

/** Exact decor/structure combinations; thickness and edging are this configurator's stock specification.
 * PM is a separate lacquered product, never an anti-fingerprint claim attached to an ST9 melamine board.
 * Sourcing and limitations: docs/decor-catalog.md. */
const boardDecors: readonly BoardDecorSKU[] = [
  board('H1318', 'ST10', 'Natural Wild Oak', '#bf986b', .68, 'wood_melamine',
    'Egger H1318 ST10 Natural Wild Oak melamine board — warm medium-golden oak with authentic rustic knots, '
    + 'natural open-pore matte woodgrain texture (ST10 Deepskin Rough), vertical grain alignment, and crisp 1mm matching ABS edge-banding'),
  board('H3170', 'ST12', 'Natural Kendal Oak', '#bca080', .72, 'wood_melamine',
    'Egger H3170 ST12 Natural Kendal Oak — calm linear European oak veneer look with subtle cathedrals, '
    + 'matte pore finish (ST12 Omnipore Matt), vertical grain on doors and upright panels'),
  board('H3734', 'ST9', 'Natural Dijon Walnut', '#8c6039', .85, 'wood_melamine',
    'Egger H3734 ST9 Natural Dijon Walnut — rich warm brown walnut woodgrain with lively dark grain streaks, '
    + 'smooth matte finish (ST9 Smoothtouch Matt), vertical grain alignment'),
  board('U702', 'ST9', 'Cashmere Grey', '#d8cabd', .85, 'unicolor_matte',
    'Egger U702 ST9 Cashmere Grey — warm greige-taupe unicolor melamine with a smooth matte surface (ST9 Smoothtouch Matt), no woodgrain'),
  board('U702', 'PM', 'Cashmere Grey', '#d8cabd', .94, 'unicolor_matte',
    'Egger U702 PM Cashmere Grey — warm greige-taupe unicolor with an ultra-matte anti-fingerprint velvet '
    + 'lacquered surface (PerfectSense Matt), subdued specular reflection, no woodgrain'),
  { id: 'kronospan-5981-bs', manufacturer: 'Kronospan', code: '5981', surfaceStructure: 'BS', name: 'Cashmere',
    category: 'unicolor_matte', allowedZones: ['carcass', 'fronts'], thicknessMm: 18, edgeBandingSpec: '1mm matching ABS edge-banding', grainDirection: 'none',
    pbr: { baseHex: '#cbc4ba', roughness: .8, metalness: 0, swatchUrl: '/textures/decors/kronospan-5981-bs.jpg' },
    aiPromptDescriptor: 'Kronospan 5981 BS Cashmere — soft warm beige-grey solid color board with fine Bureau Structure satin-matte texture, no woodgrain',
    sourceUrl: 'https://www.kronospan.com/en_US/decors/view/kronodesign/color/K5981/' },
  board('U708', 'ST9', 'Light Grey', '#d4cec9', .85, 'unicolor_matte',
    'Egger U708 ST9 Light Grey — architectural light dove grey unicolor with a smooth matte powdery surface (ST9 Smoothtouch Matt), no woodgrain'),
  board('W1100', 'ST9', 'Alpine White', '#fefffa', .85, 'unicolor_matte',
    'Egger W1100 ST9 Alpine White — crisp architectural white unicolor with a smooth matte finish (ST9 Smoothtouch Matt), no woodgrain'),
  { id: 'swiss-krono-d3025-ow', manufacturer: 'Swiss Krono', code: 'D3025', surfaceStructure: 'OW', name: 'Sonoma Oak',
    category: 'wood_melamine', allowedZones: ['carcass', 'fronts'], thicknessMm: 18, edgeBandingSpec: '1mm matching grain ABS edge-banding', grainDirection: 'vertical',
    pbr: { baseHex: '#ccb79d', roughness: .78, metalness: 0, textureUrl: '/textures/decors/swiss-krono-d3025-ow.jpg',
      textureGrainAxis: 'v', textureSizeCm: [60, 32.74] },
    aiPromptDescriptor: 'Swiss Krono D3025 OW Sonoma Oak — pale natural oak with fine linear grain, subtle cathedrals and matte ONE Wood surface, vertical grain on upright panels',
    sourceUrl: 'https://sklep.swisskrono.pl/produkt/d3025-ow-dab-sonoma-probka-plyty-laminowanej/' },
  board('U999', 'PM', 'Black', '#050407', .94, 'unicolor_matte',
    'Egger U999 PM Black — deep carbon black unicolor with an ultra-matte anti-fingerprint lacquered PerfectSense Matt finish, no woodgrain'),
  board('U963', 'ST9', 'Diamond Grey', '#4b4b4b', .85, 'unicolor_matte',
    'Egger U963 ST9 Diamond Grey — deep anthracite grey unicolor with a smooth matte micro-textured surface (ST9 Smoothtouch Matt), no woodgrain'),
  board('U638', 'ST9', 'Sage Green', '#c1bba4', .85, 'unicolor_matte',
    'Egger U638 ST9 Sage Green — soft muted grey-green unicolor with smooth matte Smoothtouch Matt finish, no woodgrain'),
];

export const baseDecors: readonly BoardDecorSKU[] = [...boardDecors, {
  ...boardDecors[0]!, id: 'egger-h1318-st10-worktop-38', allowedZones: ['worktop'], thicknessMm: 38, grainDirection: 'horizontal',
  edgeBandingSpec: 'Postformed long edge; 1mm matching ABS on exposed cut ends',
  aiPromptDescriptor: 'Egger H1318 ST10 Natural Wild Oak laminate worktop — warm golden oak with rustic dark knots, '
    + 'matte Deepskin Rough pore texture, grain running along the worktop length',
}];

