import * as THREE from "three";
import { PANEL, itemName } from '../../domain/wardrobe/catalog.js';
import { measureNumber, esc } from './editor-format.js';
/** @param {Pick<import('./inspector-presenter.ports').CreateInspectorPresenterPorts, 'dom' | 'geometry' | 'model' | 'resources' | 'cameraState' | 'camera' | 'selectionState'> & { callbacks: Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop' | 'renderAddChoices' | 'itemUI' | 'dividerUI'> }} ports */
export function createInspectorPanels({ dom, geometry, model, resources, cameraState, camera, selectionState, callbacks }) {
    const { $ } = dom;
    function sideFor() {
        const ws = geometry.widths(), i = model.activeCabinet().state.sel;
        let x, y;
        const g = model.activeCabinet().state.item >= 0 ? geometry.itemGeom(i, model.activeCabinet().state.item) : null;
        if (g) {
            x = (g.x0 + g.x1) / 2;
            y = (g.y0 + g.y1) / 2;
        }
        else {
            x = PANEL + ws.slice(0, i).reduce((a, b) => a + b + PANEL, 0) + ws[i] / 2;
            y = model.activeCabinet().state.h / 2;
        }
        const q = new THREE.Vector3(-model.activeCabinet().state.w / 2 + x, y, model.activeCabinet().state.d / 2), r = $('#view').getBoundingClientRect();
        resources.cam.updateMatrixWorld();
        q.project(resources.cam);
        return (q.x - 2 * cameraState.vs / r.width) / cameraState.vz > 0 ? 'l' : 'r';
    }
    function layoutPop(p) {
        cameraState.vsT = camera.baseShift();
        cameraState.vzT = 1;
    }
    function dockPop(p) {
        p.classList.add("docked");
        p.dataset.side = "r";
        p.style.top = p.style.left = p.style.right = "";
        layoutPop(p);
    }
    function syncMin(p) {
        p.classList.toggle('min', selectionState.popMin);
        const b = p.querySelector('.pmin');
        b.textContent = selectionState.popMin ? '▴' : '▾';
        b.title = selectionState.popMin ? 'Expand panel' : 'Collapse panel';
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-expanded', String(!selectionState.popMin));
    }
    function placePop(p, e, v) {
        syncMin(p);
        dockPop(p);
    }
    function showPop(e, id) {
        const p = $(id), v = $('#view').getBoundingClientRect();
        callbacks.hidePop();
        if (id === '#pop2') {
            callbacks.renderAddChoices();
        }
        p.classList.add('show');
        popUI();
        callbacks.itemUI();
        callbacks.dividerUI();
        placePop(p, e, v);
        if (id === '#pop2' && dom.width <= 900) {
            $('#app').classList.add('adding', 'inspecting');
            camera.frameMobileInspector();
        }
        else if (dom.width <= 900) {
            $('#app').classList.remove('adding');
            $('#app').classList.add('inspecting');
            camera.frameMobileInspector();
        }
    }
    function popUI() {
        const p = $('#pop2');
        if (!p.classList.contains('show')) {
            return;
        }
        const ws = geometry.widths(), i = model.activeCabinet().state.sel, iw = ws.reduce((a, b) => a + b), w = ws[i], one = model.activeCabinet().state.n < 2;
        $('#ptitle').textContent = 'Add to this space';
        const space = geometry.sectionSpaceMeasurements(i);
        $('#section-meta').textContent = 'Space · W ' + measureNumber(space.w) + ' × H ' + measureNumber(space.h) + ' × D ' + measureNumber(space.dep) + ' cm free';
        $('#pfree').textContent = geometry.free(i) + ' cm free';
        const content = dom.document.querySelector('#pcont');
        if (content) {
            content.innerHTML = model.activeCabinet().state.secs[i].length ? model.activeCabinet().state.secs[i].map((it, j) => '<button type="button" data-r="' + j + '"><span>' + esc(itemName(it)) + '</span><small>' + it.h + ' cm</small></button>').reverse().join('') : '<p class="sub">Empty · Add fitting</p>';
        }
        if (selectionState.addKey !== model.activeCabinet().state.sel) {
            callbacks.renderAddChoices();
        }
    }
    function swapPop(to) {
        if (to === '#pop2') {
            callbacks.renderAddChoices();
        }
        const o = to === '#pop2' ? '#pop3' : '#pop2', f = $(o), t = $(to);
        t.style.left = f.style.left;
        t.style.right = f.style.right;
        t.style.top = f.style.top;
        t.dataset.side = f.dataset.side || '';
        t.classList.toggle('docked', f.classList.contains('docked'));
        f.classList.remove('show');
        t.classList.add('show');
        syncMin(t);
        layoutPop(t);
    }
    return { sideFor, layoutPop, dockPop, syncMin, placePop, showPop, popUI, swapPop };
}
