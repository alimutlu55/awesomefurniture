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
        // About 8 screen pixels in centimetres on the board's plane: how close it must come to line up.
        const aside = picking.frontPoint({ clientX: e.clientX + 8, clientY: e.clientY });
        const tolerance = Math.max(.4, Math.min(4, aside ? Math.hypot(aside.x - point.x, aside.y - point.y) : 1));
        interactionState.dividerGesture = { index, point, original: { ...d }, snapshot: model.snapshot(), pointer: e.pointerId, target, pressX: e.clientX, pressY: e.clientY, moved: false,
            tolerance, lock: null, guide: null };
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
        // While it moves, its gaps read clearly and nothing else on the model competes with them.
        const labels = dom.$?.('#labels');
        if (labels) labels.dataset.assist = 'divider';
        const point = picking.frontPoint(e);
        if (!point) {
            return;
        }
        const hor = g.original.orientation === 'horizontal';
        const raw = (hor ? g.original.y : g.original.x) + (hor ? point.y - g.point.y : point.x - g.point.x);
        // Lines up with the shelves, fittings and middle of its space through the shared alignment rule (Shift: free).
        const { moved, line, guide } = commands.alignDividerTo(g.index, raw, { tolerance: g.tolerance, lock: g.lock, free: e.shiftKey });
        g.lock = line;
        g.guide = guide;
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
        const labels = dom.$?.('#labels');
        if (labels) delete labels.dataset.assist;
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
