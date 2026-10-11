/** Move and swap mode for items.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./move.ports').BindMoveModePorts} ports */
export function bindMoveMode({ dom, interactions }) {
    const { $ } = dom;
    $('#move-mode').onclick = () => interactions.armMovement('move');
}
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
/** @param {import('./move.ports').BindMoveBayPorts} ports */
export function bindMoveBay({ dom, inspector }) {
    const { $ } = dom;
    $('#move-bay').onchange = () => {
        $('#move-slot').value = '';
        inspector.moveSlotUI();
    };
}
/** @param {import('./move.ports').BindMoveSlotPorts} ports */
export function bindMoveSlot({ dom, inspector }) {
    const { $ } = dom;
    $('#move-slot').onchange = inspector.moveSlotUI;
}
/** @param {import('./move.ports').BindMoveApplyPorts} ports */
export function bindMoveApply({ dom, interactions, geometry, model }) {
    const { $ } = dom;
    $('#move-apply').onclick = () => interactions.performMove(geometry.planItemMove({ i: model.activeCabinet().state.sel, j: model.activeCabinet().state.item }, +$('#move-bay').value, +$('#move-slot').value));
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
