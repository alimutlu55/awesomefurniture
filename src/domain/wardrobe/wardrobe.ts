import type { EditorItem, EditorDivider, EditorLayout } from './editor-design';
import type { Dimensions, Vector3 } from '../geometry/types';
import type { WardrobeShape } from './shape/wardrobe-shape';

export type ItemKind =
  | 'drawer' | 'sdrawer' | 'void' | 'shelf' | 'folded' | 'seasonal'
  | 'short' | 'long' | 'pants' | 'shoe' | 'basket' | 'lift';

export type StoragePurpose =
  | 'free' | 'small' | 'short' | 'long' | 'pants' | 'folded'
  | 'reserve' | 'accessories' | 'shoes' | 'seasonal' | 'luggage' | 'linen' | 'laundry' | 'handbags';

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
  readonly needs: Readonly<Record<'short' | 'long' | 'pants' | 'folded' | 'shoes' | 'small', number>>;
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
}
