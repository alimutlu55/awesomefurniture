import { createDividerCommands } from './divider-commands';
import { createDividerAlign } from './divider-align';
import { createSizingCommands } from './sizing-commands';
import { createItemCommands } from './item-commands';
import { createLayoutCommands } from './layout-commands';
import { createAppearanceCommands } from './appearance-commands';
import { createCommandWorkflow } from './command-workflow';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import type { EditorState } from '../projects/editor-scene';
import type { CommandEffects } from './command-effects';
import { isRegularShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { MODS, PANEL } from '../../domain/wardrobe/catalog.js';
import { plinthOf } from '../../domain/wardrobe/carcass';
import { furnitureModule } from '../../domain/furniture/furniture';
import type { ItemKind } from '../../domain/wardrobe/wardrobe';
import { AUTO_ALIGN_CM } from '../../domain/geometry/alignment';
/** Compatibility facade: compose independent command families around one workflow. */
export function createDesignCommands(getDesign: () => EditorState, supplied: CommandEffects = {}) {
    const { effects, run } = createCommandWorkflow(getDesign, supplied);
    const rules = createWardrobeGeometry(getDesign, effects.getBudget);
    const dividers = createDividerCommands({ getDesign, effects, rules, run });
    const dividerAlign = createDividerAlign({ getDesign, rules, moveDividerTo: dividers.moveDividerTo });
    const setDividerClearance: typeof dividers.setDividerClearance = (index, side, value) => {
        if (!Number.isFinite(value) || value < 0 || side !== 'before' && side !== 'after') return false;
        const moved = dividers.setDividerClearance(index, side, value), d = getDesign().dividers?.[index];
        if (!d) return moved;
        const raw = d.orientation === 'horizontal' ? d.y : d.x;
        const aligned = raw === undefined ? null : dividerAlign.alignDividerTo(index, raw, { tolerance: AUTO_ALIGN_CM });
        return !!(moved || aligned?.moved);
    };
    const sizing = createSizingCommands({ getDesign, effects, rules });
    const items = createItemCommands({ getDesign, effects, rules, run, callbacks: { addShelfBoard: dividers.addShelfBoard } });
    const layouts = createLayoutCommands({ getDesign, effects, rules });
    const appearance = createAppearanceCommands({ getDesign, effects, run });
    const shaped = () => !isRegularShape(getDesign().shape);
    /** Outer height a bay planner should assume: the lowest clear point across the bay. */
    const bayHeight = (i: number) => Math.floor(rules.ceilingIn(i, 0, rules.widths()[i]!) + plinthOf(getDesign()) + 2 * PANEL);
    /** Auto design plans under the wardrobe's top (see planner/bay-ceilings.ts) and keeps bays that
     * steps are anchored to, so the chosen idea is applied as it is. The fit is a safety net: it says
     * so if anything still had to change. */
    const applyProposal: typeof layouts.applyProposal = (p, selected) => {
        if (!planned()) return;
        layouts.applyProposal(p, selected);
        if (shaped()) sizing.fitToShape();
    };
    const autofill: typeof layouts.autofill = i => {
        if (!planned()) return;
        if (!shaped()) return layouts.autofill(i);
        layouts.autofill(i, bayHeight(i));
        sizing.fitToShape();
    };
    /** A fitting goes only in the furniture it belongs to: no rail in a kitchen cabinet, no sink in a wardrobe. */
    const refused = (k: ItemKind) => {
        const module = furnitureModule(getDesign());
        if (module.allows(k, getDesign())) return false;
        effects.report(MODS[k].n + ' does not go in a ' + (getDesign().unit ? getDesign().unit + ' ' : '') + module.noun);
        return true;
    };
    const addMod: typeof items.addMod = k => { if (!refused(k)) items.addMod(k); };
    const editItem: typeof items.editItem = (i, j, edit) => edit.kind && refused(edit.kind) ? false : items.editItem(i, j, edit);
    /** Only furniture that Auto design plans can have a bay filled for it. */
    const planned = () => {
        if (furnitureModule(getDesign()).autoDesign) return true;
        effects.report('Auto design plans wardrobes. Add drawers, doors and appliances to a cabinet with Add item.');
        return false;
    };
    // Section changes validate detached geometry before committing; a shape refit
    // afterward could compact or remove the very fittings the command preserves.
    const changeSections: typeof layouts.changeSections = delta => layouts.changeSections(delta);
    return { run, ...dividers, ...dividerAlign, setDividerClearance, ...sizing, ...items, addMod, editItem,
        ...layouts, applyProposal, autofill, changeSections, ...appearance };
}
