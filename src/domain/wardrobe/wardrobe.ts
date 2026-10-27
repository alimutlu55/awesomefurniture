import type { EditorItem, EditorDivider, EditorLayout } from './editor-design';
import type { Dimensions, Vector3 } from '../geometry/types';
import type { WardrobeShape } from './shape/wardrobe-shape';
import type { Needs } from './possessions';
import type { Purpose } from './purposes';
import type { FittingKind } from './fittings';
import type { KitchenUnitKey } from '../kitchen/kitchen-units';

/** Fitting kinds come from the fittings registry (fittings.ts). */
export type ItemKind = FittingKind;

export type StoragePurpose = Purpose;

export interface WardrobeItem {
  readonly editorItem?: EditorItem | undefined;
  readonly id: string;
  readonly kind: ItemKind;
  readonly purpose: StoragePurpose;
  readonly width: number;
  readonly height: number;
  /** Coordinates relative to the section's internal bottom-left corner. */
  readonly x: number;
  readonly y: number;
  readonly frontFacing: boolean;
  readonly boxes: number | null;
}

export interface Divider {
  readonly editorDivider?: EditorDivider | undefined;
  readonly id: string;
  readonly orientation: 'horizontal' | 'vertical';
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly thickness: number;
}

export interface Section {
  readonly id: string;
  readonly width: number;
  readonly items: readonly WardrobeItem[];
  readonly dividers: readonly Divider[];
}

export interface WardrobePreferences {
  readonly boxWidth?: number | undefined;
  readonly boxHeight?: number | undefined;
  readonly boxDepth?: number | undefined;
  readonly composition?: 'balanced' | 'storage' | undefined;
  /** Possessions added after the first release are optional so older projects still open. */
  readonly needs: Needs;
  readonly reach: number;
  readonly longDrop: number;
  readonly upper: 'none' | 'auto' | 'more' | 'fill';
  readonly drawers: 'none' | 'auto' | 'more';
  readonly allowLift: boolean;
  readonly density: 'compact' | 'comfort' | 'spacious';
  readonly growth: number;
  readonly jackets: number;
  readonly coats: number;
  readonly accessible: boolean;
  readonly budget: number;
}

export interface Wardrobe {
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
  readonly editorLayout?: EditorLayout | undefined;
  readonly id: string;
  readonly name: string;
  readonly dimensions: Dimensions;
  readonly position: Vector3;
  readonly rotation: number;
  readonly finish: 'Oak' | 'White' | 'Walnut' | 'Graphite' | 'Sage';
  readonly doors: 'none' | 'solid' | 'glass';
  readonly sections: readonly Section[];
  readonly preferences: WardrobePreferences;
  /** Built-in skeleton; absent for regular rectangular wardrobes (and older projects). */
  readonly shape?: WardrobeShape | undefined;
  /** What kind of furniture this is (domain/furniture). Absent: a wardrobe, as in every older project. */
  readonly product?: 'kitchen' | undefined;
  /** Kitchen cabinets: which unit (base, wall or tall). */
  readonly unit?: KitchenUnitKey | undefined;
}
