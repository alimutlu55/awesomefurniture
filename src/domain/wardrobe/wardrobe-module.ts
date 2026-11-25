import type { FurnitureModule } from '../furniture/furniture-module';
import { fittingProduct, MENU_KINDS } from './fittings';
import { MIN_CABINET_DEPTH, MIN_WARDROBE_WIDTH } from './cabinet-limits';
import { resizeHeightMinimum } from './cabinet-size-limits';
import { MAX_OUTER_HEIGHT } from './shape/wardrobe-shape';
import { allowsPresetFitting, piecePreset } from '../furniture/piece-presets';

/** Wardrobes: one carcass divided into bays of rails, drawers and shelves, planned by Auto design. */
export const WARDROBE_MODULE: FurnitureModule = {
  key: 'wardrobe', category: 'wardrobe', label: 'Wardrobe', noun: 'wardrobe', mark: 'W', addLabel: 'New wardrobe', autoDesign: true, wholeDoors: true, shaped: true,
  sizes: design => ({ w: [MIN_WARDROBE_WIDTH, 600], h: [resizeHeightMinimum(design), MAX_OUTER_HEIGHT], d: [MIN_CABINET_DEPTH, 90] }),
  allows: (kind, design) => fittingProduct(kind) === 'wardrobe' && allowsPresetFitting(piecePreset(design.piecePreset), kind),
  fittingKinds: design => {
    const preset = piecePreset(design.piecePreset);
    return preset ? MENU_KINDS.filter(kind => allowsPresetFitting(preset, kind)) : MENU_KINDS;
  },
  duplicate: design => structuredClone(design),
};
