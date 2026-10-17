import type { EditorDesign } from '../wardrobe/editor-design';
import type { FittingKind } from '../wardrobe/fittings';

export type FurnitureKind = 'wardrobe' | 'kitchen';
export type SizeRange = readonly [number, number];
/** The parts of a design a module reads to decide its rules. */
export type FurnitureDesign = Pick<EditorDesign, 'w' | 'h' | 'n' | 'wt' | 'shape' | 'product' | 'unit'>;

/**
 * What makes one kind of furniture different from another. The editor's shared tools (moving,
 * resizing, shaping, sections, undo, the room) ask the module of the selected furniture instead of
 * knowing wardrobes or kitchens. A new kind of furniture is one module and one entry in furniture.ts.
 */
export interface FurnitureModule {
  readonly key: FurnitureKind;
  /** Toolbar and panel name, and the word for one of them in messages. */
  readonly label: string;
  readonly noun: string;
  /** Auto design can plan its contents. */
  readonly autoDesign: boolean;
  /** Doors across the whole front (wardrobes); otherwise each fitting shows its own front. */
  readonly wholeDoors: boolean;
  /** New ones can start from a shape template (sloped, stepped...). */
  readonly shapes: boolean;
  /** Outer width, height and depth limits in centimetres. */
  sizes(design: FurnitureDesign): { readonly w: SizeRange; readonly h: SizeRange; readonly d: SizeRange };
  /** Whether a fitting kind can go inside it. */
  allows(kind: string, design: FurnitureDesign): boolean;
  /** The kinds Add item offers, in menu order. */
  fittingKinds(design: FurnitureDesign): readonly FittingKind[];
  /** The design a duplicate starts from. */
  duplicate<T extends EditorDesign>(design: T): T;
}
