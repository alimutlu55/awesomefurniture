import { takeMobilePanel } from './mobile-panel-owner.js';
import { animateMobileSheetClose } from './mobile-sheet-motion.js';
import * as THREE from "three";
import { PANEL, itemName } from '../../domain/wardrobe/catalog.js';
import { measureNumber, esc, unitSuffix } from './editor-format.js';
/** Add sheets that add to the scene (the room's parts, fixtures, new furniture) rather than into the selected space. */
const SCENE_ADD = ['ceilings', 'fixtures', 'room', 'studio', 'wall', 'wardrobe', 'kitchen', 'furniture'];
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
        if (p.dataset.contextSection !== 'resize') cameraState.vzT = 1;
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
    function showPop(e, id, mode = null) {
        if ((id === '#pop3' || id === '#pop4') && mode !== 'resize') {
            callbacks.hidePop();
            takeMobilePanel(dom, $(id));
            camera.camRelease();
            return;
        }
        const p = $(id), v = $('#view').getBoundingClientRect();
        if (mode === 'resize') p.dataset.contextSection = 'resize';
        else delete p.dataset.contextSection;
        animateMobileSheetClose($('#left'));
        $('#app').classList.remove('props-open');
        callbacks.hidePop();
        takeMobilePanel(dom, p);
        if (id === '#pop2') {
            // This catalogue has no expand control: never inherit a collapsed inspector.
            selectionState.popMin = false;
            // Add item adds to the selected furniture; Walls, Wall items, Wardrobe and Cabinets add to the scene.
            if (SCENE_ADD.includes(mode)) p.dataset.addContext = mode;
            else delete p.dataset.addContext;
            callbacks.renderAddChoices();
        }
        p.classList.add('show');
        p.scrollTop = 0;
        popUI();
        callbacks.itemUI();
        callbacks.dividerUI();
        placePop(p, e, v);
        if (id === '#pop2') {
            $('#app').classList.add('adding', 'inspecting');
            // Adding to the scene frames the scene: its opener does that.
            if (!p.dataset.addContext) camera.camRelease();
        }
        else {
            $('#app').classList.remove('adding');
            $('#app').classList.add('inspecting');
            if (mode === 'resize') camera.camRelease(true);
            else camera.frameMobileInspector(true);
        }
    }
    function popUI() {
        const p = $('#pop2');
        if (!p.classList.contains('show')) {
            return;
        }
        const ws = geometry.widths(), i = model.activeCabinet().state.sel, iw = ws.reduce((a, b) => a + b), w = ws[i], one = model.activeCabinet().state.n < 2;
        const titles = { ceilings: 'Ceiling', fixtures: 'Fixtures', room: 'Walls', studio: 'Add to room', wall: 'Add to wall', wardrobe: 'Add a wardrobe', kitchen: 'Add a cabinet', furniture: 'Add furniture' };
        $('#ptitle').textContent = titles[p.dataset.addContext] ?? 'Add to this space';
        const space = geometry.sectionSpaceMeasurements(i);
        $('#section-meta').textContent = 'Space · W ' + measureNumber(space.w) + ' × H ' + measureNumber(space.h) + ' × D ' + measureNumber(space.dep) + unitSuffix() + ' free';
        $('#pfree').textContent = measureNumber(geometry.free(i)) + unitSuffix() + ' free';
        const content = dom.document.querySelector('#pcont');
        if (content) {
            content.innerHTML = model.activeCabinet().state.secs[i].length ? model.activeCabinet().state.secs[i].map((it, j) => '<button type="button" data-r="' + j + '"><span>' + esc(itemName(it)) + '</span><small>' + measureNumber(it.h) + unitSuffix() + '</small></button>').reverse().join('') : '<p class="sub">Empty · Add fitting</p>';
        }
        if (selectionState.addKey !== model.activeCabinet().state.sel) {
            callbacks.renderAddChoices();
        }
    }
    function swapPop(to) {
        if (to === '#pop3' || to === '#pop4') {
            showPop(null, to);
            return;
        }
        if (to === '#pop2') {
            // Returning from item editing must reset the catalogue's scene context and collapsed state too.
            showPop(null, to);
            return;
        }
        const o = to === '#pop2' ? '#pop3' : '#pop2', f = $(o), t = $(to);
        t.style.left = f.style.left;
        t.style.right = f.style.right;
        t.style.top = f.style.top;
        t.dataset.side = f.dataset.side || '';
        t.classList.toggle('docked', f.classList.contains('docked'));
        animateMobileSheetClose(f);
        f.classList.remove('show');
        takeMobilePanel(dom, t);
        t.classList.add('show');
        syncMin(t);
        layoutPop(t);
        $('#app').classList.add('inspecting');
        $('#app').classList.toggle('adding', to === '#pop2');
        camera.frameMobileInspector(to !== '#pop2');
    }
    return { sideFor, layoutPop, dockPop, syncMin, placePop, showPop, popUI, swapPop };
}
