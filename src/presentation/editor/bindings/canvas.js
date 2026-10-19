/** Pointer and wheel gestures on the 3D canvas: select, orbit, drag, rotate, zoom.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** DOM event bindings call application commands through the mounted view ports. */
/** @param {import('./canvas.ports').ObserveViewportSizePorts} ports */
export function observeViewportSize({ dom, camera, lifetime }) {
    const { $ } = dom;
    lifetime.observe(new ResizeObserver(camera.resize), $('#view'));
}
/** @param {import('./canvas.ports').BindCanvasPointerdownPorts} ports */
export function bindCanvasPointerdown({ dom, camera, touch, interactions, inspector, picking, interactionState, renderState, selectionState, resources, model, lifetime, room, kitchenArray }) {
    // The right button pans; it opens no menu on the model.
    lifetime.listen(resources.cv, 'contextmenu', e => e.preventDefault());
    lifetime.listen(resources.cv, 'pointerdown', e => {
        camera.camRelease();
        if (interactionState.rotationGesture) {
            interactionState.rotationClick = true;
            interactions.finishRotation();
            return;
        }
        // Right or middle button: pan the view.
        if (e.button === 1 || e.button === 2) {
            e.preventDefault();
            interactionState.panGesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
            resources.cv.setPointerCapture(e.pointerId);
            return;
        }
        if (e.button !== 0) {
            return;
        }
        // A second finger while a room part is dragged: put it back and pinch or pan instead.
        if (room?.dragging()) room.end(true);
        // The selected wall, door, window or ceiling is dragged by its own surface, unless a wardrobe is in front.
        if (interactionState.ptrs.size === 0 && room?.grab(e, picking.cast(e, renderState.allHits))) {
            resources.cv.focus({ preventScroll: true });
            return;
        }
        // A second pointer always joins the camera gesture before hit testing.
        if (interactionState.ptrs.size > 0) {
            interactionState.pendingFurniture = null;
            touch.release();
            kitchenArray?.holdCancel();
            if (kitchenArray?.active()) kitchenArray.end(true);
            resources.cv.setPointerCapture(e.pointerId);
            interactionState.ptrs.set(e.pointerId, e);
            if (interactionState.wardrobeGesture) interactions.finishWardrobeDrag(true);
            interactions.cancelMovement();
            camera.camRelease();
            interactionState.moved = 99;
            const [a, b] = [...interactionState.ptrs.values()];
            interactionState.pd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            return;
        }
        // Inside the chosen wardrobe, an item or a divider is dragged by a press, by mouse or finger.
        const chosen = selectionState.focusOn;
        const part = chosen && !selectionState.shapeEditing ? picking.cast(e, renderState.ihits)?.object ?? null : null;
        const onPart = !!part && part.userData.wardrobe === model.scene.activeWardrobe;
        // Anywhere else on a wardrobe or cabinet, a press then a drag moves the whole piece, chosen or not; the view
        // stays put. It starts once the pointer moves, so a tap still chooses it as before.
        const body = !onPart && !selectionState.shapeEditing ? picking.cast(e, renderState.allHits)?.object.userData.wardrobe : undefined;
        interactionState.pendingFurniture = body !== undefined && !(chosen && body === model.scene.activeWardrobe && !inspector.inside())
            ? { id: body, event: e } : null;
        const doorsShut = model.activeCabinet().state.doors !== 'none' && !model.activeCabinet().state.open;
        if (onPart && part.userData.divider !== undefined && !doorsShut) {
            // Pressing a divider selects it, as a tap does, then drags it.
            const active = model.activeCabinet().state;
            active.divider = part.userData.divider;
            active.sel = part.userData.i;
            active.item = -1;
            selectionState.deep = true;
            selectionState.pillOn = false;
            inspector.update();
            resources.cv.focus({ preventScroll: true });
            interactions.beginDividerDrag(e, part.userData.divider);
            return;
        }
        // Drag the selected wardrobe with one finger, as with the mouse.
        // Register the touch so another finger can safely take over for pinch.
        if (!onPart && !selectionState.shapeEditing && selectionState.focusOn && !inspector.inside()) {
            const hit = picking.cast(e, renderState.allHits);
            if (hit?.object.userData.wardrobe === model.scene.activeWardrobe) {
                resources.cv.focus({ preventScroll: true });
                resources.cv.setPointerCapture(e.pointerId);
                if (e.pointerType === 'touch') interactionState.ptrs.set(e.pointerId, e);
                interactions.beginWardrobeDrag(e, 'floor');
                // A kitchen unit held still for a moment pulls out copies instead of moving.
                kitchenArray?.holdStart(e.clientX, e.clientY, () => interactions.finishWardrobeDrag(true));
                return;
            }
        }
        // A finger held still on the selected kitchen unit pulls out copies, also while a space in it is chosen.
        if (kitchenArray && selectionState.focusOn && !selectionState.shapeEditing && picking.cast(e, renderState.allHits)?.object.userData.wardrobe === model.scene.activeWardrobe) {
            // Once held, the press is a pull: no tap, orbit or item drag follows from it.
            kitchenArray.holdStart(e.clientX, e.clientY, () => { interactionState.moved = 99; interactionState.drag = null; });
        }
        resources.cv.focus({ preventScroll: true });
        resources.cv.setPointerCapture(e.pointerId);
        interactionState.ptrs.set(e.pointerId, e);
        interactionState.moved = 0;
        interactionState.sx = e.clientX;
        interactionState.sy = e.clientY;
        if (interactionState.ptrs.size === 1) {
            if (onPart && part.userData.divider === undefined && !doorsShut) {
                const u = part.userData, p = picking.frontPoint(e), mesh = /** @type {import('three').Mesh<import('three').BoxGeometry>} */(part);
                // Pressing an item selects it, as a tap does, so the panels and the moved item follow the drag. A finger
                // selects it once the drag starts, so a pinch that lands on an item leaves the selection alone.
                const state = model.activeCabinet().state;
                const select = () => { if (state.divider >= 0 || state.sel !== u.i || state.item !== u.j) {
                    state.divider = -1;
                    state.sel = u.i;
                    state.item = u.j;
                    selectionState.deep = true;
                    selectionState.pillOn = false;
                    inspector.update();
                } };
                if (e.pointerType !== 'touch') select();
                interactionState.drag = { from: { i: u.i, j: u.j }, offsetX: p ? p.x - mesh.position.x : 0, offsetY: p ? p.y - mesh.position.y : 0, cx: mesh.position.x, cy: mesh.position.y, hw: mesh.geometry.parameters.width / 2, hh: mesh.geometry.parameters.height / 2, settling: false, started: false, id: e.pointerId, select: e.pointerType === 'touch' ? select : null };
            }
        }
        else if (interactionState.ptrs.size === 2) {
            interactions.cancelMovement();
            interactionState.moved = 99;
            const [a, b] = [...interactionState.ptrs.values()];
            interactionState.pd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        }
    });
}
/** @param {import('./canvas.ports').BindCanvasPointermovePorts} ports */
export function bindCanvasPointermove({ dom, camera, touch, rendering, interactions, inspector, cameraState, interactionState, resources, model, lifetime, room, kitchenArray }) {
    const { $ } = dom;
    lifetime.listen(resources.cv, 'pointermove', e => {
        if (room?.dragging()) {
            room.move(e);
            return;
        }
        if (interactionState.dividerGesture) {
            return;
        }
        if (kitchenArray?.active()) {
            kitchenArray.move(e.clientX, e.clientY);
            return;
        }
        kitchenArray?.holdMoved(e.clientX, e.clientY);
        const pan = interactionState.panGesture;
        if (pan?.id === e.pointerId) {
            camera.panBy(e.clientX - pan.x, e.clientY - pan.y);
            pan.x = e.clientX;
            pan.y = e.clientY;
            return;
        }
        if (interactionState.rotationGesture) {
            interactions.rotateFromPointer(e);
            return;
        }
        if (interactionState.wardrobeGesture) {
            if (interactionState.ptrs.has(e.pointerId)) interactionState.ptrs.set(e.pointerId, e);
            interactions.moveWardrobeFromPointer(e);
            if (e.pointerType === 'touch' && interactionState.wardrobeGesture?.follows) touch.followEdge(e, interactions.moveWardrobeFromPointer, () => !!interactionState.wardrobeGesture);
            return;
        }
        if (!interactionState.ptrs.has(e.pointerId)) {
            if (interactionState.moveMode) {
                interactions.previewAt(e);
            }
            else {
                interactions.hover(e);
            }
            return;
        }
        const o = interactionState.ptrs.get(e.pointerId);
        interactionState.moved = Math.max(interactionState.moved, Math.hypot(e.clientX - interactionState.sx, e.clientY - interactionState.sy));
        if (interactionState.ptrs.size === 1) {
            const pending = interactionState.pendingFurniture;
            if (pending && interactionState.moved >= 5) {
                // Pressed on a wardrobe or cabinet: it follows the pointer across the floor. Its frame becomes the
                // active one so the drag measures against it; nothing else about the selection or the view changes.
                interactionState.pendingFurniture = null;
                const was = model.scene.activeWardrobe;
                if (model.select(pending.id) && was !== pending.id) rendering.build();
                if (e.pointerType !== 'touch') interactionState.ptrs.delete(e.pointerId);
                interactions.beginWardrobeDrag(pending.event, 'floor');
                interactions.moveWardrobeFromPointer(e);
                return;
            }
            if (interactionState.drag) {
                if (interactionState.moved >= 6) {
                    if (!interactionState.drag.started) {
                        // Choosing the item refreshes the panels, which would end a drag already under way.
                        const drag = interactionState.drag; interactionState.drag = null; drag.select?.(); interactionState.drag = drag;
                        interactionState.drag.started = true;
                        interactionState.drag.settling = false;
                        interactionState.panelWasOpen = $('#pop3').classList.contains('show');
                        camera.camRelease();
                        inspector.hidePop();
                        cameraState.vsT = cameraState.vs;
                        cameraState.vzT = cameraState.vz;
                        rendering.clearSettling();
                    }
                    interactions.previewAt(e);
                    if (e.pointerType === 'touch') touch.followEdge(e, interactions.previewAt, () => !!interactionState.drag?.started);
                }
            }
            else if (interactionState.moveMode) {
                interactions.previewAt(e);
            }
            else if (interactionState.moved >= 5 && e.shiftKey) {
                // Shift-drag on empty space pans, for trackpads without a right button.
                camera.panBy(e.clientX - o.clientX, e.clientY - o.clientY);
                inspector.hidePop();
            }
            else if (interactionState.moved >= 5) {
                // A finger turns the view more gently than a mouse: about a quarter turn across a phone.
                const rate = e.pointerType === 'touch' ? .0045 : .007;
                cameraState.az -= (e.clientX - o.clientX) * rate;
                cameraState.el = Math.max(0, Math.min(1.35, cameraState.el + (e.clientY - o.clientY) * rate));
                inspector.hidePop();
            }
        }
        const before = interactionState.ptrs.size === 2 ? [...interactionState.ptrs.values()] : null;
        interactionState.ptrs.set(e.pointerId, e);
        if (interactionState.ptrs.size === 2) {
            const [a, b] = [...interactionState.ptrs.values()];
            // Two fingers moving together pan the view while they pinch, which zooms about the point between them.
            if (before) touch.pinch([before[0], before[1]], [a, b]);
            interactionState.pd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            interactionState.moved = 99;
        }
    });
}
/** @param {import('./canvas.ports').BindCanvasPointerupPorts} ports */
export function bindCanvasPointerup({ dom, touch, interactions, shell, interactionState, resources, lifetime, room, kitchenArray }) {
    lifetime.listen(resources.cv, 'pointerup', e => {
        interactionState.pendingFurniture = null;
        touch.release(); touch.stopFollowing();
        kitchenArray?.holdCancel();
        if (kitchenArray?.active()) {
            interactionState.ptrs.delete(e.pointerId);
            if (resources.cv.hasPointerCapture(e.pointerId)) resources.cv.releasePointerCapture(e.pointerId);
            kitchenArray.end();
            return;
        }
        // A tap on the selected part (no drag) selects what is under the pointer, as any tap does.
        if (room?.dragging()) {
            if (!room.end()) interactions.pick(e);
            return;
        }
        if (interactionState.panGesture?.id === e.pointerId) {
            interactionState.panGesture = null;
            if (resources.cv.hasPointerCapture(e.pointerId)) resources.cv.releasePointerCapture(e.pointerId);
            return;
        }
        if (interactionState.dividerGesture) {
            interactions.finishDividerDrag();
            return;
        }
        if (interactionState.rotationClick) {
            interactionState.rotationClick = false;
            return;
        }
        if (interactionState.wardrobeGesture) {
            const changed = interactionState.wardrobeGesture.moved;
            interactionState.ptrs.delete(e.pointerId);
            interactions.finishWardrobeDrag();
            if (resources.cv.hasPointerCapture(e.pointerId)) {
                resources.cv.releasePointerCapture(e.pointerId);
            }
            if (!changed) {
                interactions.pick(e);
            }
            return;
        }
        const wasDragging = interactionState.drag?.started;
        interactionState.ptrs.delete(e.pointerId);
        if (wasDragging) {
            interactions.previewAt(e);
            const plan = interactionState.previewPlan;
            interactions.cancelMovement();
            if (plan?.valid) {
                interactions.commitItemMove(plan);
            }
            else {
                shell.toast(plan?.reason || 'Move cancelled.');
            }
        }
        else if (interactionState.moved < 5 && interactionState.ptrs.size === 0) {
            interactionState.drag = null;
            if (interactionState.moveMode) {
                interactions.previewAt(e);
                if (interactionState.previewPlan?.valid) {
                    const plan = interactionState.previewPlan;
                    interactions.cancelMovement();
                    interactions.commitItemMove(plan);
                }
                else {
                    shell.toast(interactionState.previewPlan?.reason || 'Choose a destination.');
                }
            }
            else {
                interactions.pick(e);
            }
        }
        interactionState.drag = null;
        if (!interactionState.ptrs.size) {
            if (resources.cv.hasPointerCapture(e.pointerId)) {
                resources.cv.releasePointerCapture(e.pointerId);
            }
            interactions.hover(e);
        }
    });
}
/** @param {import('./canvas.ports').BindCanvasPointercancelPorts} ports */
export function bindCanvasPointercancel({ dom, touch, interactions, interactionState, resources, lifetime, room, kitchenArray }) {
    lifetime.listen(resources.cv, 'pointercancel', e => {
        interactionState.pendingFurniture = null;
        touch.release(); touch.stopFollowing();
        kitchenArray?.holdCancel();
        if (kitchenArray?.active()) kitchenArray.end(true);
        if (room?.dragging()) room.end(true);
        if (interactionState.panGesture?.id === e.pointerId) interactionState.panGesture = null;
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag(true);
        }
        interactionState.ptrs.delete(e.pointerId);
        interactionState.moved = 99;
        interactions.cancelMovement();
    });
}
/** @param {import('./canvas.ports').BindCanvasLostpointercapturePorts} ports */
export function bindCanvasLostpointercapture({ dom, interactions, interactionState, resources, lifetime }) {
    lifetime.listen(resources.cv, 'lostpointercapture', e => {
        if (interactionState.ptrs.has(e.pointerId)) {
            if (interactionState.wardrobeGesture) interactions.finishWardrobeDrag(true);
            interactionState.ptrs.delete(e.pointerId);
            interactionState.moved = 99;
            interactions.cancelMovement();
        }
    });
}
/** @param {import('./canvas.ports').BindCanvasGestureBlurPorts} ports */
export function bindCanvasGestureBlur({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'blur', () => {
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag(true);
        }
        if (interactionState.rotationGesture) {
            interactions.finishRotation(true);
        }
        interactionState.ptrs.clear();
        interactions.cancelMovement();
    });
}
/** @param {import('./canvas.ports').BindCanvasWheelPorts} ports */
export function bindCanvasWheel({ dom, camera, interactions, interactionState, resources, lifetime }) {
    lifetime.listen(resources.cv, 'wheel', e => {
        e.preventDefault();
        if (interactionState.drag?.started || interactionState.dividerGesture || interactionState.itemEdgeGesture || interactionState.wardrobeGesture || interactionState.rotationGesture) {
            return;
        }
        interactions.cancelMovement();
        const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? resources.cv.clientHeight : 1);
        camera.cameraZoom(Math.exp(Math.max(-.35, Math.min(.35, pixels * .0015))));
    }, { passive: false });
}
/** @param {import('./canvas.ports').BindCanvasPointerleavePorts} ports */
export function bindCanvasPointerleave({ dom, renderState, resources, lifetime }) {
    lifetime.listen(resources.cv, 'pointerleave', () => {
        renderState.outs.forEach(o => {
            o.visible = false;
            if (o.userData.label) {
                o.userData.label.dataset.active = 'false';
            }
        });
        renderState.ihits.forEach(x => {
            if (x.userData.o) {
                x.userData.o.visible = !!x.userData.o.userData.s;
            }
        });
    });
}
/** @param {import('./canvas.ports').BindCanvasGestureEscapePorts} ports */
export function bindCanvasGestureEscape({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if ((interactionState.rotationGesture || interactionState.wardrobeGesture) && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (interactionState.rotationGesture) {
                interactions.finishRotation(true);
            }
            if (interactionState.wardrobeGesture) {
                interactions.finishWardrobeDrag(true);
            }
        }
    }, true);
}
