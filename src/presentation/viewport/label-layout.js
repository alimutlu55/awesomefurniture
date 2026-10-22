import { sizeCanvasAdd } from './canvas-add-sizing';
import { scrubberBottom } from './dimension-scrubber-label';
import { shapeHandleVisible } from './shape-handle-visibility';
import { deconflictLabels } from './label-deconflict';

export function createLabelLayout({
    dom, renderState, resources, shapeInspector, selectionState,
    drawScreenRuler, finishScreenRuler, overlay, inspector, updateItemResizeHandles,
    updateMoveIcons, getCvRect, labelDim
}) {
    const { $, document } = dom;

    return function positionLabels() {
        resources.cam.updateMatrixWorld(true);
        inspector.updateItemBar();
        overlay?.orient();
        const r = getCvRect();
        const owners = new Set(renderState.labs.map(l => l.owner).filter(Boolean));
        owners.forEach(owner => owner.updateWorldMatrix(true, false));
        renderState.labs.forEach(l => sizeCanvasAdd(l, resources.cam, r));
        updateItemResizeHandles();
        updateMoveIcons();
        const handles = renderState.itemEdgeHandles?.length ? renderState.itemEdgeHandles : [...document.querySelectorAll('.item-resize-handle')];
        const resizeOccupied = handles.filter(el => !el.hidden).map(el => {
            const b = el.getBoundingClientRect();
            return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, w: b.width, h: b.height };
        });
        const shapePlaced = [];
        const leftLimit = 6, rightLimit = r.width - 6;
        const placed = renderState.labs.filter(l => l.el.matches('.wardrobe-actions,.ground-rotate,.wardrobe-name,.lbl.add')).map(l => {
            const q = l.p.clone();
            if (l.owner) l.owner.localToWorld(q);
            q.project(resources.cam);
            const d = labelDim(l);
            return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height, w: d.w, h: d.h };
        }).concat(resizeOccupied);

        const rank = l => (l.el.classList.contains('shape-handle') ? 2 : 0) + (l.el.classList.contains('reach-dimension') ? 1 : 0);
        let tbRect = null;
        const getToolbarRect = () => tbRect ??= ($('#toolbar')?.getBoundingClientRect() ?? { top: r.height, height: 0 });

        renderState.labs.sort((a, b) => rank(b) - rank(a)).forEach(l => {
            renderState.pv.copy(l.p);
            if (l.owner) l.owner.localToWorld(renderState.pv);
            renderState.pv.project(resources.cam);
            const visible = l.visible !== false && renderState.pv.z >= -1 && renderState.pv.z <= 1 && l.owner?.visible !== false && shapeHandleVisible(l.el, l.owner, resources.cam, shapeInspector.drag())
                && (!l.el.classList.contains('hover-dim') || l.el.dataset.active === 'true');
            const nextD = visible ? (l.el.classList.contains('wardrobe-actions') ? 'flex' : 'block') : 'none';
            if (l.el.style.display !== nextD) l.el.style.display = nextD;
            if (!visible) {
                if (l.rulerNode) l.rulerNode.style.display = 'none';
                return;
            }
            let x = (renderState.pv.x * .5 + .5) * r.width, y = (-renderState.pv.y * .5 + .5) * r.height;
            const d = labelDim(l), ew = d.w, eh = d.h;
            if (l.reachFrom) {
                renderState.pv2.copy(l.reachFrom);
                if (l.owner) l.owner.localToWorld(renderState.pv2);
                renderState.pv2.project(resources.cam);
                const ax = (renderState.pv2.x * .5 + .5) * r.width, ay = (-renderState.pv2.y * .5 + .5) * r.height;
                let dx = x - ax, dy = y - ay;
                const len = Math.hypot(dx, dy);
                if (len < 1) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
                const gap = 8, t = Math.min(Math.abs(dx) > .001 ? (ew / 2 + gap) / Math.abs(dx) : Infinity, Math.abs(dy) > .001 ? (eh / 2 + gap) / Math.abs(dy) : Infinity);
                const bx = x + dx * t, by = y + dy * t, ox = ax - dx * t, oy = ay - dy * t, fits = cx => cx - ew / 2 >= leftLimit && cx + ew / 2 <= rightLimit;
                if (fits(bx)) { x = bx; y = by; }
                else if (fits(ox)) { x = ox; y = oy; }
                else if (l.el.classList.contains('reach-dimension')) { x = Math.max(leftLimit + ew / 2, Math.min(rightLimit - ew / 2, bx)); y = by - eh / 2; }
                else { l.el.style.display = 'none'; return; }
                const nextTf = `translate(-50%,-50%) translate(${x}px,${y}px)`;
                if (l.el.style.transform !== nextTf) l.el.style.transform = nextTf;
                return;
            }
            if (l.ruler) {
                const q = drawScreenRuler(l, r, ew, eh, { left: leftLimit, right: rightLimit, bottom: r.height - scrubberBottom(l.el, r, getToolbarRect) });
                if (!q.visible) {
                    l.el.style.display = 'none';
                    return;
                }
                x = q.x;
                y = q.y;
            } else if (l.el.classList.contains('dim') && !l.el.classList.contains('space-ruler') && !l.el.classList.contains('clearance')) {
                x = Math.max(leftLimit + ew / 2, Math.min(rightLimit - ew / 2, x));
                const bottom = scrubberBottom(l.el, r, getToolbarRect);
                y = Math.max(eh / 2 + 6, Math.min(r.height - eh / 2 - bottom, y));
                for (let n = 0; n < 8 && !l.el.classList.contains('space-ruler') && placed.some(q => Math.abs(x - q.x) < (ew + q.w) / 2 + 4 && Math.abs(y - q.y) < (eh + q.h) / 2 + 3); n++) {
                    y += eh + 5;
                }
                placed.push({ x, y, w: ew, h: eh });
            }
            if (l.el.classList.contains('shape-handle')) {
                shapePlaced.push({ x, y, w: ew, h: eh, r: 9 });
            } else if (['shape-measure', 'shape-guide', 'shape-coord', 'shape-reason'].some(c => l.el.classList.contains(c))) {
                const clear = (cx, cy) => shapePlaced.every(q => Math.abs(cx - q.x) >= (ew + q.w) / 2 + 3 || Math.abs(cy - q.y) >= (eh + q.h) / 2 + 3);
                const along = l.ruler?.axis === 'height' ? [ew + 4, 0] : [0, -(eh + 4)];
                const options = [[0, 0], along, [along[0] * 2, along[1] * 2]];
                const spot = options.map(([dx, dy]) => [x + dx, y + dy]).find(([cx, cy]) => clear(cx, cy) && cx - ew / 2 >= leftLimit && cx + ew / 2 <= rightLimit && cy - eh / 2 >= 6 && cy + eh / 2 <= r.height - 56);
                if (spot) { x = spot[0]; y = spot[1]; }
                shapePlaced.push({ x, y, w: ew, h: eh });
            }
            if (l.rulerLayout) { l.rulerLayout.x = x; l.rulerLayout.y = y; }
            const nextTf = `translate(-50%,-50%) translate(${x}px,${y}px)` + (l.canvasScale === undefined ? '' : ` scale(${l.canvasScale})`);
            if (l.el.style.transform !== nextTf) l.el.style.transform = nextTf;
        });
        const shifts = deconflictLabels($('#labels'), r);
        renderState.labs.forEach(l => {
            if (l.ruler) finishScreenRuler(l, shifts?.get(l.el));
        });
    };
}
