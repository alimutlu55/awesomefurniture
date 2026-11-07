import { type CreditCurrency } from '../../credits/credit-catalog';
import { CURRENCY_COSTS } from '../../credits/unit-economics';
import { getDecor } from '../../materials/decor-catalog';
import type { BoardDecorSKU } from '../../materials/decor-types';
import { hardware } from '../../hardware/hardware-registry';
import type { HardwareCategory } from '../../hardware/hardware-types';

/**
 * The price list the engine quotes from: boards, edge banding, hardware, a panel shop's services and a workshop's time,
 * in euro, converted to the visitor's currency with the same rates as the credits (unit-economics.ts).
 *
 * These are indicative trade prices for Poland and the EU in late 2026, before VAT, collected from public panel-shop and
 * hardware price lists. They are estimates: every quote says so and names `PRICES_AS_OF`. A supplier or a workshop
 * replaces them with its own list (the same shape) to quote its real prices.
 */
export const PRICES_AS_OF = '2026-11';

/** Finished board per square metre at the decor's own thickness, by how the decor is made. */
export const BOARD_EUR_M2: Readonly<Record<NonNullable<BoardDecorSKU['construction']>, number>> = {
  melamine: 14, laminate_on_mdf: 40, lacquered_mdf: 70, veneered_mdf: 65, compact_hpl: 110, glass: 60, mirror: 55,
};
/** A thin back or drawer bottom (HDF), per square metre. */
export const THIN_BOARD_EUR_M2 = 4.5;
/** Thinner than this (centimetres), a board is priced as HDF. */
const THIN = 1;
/** A stock sheet used at least this much is bought whole; a less used one is charged for its parts' area plus OFFCUT, as
 * panel shops charge a part sheet cut from their stock. */
export const WHOLE_SHEET = .5;
export const OFFCUT = .25;

/** Edge banding (1 mm ABS) per metre, the material. */
export const EDGE_BAND_EUR_M = .5;

/** A panel shop's services. */
export const SERVICES_EUR = {
  /** Sawing, per metre of cut. */
  cutM: .8,
  /** Applying edge banding, per metre. */
  edgeM: .9,
  /** CNC drilling, per hole. */
  hole: .12,
  /** Routing a groove for a back, per metre. */
  grooveM: 1,
} as const;

/** A workshop's time, per hour, and its usual margin on materials and time. */
export const WORKSHOP = { hourEur: 35, margin: .25 } as const;

/** What one item of hardware costs when its registry entry gives no `costEur`, by kind of hardware. */
export const HARDWARE_FALLBACK_EUR: Readonly<Record<HardwareCategory, number>> = {
  connector: .15, fixing: .03, support: .1, hinge: 6, runner: 18, handle: 6, rail: 12, leg: 2, bracket: 3, lift: 90, mechanism: 120,
  plinth: 1, track: 80, lighting: 25,
};

/** Units of `currency` for one euro. */
export const perEuro = (currency: CreditCurrency) => CURRENCY_COSTS[currency].perUsd / CURRENCY_COSTS.eur.perUsd;

/** Price per square metre of a board of `decorId`, `thicknessCm` thick. An unknown decor is priced as melamine. */
export function boardEurM2(decorId: string, thicknessCm: number): number {
  if (thicknessCm < THIN) return THIN_BOARD_EUR_M2;
  let construction: NonNullable<BoardDecorSKU['construction']> = 'melamine';
  try { construction = getDecor(decorId).construction ?? 'melamine'; } catch { /* unknown decor: melamine */ }
  return BOARD_EUR_M2[construction];
}

/** Price of one item of hardware `key` (a pair, a piece, a set), or of one of `sizeMm` length for hardware sold by the metre. */
export function hardwareEur(key: string, sizeMm?: number): number {
  const entry = hardware(key);
  if (!entry) return HARDWARE_FALLBACK_EUR.fixing;
  const each = entry.rules.costEur ?? HARDWARE_FALLBACK_EUR[entry.category];
  return entry.unit === 'm' && sizeMm ? each * sizeMm / 1000 : each;
}
