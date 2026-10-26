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
  /** A sink or hob that stands on its own on a worktop, or a shelf on the wall: placed, moved and sized by itself, with no cabinet. */
  readonly fixture?: 'sink' | 'hob' | 'shelf';
  /** A solid installation component, with no carcass or storage bays. */
  readonly installation?: 'filler' | 'end-panel';
  /** What a new unit holds, and what replaces an appliance when a unit is duplicated: [kind, height][]. */
  readonly storage: readonly (readonly [string, number])[];
}

export const KITCHEN_UNITS = [
  { key: 'base', name: 'Base cabinet', description: 'Stands on the floor under the worktop', w: 60, h: 86, d: 58, elevation: 0,
    sizes: { w: [15, 150], h: [70, 100], d: [30, 80] }, worktop: true, plinth: true, storage: [['cupboard', 72]] },
  { key: 'upper', name: 'Wall cabinet', description: 'Hangs on the wall above the worktop', w: 60, h: 70, d: 35, elevation: 142,
    sizes: { w: [30, 150], h: [35, 130], d: [25, 70] }, worktop: false, plinth: false, storage: [['cupboard', 56]] },
  { key: 'tall', name: 'Tall cabinet', description: 'Floor to top: larder, fridge or ovens', w: 60, h: 215, d: 58, elevation: 0,
    sizes: { w: [30, 100], h: [150, 270], d: [30, 80] }, worktop: false, plinth: true, storage: [['cupboard', 200]] },
  { key: 'filler', name: 'Installation strip', description: 'A fixed front strip reserving its exact width along the run', w: 4, h: 86, d: 58, elevation: 0,
    sizes: { w: [.1, 30], h: [10, 300], d: [2, 90] }, worktop: true, plinth: true, installation: 'filler', storage: [] },
  { key: 'end-panel', name: 'End panel', description: 'A solid full-depth end panel; width is its actual thickness', w: 1.8, h: 86, d: 58, elevation: 0,
    sizes: { w: [.1, 10], h: [10, 300], d: [2, 90] }, worktop: true, plinth: false, installation: 'end-panel', storage: [] },
  // A sink or hob is placed by itself on the worktop (its underside is the worktop's top), never part of a cabinet.
  { key: 'sink-top', name: 'Sink', description: 'A sink and tap, placed on any worktop', w: 80, h: 30, d: 50, elevation: 90,
    sizes: { w: [40, 200], h: [30, 30], d: [35, 70] }, worktop: false, plinth: false, fixture: 'sink', storage: [] },
  { key: 'hob-top', name: 'Hob', description: 'A hob, placed on any worktop', w: 60, h: 2, d: 52, elevation: 90,
    sizes: { w: [30, 120], h: [2, 2], d: [35, 70] }, worktop: false, plinth: false, fixture: 'hob', storage: [] },
  // A shelf hangs on the wall like a wall unit: a board with no sides, doors or inside.
  { key: 'shelf', name: 'Wall shelf', description: 'An open board on the wall', w: 80, h: 3, d: 25, elevation: 142,
    sizes: { w: [30, 400], h: [2, 5], d: [15, 40] }, worktop: false, plinth: false, fixture: 'shelf', storage: [] },
] as const satisfies readonly KitchenUnitDef[];

/** A sink or hob placed on its own on a worktop (a design of that unit). */
export const isFixture = (design: { product?: string | undefined; unit?: string | undefined }) => design.product === 'kitchen' && !!kitchenUnit(design.unit).fixture;
export type KitchenUnitKey = typeof KITCHEN_UNITS[number]['key'];
export const KITCHEN_UNIT_KEYS = KITCHEN_UNITS.map(u => u.key) as readonly KitchenUnitKey[];
export const kitchenUnit = (key: string | undefined): KitchenUnitDef =>
  (KITCHEN_UNITS as readonly KitchenUnitDef[]).find(u => u.key === key) ?? KITCHEN_UNITS[0];

/** Worktop thickness, its overhang at the front, and the plinth's setback from the front. */
export const WORKTOP = { thickness: 4, overhang: 2 } as const;
export const KITCHEN_PLINTH_SETBACK = 6;

export const installationKind = (design: { product?: string | undefined; unit?: string | undefined }) =>
  design.product === 'kitchen' ? kitchenUnit(design.unit).installation : undefined;
