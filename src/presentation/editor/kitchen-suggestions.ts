import { fitting, hasTrait, type FittingKind } from '../../domain/wardrobe/fittings';
import { furnitureModule } from '../../domain/furniture/furniture';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import type { EditorState } from '../../application/projects/editor-scene';
import type { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { measureNumber, unitSuffix } from './editor-format.js';

type Rules = Pick<ReturnType<typeof createWardrobeGeometry>, 'effectiveMin' | 'itemFeasible' | 'sectionSpaceMeasurements' | 'spaceSpan'>;

/** Add item cards for a space in a kitchen unit: the fittings its unit allows, ranked by the fittings registry
 * (`kitchen.score`), with the reason it gives and a hint when one does not fit. A unit's sink or hob is
 * suggested once: a second one goes last. Same shape as the wardrobe suggestions (add-suggestions.js). */
export function kitchenSuggestions(design: Pick<EditorState, 'sel' | 'n' | 'd' | 'secs' | 'unit' | 'product' | 'w' | 'h' | 'wt' | 'shape'>, rules: Rules) {
  const sp = rules.sectionSpaceMeasurements(design.sel), w = sp.w, H = sp.h, unit = kitchenUnit(design.unit);
  const has = (k: FittingKind) => design.secs.slice(0, design.n).some(items => items.some(it => it.k === k));
  const list = furnitureModule(design).fittingKinds(design).map((k, o) => {
    const def = fitting(k)!, mn = rules.effectiveMin(k);
    const fit = rules.itemFeasible(k, w) && mn <= H + .01 && !!rules.spaceSpan(design.sel, sp, mn, def.minWidth);
    const needs = (cm: number, what: string) => 'Needs ' + measureNumber(cm) + unitSuffix() + ' ' + what;
    const hint = fit ? '' : w < def.minWidth - .01 ? needs(def.minWidth, 'width') : design.d < def.minDepth ? needs(def.minDepth, 'depth') : needs(mn, 'height');
    const s = def.kitchen!.score - (hasTrait(k, 'worktop') && has(k) ? 40 : 0);
    return { k: k as string, o, fit, s, why: def.kitchen!.why, hint, warn: false };
  });
  const divider = (w - PANEL) / 2 >= 25;
  list.push({ k: 'divider', o: list.length, fit: divider, s: w >= 80 ? 35 : 10, why: 'Splits this space side by side', hint: divider ? '' : 'Space too narrow', warn: false });
  const intent = '<b>Inside the ' + unit.name.toLowerCase() + '.</b> Drawers, doors and shelves' + (unit.worktop ? ', or a sink or hob under the worktop.' : '.');
  return { list, intent };
}
