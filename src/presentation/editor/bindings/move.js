/** Swap mode for items, and the keys that preview a drag while Shift is held.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./move.ports').BindSwapModePorts} ports */
export function bindSwapMode({ dom, interactions }) {
    const { $ } = dom;
    $('#swap-mode').onclick = () => interactions.armMovement('swap');
}
/** @param {import('./move.ports').BindMoveCancelPorts} ports */
export function bindMoveCancel({ dom, interactions }) {
    const { $ } = dom;
    $('#move-cancel').onclick = interactions.cancelMovement;
}
/** @param {import('./move.ports').BindMovePreviewKeydownPorts} ports */
export function bindMovePreviewKeydown({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (e.key === 'Shift' && interactionState.lastMoveEvent && (interactionState.drag?.started || interactionState.moveMode)) {
            interactions.previewAt({ ...interactionState.lastMoveEvent, clientX: interactionState.lastMoveEvent.clientX, clientY: interactionState.lastMoveEvent.clientY, shiftKey: true });
        }
    });
}
/** @param {import('./move.ports').BindMovePreviewKeyupPorts} ports */
export function bindMovePreviewKeyup({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keyup', e => {
        if (e.key === 'Shift' && interactionState.lastMoveEvent && (interactionState.drag?.started || interactionState.moveMode)) {
            interactions.previewAt({ clientX: interactionState.lastMoveEvent.clientX, clientY: interactionState.lastMoveEvent.clientY, shiftKey: false });
        }
    });
}
