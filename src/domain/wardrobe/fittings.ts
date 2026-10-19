/**
 * Fittings: every kind of thing that goes inside a bay of a wardrobe or a kitchen cabinet (drawer, shelf,
 * rail, cupboard door, sink...). An entry with `kitchen` belongs to kitchen cabinets; the others to wardrobes.
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

import type { KitchenUnitKey } from '../kitchen/kitchen-units';

export type MenuGroup = 'hanging' | 'drawers' | 'shelves' | 'storage' | 'doors' | 'appliances';

/** What a fitting kind is like. Rules ask for a trait, never for a list of kinds, so a new kind only
 * declares its traits here. Add a trait only when rules in more than one place need it. */
export const FITTING_TRAITS = Object.freeze({
  hanging: 'Hangs garments on a rail (including a pull-down rail).',
  fixedRail: 'A rail at a fixed height; it can face front in a shallow wardrobe.',
  drawerBox: 'A box that pulls out (drawer, basket); its top must be within drawer reach.',
  pullout: 'Pulls out towards you and is reached at its top edge.',
  openShelf: 'An open shelf; folded clothes at the back of a deep wardrobe are harder to reach.',
  foldedStacks: 'Holds stacks of folded clothes when its purpose is folded clothes or trousers.',
  front: 'Shows its own front (a drawer front, a door, an appliance) instead of standing behind the cabinet doors.',
  appliance: 'A fixture or appliance (sink, hob, oven, fridge): a duplicated cabinet gets plain storage in its place.',
  worktop: 'Sits in the worktop above its cabinet (sink, hob).',
});
export type FittingTrait = keyof typeof FITTING_TRAITS;

export type FrontOpening = 'side' | 'up' | 'down' | 'pull' | 'fixed';
/** Hardware a fitting is built with, for the hardware list. Runner length follows the cabinet's depth, a rail's
 * length the fitting's width; shelf supports go four to each of a cupboard's shelves. */
export const FITTING_HARDWARE = Object.freeze({
  runners: 'Drawer runners, one pair',
  rail: 'Hanging rail with two end supports',
  pullDownRail: 'Pull-down rail mechanism',
  trouserRack: 'Trouser pull-out rack',
  basket: 'Pull-out wire basket on runners',
  liftFitting: 'Lift-up flap fitting, one set',
  shelfSupports: 'Shelf supports, four to a shelf',
});
export type FittingHardware = keyof typeof FITTING_HARDWARE;

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
  readonly menu?: { readonly order: number; readonly group: MenuGroup; readonly label?: string; /** Breaks ties on phones, after what suits the selected space (add-menu-presenter.js). Lower first. */ readonly mobileRank?: number };
  readonly zone: ZoneStyle;
  /** 24 px line icon path. */
  readonly icon: string;
  /** Its traits (see FITTING_TRAITS). Empty when none apply. */
  readonly traits: readonly FittingTrait[];
  /** How its own front opens (fittings with the `front` trait), as drawings show it: hinged at a side, lifting up, falling
   * down from a bottom hinge, pulling out, or fixed (an appliance fascia). */
  readonly opens?: FrontOpening;
  /** The appliance shows its own front (steel and glass), not a panel in the cabinet's finish: nothing is cut for it and
   * it takes no handle. */
  readonly ownFront?: boolean;
  /** Inside a wardrobe, it has a front of its own cut from board (a drawer behind the doors). */
  readonly innerFront?: boolean;
  /** What it is built with (see FITTING_HARDWARE). */
  readonly hardware?: readonly FittingHardware[];
  /** Kitchen cabinets only: the units it fits in, and how the Add item menu ranks and explains it. */
  readonly kitchen?: { readonly units: readonly KitchenUnitKey[]; readonly score: number; readonly why: string };
}

const HANG = { color: '#477fac', priority: Z.hanging } as const;
const PLAIN = { color: '#4b9277', label: 'Folded', priority: Z.fitting } as const;
const SHELF_PURPOSES = ['folded', 'pants', 'accessories', 'seasonal', 'linen'] as const;
const KITCHEN = { color: '#7f9a86', priority: Z.fitting } as const;
const APPLIANCE = { color: '#8a8f96', priority: Z.fitting } as const;
const KITCHEN_PURPOSES = ['dishes', 'utensils', 'cookware', 'food', 'cleaning'] as const;

export const FITTINGS = [
  { key: 'drawer', name: 'Drawer', code: 'D', height: 22, min: 15, max: 30, minWidth: 25, minDepth: 35, price: 45, purpose: 'folded',
    purposes: ['folded', 'small', 'pants', 'accessories', 'seasonal', 'linen'],
    menu: { order: 2, group: 'drawers', mobileRank: 0 }, zone: { ...PLAIN, label: 'Drawer' }, icon: 'M4 6h16v12H4zM9.5 12h5', innerFront: true, hardware: ['runners'], traits: ['drawerBox', 'pullout', 'foldedStacks'] },
  { key: 'void', name: 'Free space', code: 'V', height: 20, min: 5, max: 200, minWidth: 25, minDepth: 35, price: 0, purpose: 'free',
    purposes: ['free'], planner: { min: 0, max: 400, minWidth: 0, minDepth: 0, height: 1 },
    zone: { color: '#8b9bb0', label: 'Free', priority: Z.free }, icon: 'M5 5h3M11 5h2M16 5h3M5 19h3M11 19h2M16 19h3M5 8v3M5 13v3M19 8v3M19 13v3M19 8v3', traits: [] },
  { key: 'sdrawer', name: 'Small-item drawer', code: 'M', height: 14, min: 8, max: 18, minWidth: 25, minDepth: 35, price: 30, purpose: 'small',
    purposes: ['small'], planner: { height: 12 },
    menu: { order: 8, group: 'drawers' }, zone: PLAIN, icon: 'M4 8h16v9H4zM4 5h16M10.5 12.5h3', innerFront: true, hardware: ['runners'], traits: ['drawerBox', 'pullout'] },
  { key: 'shelf', name: 'Shelf', code: 'S', height: 30, min: 15, max: 65, minWidth: 25, minDepth: 35, price: 15, purpose: 'accessories',
    purposes: [...SHELF_PURPOSES, 'reserve'], holdsShelfPossessions: true, itemName: 'Open shelf bay',
    menu: { order: 3, group: 'shelves', mobileRank: 1 }, zone: PLAIN, icon: 'M3 18h18M7 18v-5h4v5M13 18V9h4v9', traits: ['openShelf', 'foldedStacks'] },
  { key: 'short', name: 'Short hang', code: 'H', height: 106, min: 100, max: 120, minWidth: 45, minDepth: 55, price: 30, purpose: 'short',
    purposes: ['short', 'seasonal'], frontName: 'Front-facing short hang',
    menu: { order: 0, group: 'hanging', label: 'Hanging rail', mobileRank: 2 }, zone: { ...HANG, label: 'Shirts', frontLabel: 'Front hang' },
    icon: 'M12 6.5a2 2 0 1 1 2 2l-2 1.2V12M12 12 3.5 17.2c-.9.6-.5 1.8.6 1.8h15.8c1.1 0 1.5-1.2.6-1.8z', hardware: ['rail'], traits: ['hanging', 'fixedRail'] },
  { key: 'long', name: 'Long hang', code: 'L', height: 160, min: 130, max: 195, minWidth: 45, minDepth: 55, price: 40, purpose: 'long',
    purposes: ['long', 'seasonal'], frontName: 'Front-facing long hang',
    menu: { order: 1, group: 'hanging' }, zone: { ...HANG, label: 'Long hang', frontLabel: 'Front hang' }, icon: 'M4 5h16M12 5v2M8 7h8l1.5 13h-11z', hardware: ['rail'], traits: ['hanging', 'fixedRail'] },
  { key: 'shoe', name: 'Shoe rack', code: 'R', height: 24, min: 18, max: 35, minWidth: 25, minDepth: 35, price: 25, purpose: 'shoes',
    purposes: ['shoes'],
    menu: { order: 4, group: 'shelves' }, zone: { color: '#73869c', label: 'Shoes', priority: Z.fitting }, icon: 'M3 17v-3c2 0 3-1 4-3l2 1.5c1 .8 2 1 4 1.5 3 .7 7 1 7 3.5V17zM3 20h18', traits: [] },
  { key: 'pants', name: 'Trouser pull-out', code: 'J', height: 75, min: 65, max: 85, minWidth: 45, minDepth: 50, price: 65, purpose: 'pants',
    purposes: ['pants'],
    menu: { order: 7, group: 'hanging' }, zone: { color: '#9876ac', label: 'Trousers', priority: Z.hanging }, icon: 'M7 3h10l-1 18h-3.5L12 10l-.5 11H8z', hardware: ['trouserRack'], traits: ['pullout'] },
  { key: 'folded', name: 'Folded shelf', code: 'F', height: 28, min: 22, max: 38, minWidth: 25, minDepth: 35, price: 18, purpose: 'folded',
    purposes: SHELF_PURPOSES,
    menu: { order: 6, group: 'shelves' }, zone: PLAIN, icon: 'M4 20h16M6 20v-3h5v3M6 17v-3h5v3M6 14v-3h5v3M13 20v-3h5v3M13 17v-3h5v3', traits: ['openShelf', 'foldedStacks'] },
  { key: 'seasonal', name: 'Upper boxes', code: 'U', height: 40, min: 25, max: 65, minWidth: 25, minDepth: 35, price: 20, purpose: 'seasonal',
    purposes: ['seasonal', 'luggage', 'linen'],
    menu: { order: 5, group: 'storage', mobileRank: 3 }, zone: { color: '#b78a4d', label: 'Boxes', priority: Z.fitting }, icon: 'M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12m0 0 8.5-4M12 12v8', traits: [] },
  { key: 'basket', name: 'Pull-out basket', code: 'B', height: 32, min: 25, max: 45, minWidth: 30, minDepth: 35, price: 40, purpose: 'laundry',
    purposes: ['laundry', 'accessories', 'folded', 'pants'],
    menu: { order: 9, group: 'storage' }, zone: { color: '#86928c', label: 'Basket', priority: Z.fitting }, icon: 'M4 10h16l-1.5 9h-13zM8 10l3-5M16 10l-3-5', hardware: ['basket'], traits: ['drawerBox', 'pullout', 'foldedStacks'] },
  { key: 'lift', name: 'Pull-down rail', code: 'P', height: 106, min: 100, max: 120, minWidth: 55, minDepth: 55, price: 130, purpose: 'short',
    purposes: ['short', 'seasonal'], frontName: 'Front-facing short hang',
    menu: { order: 10, group: 'hanging' }, zone: { ...HANG, label: 'Pull-down' }, icon: 'M12 4v12M7 11l5 5 5-5M5 20h14', hardware: ['pullDownRail'], traits: ['hanging'] },
  { key: 'cutlery', name: 'Cutlery drawer', code: 'C', height: 15, min: 10, max: 22, minWidth: 30, minDepth: 40, price: 55, purpose: 'utensils',
    purposes: KITCHEN_PURPOSES, menu: { order: 11, group: 'drawers', mobileRank: 0 }, zone: { ...KITCHEN, label: 'Drawer' },
    icon: 'M4 8h16v8H4zM9.5 12h5', opens: 'pull', hardware: ['runners'], traits: ['pullout', 'front'], kitchen: { units: ['base', 'tall'], score: 60, why: 'Cutlery and utensils at hand' } },
  { key: 'pan', name: 'Pan drawer', code: 'N', height: 28, min: 18, max: 40, minWidth: 30, minDepth: 40, price: 70, purpose: 'cookware',
    purposes: KITCHEN_PURPOSES, menu: { order: 12, group: 'drawers', mobileRank: 1 }, zone: { ...KITCHEN, label: 'Pan drawer' },
    icon: 'M4 6h16v13H4zM9.5 10h5', opens: 'pull', hardware: ['runners'], traits: ['pullout', 'front'], kitchen: { units: ['base', 'tall'], score: 55, why: 'Deep drawer for pots and pans' } },
  { key: 'cupboard', name: 'Cupboard door', code: 'K', height: 72, min: 25, max: 220, minWidth: 25, minDepth: 25, price: 60, purpose: 'dishes',
    purposes: KITCHEN_PURPOSES, itemName: 'Cupboard', menu: { order: 13, group: 'doors', mobileRank: 2 }, zone: { ...KITCHEN, label: 'Cupboard' },
    icon: 'M6 3h12v18H6zM15 11v2M6 12h12', opens: 'side', hardware: ['shelfSupports'], traits: ['front'], kitchen: { units: ['base', 'upper', 'tall'], score: 50, why: 'Hinged door, shelves inside' } },
  { key: 'flap', name: 'Lift-up flap', code: 'Y', height: 36, min: 25, max: 60, minWidth: 30, minDepth: 25, price: 75, purpose: 'dishes',
    purposes: KITCHEN_PURPOSES, menu: { order: 14, group: 'doors' }, zone: { ...KITCHEN, label: 'Flap' },
    icon: 'M4 9h16v10H4zM4 9l3-5h10l3 5M10.5 15h3', opens: 'up', hardware: ['liftFitting'], traits: ['front'], kitchen: { units: ['upper'], score: 45, why: 'Opens upwards, out of the way' } },
  { key: 'niche', name: 'Open shelf', code: 'Q', height: 30, min: 15, max: 60, minWidth: 25, minDepth: 20, price: 20, purpose: 'dishes',
    purposes: KITCHEN_PURPOSES, menu: { order: 15, group: 'shelves' }, zone: { ...KITCHEN, label: 'Open' },
    icon: 'M4 5h16v14H4zM4 12h16', traits: ['openShelf'], kitchen: { units: ['base', 'upper', 'tall'], score: 30, why: 'Things on show, within reach' } },
  { key: 'sink', name: 'Sink and tap', code: 'I', height: 72, min: 50, max: 80, minWidth: 45, minDepth: 50, price: 180, purpose: 'cleaning',
    purposes: ['cleaning'], menu: { order: 16, group: 'appliances' }, zone: { color: '#6b8ea8', label: 'Sink', priority: Z.fitting },
    icon: 'M3 12h18M5 12l1.5 7h11L19 12M12 12V6a2 2 0 0 1 4 0', opens: 'side', traits: ['front', 'appliance', 'worktop'],
    kitchen: { units: ['base'], score: 40, why: 'Sink in the worktop, doors below' } },
  { key: 'hob', name: 'Hob', code: 'O', height: 14, min: 10, max: 20, minWidth: 55, minDepth: 50, price: 220, purpose: 'appliance',
    purposes: ['appliance'], menu: { order: 17, group: 'appliances' }, zone: { ...APPLIANCE, label: 'Hob' },
    icon: 'M3 6h18v12H3zM8.5 10a1.5 1.5 0 1 0 0 .01M15.5 10a1.5 1.5 0 1 0 0 .01M8.5 15h.01M15.5 15h.01', opens: 'pull', hardware: ['runners'], traits: ['front', 'appliance', 'worktop'],
    kitchen: { units: ['base'], score: 35, why: 'Cooktop in the worktop over a shallow drawer' } },
  { key: 'oven', name: 'Built-in oven', code: 'E', height: 60, min: 56, max: 62, minWidth: 55, minDepth: 55, price: 320, purpose: 'appliance',
    purposes: ['appliance'], menu: { order: 18, group: 'appliances' }, zone: { ...APPLIANCE, label: 'Oven' },
    icon: 'M4 4h16v16H4zM4 8h16M7 12h10v5H7z', opens: 'down', ownFront: true, traits: ['front', 'appliance'], kitchen: { units: ['base', 'tall'], score: 35, why: 'Oven at a comfortable height' } },
  { key: 'fridge', name: 'Integrated fridge', code: 'G', height: 178, min: 60, max: 200, minWidth: 55, minDepth: 55, price: 450, purpose: 'food',
    purposes: ['food'], menu: { order: 19, group: 'appliances' }, zone: { ...APPLIANCE, label: 'Fridge' },
    icon: 'M6 3h12v18H6zM6 10h12M9 6v2M9 13v3', opens: 'side', traits: ['front', 'appliance'], kitchen: { units: ['tall', 'base'], score: 40, why: 'Fridge behind a matching door' } },
  { key: 'microwave', name: 'Built-in microwave', code: 'W', height: 38, min: 29, max: 46, minWidth: 45, minDepth: 30, price: 240, purpose: 'appliance',
    purposes: ['appliance'], menu: { order: 21, group: 'appliances' }, zone: { ...APPLIANCE, label: 'Microwave' },
    icon: 'M3 6h18v12H3zM15 6v12M6 9.5h6v5H6zM17.5 9h.01M17.5 12h.01', opens: 'fixed', ownFront: true, traits: ['front', 'appliance'],
    kitchen: { units: ['upper', 'tall'], score: 36, why: 'Microwave at eye level, out of the worktop' } },
  { key: 'dishwasher', name: 'Built-in dishwasher', code: 'X', height: 74, min: 60, max: 82, minWidth: 45, minDepth: 55, price: 420, purpose: 'cleaning',
    purposes: ['cleaning'], menu: { order: 23, group: 'appliances' }, zone: { ...APPLIANCE, label: 'Dishwasher' },
    icon: 'M4 3h16v18H4zM4 8h16M7 5.5h.01M10 5.5h.01M8 14h8v4H8z', opens: 'down', traits: ['front', 'appliance'],
    kitchen: { units: ['base'], score: 38, why: 'Dishwasher next to the sink, behind a matching door' } },
  { key: 'hood', name: 'Cooker hood', code: 'A', height: 24, min: 15, max: 60, minWidth: 45, minDepth: 25, price: 210, purpose: 'appliance',
    purposes: ['appliance'], menu: { order: 24, group: 'appliances' }, zone: { ...APPLIANCE, label: 'Hood' },
    icon: 'M3 13h18l-3-6H6zM8 13v3M16 13v3M12 16v4', opens: 'fixed', ownFront: true, traits: ['front', 'appliance'],
    kitchen: { units: ['upper'], score: 34, why: 'Extractor over the hob' } },
  { key: 'cargo', name: 'Cargo pull-out', code: 'Z', height: 74, min: 50, max: 200, minWidth: 25, minDepth: 40, price: 210, purpose: 'food',
    purposes: KITCHEN_PURPOSES, menu: { order: 22, group: 'storage' }, zone: { ...KITCHEN, label: 'Cargo' },
    icon: 'M8 3h8v18H8zM8 8h8M8 13h8M8 18h8M12 3v18', opens: 'pull', hardware: ['runners'], traits: ['pullout', 'front'],
    kitchen: { units: ['base', 'tall'], score: 42, why: 'Slim pull-out for bottles, jars and tins' } },
  { key: 'pantry', name: 'Pantry pull-out', code: 'T', height: 160, min: 90, max: 200, minWidth: 30, minDepth: 45, price: 260, purpose: 'food',
    purposes: KITCHEN_PURPOSES, menu: { order: 20, group: 'storage' }, zone: { ...KITCHEN, label: 'Pantry' },
    icon: 'M7 3h10v18H7zM7 8h10M7 13h10M12 17v1', opens: 'pull', hardware: ['runners'], traits: ['pullout', 'front'], kitchen: { units: ['tall'], score: 45, why: 'Tall pull-out larder for food' } },
] as const satisfies readonly FittingDef[];

export type FittingKind = typeof FITTINGS[number]['key'];
export const FITTING_KINDS = FITTINGS.map(f => f.key) as readonly FittingKind[];
export const fitting = (key: string | undefined): FittingDef | undefined => (FITTINGS as readonly FittingDef[]).find(f => f.key === key);

const kindsWith = (trait: FittingTrait) => new Set((FITTINGS as readonly FittingDef[]).filter(f => f.traits.includes(trait)).map(f => f.key));
const TRAIT_KINDS = Object.fromEntries((Object.keys(FITTING_TRAITS) as FittingTrait[]).map(t => [t, kindsWith(t)])) as unknown as Record<FittingTrait, ReadonlySet<string>>;
/** Whether a fitting kind has a trait. Use this instead of listing kinds. */
export const hasTrait = (kind: string | undefined, trait: FittingTrait) => kind !== undefined && TRAIT_KINDS[trait].has(kind);

/** Which furniture a fitting kind goes in: kitchen cabinets when it names its kitchen units, else wardrobes. */
export const fittingProduct = (key: string | undefined): 'wardrobe' | 'kitchen' => fitting(key)?.kitchen ? 'kitchen' : 'wardrobe';
const menuOrder = (product: 'wardrobe' | 'kitchen') => (FITTINGS as readonly FittingDef[])
  .filter(f => f.menu && fittingProduct(f.key) === product).sort((a, b) => a.menu!.order - b.menu!.order).map(f => f.key as FittingKind);
/** Wardrobe kinds in Add item menu order. */
export const MENU_KINDS = menuOrder('wardrobe');
/** Kitchen cabinet kinds in Add item menu order. */
export const KITCHEN_MENU_KINDS = menuOrder('kitchen');

/** The planner's limits per kind: [min, max, minWidth, minDepth, default height, price]. */
export function plannerLimits(): Record<string, [number, number, number, number, number, number]> {
  return Object.fromEntries((FITTINGS as readonly FittingDef[]).map(f => {
    const p = f.planner ?? {};
    return [f.key, [p.min ?? f.min, p.max ?? f.max, p.minWidth ?? f.minWidth, p.minDepth ?? f.minDepth, p.height ?? f.height, f.price]];
  }));
}
