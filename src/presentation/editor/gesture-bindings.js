import { MODS } from '../../domain/wardrobe/catalog.js';
import { ibIcon } from './editor-format.js';
/** DOM event bindings call application commands through the mounted view ports. */
/** @param {import('./gesture-bindings.ports').ObserveViewportSizePorts} ports */
export function observeViewportSize({ dom, camera, lifetime }) {
    const { $ } = dom;
    lifetime.observe(new ResizeObserver(camera.resize), $('#view'));
}
/** @param {import('./gesture-bindings.ports').BindCanvasPointerdownPorts} ports */
export function bindCanvasPointerdown({ dom, camera, interactions, inspector, picking, interactionState, renderState, selectionState, resources, model, lifetime }) {
    lifetime.listen(resources.cv, 'pointerdown', e => {
        camera.camRelease();
        if (interactionState.rotationGesture) {
            interactionState.rotationClick = true;
            interactions.finishRotation();
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
        if (selectionState.focusOn && !inspector.inside()) {
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
/** @param {import('./gesture-bindings.ports').BindCanvasPointermovePorts} ports */
export function bindCanvasPointermove({ dom, camera, rendering, interactions, inspector, cameraState, interactionState, resources, lifetime }) {
    const { $ } = dom;
    lifetime.listen(resources.cv, 'pointermove', e => {
        if (interactionState.dividerGesture) {
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
            else if (interactionState.moved >= 5) {
                cameraState.az -= (e.clientX - o.clientX) * .007;
                cameraState.el = Math.max(0, Math.min(1.35, cameraState.el + (e.clientY - o.clientY) * .007));
                inspector.hidePop();
            }
        }
        interactionState.ptrs.set(e.pointerId, e);
        if (interactionState.ptrs.size === 2) {
            const [a, b] = [...interactionState.ptrs.values()], nd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
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
/** @param {import('./gesture-bindings.ports').BindCanvasPointerupPorts} ports */
export function bindCanvasPointerup({ dom, interactions, shell, interactionState, resources, lifetime }) {
    lifetime.listen(resources.cv, 'pointerup', e => {
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
/** @param {import('./gesture-bindings.ports').BindCanvasPointercancelPorts} ports */
export function bindCanvasPointercancel({ dom, interactions, interactionState, resources, lifetime }) {
    lifetime.listen(resources.cv, 'pointercancel', e => {
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag(true);
        }
        interactionState.ptrs.delete(e.pointerId);
        interactionState.moved = 99;
        interactions.cancelMovement();
    });
}
/** @param {import('./gesture-bindings.ports').BindCanvasLostpointercapturePorts} ports */
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
/** @param {import('./gesture-bindings.ports').BindWindowBlur2Ports} ports */
export function bindWindowBlur2({ dom, interactions, interactionState, lifetime }) {
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
/** @param {import('./gesture-bindings.ports').BindCanvasWheelPorts} ports */
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
/** @param {import('./gesture-bindings.ports').BindCanvasPointerleavePorts} ports */
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
/** @param {import('./gesture-bindings.ports').BindViewPorts} ports */
export function bindView({ dom, inspector, picking, renderState, selectionState, resources, model, lifetime }) {
    const { $, document, window } = dom;
    const cancelMove = document.createElement('button');
    cancelMove.type = 'button';
    cancelMove.className = 'mobile-cancel-move';
    cancelMove.textContent = 'Cancel move';
    cancelMove.hidden = true;
    $('#view').append(cancelMove);
    lifetime.listen(cancelMove, 'click', () => $('#move-cancel').click());
    (function buildItemBar() {
        selectionState.itemBar = document.createElement('div');
        dom.setId(selectionState.itemBar, 'item-bar');
        selectionState.itemBar.hidden = true;
        selectionState.itemBar.setAttribute('role', 'toolbar');
        selectionState.itemBar.setAttribute('aria-label', 'Item actions');
        selectionState.itemBar.innerHTML = [['dup', 'Duplicate (Ctrl/Cmd+D)'], ['del', 'Remove (Delete)'], ['typ', 'Change type']].map(([k, t]) => '<button type="button" data-ib="' + k + '" title="' + t + '" aria-label="' + t + '"' + (k === 'del' ? ' class="dl"' : '') + '>' + ibIcon(k) + '</button>').join('');
        selectionState.itemTypeMenu = document.createElement('div');
        dom.setId(selectionState.itemTypeMenu, 'item-type-menu');
        selectionState.itemTypeMenu.hidden = true;
        selectionState.itemTypeMenu.innerHTML = Object.entries(MODS).filter(([k]) => k !== 'void').map(([k, m]) => '<button type="button" data-itm="' + k + '">' + (k === 'short' ? 'Hanging rail' : m.n) + '</button>').join('');
        selectionState.ctxMenu = document.createElement('div');
        dom.setId(selectionState.ctxMenu, 'ctx-menu');
        selectionState.ctxMenu.hidden = true;
        selectionState.ctxMenu.setAttribute('role', 'menu');
        selectionState.ctxMenu.innerHTML = [['dup', 'Duplicate', 'Ctrl/Cmd+D'], ['del', 'Remove', 'Del'], ['mov', 'Move on model', ''], ['swap', 'Swap with another item', ''], ['al-l', 'Align left', ''], ['al-c', 'Centre', ''], ['al-r', 'Align right', ''], ['full', 'Full width', '']].map(([k, t, h]) => '<button type="button" role="menuitem" data-cm="' + k + '"' + (k === 'del' ? ' class="dl"' : '') + '>' + t + (h ? '<kbd>' + h + '</kbd>' : '') + '</button>').join('');
        $('#view').append(selectionState.itemBar, selectionState.itemTypeMenu, selectionState.ctxMenu);
        for (const el of [selectionState.itemBar, selectionState.itemTypeMenu, selectionState.ctxMenu]) {
            lifetime.listen(el, 'pointerdown', e => e.stopPropagation());
            lifetime.listen(el, 'mousedown', e => e.preventDefault());
            lifetime.listen(el, 'contextmenu', e => e.preventDefault());
        }
        selectionState.itemBar.onclick = e => {
            const b = e.target.closest(dom.selector('[data-ib]'));
            if (!b || b.disabled) {
                return;
            }
            const k = b.dataset.ib;
            if (model.activeCabinet().state.divider >= 0 && (k === 'dup' || k === 'del')) {
                $(k === 'dup' ? '#divider-dup' : '#divider-remove').click();
                return;
            }
            if (k === 'typ') {
                const was = !selectionState.itemTypeMenu.hidden;
                inspector.closeItemMenus();
                selectionState.itemTypeMenu.hidden = was;
                if (!was) {
                    inspector.placeItemTypeMenu();
                }
                return;
            }
            inspector.itemAction(k);
        };
        selectionState.itemTypeMenu.onclick = e => {
            const b = e.target.closest(dom.selector('[data-itm]'));
            if (b) {
                inspector.itemAction('t-' + b.dataset.itm);
            }
        };
        selectionState.ctxMenu.onclick = e => {
            const b = e.target.closest(dom.selector('[data-cm]'));
            if (b) {
                inspector.itemAction(b.dataset.cm);
            }
        };
        lifetime.listen(window, 'pointerdown', e => {
            if (!e.target.closest(dom.selector('#item-bar,#item-type-menu,#ctx-menu'))) {
                inspector.closeItemMenus();
            }
        }, true);
        lifetime.listen(window, 'keydown', e => {
            if (e.key === 'Escape' && ((!selectionState.itemTypeMenu.hidden) || (!selectionState.ctxMenu.hidden))) {
                e.stopImmediatePropagation();
                inspector.closeItemMenus();
            }
        }, true);
        lifetime.listen(resources.cv, 'wheel', inspector.closeItemMenus, { passive: true });
        lifetime.listen(resources.cv, 'contextmenu', e => {
            if (!selectionState.focusOn || !inspector.inside()) {
                return;
            }
            const m = picking.cast(e, renderState.allItemHits);
            if (!m || m.object.userData.wardrobe !== model.scene.activeWardrobe || m.object.userData.divider !== undefined) {
                inspector.closeItemMenus();
                return;
            }
            e.preventDefault();
            const u = m.object.userData;
            model.activeCabinet().state.divider = -1;
            selectionState.deep = true;
            selectionState.pillOn = false;
            model.activeCabinet().state.sel = u.i;
            model.activeCabinet().state.item = u.j;
            inspector.update();
            inspector.showPop(e, '#pop3');
            inspector.closeItemMenus();
            const vr = $('#view').getBoundingClientRect();
            selectionState.ctxMenu.hidden = false;
            inspector.placeFloating(selectionState.ctxMenu, e.clientX - vr.left, e.clientY - vr.top);
        });
    })();
}
/** @param {import('./gesture-bindings.ports').BindWindowKeydown3Ports} ports */
export function bindWindowKeydown3({ dom, interactions, interactionState, lifetime }) {
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
/** @param {import('./gesture-bindings.ports').BindResetAllPorts} ports */
export function bindResetAll({ dom, inspector, shell, plannerState, sceneCommands }) {
    const { $ } = dom;
    $('#reset-all').onclick = () => {
        if (!sceneCommands.resetCabinet()) {
            return;
        }
        inspector.hidePop();
        plannerState.emptyDismissed = false;
        inspector.update();
        shell.toast('Wardrobe reset. Undo (Ctrl/Cmd+Z) brings it back.');
    };
}
/** @param {import('./gesture-bindings.ports').BindWindowKeydown4Ports} ports */
export function bindWindowKeydown4({ dom, interactions, inspector, planner, shell, interactionState, selectionState, model, commands, lifetime }) {
    const { $, window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (e.key === 'Escape') {
            if (interactionState.drag || interactionState.moveMode) {
                interactionState.ptrs.clear();
                interactionState.moved = 99;
                interactions.cancelMovement();
                shell.toast('Move cancelled.');
                return;
            }
            if (!$('#wizard').hidden) {
                inspector.hidePop();
                planner.closeWizard();
            }
            else if (model.activeCabinet().state.item >= 0 || model.activeCabinet().state.divider >= 0) {
                inspector.goUp('section');
            }
            else if (selectionState.deep && selectionState.focusOn) {
                inspector.goUp('wardrobe');
            }
            else {
                inspector.clearFocus();
            }
        }
        if (!$('#wizard').hidden || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) {
            return;
        }
        const k = e.key.toLowerCase();
        if (e.shiftKey && model.activeCabinet().state.item >= 0 && e.key.startsWith('Arrow')) {
            e.preventDefault();
            interactions.keyboardMove(e.key);
            return;
        }
        if (e.key === 'ArrowRight') {
            model.activeCabinet().state.sel = (model.activeCabinet().state.sel + 1) % model.activeCabinet().state.n;
            model.activeCabinet().state.item = -1;
            selectionState.deep = selectionState.pillOn = true;
            inspector.update();
        }
        else if (e.key === 'ArrowLeft') {
            model.activeCabinet().state.sel = (model.activeCabinet().state.sel + model.activeCabinet().state.n - 1) % model.activeCabinet().state.n;
            model.activeCabinet().state.item = -1;
            selectionState.deep = selectionState.pillOn = true;
            inspector.update();
        }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = model.activeCabinet().state.secs[model.activeCabinet().state.sel].length;
            if (n) {
                model.activeCabinet().state.item = Math.max(0, Math.min(n - 1, (model.activeCabinet().state.item < 0 ? (e.key === 'ArrowUp' ? -1 : n) : model.activeCabinet().state.item) + (e.key === 'ArrowUp' ? 1 : -1)));
                inspector.update();
            }
        }
        else if (e.key === 'Backspace' || (e.key === 'Delete' && model.activeCabinet().state.item >= 0)) {
            e.preventDefault();
            if (selectionState.focusOn) {
                commands.removeTop();
            }
            else {
                inspector.update();
            }
        }
        else {
            const m = Object.keys(MODS).find(x => MODS[x].k.toLowerCase() === k);
            if (m) {
                commands.addMod(/** @type {import('../../domain/wardrobe/wardrobe').ItemKind} */ (m));
            }
        }
    });
}
/** @param {import('./gesture-bindings.ports').BindPopPminPorts} ports */
export function bindPopPmin({ dom, inspector, selectionState, lifetime }) {
    const { document } = dom;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.pop .pmin')).forEach(b => lifetime.listen(b, 'click', e => {
        e.stopPropagation();
        selectionState.popMin = !selectionState.popMin;
        const p = b.closest(dom.selector('.pop'));
        inspector.syncMin(p);
        inspector.layoutPop(p);
    }));
}
/** @param {import('./gesture-bindings.ports').BindPopPhPorts} ports */
export function bindPopPh({ dom, camera, inspector, cameraState, selectionState, lifetime }) {
    const { $, document } = dom;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.pop .ph')).forEach(h => {
        h.title = '';
        lifetime.listen(h, 'pointerdown', e => {
            if (1) {
                return;
            }
            const p = /** @type {HTMLElement} */ (h.closest(dom.selector('.pop'))), pr = p.getBoundingClientRect(), v = $('#view').getBoundingClientRect(), ox = e.clientX - pr.left, oy = e.clientY - pr.top;
            h.setPointerCapture(e.pointerId);
            h.style.cursor = 'grabbing';
            const mv = ev => {
                const x = Math.max(0, Math.min(v.width - p.offsetWidth, ev.clientX - v.left - ox)), y = Math.max(0, Math.min(v.height - 60, ev.clientY - v.top - oy));
                p.classList.remove('docked');
                p.style.right = 'auto';
                p.style.left = x + 'px';
                p.style.top = y + 'px';
                selectionState.popPos = { x, y };
                cameraState.vsT = camera.baseShift();
                cameraState.vzT = 1;
            }, up = () => {
                h.style.cursor = '';
                h.removeEventListener('pointermove', mv);
                h.removeEventListener('pointerup', up);
            };
            lifetime.listen(h, 'pointermove', mv);
            lifetime.listen(h, 'pointerup', up);
        });
        lifetime.listen(h, 'dblclick', e => {
            if (e.target.closest(dom.selector('button'))) {
                return;
            }
            selectionState.popPos = null;
            inspector.dockPop(h.closest(dom.selector('.pop')));
        });
    });
}
/** @param {import('./gesture-bindings.ports').BindPxPorts} ports */
export function bindPx({ dom, inspector }) {
    const { $ } = dom;
    $('#px').onclick = inspector.hidePop;
}
/** @param {import('./gesture-bindings.ports').BindPop2Ports} ports */
export function bindPop2({ dom, inspector, model, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#pop2'), 'click', e => {
        const b = e.target.closest(dom.selector('button'));
        if (!b || dom.controlId(b) === 'px') {
            return;
        }
        const i = model.activeCabinet().state.sel, d = b.dataset;
        if (d.r !== undefined) {
            model.activeCabinet().state.item = +d.r;
            inspector.update();
            inspector.swapPop('#pop3');
            inspector.itemUI();
        }
        else if (d.m) {
            commands.addMod(d.m);
        }
        else if (d.a === 'fit') {
            commands.run(() => commands.autofill(i));
        }
        else if (d.a === 'clear') {
            commands.clearSection(i);
        }
        else if (d.a === 'divider') {
            commands.addSpaceDivider();
            if (model.activeCabinet().state.divider >= 0) {
                inspector.showPop(null, '#pop4');
            }
        }
    });
}
