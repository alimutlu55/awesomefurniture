/** Pointer and wheel gestures on the 3D canvas: select, orbit, drag, rotate, zoom.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
import { cancelCanvasSession, releaseCanvasPointer } from './canvas-pointer-lifecycle.js';
export { bindCanvasPointercancel, bindCanvasLostpointercapture, bindCanvasGestureBlur } from './canvas-pointer-lifecycle.js';
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
        // The canvas owns every press before delegating it to a drag tool.
        // A divider, room surface and wardrobe must all participate in the same
        // pointer lifecycle, so a second finger can always take over for pinch.
        resources.cv.focus({ preventScroll: true });
        resources.cv.setPointerCapture(e.pointerId);
        interactionState.ptrs.set(e.pointerId, e);
        if (interactionState.ptrs.size > 1) {
            interactionState.pendingFurniture = null;
            touch.release();
            kitchenArray?.holdCancel();
            if (kitchenArray?.active()) kitchenArray.end(true);
            if (room?.dragging()) room.end(true);
            if (interactionState.dividerGesture) interactions.finishDividerDrag(true);
            if (interactionState.wardrobeGesture) interactions.finishWardrobeDrag(true);
            interactions.cancelMovement();
            camera.camRelease();
            // Finishing a surface/board drag releases its capture. The camera
            // now owns both live fingers, including the one just handed over.
            for (const id of interactionState.ptrs.keys()) resources.cv.setPointerCapture(id);
            interactionState.moved = 99;
            const [a, b] = [...interactionState.ptrs.values()];
            interactionState.pd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            return;
        }
        interactionState.moved = 0;
        interactionState.sx = e.clientX;
        interactionState.sy = e.clientY;
        interactionState.rotationClick = false;
        if (interactionState.rotationGesture) {
            interactionState.rotationClick = true;
            interactions.finishRotation();
            return;
        }
        // The selected room surface moves unless furniture is in front of it.
        if (room?.grab(e, picking.cast(e, renderState.allHits))) return;
        // Only what is chosen moves, by mouse or finger: tap first, then drag. A press on the chosen fitting or board drags
        // it; anywhere else on the chosen piece it moves the whole piece. On anything not chosen a drag turns the view and
        // a tap chooses it.
        const chosen = selectionState.focusOn, state = model.activeCabinet().state;
        const part = chosen && !selectionState.shapeEditing ? picking.cast(e, renderState.ihits)?.object ?? null : null, u = part?.userData;
        const onPart = !!part && u.wardrobe === model.scene.activeWardrobe
            && (u.divider !== undefined ? state.divider === u.divider : state.divider < 0 && state.sel === u.i && state.item === u.j);
        // The piece moves once the pointer moves, so a tap on it still chooses what is under it. Its frame counts as the piece.
        const pieceUnder = () => picking.cast(e, renderState.allHits)?.object.userData.wardrobe ?? picking.pieceAt(e);
        const body = !onPart && !selectionState.shapeEditing ? pieceUnder() : undefined;
        interactionState.pendingFurniture = chosen && body === model.scene.activeWardrobe && inspector.inside() ? { id: body, event: e } : null;
        const doorsShut = model.activeCabinet().state.doors !== 'none' && !model.activeCabinet().state.open;
        if (onPart && part.userData.divider !== undefined && !doorsShut) {
            // The chosen divider is dragged where it is.
            interactions.beginDividerDrag(e, part.userData.divider);
            return;
        }
        // Drag the selected wardrobe with one finger, as with the mouse.
        // Register the touch so another finger can safely take over for pinch.
        if (!onPart && !selectionState.shapeEditing && selectionState.focusOn && !inspector.inside()) {
            if (body === model.scene.activeWardrobe) {
                interactions.beginWardrobeDrag(e, 'floor');
                // A kitchen unit held still for a moment pulls out copies instead of moving.
                kitchenArray?.holdStart(e.clientX, e.clientY, () => interactions.finishWardrobeDrag(true));
                return;
            }
        }
        // A finger held still on the selected kitchen unit pulls out copies, also while a space in it is chosen.
        if (kitchenArray && selectionState.focusOn && !selectionState.shapeEditing && pieceUnder() === model.scene.activeWardrobe) {
            // Once held, the press is a pull: no tap, orbit or item drag follows from it.
            kitchenArray.holdStart(e.clientX, e.clientY, () => { interactionState.moved = 99; interactionState.drag = null; });
        }
        if (onPart && part.userData.divider === undefined && !doorsShut) {
            const p = picking.frontPoint(e), mesh = /** @type {import('three').Mesh<import('three').BoxGeometry>} */(part);
            interactionState.drag = { from: { i: u.i, j: u.j }, offsetX: p ? p.x - mesh.position.x : 0, offsetY: p ? p.y - mesh.position.y : 0, cx: mesh.position.x, cy: mesh.position.y, hw: mesh.geometry.parameters.width / 2, hh: mesh.geometry.parameters.height / 2, settling: false, started: false, id: e.pointerId };
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
            interactions.moveDividerDrag(e);
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
                interactions.beginWardrobeDrag(pending.event, 'floor');
                interactions.moveWardrobeFromPointer(e);
                return;
            }
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
                // A finger turns the view around what is in the middle of it, keeping to its direction (touch-camera.ts).
                if (e.pointerType === 'touch') touch.turn(e.clientX - o.clientX, e.clientY - o.clientY);
                else {
                    cameraState.az -= (e.clientX - o.clientX) * .007;
                    cameraState.el = Math.max(0, Math.min(1.35, cameraState.el + (e.clientY - o.clientY) * .007));
                }
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
        // Retire the press before any tool can return early or rebuild the scene.
        // An up from a cancelled session (or a control outside the canvas) is
        // never a new click, regardless of the last gesture's movement distance.
        const tracked = interactionState.ptrs.has(e.pointerId), pan = interactionState.panGesture?.id === e.pointerId;
        if (!tracked && !pan) return;
        releaseCanvasPointer(interactionState, resources.cv, e.pointerId);
        interactionState.pendingFurniture = null;
        touch.release(); touch.stopFollowing();
        kitchenArray?.holdCancel();
        if (kitchenArray?.active()) {
            kitchenArray.end();
            return;
        }
        // A tap on the selected part (no drag) selects what is under the pointer, as any tap does.
        if (room?.dragging()) {
            if (!room.end()) interactions.pick(e);
            return;
        }
        if (pan) {
            interactionState.panGesture = null;
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
            interactions.finishWardrobeDrag();
            if (!changed) {
                interactions.pick(e);
            }
            return;
        }
        const wasDragging = interactionState.drag?.started;
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
            interactions.hover(e);
        }
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
        camera.cameraZoom(Math.exp(Math.max(-.35, Math.min(.35, pixels * .0015))), e);
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
export function bindCanvasGestureEscape(ports) {
    const { interactionState } = ports;
    ports.lifetime.listen(ports.dom.window, 'keydown', e => {
        if ((interactionState.dividerGesture || interactionState.rotationGesture || interactionState.wardrobeGesture) && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelCanvasSession(ports);
        }
    }, true);
}
