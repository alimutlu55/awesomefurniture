import type { EditorState } from '../projects/editor-scene';
import type { CommandEffects } from './command-effects';
/** Shared history and refresh hooks; command families own validation and mutations. */
export function createCommandWorkflow(getDesign: () => EditorState, supplied: CommandEffects = {}) {
    const effects: Required<CommandEffects> = {
        getBudget: supplied.getBudget ?? (() => 900),
        report: supplied.report ?? (() => { }), changed: supplied.changed ?? (() => { }),
        checkpoint: supplied.checkpoint ?? (() => { }), discardCheckpoint: supplied.discardCheckpoint ?? (() => { }),
        closeInspector: supplied.closeInspector ?? (() => { }), milestone: supplied.milestone ?? (() => { }),
        selectionChanged: supplied.selectionChanged ?? (() => { }), requestUndo: supplied.requestUndo ?? (() => { }),
    };
    return {
        effects,
        run(mutate: () => void): void {
            effects.checkpoint();
            getDesign().proposal = null;
            mutate();
            effects.changed();
        }
    };
}
