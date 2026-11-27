/**
 * Furnishings: the loose furniture a room already has, such as a bed, a bedside table or a rug. They are not designed
 * or built here (no boards, no price): they stand in the room so a wardrobe can be planned around them, and the
 * room looks lived in. THIS IS THE ONLY PLACE TO ADD ONE: append an entry to FURNISHINGS. The catalogue, the 3D model,
 * saving, sizes, placing and validation all follow from it. Plain data in scene centimetres.
 *
 * A furnishing stands anywhere on the floor at any angle, as a wardrobe does: `x`/`z` is its middle, and at angle 0
 * its back (a bed's headboard, a desk's back edge) is at -z and its front faces +z.
 */

export interface FurnishingSize { readonly width: number; readonly depth: number; readonly height: number }
type Range = readonly [number, number];

/** A kind's variant: its usual size and the sizes it can be set to. */
export interface FurnishingType {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly size: FurnishingSize;
  readonly limits: { readonly width: Range; readonly depth: Range; readonly height: Range };
}

export type FurnishingFinishGroup = 'fabric' | 'wood';
export interface FurnishingFinish { readonly id: string; readonly name: string; readonly color: string; readonly roughness: number }

export const FURNISHING_FINISHES: Readonly<Record<FurnishingFinishGroup, readonly FurnishingFinish[]>> = Object.freeze({
  fabric: [
    { id: 'linen', name: 'Linen', color: '#e9e4da', roughness: .95 },
    { id: 'oatmeal', name: 'Oatmeal', color: '#cbbba3', roughness: .95 },
    { id: 'sage', name: 'Sage', color: '#a3ad99', roughness: .95 },
    { id: 'charcoal', name: 'Charcoal', color: '#55585a', roughness: .95 },
  ],
  wood: [
    { id: 'oak', name: 'Oak', color: '#c9a273', roughness: .6 },
    { id: 'walnut', name: 'Walnut', color: '#6e4c35', roughness: .55 },
    { id: 'white', name: 'White', color: '#efede8', roughness: .5 },
    { id: 'black', name: 'Black', color: '#2d2c2b', roughness: .5 },
  ],
});
export const FURNISHING_FINISH_NAMES: Readonly<Record<FurnishingFinishGroup, string>> = Object.freeze({ fabric: 'Fabric', wood: 'Wood' });

/** Where a new one goes: its back against a wall (`wall`), beside a bed on the same wall (`bedside`), or in the
 * middle of the floor (`floor`). */
export type FurnishingPlacing = 'wall' | 'bedside' | 'floor';

export interface FurnishingKind {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** Catalogue and menu icon: an SVG path on a 24 × 24 grid. */
  readonly icon: string;
  readonly types: readonly FurnishingType[];
  /** The type a new one starts with (else its first). */
  readonly start?: string;
  /** What its size fields are called: across its front, from back to front, and its height. */
  readonly labels: { readonly width: string; readonly depth: string; readonly height: string };
  /** Free floor a person needs to use it, in front and at its sides (a bed is got into from its sides): advice shown
   * amber, never enforced. Centimetres. */
  readonly use: { readonly front: number; readonly sides: number };
  readonly finishes: readonly FurnishingFinishGroup[];
  readonly placing: FurnishingPlacing;
  /** Lies flat on the floor (a rug): furniture stands on it, so it is never in anything's way. */
  readonly flat?: boolean;
}

const bed = (id: string, name: string, mattress: number): FurnishingType => ({
  id, name, note: `${mattress} × 200 mattress`, size: { width: mattress + 8, depth: 212, height: 100 },
  limits: { width: [80, 240], depth: [190, 240], height: [60, 140] },
});

export const FURNISHINGS = [
  {
    key: 'bed', name: 'Bed', description: 'A bed with its headboard against a wall: single, double, king or super king',
    icon: 'M3 18V7M3 13h18v5M21 18v-5M6 13v-3h5v3M13 13v-3h5v3',
    types: [bed('single', 'Single', 90), bed('double', 'Double', 140), bed('king', 'King', 160), bed('super-king', 'Super king', 180)],
    start: 'king',
    labels: { width: 'Width', depth: 'Length', height: 'Headboard height' },
    use: { front: 60, sides: 60 }, finishes: ['fabric', 'wood'], placing: 'wall',
  },
  {
    key: 'bedside', name: 'Bedside table', description: 'A small table with a drawer beside a bed',
    icon: 'M5 7h14v12H5zM5 12h14M11 9.5h2',
    types: [{ id: 'bedside', name: 'Bedside table', note: 'With a drawer', size: { width: 45, depth: 40, height: 52 },
      limits: { width: [30, 80], depth: [25, 60], height: [35, 80] } }],
    labels: { width: 'Width', depth: 'Depth', height: 'Height' },
    use: { front: 0, sides: 0 }, finishes: ['wood'], placing: 'bedside',
  },
  {
    key: 'desk', name: 'Desk and chair', description: 'A desk against a wall with its chair tucked under it',
    icon: 'M3 8h18M5 8v11M19 8v11M10 13h4v3h-4zM12 16v3',
    types: [{ id: 'desk', name: 'Desk', note: 'With a chair', size: { width: 120, depth: 60, height: 75 },
      limits: { width: [70, 200], depth: [45, 90], height: [65, 90] } }],
    labels: { width: 'Width', depth: 'Depth', height: 'Height' },
    use: { front: 80, sides: 0 }, finishes: ['wood', 'fabric'], placing: 'wall',
  },
  {
    key: 'armchair', name: 'Armchair', description: 'An upholstered armchair',
    icon: 'M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M4 11h3v4h10v-4h3v7H4zM6 18v2M18 18v2',
    types: [{ id: 'armchair', name: 'Armchair', note: 'Upholstered', size: { width: 80, depth: 85, height: 85 },
      limits: { width: [60, 120], depth: [60, 110], height: [65, 110] } }],
    labels: { width: 'Width', depth: 'Depth', height: 'Height' },
    use: { front: 50, sides: 0 }, finishes: ['fabric', 'wood'], placing: 'wall',
  },
  {
    key: 'rug', name: 'Rug', description: 'A rug on the floor: furniture stands on it',
    icon: 'M4 6h16v12H4zM7 9h10v6H7z',
    types: [
      { id: 'small', name: 'Small', note: '120 × 170', size: { width: 120, depth: 170, height: 1 }, limits: { width: [60, 400], depth: [60, 500], height: [.5, 4] } },
      { id: 'medium', name: 'Medium', note: '160 × 230', size: { width: 160, depth: 230, height: 1 }, limits: { width: [60, 400], depth: [60, 500], height: [.5, 4] } },
      { id: 'large', name: 'Large', note: '200 × 300', size: { width: 200, depth: 300, height: 1 }, limits: { width: [60, 400], depth: [60, 500], height: [.5, 4] } },
    ],
    start: 'medium',
    labels: { width: 'Width', depth: 'Length', height: 'Thickness' },
    use: { front: 0, sides: 0 }, finishes: ['fabric'], placing: 'floor', flat: true,
  },
] as const satisfies readonly FurnishingKind[];

export type FurnishingKey = typeof FURNISHINGS[number]['key'];
export const FURNISHING_KEYS = FURNISHINGS.map(k => k.key) as readonly FurnishingKey[];

const BY_KEY = new Map<string, FurnishingKind>(FURNISHINGS.map(k => [k.key, k]));
export const furnishingKind = (key: string): FurnishingKind | undefined => BY_KEY.get(key);
export const furnishingType = (key: string, type: string): FurnishingType | undefined => BY_KEY.get(key)?.types.find(t => t.id === type);
/** The type a kind starts with. */
export const startFurnishingType = (key: string): FurnishingType | undefined => {
  const k = BY_KEY.get(key);
  return k && (k.types.find(t => t.id === k.start) ?? k.types[0]);
};
export const furnishingFinish = (group: FurnishingFinishGroup, id: string | undefined): FurnishingFinish =>
  FURNISHING_FINISHES[group].find(f => f.id === id) ?? FURNISHING_FINISHES[group][0]!;
