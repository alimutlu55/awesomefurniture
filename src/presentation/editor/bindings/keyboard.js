import { MODS } from '../../../domain/wardrobe/catalog.js';
/** Escape and other global keys.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./keyboard.ports').BindEscapeKeyPorts} ports */
export function bindEscapeKey({ dom, interactions, inspector, planner, shell, interactionState, selectionState, model, commands, lifetime }) {
    const { $, window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (e.key === 'Escape') {
            if (interactionState.drag || interactionState.moveMode) {
                interactionState.ptrs.clear();
                interactionState.moved = 99;
                interactions.cancelMovement();
                shell.toast('Move cancelled.');
                return;
            }
            if (!$('#wizard').hidden) {
                inspector.hidePop();
                planner.closeWizard();
            }
            else if ($('#app').classList.contains('props-open')) {
                $('#left-close').click();
                return;
            }
            else if (model.activeCabinet().state.item >= 0 || model.activeCabinet().state.divider >= 0) {
                inspector.goUp('section');
            }
            else if (selectionState.deep && selectionState.focusOn) {
                inspector.goUp('wardrobe');
            }
            else {
                inspector.clearFocus();
            }
        }
        if (!$('#wizard').hidden || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) {
            return;
        }
        const k = e.key.toLowerCase();
        if (e.shiftKey && model.activeCabinet().state.item >= 0 && e.key.startsWith('Arrow')) {
            e.preventDefault();
            interactions.keyboardMove(e.key);
            return;
        }
        // A selected divider or shelf moves 1 cm with Shift and the arrows across it (up and down for a shelf).
        if (e.shiftKey && model.activeCabinet().state.divider >= 0 && e.key.startsWith('Arrow')) {
            const state = model.activeCabinet().state, divider = state.dividers?.[state.divider];
            const hor = divider?.orientation === 'horizontal';
            const dir = hor ? (e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0) : (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
            e.preventDefault();
            if (divider && dir) commands.run(() => commands.moveDividerTo(state.divider, (hor ? divider.y : divider.x) + dir));
            return;
        }
        if (e.key === 'ArrowRight') {
            model.activeCabinet().state.sel = (model.activeCabinet().state.sel + 1) % model.activeCabinet().state.n;
            model.activeCabinet().state.item = -1;
            selectionState.deep = selectionState.pillOn = true;
            inspector.update();
        }
        else if (e.key === 'ArrowLeft') {
            model.activeCabinet().state.sel = (model.activeCabinet().state.sel + model.activeCabinet().state.n - 1) % model.activeCabinet().state.n;
            model.activeCabinet().state.item = -1;
            selectionState.deep = selectionState.pillOn = true;
            inspector.update();
        }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = model.activeCabinet().state.secs[model.activeCabinet().state.sel].length;
            if (n) {
                model.activeCabinet().state.item = Math.max(0, Math.min(n - 1, (model.activeCabinet().state.item < 0 ? (e.key === 'ArrowUp' ? -1 : n) : model.activeCabinet().state.item) + (e.key === 'ArrowUp' ? 1 : -1)));
                inspector.update();
            }
        }
        else if (e.key === 'Backspace' || (e.key === 'Delete' && model.activeCabinet().state.item >= 0)) {
            e.preventDefault();
            if (selectionState.focusOn) {
                commands.removeTop();
            }
            else {
                inspector.update();
            }
        }
        else {
            const m = Object.keys(MODS).find(x => MODS[x].k.toLowerCase() === k);
            if (m) {
                commands.addMod(/** @type {import('../../../domain/wardrobe/wardrobe').ItemKind} */ (m));
            }
        }
    });
}
