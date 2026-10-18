/**
 * Kitchen units: the modular boxes a kitchen is built from. Base units stand on the floor under a
 * shared worktop and plinth; wall units hang above the worktop; tall units stand from floor to top.
 *
 * THIS IS THE ONLY PLACE THAT DEFINES A KITCHEN UNIT. The Cabinets add panel, the size limits, the
 * saved-project format and what a new or duplicated unit holds all come from this list.
 *
 * Centimetres. `h` is the carcass height with its plinth (wall units: their light rail); the worktop
 * sits on top of base units and is not part of `h`.
 */
export interface KitchenUnitDef {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  /** Height of the unit's underside above the floor. */
  readonly elevation: number;
  readonly sizes: { readonly w: readonly [number, number]; readonly h: readonly [number, number]; readonly d: readonly [number, number] };
  /** It stands under the worktop that runs along neighbouring base units. */
  readonly worktop: boolean;
  /** It stands on a plinth that runs along neighbouring units on the floor. */
  readonly plinth: boolean;
  /** What a new unit holds, and what replaces an appliance when a unit is duplicated: [kind, height][]. */
  readonly storage: readonly (readonly [string, number])[];
}

export const KITCHEN_UNITS = [
  { key: 'base', name: 'Base cabinet', description: 'Stands on the floor under the worktop', w: 60, h: 86, d: 58, elevation: 0,
    sizes: { w: [30, 150], h: [70, 100], d: [30, 80] }, worktop: true, plinth: true, storage: [['cupboard', 72]] },
  { key: 'upper', name: 'Wall cabinet', description: 'Hangs on the wall above the worktop', w: 60, h: 70, d: 35, elevation: 142,
    sizes: { w: [30, 150], h: [35, 130], d: [25, 70] }, worktop: false, plinth: false, storage: [['cupboard', 56]] },
  { key: 'tall', name: 'Tall cabinet', description: 'Floor to top: larder, fridge or ovens', w: 60, h: 215, d: 58, elevation: 0,
    sizes: { w: [30, 100], h: [150, 270], d: [30, 80] }, worktop: false, plinth: true, storage: [['cupboard', 200]] },
] as const satisfies readonly KitchenUnitDef[];

export type KitchenUnitKey = typeof KITCHEN_UNITS[number]['key'];
export const KITCHEN_UNIT_KEYS = KITCHEN_UNITS.map(u => u.key) as readonly KitchenUnitKey[];
export const kitchenUnit = (key: string | undefined): KitchenUnitDef =>
  (KITCHEN_UNITS as readonly KitchenUnitDef[]).find(u => u.key === key) ?? KITCHEN_UNITS[0];

/** Worktop thickness, its overhang at the front, and the plinth's setback from the front. */
export const WORKTOP = { thickness: 4, overhang: 2 } as const;
export const KITCHEN_PLINTH_SETBACK = 6;
