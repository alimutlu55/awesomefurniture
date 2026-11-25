import type { FurnitureModule } from '../furniture/furniture-module';
import { fitting, KITCHEN_MENU_KINDS } from '../wardrobe/fittings';
import { kitchenUnit } from './kitchen-units';
import { createKitchenDesign, duplicateKitchenDesign, isCoverUnit } from './kitchen-design';

/** Kitchen cabinets: modular base, wall and tall units that share a worktop and plinth along a run.
 * Their fronts are the fittings themselves (drawers, doors, appliances), so there are no whole-front doors. */
export const KITCHEN_MODULE: FurnitureModule = {
  key: 'kitchen', category: 'kitchen', label: 'Cabinets', noun: 'cabinet', mark: 'K', addLabel: 'Add cabinet', autoDesign: false, wholeDoors: false, shaped: false,
  sizes: design => {
    const base = kitchenUnit(design.unit).sizes;
    return isCoverUnit(design) ? { ...base, w: [5, base.w[1]] } : base;
  },
  allows: (kind, design) => (fitting(kind)?.kitchen?.units as readonly string[] | undefined)?.includes(kitchenUnit(design.unit).key) ?? false,
  fittingKinds: design => KITCHEN_MENU_KINDS.filter(k => KITCHEN_MODULE.allows(k, design)),
  duplicate: duplicateKitchenDesign,
  reset: design => {
    const unit = design.unit ?? 'base', empty = createKitchenDesign(unit, unit);
    // The fixed panels make a cover unit fit its gap and define its usable width range.
    return isCoverUnit(design) ? { ...empty, n: design.n, wt: design.wt, secs: design.secs } : empty;
  },
};
