/**
 * Purposes: what a fitting is used for. Every purpose is either a possession (see possessions.ts,
 * the things Auto design plans for) or one of the general purposes below (spare room, boxes...).
 *
 * TO ADD A GENERAL PURPOSE: append one entry to GENERAL_PURPOSES. Its label, saved-project format
 * and zone style follow. Then say which fitting kinds offer it, in fittings.ts (`purposes`).
 * tests/architecture/fittings.test.ts checks every purpose.
 */
import { POSSESSIONS } from './possessions';
import type { PossessionKey } from './possessions';
import { ZONE_PRIORITY as Z } from './zone-style';
import type { ZoneStyle } from './zone-style';

export interface GeneralPurposeDef {
  readonly key: string;
  readonly label: string;
  readonly zone?: ZoneStyle;
}

const TINT = { color: '#b78a4d', priority: Z.tint } as const;

export const GENERAL_PURPOSES = [
  { key: 'reserve', label: 'Adjustable storage', zone: { color: '#8b9bb0', label: 'Adjustable', priority: Z.purpose } },
  { key: 'free', label: 'Free space' },
  { key: 'accessories', label: 'Accessories', zone: { color: '#6f8fa3', label: 'Spare shelf', priority: Z.purpose } },
  { key: 'seasonal', label: 'Seasonal clothing', zone: TINT },
  { key: 'luggage', label: 'Bags & luggage', zone: TINT },
  { key: 'linen', label: 'Bedding & linen', zone: TINT },
  { key: 'laundry', label: 'Laundry' },
  // Kitchen cabinets.
  { key: 'dishes', label: 'Plates & glasses' },
  { key: 'utensils', label: 'Cutlery & utensils' },
  { key: 'cookware', label: 'Pots & pans' },
  { key: 'food', label: 'Food & pantry' },
  { key: 'cleaning', label: 'Cleaning & bins' },
  { key: 'appliance', label: 'Appliance' },
] as const satisfies readonly GeneralPurposeDef[];

export type GeneralPurpose = typeof GENERAL_PURPOSES[number]['key'];
export type Purpose = GeneralPurpose | PossessionKey;

/** One entry per purpose, general ones first, with its label and zone style. */
export const PURPOSES: readonly { readonly key: Purpose; readonly label: string; readonly zone?: ZoneStyle | undefined }[] = [
  ...GENERAL_PURPOSES,
  ...POSSESSIONS.map(p => ({
    key: p.key, label: p.label,
    // A possession on a shelf of its own shows as itself; the clothing possessions say so in their entry.
    zone: p.engine === 'shelf' ? { color: p.look.color, label: p.label, priority: Z.purpose } : 'zone' in p ? p.zone : undefined,
  })),
];

export const ALL_PURPOSES = PURPOSES.map(p => p.key);
export const purposeDef = (key: string | undefined) => PURPOSES.find(p => p.key === key);
