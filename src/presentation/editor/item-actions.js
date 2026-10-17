import { furnitureModule } from '../../domain/furniture/furniture';
import * as THREE from "three";
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { capWord } from './editor-format.js';
/** @param {Pick<import('./inspector-presenter.ports').CreateInspectorPresenterPorts, 'dom' | 'selectionState' | 'model' | 'commands' | 'interactions' | 'interactionState' | 'renderState' | 'geometry' | 'resources'> & { callbacks: Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'inside' | 'divWord'> }} ports */
export function createItemActions({ dom, selectionState, model, commands, interactions, interactionState, renderState, geometry, resources, callbacks }) {
    const { $, document } = dom;
    function closeItemMenus() {
        if (selectionState.itemTypeMenu) {
            selectionState.itemTypeMenu.hidden = true;
        }
        if (selectionState.ctxMenu) {
            selectionState.ctxMenu.hidden = true;
        }
    }
    function itemAction(a) {
        closeItemMenus();
        if (model.activeCabinet().state.item < 0) {
            return;
        }
        if (a === 'dup') {
            commands.duplicateItem();
        }
        else if (a === 'del') {
            commands.deleteItem();
        }
        else if (a === 'swap') {
            interactions.armMovement('swap');
        }
        else if (a === 'full') {
            ( /** @type {HTMLElement} */($('#pop3').querySelector('[data-iwfull]')))?.click();
        }
        else if (a.startsWith('al-')) {
            ( /** @type {HTMLElement} */($('#pop3').querySelector('[data-al="' + a.slice(3) + '"]')))?.click();
        }
        else if (a.startsWith('t-')) {
            ( /** @type {HTMLElement} */($('#itype').querySelector('[data-t="' + a.slice(2) + '"]')))?.click();
        }
    }
    function placeFloating(el, x, y) {
        const vr = $('#view').getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
        el.style.transform = 'translate(' + Math.round(Math.max(6, Math.min(vr.width - w - 6, x))) + 'px,' + Math.round(Math.max(6, Math.min(vr.height - h - 6, y))) + 'px)';
    }
    function placeItemTypeMenu() {
        // Only the kinds this furniture takes (kitchen fittings in a kitchen cabinet, wardrobe fittings in a wardrobe).
        const state = model.activeCabinet().state, module = furnitureModule(state);
        selectionState.itemTypeMenu.querySelectorAll('[data-itm]').forEach(o => { o.hidden = !module.allows(o.dataset.itm, state); });
        const b = selectionState.itemBar.getBoundingClientRect(), vr = $('#view').getBoundingClientRect(), h = selectionState.itemTypeMenu.offsetHeight, below = b.bottom - vr.top + 6;
        placeFloating(selectionState.itemTypeMenu, b.right - vr.left - selectionState.itemTypeMenu.offsetWidth, below + h > vr.height - 6 ? b.top - vr.top - h - 6 : below);
    }
    function updateItemBar() {
        if (!selectionState.itemBar) {
            return;
        }
        try {
            const it = model.activeCabinet().state.item >= 0 ? model.activeCabinet().state.secs[model.activeCabinet().state.sel]?.[model.activeCabinet().state.item] : null, dvt = model.activeCabinet().state.divider >= 0 ? model.activeCabinet().state.dividers?.[model.activeCabinet().state.divider] : null, show = ((!!it && model.activeCabinet().state.divider < 0) || !!dvt) && selectionState.focusOn && callbacks.inside() && !interactionState.moveMode && !interactionState.drag && !interactionState.dividerGesture && !interactionState.wardrobeGesture && !interactionState.rotationGesture && !interactionState.itemEdgeGesture && !renderState.overlayHeld && !document.querySelector('#labels .measurement-badge.is-editing');
            if (!show) {
                selectionState.itemBar.hidden = true;
                selectionState.itemTypeMenu.hidden = true;
                return;
            }
            if (!selectionState.itemBarCache || selectionState.itemBarCache.stamp !== renderState.buildStamp || selectionState.itemBarCache.S !== model.activeCabinet().state || selectionState.itemBarCache.sel !== model.activeCabinet().state.sel || selectionState.itemBarCache.item !== model.activeCabinet().state.item || selectionState.itemBarCache.dv !== model.activeCabinet().state.divider) {
                if (dvt) {
                    const m = geometry.dividerMeasurements(model.activeCabinet().state.divider), ws = geometry.widths(), bayL = PANEL + ws.slice(0, dvt.i).reduce((a, b) => a + b + PANEL, 0);
                    selectionState.itemBarCache = { stamp: renderState.buildStamp, S: model.activeCabinet().state, sel: model.activeCabinet().state.sel, item: model.activeCabinet().state.item, dv: model.activeCabinet().state.divider, g: m && { x0: bayL + m.x0, x1: bayL + m.x1, y0: PLINTH + PANEL + m.y0, y1: PLINTH + PANEL + m.y1 }, canDup: geometry.dividerDupSpot(model.activeCabinet().state.divider) != null };
                }
                else {
                    const g = geometry.itemMeasurements(model.activeCabinet().state.sel, model.activeCabinet().state.item);
                    selectionState.itemBarCache = { stamp: renderState.buildStamp, S: model.activeCabinet().state, sel: model.activeCabinet().state.sel, item: model.activeCabinet().state.item, dv: model.activeCabinet().state.divider, g, canDup: geometry.itemFreeAbove(model.activeCabinet().state.sel, model.activeCabinet().state.item) >= geometry.effectiveMin(it.k) || geometry.duplicateSideSpot(model.activeCabinet().state.sel, model.activeCabinet().state.item) != null };
                }
            }
            const g = selectionState.itemBarCache.g;
            if (!g || !renderState.Gr) {
                selectionState.itemBar.hidden = true;
                return;
            }
            const r = resources.cv.getBoundingClientRect(), vr = $('#view').getBoundingClientRect(), ox = r.left - vr.left, oy = r.top - vr.top, pr = (x, y) => {
                const q = renderState.Gr.localToWorld(new THREE.Vector3(-model.activeCabinet().state.w / 2 + x, y, model.activeCabinet().state.d / 2 + 4));
                q.project(resources.cam);
                return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height, z: q.z };
            }, tl = pr(g.x0, g.y1), tr = pr(g.x1, g.y1), bl = pr(g.x0, g.y0);
            if (tl.z > 1) {
                selectionState.itemBar.hidden = true;
                return;
            }
            {
                const dup = selectionState.itemBar.querySelector('[data-ib=dup]'), typ = selectionState.itemBar.querySelector('[data-ib=typ]'), w = dvt ? callbacks.divWord(model.activeCabinet().state.divider) : 'item';
                dup.disabled = !selectionState.itemBarCache.canDup;
                typ.hidden = !!dvt;
                if (dvt) {
                    closeItemMenus();
                }
                dup.title = selectionState.itemBarCache.canDup || !dvt ? 'Duplicate' + (dvt ? ' this ' + w : ' (Ctrl/Cmd+D)') : 'No room for another ' + w + ' here';
                selectionState.itemBar.querySelector('[data-ib=del]').title = 'Remove' + (dvt ? ' this ' + w : ' (Delete)');
                selectionState.itemBar.setAttribute('aria-label', capWord(w) + ' actions');
            }
            selectionState.itemBar.hidden = false;
            const bw = selectionState.itemBar.offsetWidth, bh = selectionState.itemBar.offsetHeight, leftLimit = 6, l = Math.min(tl.x, tr.x), rt = Math.max(tl.x, tr.x);
            let cx = rt - l > bw + 60 ? rt - bw / 2 - 14 : (l + rt) / 2;
            cx = Math.max(leftLimit + bw / 2, Math.min(r.width - 6 - bw / 2, cx));
            let cy = tl.y - 26 - bh / 2;
            if (cy - bh / 2 < 6) {
                cy = bl.y + 26 + bh / 2;
                if (cy + bh / 2 > r.height - 56) {
                    cy = 6 + bh / 2;
                }
            }
            selectionState.itemBar.style.transform = 'translate(' + Math.round(ox + cx - bw / 2) + 'px,' + Math.round(oy + cy - bh / 2) + 'px)';
            if (!selectionState.itemTypeMenu.hidden) {
                placeItemTypeMenu();
            }
        }
        catch (err) {
            selectionState.itemBar.hidden = true;
        }
    }
    return { closeItemMenus, itemAction, placeFloating, placeItemTypeMenu, updateItemBar };
}
