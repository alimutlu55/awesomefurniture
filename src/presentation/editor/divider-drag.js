/** @param {Pick<import('./editor-gestures.ports').CreateEditorGesturesPorts, 'dom' | 'resources' | 'model' | 'picking' | 'camera' | 'cameraState' | 'interactionState' | 'commands' | 'rendering' | 'history' | 'inspector'>} ports */
export function createDividerDrag({ dom, resources, model, picking, camera, cameraState, interactionState, commands, rendering, history, inspector }) {
    function beginDividerDrag(e, index, target = resources.cv) {
        if (model.activeCabinet().state.doors !== 'none' && !model.activeCabinet().state.open) {
            return;
        }
        const d = model.activeCabinet().state.dividers?.[index], point = picking.frontPoint(e);
        if (!d || !point) {
            return;
        }
        target = resources.cv;
        camera.camRelease();
        cameraState.tgtY = cameraState.tgt.y;
        cameraState.vsT = cameraState.vs;
        cameraState.vzT = cameraState.vz;
        interactionState.dividerGesture = { index, point, original: { ...d }, snapshot: model.snapshot(), pointer: e.pointerId, target, pressX: e.clientX, pressY: e.clientY, moved: false };
        target.setPointerCapture(e.pointerId);
    }
    function moveDividerDrag(e) {
        const g = interactionState.dividerGesture;
        if (!g || e.pointerId !== g.pointer) {
            return;
        }
        if (!g.moved && Math.hypot(e.clientX - g.pressX, e.clientY - g.pressY) < 4) {
            return;
        }
        g.moved = true;
        const point = picking.frontPoint(e);
        if (!point) {
            return;
        }
        const hor = g.original.orientation === 'horizontal';
        const moved = commands.moveDividerTo(g.index, (hor ? g.original.y : g.original.x) + (hor ? point.y - g.point.y : point.x - g.point.x));
        // Shelves and fittings attached to it moved too: the wardrobe is redrawn, else just the board.
        if (moved === 'all') rendering.build();
        else if (moved) rendering.refreshDividerVisual(g.index);
    }
    function finishDividerDrag(cancel = false) {
        const g = interactionState.dividerGesture;
        if (!g) {
            return;
        }
        interactionState.dividerGesture = null;
        if (cancel) {
            model.restore(g.snapshot);
        }
        else if (model.snapshot() !== g.snapshot) {
            history.checkpoint(g.snapshot);
            inspector.histUI();
        }
        if (g.target.hasPointerCapture(g.pointer)) {
            g.target.releasePointerCapture(g.pointer);
        }
        inspector.update(true);
        if (!g.moved && !cancel) {
            inspector.showPop(null, '#pop4');
        }
    }
    return { beginDividerDrag, moveDividerDrag, finishDividerDrag };
}
