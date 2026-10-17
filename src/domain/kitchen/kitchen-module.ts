import type { FurnitureModule } from '../furniture/furniture-module';
import { fitting, KITCHEN_MENU_KINDS } from '../wardrobe/fittings';
import { kitchenUnit } from './kitchen-units';
import { duplicateKitchenDesign } from './kitchen-design';

/** Kitchen cabinets: modular base, wall and tall units that share a worktop and plinth along a run.
 * Their fronts are the fittings themselves (drawers, doors, appliances), so there are no whole-front doors. */
export const KITCHEN_MODULE: FurnitureModule = {
  key: 'kitchen', label: 'Cabinets', noun: 'cabinet', addLabel: 'Add cabinet', autoDesign: false, wholeDoors: false, shapes: false,
  sizes: design => kitchenUnit(design.unit).sizes,
  allows: (kind, design) => (fitting(kind)?.kitchen?.units as readonly string[] | undefined)?.includes(kitchenUnit(design.unit).key) ?? false,
  fittingKinds: design => KITCHEN_MENU_KINDS.filter(k => KITCHEN_MODULE.allows(k, design)),
  duplicate: duplicateKitchenDesign,
};
