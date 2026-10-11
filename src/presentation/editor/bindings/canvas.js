/** Pointer and wheel gestures on the 3D canvas: select, orbit, drag, rotate, zoom.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** DOM event bindings call application commands through the mounted view ports. */
/** @param {import('./canvas.ports').ObserveViewportSizePorts} ports */
export function observeViewportSize({ dom, camera, lifetime }) {
    const { $ } = dom;
    lifetime.observe(new ResizeObserver(camera.resize), $('#view'));
}
/** @param {import('./canvas.ports').BindCanvasPointerdownPorts} ports */
export function bindCanvasPointerdown({ dom, camera, interactions, inspector, picking, interactionState, renderState, selectionState, resources, model, lifetime }) {
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
        // A second pointer always joins the camera gesture before hit testing.
        if (interactionState.ptrs.size > 0) {
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
        // Drag the selected wardrobe with one finger, as with the mouse.
        // Register the touch so another finger can safely take over for pinch.
        if (selectionState.focusOn && (!inspector.inside() || (dom.width <= 900 && dom.$('#app').dataset.toolbarMode === 'move'))) {
            const hit = picking.cast(e, renderState.allHits);
            if (hit?.object.userData.wardrobe === model.scene.activeWardrobe) {
                resources.cv.focus({ preventScroll: true });
                resources.cv.setPointerCapture(e.pointerId);
                if (e.pointerType === 'touch') interactionState.ptrs.set(e.pointerId, e);
                interactions.beginWardrobeDrag(e, 'floor');
                return;
            }
        }
        if (e.pointerType !== 'touch' && model.activeCabinet().state.divider >= 0 && selectionState.focusOn && inspector.inside()) {
            const hit = picking.cast(e, renderState.ihits);
            if (hit?.object.userData.divider === model.activeCabinet().state.divider) {
                resources.cv.focus({ preventScroll: true });
                interactions.beginDividerDrag(e, model.activeCabinet().state.divider);
                return;
            }
        }
        resources.cv.focus({ preventScroll: true });
        resources.cv.setPointerCapture(e.pointerId);
        interactionState.ptrs.set(e.pointerId, e);
        interactionState.moved = 0;
        interactionState.sx = e.clientX;
        interactionState.sy = e.clientY;
        if (interactionState.ptrs.size === 1) {
            const h = picking.cast(e, renderState.ihits), u = h?.object.userData;
            if (u && u.wardrobe === model.scene.activeWardrobe && u.i === model.activeCabinet().state.sel && u.j === model.activeCabinet().state.item && selectionState.focusOn && !(model.activeCabinet().state.doors !== 'none' && !model.activeCabinet().state.open)) {
                const p = picking.frontPoint(e);
                interactionState.drag = { from: { i: u.i, j: u.j }, offsetX: p ? p.x - h.object.position.x : 0, offsetY: p ? p.y - h.object.position.y : 0, cx: h.object.position.x, cy: h.object.position.y, hw: ( /** @type {import('three').Mesh<import('three').BoxGeometry>} */(h.object)).geometry.parameters.width / 2, hh: ( /** @type {import('three').Mesh<import('three').BoxGeometry>} */(h.object)).geometry.parameters.height / 2, settling: false, started: false, id: e.pointerId };
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
export function bindCanvasPointermove({ dom, camera, rendering, interactions, inspector, cameraState, interactionState, resources, lifetime }) {
    const { $ } = dom;
    lifetime.listen(resources.cv, 'pointermove', e => {
        if (interactionState.dividerGesture) {
            return;
        }
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
            if (interactionState.drag) {
                if (interactionState.moved >= 6) {
                    if (!interactionState.drag.started) {
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
                cameraState.az -= (e.clientX - o.clientX) * .007;
                cameraState.el = Math.max(0, Math.min(1.35, cameraState.el + (e.clientY - o.clientY) * .007));
                inspector.hidePop();
            }
        }
        const before = interactionState.ptrs.size === 2 ? [...interactionState.ptrs.values()] : null;
        interactionState.ptrs.set(e.pointerId, e);
        if (interactionState.ptrs.size === 2) {
            const [a, b] = [...interactionState.ptrs.values()], nd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            // Two fingers moving together pan the view while they pinch.
            if (before) camera.panBy(((a.clientX + b.clientX) - (before[0].clientX + before[1].clientX)) / 2, ((a.clientY + b.clientY) - (before[0].clientY + before[1].clientY)) / 2);
            if (nd > 0 && interactionState.pd > 0) {
                camera.cameraZoomDistance(camera.cameraDistance(cameraState.dist * interactionState.pd / nd), null);
                cameraState.tgt.lerp(camera.cameraFocusPoint(), .12);
                cameraState.tgtY = cameraState.tgt.y;
            }
            interactionState.pd = nd;
            interactionState.moved = 99;
        }
    });
}
/** @param {import('./canvas.ports').BindCanvasPointerupPorts} ports */
export function bindCanvasPointerup({ dom, interactions, shell, interactionState, resources, lifetime }) {
    lifetime.listen(resources.cv, 'pointerup', e => {
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
export function bindCanvasPointercancel({ dom, interactions, interactionState, resources, lifetime }) {
    lifetime.listen(resources.cv, 'pointercancel', e => {
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
