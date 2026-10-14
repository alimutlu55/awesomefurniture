import * as THREE from 'three';

/** Recommended defaults from the Wardrobe Drape Lab (Realistic preset, Shirts mix). */
export const DRAPE = {
  /** Real cuts; off gives flat slabs. */
  shape: true,
  /** Cloth ridges, sleeve creases and an uneven hem, scaled by `foldDepth`. Recommended: 0%. */
  folds: true,
  foldDepth: 0,
  /** Size, colour, turn, tilt and spacing differ per garment, scaled by `variation`. Recommended: 0%. */
  variation: 0,
  /** Woven fabric: weave pitch in millimetres. Recommended: 2.0 mm. */
  fabric: true,
  pitch: 2.0,
  /** Baked occlusion: darker folds and armpits, darker under the shelf and toward the floor. */
  shadows: true,
  /** Hanger, hook and garment details. */
  hardware: true,
  /** Idle pendulum sway. Recommended: 100%. */
  sway: true,
  swayStrength: 1.0,
  /** Which garments hang on the rails: 'shirt' by default. */
  mix: 'shirt' as GarmentKey | 'mixed',
  /** Hanger turn on a side rail, degrees: 81° turns the fronts slightly toward the viewer. */
  turn: 81,
  /** Exposure the clothes are seen at. */
  exposure: 1.20,
} as const;

export const TAU = Math.PI * 2;
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Seeded random numbers, reproducible sequence for a given seed. */
export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FabricKey = 'jersey' | 'poplin' | 'wool' | 'knit';
export const FABRICS: Record<FabricKey, { us: number; ns: number; rough: number; sheen: number; knit?: true }> = {
  jersey: { us: 1.6, ns: 0.5, rough: 0.9, sheen: 0.4 },
  poplin: { us: 2.2, ns: 0.35, rough: 0.78, sheen: 0.7 },
  wool: { us: 0.9, ns: 0.9, rough: 0.96, sheen: 0.3 },
  knit: { us: 1.0, ns: 1.1, rough: 1.0, sheen: 1.0, knit: true },
};

export interface GarmentType {
  len: number; sh: number; chest: number; drop: number; neck: number; neckF: number; neckB: number; armH: number; hemDrop: number;
  /** Dimensionless taper and flare ratios; these are not centimetres. */
  waist: number; flare: number; sleeve: number; sr0: number; sr1: number; dChest: number; dHem: number; stiff: number; fab: FabricKey;
  collar: 'rib' | 'shirt' | 'lapel'; cuff: 'seam' | 'band' | 'rib'; placket?: true; hemBand?: true;
  buttons?: { n: number; t0: number; dt: number; r: number }; cuffButtons?: number; pocket?: 'chest' | 'flap'; pocketT?: [number, number];
  palette: readonly string[];
}

/** Pattern dimensions in CENTIMETRES. */
export const GARMENT_TYPES = {
  tee: {
    len: 68, sh: 20.0, chest: 18.2, drop: 5.0, neck: 8.0, neckF: 7.0, neckB: 1.8, armH: 16, hemDrop: 0, waist: 0, flare: 0,
    sleeve: 19, sr0: 7.4, sr1: 6.8, dChest: 3.0, dHem: 1.4, stiff: 0.9, fab: 'jersey', collar: 'rib', cuff: 'seam',
    palette: ['#eeeeec', '#d3d1cb', '#3a3a37', '#6e7a52', '#4c5872', '#d8cfb9'],
  },
  shirt: {
    len: 78, sh: 21.5, chest: 19.0, drop: 5.5, neck: 8.0, neckF: 4.0, neckB: 1.5, armH: 17, hemDrop: 3.0, waist: 0.02, flare: 0,
    sleeve: 58, sr0: 6.0, sr1: 4.0, dChest: 4.4, dHem: 1.8, stiff: 0.8, fab: 'poplin', collar: 'shirt', cuff: 'band', placket: true,
    buttons: { n: 7, t0: 0.11, dt: 0.115, r: 0.65 }, cuffButtons: 1, pocket: 'chest',
    palette: ['#f1f0ec', '#c9d3e0', '#e3ded4', '#9fb2cc', '#d9d3c4', '#4c5872'],
  },
  jacket: {
    len: 76, sh: 22.5, chest: 20.5, drop: 6.0, neck: 9.0, neckF: 7.0, neckB: 2.0, armH: 18, hemDrop: 0, waist: 0.05, flare: 0.03,
    sleeve: 60, sr0: 7.0, sr1: 5.2, dChest: 7.5, dHem: 5.0, stiff: 0.35, fab: 'wool', collar: 'lapel', cuff: 'seam',
    buttons: { n: 2, t0: 0.36, dt: 0.16, r: 0.95 }, cuffButtons: 2, pocket: 'flap', pocketT: [0.58, 0.66],
    palette: ['#3a3a37', '#2f3a52', '#6e7a52', '#b4afa2', '#4c5872', '#5a4b3c'],
  },
  sweater: {
    len: 66, sh: 21.5, chest: 20.0, drop: 5.0, neck: 8.5, neckF: 6.0, neckB: 1.8, armH: 17, hemDrop: 0, waist: 0, flare: 0,
    sleeve: 58, sr0: 7.5, sr1: 5.2, dChest: 5.0, dHem: 3.6, stiff: 0.7, fab: 'knit', collar: 'rib', cuff: 'rib', hemBand: true,
    palette: ['#d8cfb9', '#8f8c86', '#4c5872', '#6e7a52', '#e3ded4', '#3a3a37'],
  },
  coat: {
    len: 140, sh: 23.2, chest: 21.2, drop: 6.2, neck: 9.5, neckF: 6.0, neckB: 2.0, armH: 19, hemDrop: 0, waist: 0.03, flare: 0.06,
    sleeve: 62, sr0: 7.8, sr1: 6.0, dChest: 8.5, dHem: 7.0, stiff: 0.3, fab: 'wool', collar: 'lapel', cuff: 'seam',
    // Keep closures and pockets near the hands while the longer body extends below them.
    buttons: { n: 3, t0: 0.24, dt: 0.11, r: 1.25 }, cuffButtons: 2, pocket: 'flap', pocketT: [0.44, 0.50],
    palette: ['#3a3a37', '#b4a58a', '#2f3a52', '#6e7a52', '#8a8a86'],
  },
} satisfies Record<string, GarmentType>;

export type GarmentKey = keyof typeof GARMENT_TYPES;

/** Distance from the rail center down to the neckline top in centimetres. */
export const HOOK_CM = DRAPE.hardware ? 7.5 : 3.0;

export interface GarmentSpec {
  key: GarmentKey; ty: GarmentType; sh: number; chest: number; neck: number; neckF: number; neckB: number; drop: number; len: number;
  sleeve: number; sr0: number; sr1: number; rotY: number; tiltZ: number; color: THREE.Color; ph: number[]; foldAmt: number;
  hemAmp: number; hp: number; omega: number; ph1: number; ph2: number;
}
