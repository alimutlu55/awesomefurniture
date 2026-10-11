import { createDividerCommands } from './divider-commands';
import { createSizingCommands } from './sizing-commands';
import { createItemCommands } from './item-commands';
import { createLayoutCommands } from './layout-commands';
import { createAppearanceCommands } from './appearance-commands';
import { createCommandWorkflow } from './command-workflow';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import type { EditorState } from '../projects/editor-scene';
import type { CommandEffects } from './command-effects';
import { isRegularShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
/** Compatibility facade: compose independent command families around one workflow. */
export function createDesignCommands(getDesign: () => EditorState, supplied: CommandEffects = {}) {
    const { effects, run } = createCommandWorkflow(getDesign, supplied);
    const rules = createWardrobeGeometry(getDesign, effects.getBudget);
    const dividers = createDividerCommands({ getDesign, effects, rules, run });
    const sizing = createSizingCommands({ getDesign, effects, rules });
    const items = createItemCommands({ getDesign, effects, rules, run, callbacks: { addShelfBoard: dividers.addShelfBoard } });
    const layouts = createLayoutCommands({ getDesign, effects, rules });
    const appearance = createAppearanceCommands({ getDesign, effects, run });
    const shaped = () => !isRegularShape(getDesign().shape);
    /** Outer height a bay planner should assume: the lowest clear point across the bay. */
    const bayHeight = (i: number) => Math.floor(rules.ceilingIn(i, 0, rules.widths()[i]!) + PLINTH + 2 * PANEL);
    /** Auto design plans under the wardrobe's top (see planner/bay-ceilings.ts) and keeps bays that
     * steps are anchored to, so the chosen idea is applied as it is. The fit is a safety net: it says
     * so if anything still had to change. */
    const applyProposal: typeof layouts.applyProposal = (p, selected) => {
        layouts.applyProposal(p, selected);
        if (shaped()) sizing.fitToShape();
    };
    const autofill: typeof layouts.autofill = i => {
        if (!shaped()) return layouts.autofill(i);
        layouts.autofill(i, bayHeight(i));
        sizing.fitToShape();
    };
    const changeSections: typeof layouts.changeSections = delta => {
        layouts.changeSections(delta);
        if (!shaped()) return;
        sizing.fitToShape();
        effects.changed();
    };
    return { run, ...dividers, ...sizing, ...items, ...layouts, applyProposal, autofill, changeSections, ...appearance };
}
