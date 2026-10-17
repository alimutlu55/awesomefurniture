/**
 * Furniture: the kinds of product the editor builds.
 *
 * THIS IS THE ONLY PLACE THAT LISTS FURNITURE KINDS. The Furniture toolbar, the saved-project format,
 * Add item, size limits and duplication all ask the module of the furniture they work on. To add a kind
 * of furniture, write its module (see furniture-module.ts) and add it here.
 */
import { WARDROBE_MODULE } from '../wardrobe/wardrobe-module';
import { KITCHEN_MODULE } from '../kitchen/kitchen-module';
import type { FurnitureDesign, FurnitureKind, FurnitureModule } from './furniture-module';

export type { FurnitureKind, FurnitureModule } from './furniture-module';
export const FURNITURE: readonly FurnitureModule[] = [WARDROBE_MODULE, KITCHEN_MODULE];
export const FURNITURE_KINDS = FURNITURE.map(m => m.key);

/** What kind of furniture a design is. Older projects have no product: they are wardrobes. */
export const furnitureKind = (design: Pick<FurnitureDesign, 'product'>): FurnitureKind => design.product ?? 'wardrobe';
export const furnitureModule = (design: Pick<FurnitureDesign, 'product'>): FurnitureModule =>
  FURNITURE.find(m => m.key === furnitureKind(design)) ?? WARDROBE_MODULE;
export const isKitchen = (design: Pick<FurnitureDesign, 'product'>) => furnitureKind(design) === 'kitchen';
