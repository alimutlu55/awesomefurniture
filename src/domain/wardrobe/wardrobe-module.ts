import type { FurnitureModule } from '../furniture/furniture-module';
import { fittingProduct, MENU_KINDS } from './fittings';
import { MIN_CABINET_DEPTH } from './cabinet-limits';
import { resizeHeightMinimum } from './cabinet-size-limits';
import { MAX_OUTER_HEIGHT } from './shape/wardrobe-shape';

/** Wardrobes: one carcass divided into bays of rails, drawers and shelves, planned by Auto design. */
export const WARDROBE_MODULE: FurnitureModule = {
  key: 'wardrobe', label: 'Wardrobe', noun: 'wardrobe', mark: 'W', addLabel: 'New wardrobe', autoDesign: true, wholeDoors: true, shaped: true,
  sizes: design => ({ w: [80, 600], h: [resizeHeightMinimum(design), MAX_OUTER_HEIGHT], d: [MIN_CABINET_DEPTH, 90] }),
  allows: kind => fittingProduct(kind) === 'wardrobe',
  fittingKinds: () => MENU_KINDS,
  duplicate: design => structuredClone(design),
};
