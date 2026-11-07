import { getDecor } from '../../materials/decor-catalog';
import type { BoardDecorSKU } from '../../materials/decor-types';

/**
 * What a board is made of underneath its decor, as the engine's physics and prices read it: how heavy it is and how
 * stiff. A decor names its construction (melamine on chipboard, lacquered MDF, glass...); the substrate follows from it.
 *
 * Values are typical published figures for the board types, used as design values:
 * - chipboard (EN 312 P2, melamine faced): about 650 kg/m³, bending modulus about 2,500 MPa;
 * - MDF (EN 622-5): about 750 kg/m³, about 3,000 MPa; HDF backs: about 850 kg/m³, about 4,000 MPa;
 * - compact laminate: about 1,400 kg/m³, about 9,000 MPa; float glass and mirror: 2,500 kg/m³, 70,000 MPa.
 * `creep` multiplies a deflection under a load that stays for years (wood-based boards keep bending slowly; glass does not).
 */
export interface Substrate {
  readonly key: SubstrateKey;
  readonly label: string;
  readonly densityKgM3: number;
  readonly bendingModulusMpa: number;
  readonly creep: number;
}

export const SUBSTRATES = {
  chipboard: { key: 'chipboard', label: 'Melamine-faced chipboard', densityKgM3: 650, bendingModulusMpa: 2500, creep: 1.5 },
  mdf: { key: 'mdf', label: 'MDF', densityKgM3: 750, bendingModulusMpa: 3000, creep: 1.5 },
  hdf: { key: 'hdf', label: 'HDF', densityKgM3: 850, bendingModulusMpa: 4000, creep: 1.5 },
  compact: { key: 'compact', label: 'Compact laminate', densityKgM3: 1400, bendingModulusMpa: 9000, creep: 1.2 },
  glass: { key: 'glass', label: 'Glass', densityKgM3: 2500, bendingModulusMpa: 70000, creep: 1 },
} as const satisfies Record<string, { key: string } & Omit<Substrate, 'key'>>;
export type SubstrateKey = keyof typeof SUBSTRATES;

/** The substrate a decor's construction is made on. A thin board (a back, a drawer bottom) of a wood decor is HDF. */
const BY_CONSTRUCTION: Readonly<Record<NonNullable<BoardDecorSKU['construction']>, SubstrateKey>> = {
  melamine: 'chipboard', lacquered_mdf: 'mdf', laminate_on_mdf: 'mdf', veneered_mdf: 'mdf', compact_hpl: 'compact', glass: 'glass', mirror: 'glass',
};

/** Thinner than this (centimetres), a wood-based board is HDF whatever its decor. */
const THIN = 1;

/** The substrate of a board of `decorId`, `thicknessCm` thick. An unknown decor is taken as melamine-faced chipboard. */
export function substrateOf(decorId: string, thicknessCm: number): Substrate {
  let key: SubstrateKey = 'chipboard';
  try { key = BY_CONSTRUCTION[getDecor(decorId).construction ?? 'melamine']; } catch { /* unknown decor: chipboard */ }
  if (key !== 'glass' && key !== 'compact' && thicknessCm < THIN) key = 'hdf';
  return SUBSTRATES[key];
}

/** Kilograms of a board of `volumeCm3` cubic centimetres. */
export const boardMass = (s: Substrate, volumeCm3: number) => s.densityKgM3 * volumeCm3 / 1e6;
