import type { EditorState } from '../projects/editor-scene';
import type { ItemKind } from '../../domain/wardrobe/wardrobe';
import { fitting, hasTrait } from '../../domain/wardrobe/fittings';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { smallestFront, takesWholeFront, wholeFrontProblem } from '../../domain/kitchen/kitchen-fit';

type Rules = Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>,
  'computeLayout' | 'free' | 'ih' | 'interiorFloor' | 'itemFreeAbove' | 'sectionDividers' | 'sectionLayoutValid' | 'sectionSpaceMeasurements' | 'widths'>;

/**
 * Keeps a kitchen unit's fronts closed (domain/kitchen/kitchen-fit.ts): a whole front goes only into an empty unit, a
 * resize grows the fronts that filled the unit with it, and a unit holding an appliance or mechanism made in set widths
 * grows no wider than that. Wardrobes are left as they are.
 */
export function createKitchenFitCommands({ getDesign, rules, report }: { getDesign(): EditorState; rules: Rules; report(message: string): void }) {
  const kitchen = () => getDesign().product === 'kitchen';
  const unit = () => getDesign().unit ?? 'base';

  /** Height open where Add item puts a fitting (the same choice as `addMod0` in item-commands.ts). */
  function openHeight() {
    const d = getDesign(), i = d.sel, selected = d.item >= 0 ? d.secs[i]?.[d.item] : undefined;
    if (d.item < 0 && (d.space?.i === i || rules.sectionDividers(i).length)) return rules.sectionSpaceMeasurements(i).h;
    return selected?.w ? rules.itemFreeAbove(i, d.item) : rules.free(i);
  }

  /** Why `k` cannot be added to the selected kitchen unit, or ''. */
  function addProblem(k: ItemKind) {
    if (!kitchen() || !wholeFrontProblem(k, unit(), openHeight(), rules.ih(getDesign().sel))) return '';
    return fitting(k)!.name + ' takes the whole front of this cabinet. Remove what is in it first.';
  }

  /**
   * Close the strips of open carcass in bay `i`: a fitting with a gap above it lower than any front the unit can hold
   * (or that was, before the unit grew `grownBy` cm taller), or a whole front, grows to close it within its own maximum.
   */
  function closeGaps(i: number, grownBy = 0) {
    if (!kitchen()) return;
    const sec = getDesign().secs[i] ?? [], small = smallestFront(unit()), top = rules.ih(i);
    sec.forEach((it, j) => {
      const free = rules.itemFreeAbove(i, j), q = rules.computeLayout(i)[j];
      if (free <= .05 || !q) return;
      const was = Math.abs(q.relY1 + free - top) < .05 ? free - grownBy : free;
      if (was >= small - .01 && !takesWholeFront(it.k, unit())) return;
      const h = Math.min(fitting(it.k)?.max ?? it.h, Math.round((it.h + free) * 100) / 100), old = it.h;
      if (h <= old + .001) return;
      it.h = h;
      if (!rules.sectionLayoutValid(i)) it.h = old;
    });
  }

  /** The widest the kitchen unit can be while every fitting across a whole bay stays within the width it is
   * made in (an oven housing stays an oven housing). Infinity when nothing limits it. */
  function widestWidth() {
    if (!kitchen()) return Infinity;
    const d = getDesign(), ws = rules.widths().slice(0, d.n), inner = ws.reduce((s, w) => s + w, 0);
    let most = Infinity;
    ws.forEach((w, i) => {
      const limit = Math.min(...(d.secs[i] ?? []).filter(it => !it.w || it.w >= w - .01).map(it => fitting(it.k)?.maxWidth ?? Infinity));
      if (Number.isFinite(limit) && w > 0) most = Math.min(most, limit * inner / w);
    });
    return Number.isFinite(most) ? Math.floor((most + (d.n + 1) * PANEL) * 10) / 10 : Infinity;
  }

  /** `requested` width, or the widest the unit can be for what it holds (never narrower than it is now). */
  function limitWidth(requested: number) {
    const widest = Math.max(getDesign().w, widestWidth());
    if (requested <= widest + .001) return requested;
    report('Widest this cabinet can be for what it holds: ' + widest + ' cm');
    return widest;
  }

  /**
   * A hob's drawer sits right under the worktop it is set in: when Add item has put a fitting the worktop holds into bay
   * `i` (the item not in `before`), it rises to the top of the open space above it, and the space below it is selected
   * for the next fitting (drawers under the hob).
   */
  function underWorktop(i: number, before: readonly string[]) {
    const sec = getDesign().secs[i] ?? [], keys = sec.map(it => JSON.stringify(it));
    const j = keys.findIndex((_, n) => JSON.stringify(keys.filter((__, m) => m !== n)) === JSON.stringify(before));
    const it = sec[j], q = rules.computeLayout(i)[j];
    if (!kitchen() || !it || !q || !hasTrait(it.k, 'worktop') || takesWholeFront(it.k, unit())) return false;
    const free = rules.itemFreeAbove(i, j), was = it.y;
    if (free < .05) return false;
    it.y = Math.round((q.relY0 + free) * 100) / 100;
    if (!rules.sectionLayoutValid(i)) { if (was === undefined) delete it.y; else it.y = was; return false; }
    getDesign().space = { i, x: (q.x0 + q.x1) / 2, y: rules.interiorFloor() + q.relY0 + free / 2 };
    return true;
  }

  return { addProblem, closeGaps, limitWidth, underWorktop };
}
