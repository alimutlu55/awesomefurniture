/**
 * Fittings: every kind of thing that goes inside a wardrobe bay (drawer, shelf, rail...).
 *
 * THIS IS THE ONLY PLACE THAT DEFINES A FITTING KIND. The catalogue (`MODS`), the planner's size
 * limits, the saved-project format, the purposes each kind offers, the Add item menu (order, group,
 * label), the zone colour and label in layout diagrams, and the icon all come from this list.
 *
 * TO ADD A FITTING KIND: append one entry and run `npm test`. tests/architecture/fittings.test.ts
 * walks every entry through every place above and names what is missing. Two things still need code:
 *   - how many possessions it holds, in planner/wardrobe-planner.js (`capacitiesOf`), if it holds any;
 *   - how it is drawn in 3D, in presentation/viewport/fitting-renderer.ts.
 * Something that simply stands on a shelf (bags, hats...) is not a fitting: add it to possessions.ts.
 *
 * Sizes are centimetres. Prices are the catalogue's relative price units.
 */
import { ZONE_PRIORITY as Z } from './zone-style';
import type { ZoneStyle } from './zone-style';
import type { Purpose } from './purposes';

export type MenuGroup = 'hanging' | 'drawers' | 'shelves' | 'storage';

export interface FittingDef {
  readonly key: string;
  /** Catalogue name. */
  readonly name: string;
  /** One-letter code used in compact layout summaries. */
  readonly code: string;
  /** Default height when added. */
  readonly height: number;
  readonly min: number;
  readonly max: number;
  /** Narrowest bay it fits in. */
  readonly minWidth: number;
  /** Shallowest wardrobe it fits in. */
  readonly minDepth: number;
  readonly price: number;
  /** Purpose a new fitting of this kind starts with. */
  readonly purpose: Purpose;
  /** Purposes the inspector offers for it, in menu order. The first is usually `purpose`. */
  readonly purposes: readonly Purpose[];
  /** Shelves also offer every possession that stands on a shelf (handbags...). */
  readonly holdsShelfPossessions?: boolean;
  /** Where the planner's own limits differ from the editor's. Leave out when they are the same. */
  readonly planner?: { readonly min?: number; readonly max?: number; readonly minWidth?: number; readonly minDepth?: number; readonly height?: number };
  /** Name of one placed item when it differs from `name`, and when it hangs front-facing. */
  readonly itemName?: string;
  readonly frontName?: string;
  /** Add item menu. Leave out for kinds the user does not add directly (free space). */
  readonly menu?: { readonly order: number; readonly group: MenuGroup; readonly label?: string; /** Lower first on phones. */ readonly mobileRank?: number };
  readonly zone: ZoneStyle;
  /** 24 px line icon path. */
  readonly icon: string;
}

const HANG = { color: '#477fac', priority: Z.hanging } as const;
const PLAIN = { color: '#4b9277', label: 'Folded', priority: Z.fitting } as const;
const SHELF_PURPOSES = ['folded', 'pants', 'accessories', 'seasonal', 'linen'] as const;

export const FITTINGS = [
  { key: 'drawer', name: 'Drawer', code: 'D', height: 22, min: 15, max: 30, minWidth: 25, minDepth: 35, price: 45, purpose: 'folded',
    purposes: ['folded', 'small', 'pants', 'accessories', 'seasonal', 'linen'],
    menu: { order: 2, group: 'drawers', mobileRank: 0 }, zone: { ...PLAIN, label: 'Drawer' }, icon: 'M4 6h16v12H4zM9.5 12h5' },
  { key: 'void', name: 'Free space', code: 'V', height: 20, min: 5, max: 200, minWidth: 25, minDepth: 35, price: 0, purpose: 'free',
    purposes: ['free'], planner: { min: 0, max: 400, minWidth: 0, minDepth: 0, height: 1 },
    zone: { color: '#8b9bb0', label: 'Free', priority: Z.free }, icon: 'M5 5h3M11 5h2M16 5h3M5 19h3M11 19h2M16 19h3M5 8v3M5 13v3M19 8v3M19 13v3M19 8v3' },
  { key: 'sdrawer', name: 'Small-item drawer', code: 'M', height: 14, min: 8, max: 18, minWidth: 25, minDepth: 35, price: 30, purpose: 'small',
    purposes: ['small'], planner: { height: 12 },
    menu: { order: 8, group: 'drawers' }, zone: PLAIN, icon: 'M4 8h16v9H4zM4 5h16M10.5 12.5h3' },
  { key: 'shelf', name: 'Shelf', code: 'S', height: 30, min: 15, max: 65, minWidth: 25, minDepth: 35, price: 15, purpose: 'accessories',
    purposes: [...SHELF_PURPOSES, 'reserve'], holdsShelfPossessions: true, itemName: 'Open shelf bay',
    menu: { order: 3, group: 'shelves', mobileRank: 1 }, zone: PLAIN, icon: 'M3 18h18M7 18v-5h4v5M13 18V9h4v9' },
  { key: 'short', name: 'Short hang', code: 'H', height: 106, min: 100, max: 120, minWidth: 45, minDepth: 55, price: 30, purpose: 'short',
    purposes: ['short', 'seasonal'], frontName: 'Front-facing short hang',
    menu: { order: 0, group: 'hanging', label: 'Hanging rail', mobileRank: 2 }, zone: { ...HANG, label: 'Shirts', frontLabel: 'Front hang' },
    icon: 'M12 6.5a2 2 0 1 1 2 2l-2 1.2V12M12 12 3.5 17.2c-.9.6-.5 1.8.6 1.8h15.8c1.1 0 1.5-1.2.6-1.8z' },
  { key: 'long', name: 'Long hang', code: 'L', height: 160, min: 130, max: 195, minWidth: 45, minDepth: 55, price: 40, purpose: 'long',
    purposes: ['long', 'seasonal'], frontName: 'Front-facing long hang',
    menu: { order: 1, group: 'hanging' }, zone: { ...HANG, label: 'Long hang', frontLabel: 'Front hang' }, icon: 'M4 5h16M12 5v2M8 7h8l1.5 13h-11z' },
  { key: 'shoe', name: 'Shoe rack', code: 'R', height: 24, min: 18, max: 35, minWidth: 25, minDepth: 35, price: 25, purpose: 'shoes',
    purposes: ['shoes'],
    menu: { order: 4, group: 'shelves' }, zone: { color: '#73869c', label: 'Shoes', priority: Z.fitting }, icon: 'M3 17v-3c2 0 3-1 4-3l2 1.5c1 .8 2 1 4 1.5 3 .7 7 1 7 3.5V17zM3 20h18' },
  { key: 'pants', name: 'Trouser pull-out', code: 'J', height: 75, min: 65, max: 85, minWidth: 45, minDepth: 50, price: 65, purpose: 'pants',
    purposes: ['pants'],
    menu: { order: 7, group: 'hanging' }, zone: { color: '#9876ac', label: 'Trousers', priority: Z.hanging }, icon: 'M7 3h10l-1 18h-3.5L12 10l-.5 11H8z' },
  { key: 'folded', name: 'Folded shelf', code: 'F', height: 28, min: 22, max: 38, minWidth: 25, minDepth: 35, price: 18, purpose: 'folded',
    purposes: SHELF_PURPOSES,
    menu: { order: 6, group: 'shelves' }, zone: PLAIN, icon: 'M4 20h16M6 20v-3h5v3M6 17v-3h5v3M6 14v-3h5v3M13 20v-3h5v3M13 17v-3h5v3' },
  { key: 'seasonal', name: 'Upper boxes', code: 'U', height: 40, min: 25, max: 65, minWidth: 25, minDepth: 35, price: 20, purpose: 'seasonal',
    purposes: ['seasonal', 'luggage', 'linen'],
    menu: { order: 5, group: 'storage', mobileRank: 3 }, zone: { color: '#b78a4d', label: 'Boxes', priority: Z.fitting }, icon: 'M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12m0 0 8.5-4M12 12v8' },
  { key: 'basket', name: 'Pull-out basket', code: 'B', height: 32, min: 25, max: 45, minWidth: 30, minDepth: 35, price: 40, purpose: 'laundry',
    purposes: ['laundry', 'accessories', 'folded', 'pants'],
    menu: { order: 9, group: 'storage' }, zone: { color: '#86928c', label: 'Basket', priority: Z.fitting }, icon: 'M4 10h16l-1.5 9h-13zM8 10l3-5M16 10l-3-5' },
  { key: 'lift', name: 'Pull-down rail', code: 'P', height: 106, min: 100, max: 120, minWidth: 55, minDepth: 55, price: 130, purpose: 'short',
    purposes: ['short', 'seasonal'], frontName: 'Front-facing short hang',
    menu: { order: 10, group: 'hanging' }, zone: { ...HANG, label: 'Pull-down' }, icon: 'M12 4v12M7 11l5 5 5-5M5 20h14' },
] as const satisfies readonly FittingDef[];

export type FittingKind = typeof FITTINGS[number]['key'];
export const FITTING_KINDS = FITTINGS.map(f => f.key) as readonly FittingKind[];
export const fitting = (key: string | undefined): FittingDef | undefined => (FITTINGS as readonly FittingDef[]).find(f => f.key === key);

/** Kinds in Add item menu order. */
export const MENU_KINDS = (FITTINGS as readonly FittingDef[]).filter(f => f.menu).sort((a, b) => a.menu!.order - b.menu!.order).map(f => f.key as FittingKind);

/** The planner's limits per kind: [min, max, minWidth, minDepth, default height, price]. */
export function plannerLimits(): Record<string, [number, number, number, number, number, number]> {
  return Object.fromEntries((FITTINGS as readonly FittingDef[]).map(f => {
    const p = f.planner ?? {};
    return [f.key, [p.min ?? f.min, p.max ?? f.max, p.minWidth ?? f.minWidth, p.minDepth ?? f.minDepth, p.height ?? f.height, f.price]];
  }));
}
