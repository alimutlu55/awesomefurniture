/** Floating panels and the toolbar: minimise, drag, close, colour scheme.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** DOM event bindings call application commands through the mounted view ports. */
/** @param {import('./panels.ports').BindInspectorControlsPorts} ports */
export function bindInspectorControls({ dom, rendering, lifetime }) {
    const { matchMedia } = dom;
    lifetime.listen(matchMedia('(prefers-color-scheme: dark)'), 'change', rendering.theme);
}
/** @param {import('./panels.ports').BindToolbarPorts} ports */
export function bindToolbar({ dom, }) {
    const { $ } = dom;
    $('#toolbar').insertAdjacentHTML('beforeend', '<span class="sep"></span>');
}
/** @param {import('./panels.ports').BindPopPminPorts} ports */
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
/** @param {import('./panels.ports').BindPopPhPorts} ports */
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
/** @param {import('./panels.ports').BindPxPorts} ports */
export function bindPx({ dom, inspector }) {
    const { $ } = dom;
    $('#px').onclick = inspector.hidePop;
}
