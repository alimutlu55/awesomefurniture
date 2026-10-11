/** Undo, redo and edit keyboard shortcuts.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./history.ports').BindUndoButtonPorts} ports */
export function bindUndoButton({ dom, inspector }) {
    const { $ } = dom;
    $('#undo2').onclick = inspector.undo;
}
/** @param {import('./history.ports').BindRedoButtonPorts} ports */
export function bindRedoButton({ dom, inspector }) {
    const { $ } = dom;
    $('#redo2').onclick = inspector.redo;
}
/** @param {import('./history.ports').BindEditShortcutsPorts} ports */
export function bindEditShortcuts({ dom, inspector, selectionState, model, commands, lifetime }) {
    const { $, window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (!(e.metaKey || e.ctrlKey) || e.altKey || !$('#wizard').hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
            return;
        }
        const k = e.key.toLowerCase();
        if (k === 'z') {
            e.preventDefault();
            e.shiftKey ? inspector.redo() : inspector.undo();
        }
        else if (k === 'y') {
            e.preventDefault();
            inspector.redo();
        }
        else if (k === 'd' && selectionState.focusOn && model.activeCabinet().state.item >= 0) {
            e.preventDefault();
            commands.duplicateItem();
        }
    });
}
