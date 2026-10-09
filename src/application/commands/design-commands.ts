import { createDividerCommands } from './divider-commands';
import { createSizingCommands } from './sizing-commands';
import { createItemCommands } from './item-commands';
import { createLayoutCommands } from './layout-commands';
import { createAppearanceCommands } from './appearance-commands';
import { createCommandWorkflow } from './command-workflow';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import type { EditorState } from '../projects/editor-scene';
import type { CommandEffects } from './command-effects';
/** Compatibility facade: compose independent command families around one workflow. */
export function createDesignCommands(getDesign: () => EditorState, supplied: CommandEffects = {}) {
    const { effects, run } = createCommandWorkflow(getDesign, supplied);
    const rules = createWardrobeGeometry(getDesign, effects.getBudget);
    const dividers = createDividerCommands({ getDesign, effects, rules, run });
    const sizing = createSizingCommands({ getDesign, effects, rules });
    const items = createItemCommands({ getDesign, effects, rules, run, callbacks: { addShelfBoard: dividers.addShelfBoard } });
    const layouts = createLayoutCommands({ getDesign, effects, rules });
    const appearance = createAppearanceCommands({ getDesign, effects, run });
    return { run, ...dividers, ...sizing, ...items, ...layouts, ...appearance };
}
