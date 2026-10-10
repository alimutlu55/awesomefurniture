import { tags, noticeLabels } from './storage-tags.js';
import * as THREE from "three";
import { createSceneSelection } from './scene-selection.js';
import { createItemResize } from './item-resize.js';
import { createCabinetDrag } from './cabinet-drag.js';
import { createDividerDrag } from './divider-drag.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./editor-gestures.ports').CreateEditorGesturesPorts} ports */
export function createEditorGestures({ dom, camera, rendering, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, geometry, cabinetGeometry, resources, model, commands, sceneCommands, history }) {
    const { $, matchMedia } = dom;
    const { pick, hover } = createSceneSelection({ dom, picking, renderState, inspector, selectionState, model, resources, camera });
    const { beginItemEdgeResize, moveItemEdgeResize, finishItemEdgeResize, buildSnapContext, snapPxPerCm, snapItemEdge, setManualItemSize } = createItemResize({ dom, geometry, model, picking, camera, cameraState, interactionState, commands, history, shellState, inspector, renderState, callbacks: { get cancelMovement() {
                return cancelMovement;
            } } });
    const { beginRotation, rotateFromPointer, finishRotation, beginWardrobeDrag, moveWardrobeFromPointer, finishWardrobeDrag } = createCabinetDrag({ dom, camera, inspector, model, picking, interactionState, cameraState, resources, sceneCommands, renderState, history, cabinetGeometry, callbacks: { get cancelMovement() {
                return cancelMovement;
            } } });
    const { beginDividerDrag, moveDividerDrag, finishDividerDrag } = createDividerDrag({ dom, resources, model, picking, camera, cameraState, interactionState, commands, rendering, history, inspector });
    function cancelMovement() {
        rendering.holdOverlay(false);
        if (interactionState.panelWasOpen) {
            interactionState.panelWasOpen = false;
            queueMicrotask(inspector.reopenItemPanel);
        }
        camera.moveViewOff();
        interactionState.drag = null;
        interactionState.moveMode = null;
        interactionState.lastMoveEvent = null;
        rendering.clearPreview();
        inspector.movementUI();
        resources.cv.style.cursor = 'grab';
    }
    function armMovement(mode) {
        if (model.activeCabinet().state.item < 0) {
            return;
        }
        if (model.activeCabinet().state.doors !== 'none' && !model.activeCabinet().state.open) {
            shell.toast('Open the doors before moving items.');
            return;
        }
        if (interactionState.moveMode === mode) {
            cancelMovement();
            return;
        }
        cancelMovement();
        interactionState.moveMode = mode;
        rendering.clearSettling();
        inspector.hidePop();
        inspector.showPop({ clientX: resources.cv.getBoundingClientRect().left + 30, clientY: resources.cv.getBoundingClientRect().top + 30 }, '#pop3');
        cameraState.vsT = cameraState.vs;
        cameraState.vzT = cameraState.vz;
        camera.moveViewOn();
        inspector.movementUI();
        resources.cv.focus({ preventScroll: true });
        const status = $('#move-status');
        status.hidden = false;
        status.classList.remove('bad');
        status.innerHTML = tags(mode === 'swap' ? ['Swap', 'Pick item', 'Esc cancel'] : ['Move', 'Pick space', 'Esc cancel']);
    }
    function previewAt(e) {
        if (cameraState.camGoal) {
            camera.camRelease();
        }
        interactionState.lastMoveEvent = e;
        const from = interactionState.drag?.from || { i: model.activeCabinet().state.sel, j: model.activeCabinet().state.item }, it = model.activeCabinet().state.secs[from.i]?.[from.j], p = picking.frontPoint(e), ws = geometry.widths();
        if (!it) {
            return;
        }
        rendering.holdOverlay(true);
        const swap = interactionState.moveMode === 'swap' || e.shiftKey;
        let to = -1, bayL = -model.activeCabinet().state.w / 2 + PANEL;
        // The pointer is held inside the wardrobe interior, so the item stops at the borders instead of following the pointer out.
        // More than 30 cm outside is the cancel zone. The gaps between sections snap to the nearest section.
        const xL = -model.activeCabinet().state.w / 2 + PANEL, xR = model.activeCabinet().state.w / 2 - PANEL, yB = PLINTH + PANEL, yT = model.activeCabinet().state.h - PANEL, cancelZone = !p || Math.max(xL - p.x, p.x - xR, yB - p.y, p.y - yT) > 30, px = p ? Math.max(xL, Math.min(xR, p.x)) : 0, py = p ? Math.max(yB, Math.min(yT, p.y)) : 0;
        if (!cancelZone) {
            let best = Infinity;
            for (let i = 0, l = xL; i < model.activeCabinet().state.n; l += ws[i] + PANEL, i++) {
                const gap = Math.max(l - px, px - (l + ws[i]), 0);
                if (gap < best - 1e-9) {
                    best = gap;
                    to = i;
                    bayL = l;
                }
            }
        }
        let plan = { valid: false, reason: 'Outside the wardrobe: releasing here cancels the move.' }, ax = it.ax || 'c';
        if (to >= 0) {
            const w = WardrobePlanner.itemWidth(it, ws[from.i]), local = px - (interactionState.drag?.offsetX || 0) - bayL;
            /** @type {Array<["l" | "c" | "r", number]>} */ const choices = [['l', w / 2], ['c', ws[to] / 2], ['r', ws[to] - w / 2]];
            choices.sort((a, b) => Math.abs(local - a[1]) - Math.abs(local - b[1]));
            ax = choices[0][0];
            const lay = geometry.computeLayout(to), centerY = py - (interactionState.drag?.offsetY || 0);
            let slot;
            if (swap) {
                const x0 = ax === 'l' ? 0 : ax === 'r' ? ws[to] - w : (ws[to] - w) / 2, x1 = x0 + w;
                const candidates = lay.map((q, j) => ({ q, j })).filter(({ q, j }) => !(to === from.i && j === from.j) && py >= q.y0 && py <= q.y1 && x0 < q.x1 - .01 && q.x0 < x1 - .01);
                candidates.sort((a, b) => Math.abs(local - (a.q.x0 + a.q.x1) / 2) - Math.abs(local - (b.q.x0 + b.q.x1) / 2));
                slot = candidates[0]?.j;
                plan = slot === undefined ? { valid: false, reason: 'Point at another item to swap. Both items must fit their new sections.' } : geometry.planItemMove(from, to, slot, true);
            }
            else {
                plan = geometry.planFreeMove(from, to, { x: local - w / 2, y: centerY - it.h / 2 - (PLINTH + PANEL) }, { free: e.altKey });
            }
        }
        rendering.clearPreview(false);
        interactionState.previewPlan = plan;
        const status = $('#move-status'), message = tags([...noticeLabels(plan.reason), ...(plan.valid ? [interactionState.drag?.started ? 'Release · Place' : 'Click · Place', 'Esc · Cancel'] : [])]);
        status.hidden = false;
        status.classList.toggle('bad', !plan.valid);
        if (status.innerHTML !== message) {
            status.innerHTML = message;
        }
        resources.cv.style.cursor = plan.valid ? 'grabbing' : 'not-allowed';
        renderState.previewGroup = new THREE.Group();
        renderState.previewGroup.position.copy(renderState.Gr.position);
        renderState.previewGroup.rotation.copy(renderState.Gr.rotation);
        resources.scene.add(renderState.previewGroup);
        const outline = (q, i, color, opacity = 1) => {
            const left = -model.activeCabinet().state.w / 2 + PANEL + ws.slice(0, i).reduce((a, b) => a + b + PANEL, 0), geo = new THREE.BoxGeometry(q.w, q.h || q.y1 - q.y0, model.activeCabinet().state.d + 1), edges = new THREE.EdgesGeometry(geo);
            geo.dispose();
            const o = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
            o.position.set(left + (q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, 0);
            o.renderOrder = 20;
            renderState.previewGroup.add(o);
        };
        if (plan.valid) {
            for (const [i, lay] of Object.entries(plan.layouts)) {
                const old = geometry.computeLayout(+i);
                lay.forEach((q, j) => {
                    if (+i === plan.to && j === plan.index) {
                        outline(q, +i, 0x1f9d6b);
                    }
                    else if (!old[j] || Math.abs(old[j].y0 - q.y0) > .01 || Math.abs(old[j].x0 - q.x0) > .01) {
                        outline(q, +i, plan.swap ? 0xe5a000 : 0x2f5bea, .65);
                    }
                });
            }
        }
        else if (to >= 0) {
            const g = new THREE.BoxGeometry(WardrobePlanner.itemWidth(it, ws[from.i]), it.h, model.activeCabinet().state.d), edges = new THREE.EdgesGeometry(g);
            g.dispose();
            const o = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xd6383a, depthTest: false }));
            {
                const hw = WardrobePlanner.itemWidth(it, ws[from.i]) / 2, hh = it.h / 2, cl = (v, a, b) => a > b ? (a + b) / 2 : Math.max(a, Math.min(b, v));
                o.position.set(cl(px - (interactionState.drag?.offsetX || 0), xL + hw, xR - hw), cl(py - (interactionState.drag?.offsetY || 0), yB + hh, yT - hh), model.activeCabinet().state.d + 3);
            }
            o.renderOrder = 20;
            renderState.previewGroup.add(o);
        }
        const keep = new Set();
        if (plan.valid) {
            rendering.drawClearances(plan, it, keep);
        }
        else if (to >= 0) {
            keep.add('reason');
            rendering.setPreviewLabel('reason', new THREE.Vector3(px, Math.min(yT, py - (interactionState.drag?.offsetY || 0) + it.h / 2 + 8), model.activeCabinet().state.d / 2 + 4), noticeLabels(plan.reason).join(' · '), 'lbl dim clearance bad preview');
        }
        rendering.dropPreviewLabels(keep);
    }
    function commitItemMove(plan) {
        if (!plan?.valid) {
            return false;
        }
        if (plan.unchanged) {
            shell.toast(plan.reason);
            return false;
        }
        const old = new Map(renderState.itemGroups.map(g => [g.it, g])), source = old.get(model.activeCabinet().state.secs[plan.from.i][plan.from.j]), target = plan.swap ? old.get(model.activeCabinet().state.secs[plan.to][plan.index]) : null;
        commands.applyMove(plan);
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const now = performance.now();
            renderState.itemGroups.forEach(g => {
                const previous = g.it === plan.moved ? source : plan.swap && g.i === plan.from.i && g.j === plan.from.j ? target : old.get(g.it);
                if (!previous) {
                    return;
                }
                const dx = previous.x - g.x, dy = previous.y - g.y;
                if (Math.abs(dx) + Math.abs(dy) < .01) {
                    return;
                }
                const lift = g.it === plan.moved ? model.activeCabinet().state.d + 4 : previous === target ? model.activeCabinet().state.d * 2 + 8 : 0;
                g.group.position.set(dx, dy, 0);
                renderState.settling.push({ group: g.group, dx, dy, lift, start: now });
            });
        }
        return true;
    }
    function performMove(plan) {
        if (model.activeCabinet().state.doors !== 'none' && !model.activeCabinet().state.open) {
            shell.toast('Open the doors before moving items.');
            return false;
        }
        cancelMovement();
        if (!plan.valid) {
            shell.toast(plan.reason);
            return false;
        }
        return commitItemMove(plan);
    }
    function keyboardMove(key) {
        const from = { i: model.activeCabinet().state.sel, j: model.activeCabinet().state.item };
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            const slot = geometry.verticalNeighbor(model.activeCabinet().state.sel, model.activeCabinet().state.item, key === 'ArrowUp' ? 1 : -1);
            if (slot < 0) {
                shell.toast('No item ' + (key === 'ArrowUp' ? 'above' : 'below') + ' in this stack.');
                return;
            }
            performMove(geometry.planItemMove(from, model.activeCabinet().state.sel, slot, true));
        }
        else {
            const to = model.activeCabinet().state.sel + (key === 'ArrowRight' ? 1 : -1);
            performMove(geometry.planItemMove(from, to, model.activeCabinet().state.secs[to]?.length || 0));
        }
    }
    return { beginDividerDrag, moveDividerDrag, finishDividerDrag, frontPoint: picking.frontPoint, cancelMovement, armMovement, previewAt, commitItemMove, cast: picking.cast, hitAt: picking.hitAt, pick, hover, groundPoint: picking.groundPoint, beginRotation, rotateFromPointer, finishRotation, screenPoint: picking.screenPoint, beginWardrobeDrag, moveWardrobeFromPointer, finishWardrobeDrag, beginItemEdgeResize, moveItemEdgeResize, finishItemEdgeResize, buildSnapContext, snapPxPerCm, snapItemEdge, performMove, keyboardMove, setManualItemSize };
}
