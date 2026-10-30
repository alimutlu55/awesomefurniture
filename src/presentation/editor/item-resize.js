import * as THREE from "three";
import { PANEL, MODS } from '../../domain/wardrobe/catalog.js';
import { AUTO_ALIGN_CM, resolveAlignment } from '../../domain/geometry/alignment';
/** @param {Pick<import('./editor-gestures.ports').CreateEditorGesturesPorts, 'dom' | 'geometry' | 'model' | 'picking' | 'camera' | 'cameraState' | 'interactionState' | 'commands' | 'history' | 'shellState' | 'inspector' | 'renderState'> & { callbacks: Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement'> }} ports */
export function createItemResize({ dom, geometry, model, picking, camera, cameraState, interactionState, commands, history, shellState, inspector, renderState, callbacks }) {
    function beginItemEdgeResize(e, edge, handle) {
        if (e.button !== 0) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const g = geometry.itemGeom(model.activeCabinet().state.sel, model.activeCabinet().state.item), it = model.activeCabinet().state.secs[model.activeCabinet().state.sel]?.[model.activeCabinet().state.item], p = picking.frontPoint(e);
        if (!g || !it || !p || model.activeCabinet().state.doors !== 'none' && !model.activeCabinet().state.open) {
            return;
        }
        callbacks.cancelMovement();
        camera.camRelease();
        cameraState.tgtY = cameraState.tgt.y;
        cameraState.vsT = cameraState.vs;
        cameraState.vzT = cameraState.vz;
        interactionState.itemEdgeGesture = { edge, handle, pointer: e.pointerId, lastX: e.clientX, lastY: e.clientY, pressX: e.clientX, pressY: e.clientY, delta: 0, moved: false, g, section: model.activeCabinet().state.sel, index: model.activeCabinet().state.item, wardrobe: model.scene.activeWardrobe, layout: geometry.resizeObstacles(model.activeCabinet().state.sel), original: JSON.parse(JSON.stringify(model.activeCabinet().state.secs[model.activeCabinet().state.sel])), snapshot: model.snapshot(), minW: geometry.itemMinW(it), minH: geometry.effectiveMin(it.k), maxH: MODS[it.k].mx };
        interactionState.itemEdgeGesture.snap = buildSnapContext(interactionState.itemEdgeGesture);
        interactionState.itemEdgeGesture.guide = null;
        interactionState.itemEdgeGesture.lock = null;
        // Under a finger the view holds still, so the edge stays under it; a mouse turns to the front for precision.
        if (e.pointerType !== 'touch') camera.moveViewOn();
        handle.classList.add('resizing');
        handle.setPointerCapture(e.pointerId);
    }
    function moveItemEdgeResize(e) {
        const a = interactionState.itemEdgeGesture;
        if (!a || e.pointerId !== a.pointer) {
            return;
        }
        if (!a.moved) {
            if (Math.hypot(e.clientX - a.pressX, e.clientY - a.pressY) < 4) {
                return;
            }
            a.moved = true;
            // Only what this edge changes shows on the model while it is dragged.
            const labels = dom.$?.('#labels');
            if (labels) labels.dataset.assist = 'item';
        }
        // Reproject both pointer positions with the current camera: easing alone must never resize an item.
        const p = picking.frontPoint(e), previous = picking.frontPoint({ clientX: a.lastX, clientY: a.lastY });
        if (!p || !previous) {
            return;
        }
        a.delta += a.edge === 'top' || a.edge === 'bottom' ? p.y - previous.y : p.x - previous.x;
        a.lastX = e.clientX;
        a.lastY = e.clientY;
        let target = geometry.itemEdgeSize(a.g, a.edge, a.delta, a.layout, a.index, a.minW, a.minH, a.maxH);
        {
            const sn = snapItemEdge(a);
            if (sn) {
                target = sn.target;
                a.guide = sn.guide;
            }
            else {
                a.guide = null;
            }
        }
        const vertical = a.edge === 'top' || a.edge === 'bottom';
        if (vertical ? Math.abs(target.h - a.g.h) < .001 && (a.edge === 'top' || Math.abs(target.y - (a.g.y0 - geometry.interiorFloor())) < .001) : Math.abs(target.w - a.g.w) < .001 && Math.abs(target.x - (a.g.x0 - a.g.bayL)) < .001) {
            commands.restoreSection(a.section, a.original);
            return;
        }
        commands.applyItemEdgeSize(a, target);
    }
    function finishItemEdgeResize(cancel = false) {
        const a = interactionState.itemEdgeGesture;
        if (!a) {
            return;
        }
        interactionState.itemEdgeGesture = null;
        a.handle.classList.remove('resizing');
        const labels = dom.$?.('#labels');
        if (labels) delete labels.dataset.assist;
        if (cancel) {
            model.restore(a.snapshot);
        }
        else if (model.snapshot() !== a.snapshot) {
            history.checkpoint(a.snapshot);
            shellState.G.tune = 1;
        }
        if (a.handle.hasPointerCapture(a.pointer)) {
            a.handle.releasePointerCapture(a.pointer);
        }
        camera.moveViewOff();
        inspector.update(true);
    }
    function buildSnapContext(a) {
        const ws = geometry.widths(), others = [];
        for (let i = 0; i < model.activeCabinet().state.n; i++) {
            const bayL = PANEL + ws.slice(0, i).reduce((x, y) => x + y + PANEL, 0);
            const lay = i === a.section ? a.layout : geometry.computeLayout(i), count = i === a.section ? a.original.length : lay.length;
            lay.forEach((q, j) => {
                if (i === a.section && j === a.index) {
                    return;
                }
                others.push({ i, j, div: j >= count, bayL, x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1 });
            });
        }
        return { others, bw: a.g.bw, top: geometry.interiorFloor() + geometry.ih() };
    }
    function snapPxPerCm(a) {
        const g = a.g, y = (g.y0 + g.y1) / 2, A = picking.screenPoint(renderState.Gr.localToWorld(new THREE.Vector3(g.x0 - model.activeCabinet().state.w / 2, y, model.activeCabinet().state.d / 2 + 1))), B = picking.screenPoint(renderState.Gr.localToWorld(new THREE.Vector3(g.x0 - model.activeCabinet().state.w / 2 + 10, y, model.activeCabinet().state.d / 2 + 1)));
        return Math.max(.5, Math.hypot(B.x - A.x, B.y - A.y) / 10);
    }
    function snapItemEdge(a) {
        const c = a.snap;
        if (!c) {
            return null;
        }
        const g = a.g, tol = AUTO_ALIGN_CM, top = a.edge === 'top', bottom = a.edge === 'bottom', left = g.x0 - g.bayL, right = g.x1 - g.bayL,
            raw = top ? g.y1 + a.delta : bottom ? g.y0 + a.delta : (a.edge === 'left' ? left : right) + a.delta, cand = [],
            add = (v, kind, label, src) => cand.push({ v, kind, label, src, penalty: kind === 'size' ? tol * .35 : 0 });
        if (top) {
            add(c.top, 'wall', 'Flush with top');
            c.others.forEach(o => {
                add(o.y1, 'edge', 'Aligned', o);
                add(o.y0, 'edge', 'Aligned', o);
                if (!o.div) {
                    add(g.y0 + (o.y1 - o.y0), 'size', 'Same height', o);
                }
            });
        }
        else if (bottom) {
            // The bottom edge lines up with the base board and with the edges of the fittings and boards beside it.
            add(geometry.interiorFloor(), 'wall', 'Flush with the base');
            c.others.forEach(o => {
                add(o.y1, 'edge', 'Aligned', o);
                add(o.y0, 'edge', 'Aligned', o);
                if (!o.div) add(g.y1 - (o.y1 - o.y0), 'size', 'Same height', o);
            });
        }
        else {
            const R = a.edge === 'right';
            add(R ? c.bw : 0, 'wall', 'Flush with side');
            add(R ? c.bw - left : c.bw - right, 'center', 'Centred');
            c.others.forEach(o => {
                if (o.i !== a.section) {
                    return;
                }
                add(o.x0, 'edge', o.div ? 'Aligned with divider' : 'Aligned', o);
                add(o.x1, 'edge', o.div ? 'Aligned with divider' : 'Aligned', o);
                if (!o.div) {
                    const ow = o.x1 - o.x0;
                    add(R ? left + ow : right - ow, 'size', 'Same width', o);
                }
            });
        }
        // A visual alignment must be reachable by the very same edge solver as a free drag. Otherwise a nearby
        // edge through a solid can win the snap and make the command reject every move near the boundary.
        const start = top ? g.y1 : bottom ? g.y0 : a.edge === 'left' ? left : right;
        const solve = delta => geometry.itemEdgeSize(g, a.edge, delta, a.layout, a.index, a.minW, a.minH, a.maxH);
        const position = target => top ? g.y0 + target.h : bottom ? geometry.interiorFloor() + target.y
            : a.edge === 'left' ? target.x : target.x + target.w;
        // Resolve the interval once per pointer move, rather than rescanning every neighbor for every candidate.
        const low = position(solve(-Infinity)), high = position(solve(Infinity));
        const best = resolveAlignment(raw, cand, { tolerance: tol, lock: a.lock, hold: 1, within: [low, high] });
        if (!best) {
            a.lock = null;
            return null;
        }
        a.lock = best;
        const target = solve(best.v - start), pos = position(target);
        return { target, guide: { orient: top || bottom ? 'h' : 'v', pos: top || bottom ? pos : g.bayL + pos, kind: best.kind, label: best.label, src: best.src } };
    }
    function setManualItemSize(edge, value, recordHistory = true) {
        const g = geometry.itemGeom(model.activeCabinet().state.sel, model.activeCabinet().state.item), it = model.activeCabinet().state.secs[model.activeCabinet().state.sel]?.[model.activeCabinet().state.item];
        if (!g || !it || !Number.isFinite(value)) {
            inspector.itemUI();
            return;
        }
        if (edge === 'right') {
            edge = geometry.widthEdgeFor(g);
        }
        const vertical = edge === 'top' || edge === 'bottom';
        const delta = edge === 'top' ? value - g.h : edge === 'bottom' ? g.h - value : edge === 'left' ? g.w - value : value - g.w;
        const before = model.snapshot(), section = model.activeCabinet().state.sel, index = model.activeCabinet().state.item;
        const a = { edge, g, section, index, delta, layout: geometry.resizeObstacles(section), original: model.activeCabinet().state.secs[section],
            minW: geometry.itemMinW(it), minH: geometry.effectiveMin(it.k), maxH: MODS[it.k].mx };
        const target = snapItemEdge({ ...a, snap: buildSnapContext(a), lock: null })?.target
            ?? geometry.itemEdgeSize(g, edge, delta, a.layout, index, a.minW, a.minH, a.maxH);
        if (vertical ? Math.abs(target.h - g.h) < .001 : Math.abs(target.w - g.w) < .001) {
            inspector.itemUI();
            return;
        }
        const applied = commands.applyItemEdgeSize({ edge, g, index: model.activeCabinet().state.item, section: model.activeCabinet().state.sel, layout: geometry.resizeObstacles(model.activeCabinet().state.sel), original: model.activeCabinet().state.secs[model.activeCabinet().state.sel] }, target);
        if (applied && model.snapshot() !== before) {
            if (recordHistory) history.checkpoint(before);
            shellState.G.tune = 1;
            inspector.histUI();
        }
        else {
            inspector.itemUI();
        }
    }
    return { beginItemEdgeResize, moveItemEdgeResize, finishItemEdgeResize, buildSnapContext, snapPxPerCm, snapItemEdge, setManualItemSize };
}
