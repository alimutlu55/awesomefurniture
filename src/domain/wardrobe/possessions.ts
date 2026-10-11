/**
 * Possessions: everything a person stores that Auto design plans for.
 *
 * THIS FILE IS THE ONLY PLACE TO ADD A POSSESSION THAT STANDS ON A SHELF (bags, hats, folded
 * blankets in baskets...). Append one `engine: 'shelf'` entry to POSSESSIONS and the following
 * follow from it, with no other edit:
 *   - the planner category: demand, frequency and reach-band weights, shelf modules, capacity
 *   - the wizard "What do you store?" field, its limits and its saved value
 *   - the saved-project format (purpose and need), the item purpose label and colour
 *   - the Add item menu card, its shelf command, the drawn items on the shelf in 3D
 *   - the "room for N of M" report after Auto design
 * `tests/architecture/possessions.test.ts` walks every entry through all of these. If you add an
 * entry and a test fails, that test names the step that is missing.
 *
 * The six clothing possessions are `engine: 'bespoke'`: their fittings (rails, drawers, trouser
 * pull-outs...) have hand-written capacity rules in the planner. A new kind of fitting needs
 * engine work; a new thing to put on a shelf does not.
 */

import { ZONE_PRIORITY } from './zone-style';
import type { ZoneStyle } from './zone-style';

/** A shelf that holds one possession. Centimetres. */
export interface ShelfHolder {
  /** Shelf height. A lower shelf holds none. */
  readonly height: number;
  /** Width one unit takes, including the gap to the next. */
  readonly pitch: number;
  /** Width kept free at the ends of the shelf. */
  readonly margin: number;
  /** Most shelves of this kind the planner stacks in one module. */
  readonly maxStack: number;
  /** Size of one unit as drawn standing on the shelf. */
  readonly unit: { readonly width: number; readonly depth: number; readonly height: number; readonly handle: boolean };
}

interface Common {
  /** The planner category, the `needs` key and the item purpose are all this one word. */
  readonly key: string;
  /** Shown for the purpose, in the wizard and in the Add menu. */
  readonly label: string;
  /** Wizard field: starting count and the most the field accepts. */
  readonly need: { readonly default: number; readonly max: number };
  /** Weights the planner trades off with the other possessions. */
  readonly planner: {
    /** How often it is used: 1 is daily. Scales the benefit of storing it well. */
    readonly frequency: number;
    /** Share of the reach height where it is best kept: [low, high]. Outside it loses benefit. */
    readonly home: readonly [number, number];
  };
  /** How its zone is drawn when it changes what the zone is (see zone-style.ts). Optional. */
  readonly zone?: ZoneStyle;
}

export interface BespokePossession extends Common { readonly engine: 'bespoke' }

export interface ShelfPossession extends Common {
  readonly engine: 'shelf';
  readonly holder: ShelfHolder;
  readonly look: {
    /** Colour of its zone in the layout drawings. */
    readonly color: string;
    /** 24 px line icon path, used on the Add item card and the layout drawings. */
    readonly icon: string;
    /** Stroke of the large Add item card illustration. */
    readonly stroke: string;
  };
  /** Add item card. The planner never reads this. */
  readonly menu: { readonly why: string; readonly score: number };
}

export type Possession = BespokePossession | ShelfPossession;

export const POSSESSIONS = [
  { key: 'short', label: 'Shirts & jackets', engine: 'bespoke', need: { default: 24, max: 150 }, planner: { frequency: 1, home: [.4, 1] } },
  { key: 'long', label: 'Dresses & coats', engine: 'bespoke', need: { default: 6, max: 80 }, planner: { frequency: .6, home: [.4, 1] } },
  { key: 'pants', label: 'Trousers & jeans', engine: 'bespoke', need: { default: 12, max: 100 }, planner: { frequency: .9, home: [.2, .8] }, zone: { color: '#9876ac', label: 'Trousers', priority: ZONE_PRIORITY.purpose } },
  { key: 'folded', label: 'T-shirts & knitwear', engine: 'bespoke', need: { default: 30, max: 200 }, planner: { frequency: 1, home: [.2, .8] } },
  { key: 'shoes', label: 'Shoes', engine: 'bespoke', need: { default: 8, max: 80 }, planner: { frequency: .8, home: [0, .4] } },
  { key: 'small', label: 'Underwear & socks', engine: 'bespoke', need: { default: 30, max: 200 }, planner: { frequency: 1, home: [.4, .8] }, zone: { color: '#c0668a', label: 'Underwear & socks', priority: ZONE_PRIORITY.purpose } },
  {
    key: 'handbags', label: 'Handbags', engine: 'shelf', need: { default: 0, max: 60 }, planner: { frequency: .7, home: [.25, .85] },
    // A medium tote: 31 × 14 × 23 cm, standing upright, 33 cm each with a 2 cm gap.
    holder: { height: 25, pitch: 33, margin: 2, maxStack: 3, unit: { width: 31, depth: 14, height: 23, handle: true } },
    look: { color: '#a0664f', icon: 'M6 9h12l1 11H5L6 9Zm3 0V7a3 3 0 0 1 6 0v2', stroke: '#6b4a3a' },
    menu: { why: 'Bags stand upright on a shelf', score: 42 },
  },
] as const satisfies readonly Possession[];

export type PossessionKey = typeof POSSESSIONS[number]['key'];
export type ShelfPossessionEntry = Extract<typeof POSSESSIONS[number], { engine: 'shelf' }>;
export type ShelfKey = ShelfPossessionEntry['key'];
export type BespokeKey = Exclude<PossessionKey, ShelfKey>;

export const POSSESSION_KEYS = POSSESSIONS.map(p => p.key) as readonly PossessionKey[];
export const SHELF_POSSESSIONS = POSSESSIONS.filter((p): p is ShelfPossessionEntry => p.engine === 'shelf');

/** Every possession a saved design may need, with the project's own count. */
export type Needs = Readonly<Record<BespokeKey, number>> & Readonly<Partial<Record<ShelfKey, number | undefined>>>;

export const possession = (key: string): Possession | undefined => (POSSESSIONS as readonly Possession[]).find(p => p.key === key);
export const shelfPossession = (key: string): ShelfPossessionEntry | undefined => SHELF_POSSESSIONS.find(p => p.key === key);

/** Starting counts for a new design, from each possession's own default. */
export const defaultNeeds = () => Object.fromEntries(POSSESSIONS.map(p => [p.key, p.need.default])) as Record<PossessionKey, number>;

/** How many units stand on a shelf of this width. */
export const unitsOnShelf = (holder: ShelfHolder, widthCm: number) => Math.max(0, Math.floor((widthCm - holder.margin) / holder.pitch));
/** Whether an item of this kind could hold the possession: a shelf tall enough and wide enough for one unit. */
export const shelfFits = (holder: ShelfHolder, widthCm: number, heightCm: number) => heightCm >= holder.height - .01 && unitsOnShelf(holder, widthCm) >= 1;
