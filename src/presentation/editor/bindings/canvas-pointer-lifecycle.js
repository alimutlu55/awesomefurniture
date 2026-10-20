/** Canvas pointer ownership is independent of the drag tool that handles a press. */
/** @param {Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'ptrs'>} state
 * @param {HTMLCanvasElement} canvas @param {number} id */
export function releaseCanvasPointer(state, canvas, id) {
    state.ptrs.delete(id);
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}

/** Abort the entire session: any remaining ups belong to this cancelled gesture,
 * so none may select or commit. A fresh down starts with no stale pointer or latch.
 * @param {import('./canvas.ports').BindCanvasPointercancelPorts} ports */
export function cancelCanvasSession({ touch, interactions, interactionState, resources, room, kitchenArray }) {
    const ids = [...interactionState.ptrs.keys()];
    if (interactionState.panGesture) ids.push(interactionState.panGesture.id);
    interactionState.ptrs.clear();
    interactionState.panGesture = null;
    interactionState.rotationClick = false;
    interactionState.moved = 99;
    touch.release(); touch.stopFollowing();
    kitchenArray?.holdCancel();
    if (kitchenArray?.active()) kitchenArray.end(true);
    if (room?.dragging()) room.end(true);
    if (interactionState.dividerGesture) interactions.finishDividerDrag(true);
    if (interactionState.wardrobeGesture) interactions.finishWardrobeDrag(true);
    if (interactionState.rotationGesture) interactions.finishRotation(true);
    interactions.cancelMovement();
    for (const id of ids) releaseCanvasPointer(interactionState, resources.cv, id);
}

/** @param {import('./canvas.ports').BindCanvasPointercancelPorts} ports */
export function bindCanvasPointercancel(ports) {
    ports.lifetime.listen(ports.resources.cv, 'pointercancel', () => cancelCanvasSession(ports));
}
/** @param {import('./canvas.ports').BindCanvasLostpointercapturePorts} ports */
export function bindCanvasLostpointercapture(ports) {
    ports.lifetime.listen(ports.resources.cv, 'lostpointercapture', e => {
        // Normal completion removes the pointer before releasing capture.
        if (ports.interactionState.ptrs.has(e.pointerId) || ports.interactionState.panGesture?.id === e.pointerId) cancelCanvasSession(ports);
    });
}
/** @param {import('./canvas.ports').BindCanvasGestureBlurPorts} ports */
export function bindCanvasGestureBlur(ports) {
    ports.lifetime.listen(ports.dom.window, 'blur', () => cancelCanvasSession(ports));
}
