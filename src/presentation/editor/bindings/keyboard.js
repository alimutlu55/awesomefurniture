import { quarterTurnCabinet } from '../../../application/commands/cabinet-turn';
import { cabinetPiece } from '../../../domain/pieces/pieces';
import { MODS } from '../../../domain/wardrobe/catalog.js';
import { chosenLeaf } from '../selection-state.js';
/** Escape and other global keys.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./keyboard.ports').BindEscapeKeyPorts} ports */
export function bindEscapeKey({ dom, interactions, inspector, planner, shell, interactionState, selectionState, model, commands, sceneCommands, history, make, lifetime }) {
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
            else if (chosenLeaf(selectionState, model.scene.activeWardrobe, model.activeCabinet().state)) {
                // A chosen door leaf lets go first, back to the bay it closes.
                selectionState.leaf = null;
                inspector.update();
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
        if (k === 'r' && selectionState.studioView !== '2d' && selectionState.focusOn && !selectionState.room && !make.active) {
            const app = $('#app'), root = /** @type {Document | ShadowRoot} */ (app.getRootNode());
            const target = root.activeElement ?? e.target;
            if (target?.closest?.('input,select,textarea,[contenteditable],.contextual-popover') || app.dataset.scrubbing !== undefined) return;
            if (interactionState.drag || interactionState.moveMode || interactionState.wardrobeGesture || interactionState.rotationGesture) return;
            const cabinet = model.scene.wardrobes.find(c => c.id === model.scene.activeWardrobe);
            if (!cabinet || cabinet.state.item >= 0 || cabinet.state.divider >= 0 || chosenLeaf(selectionState, cabinet.id, cabinet.state)
                || !cabinetPiece(cabinet).capabilities.turnable) return;
            e.preventDefault();
            if (e.repeat) return;
            const snapshot = model.snapshot();
            if (quarterTurnCabinet(cabinet, sceneCommands)) history.checkpoint(snapshot);
            inspector.update(true);
            return;
        }
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
