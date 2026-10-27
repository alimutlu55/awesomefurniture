import type { ItemKind, StoragePurpose, WardrobePreferences } from './wardrobe';
import type { WardrobeShape } from './shape/wardrobe-shape';
import type { KitchenUnitKey } from '../kitchen/kitchen-units';

/** Serializable layout intent: distinguishes stacked/full-width items from
 * pinned coordinates and retains divider travel regions. No camera or selection. */
export interface EditorItem {
  id?: string | undefined;
  k: ItemKind; h: number; f?: 'Oak' | 'White' | 'Walnut' | 'Graphite' | 'Sage' | null | undefined; purpose?: StoragePurpose | undefined;
  w?: number | undefined; x?: number | undefined; y?: number | undefined; ax?: 'l' | 'c' | 'r' | undefined; front?: boolean | undefined; boxes?: number | undefined;
  /** Which side a side-hung door or upright pull hinges on ('left' puts the handle on the right; 'right' on the left). */
  hinge?: 'left' | 'right' | undefined;
}
export interface EditorDivider {
  id?: string | undefined;
  i: number; orientation: 'horizontal' | 'vertical';
  /** Wanted top, in section coordinates. The drawn top is the lower of this and the slope, so a divider grows back when the slope rises. */
  want?: number | undefined;
  /** An automatic divider follows the roof across its depth, rather than ending on a flat plane. */
  roofFit?: boolean | undefined;
  x?: number | undefined; y?: number | undefined; x0?: number | undefined; x1?: number | undefined; y0?: number | undefined; y1?: number | undefined;
  area?: { x0: number; x1: number; y0: number; y1: number } | undefined;
}
export type EditorProfile = { -readonly [K in keyof Omit<WardrobePreferences, 'budget'>]: Omit<WardrobePreferences, 'budget'>[K] } & { reachStd?: number | undefined; engaged?: boolean | undefined };
export interface EditorLayout {
  cabinetId: number;
  weights: number[];
  reachStd?: number | undefined;
  engaged?: boolean | undefined;
  reachLine?: boolean | undefined;
  doorHang?: 'left' | 'right' | undefined;
  proposal: { title: string; summary: string } | null;
}
export interface EditorDesign {
  /** Kitchen plinth height in centimetres; absent retains the legacy 80 mm construction. */
  plinthHeight?: number | undefined;
  /** Specified finished assembly thicknesses (cm); absent uses selected stock or legacy construction. */
  frontThickness?: number | undefined;
  worktopThickness?: number | undefined;
  /** Installed fixed strip beside the perpendicular return, inside the overall corner cabinet width (cm). */
  cornerStrip?: number | undefined;
  /** Attached finish panel thickness at exposed kitchen run ends (cm); default 18 mm. */
  endPanelThickness?: number | undefined;
  /** Existing attached end/separator boards survive joining another cabinet. */
  endPanelSides?: (-1 | 1)[] | undefined;
  /** Nominal lower fridge door height from its front bottom (cm); zero/absent uses the legacy split. */
  fridgeSplit?: number | undefined;
  /** Purchased plinth grille outer dimensions (cm), not a manufacturer cut-out or free-area specification. */
  ventilationWidth?: number | undefined;
  ventilationHeight?: number | undefined;
  /** Real board selections; absent only in legacy designs. */
  materials?: import('../materials/configured-materials').ConfiguredMaterialsState | undefined;
  w: number; h: number; d: number; n: number; wt: number[];
  secs: EditorItem[][]; dividers: EditorDivider[];
  fin: 'Oak' | 'White' | 'Walnut' | 'Graphite' | 'Sage'; doors: 'none' | 'hinged' | 'glass';
  /** Which side single-leaf doors hinge on across the cabinet; absent means outward (each leaf hinged nearer the cabinet's end, or left for a single kitchen door). */
  doorHang?: 'left' | 'right' | undefined;
  profile: EditorProfile; proposal: EditorLayout['proposal']; reachLine?: boolean | undefined;
  /** Built-in skeleton; absent means the regular rectangular wardrobe. */
  shape?: WardrobeShape | undefined;
  /** What kind of furniture this is (domain/furniture). Absent: a wardrobe, as in every older project. */
  product?: 'kitchen' | undefined;
  /** Kitchen cabinets: which unit (base, wall or tall). */
  unit?: KitchenUnitKey | undefined;
}
