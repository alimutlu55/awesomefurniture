import { sceneMeasurementBadge } from './scene-measurement-badge';
import { tags } from './storage-tags.js';
import { syncResizeFields } from './resize-fields.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { fittingDepth } from '../../domain/wardrobe/carcass';
import { measureNumber, capWord, esc, unitSuffix } from './editor-format.js';
/** @param {Pick<import('./inspector-presenter.ports').CreateInspectorPresenterPorts, 'dom' | 'geometry' | 'shell' | 'commands' | 'rendering' | 'model' | 'history'> & { callbacks: Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'histUI' | 'hidePop' | 'divWord'> }} ports */
export function createMeasurementInspector({ dom, geometry, model, callbacks }) {
    const { $ } = dom;
    function editableItemClearance(el, i, j, side) {
        const m = geometry.itemMeasurements(i, j);
        if (!m) return;
        sceneMeasurementBadge(el, { kind: 'item-gap', section: i, index: j, side },
            side === 'top' ? 'Distance above item' : 'Distance below item', side === 'top' ? m.gapAbove : m.gapBelow, 'vertical');
    }
    function editableDividerClearance(el, index, side) {
        const m = geometry.dividerMeasurements(index);
        if (!m) return;
        const label = m.hor ? (side === 'before' ? 'Distance below shelf' : 'Distance above shelf')
            : (side === 'before' ? 'Distance left of divider' : 'Distance right of divider');
        sceneMeasurementBadge(el, { kind: 'board-gap', index, side }, label, m[side], m.hor ? 'vertical' : 'horizontal');
    }
    function dividerUI(force = false) {
        const d = model.activeCabinet().state.dividers?.[model.activeCabinet().state.divider], panel = $('#pop4');
        if (!force && !panel.classList.contains('show') && !$('#app').classList.contains('v-div') && !dom.document.querySelector('.contextual-control-popover:not([hidden])')) {
            return;
        }
        if (!d) {
            callbacks.hidePop();
            return;
        }
        {
            // Vertical dividers have a height; shelves are set by their gaps alone.
            const vertical = d.orientation !== 'horizontal', heightRow = $('#divider-height-row');
            heightRow.hidden = !vertical;
            heightRow.style.display = vertical ? '' : 'none';
            if (vertical) /** @type {HTMLInputElement} */ ($('#dheight')).value = measureNumber(d.y1 - d.y0);
            const w = callbacks.divWord(model.activeCabinet().state.divider);
            $('#divider-title').textContent = panel.dataset.contextSection === 'resize' ? 'Size' : capWord(w);
            $('#divider-remove').title = 'Remove this ' + w;
            $('#divider-close').setAttribute('aria-label', 'Close ' + w + ' settings');
            panel.querySelector('.pmin')?.setAttribute('aria-label', 'Collapse ' + w + ' panel');
            panel.querySelector('.item-actions')?.setAttribute('aria-label', capWord(w) + ' actions');
        }
        {
            const dup = $('#divider-dup'), spot = geometry.dividerDupSpot(model.activeCabinet().state.divider);
            dup.disabled = spot == null;
            dup.title = spot == null ? 'No room for another ' + callbacks.divWord(model.activeCabinet().state.divider) + ' here' : 'Duplicate this ' + callbacks.divWord(model.activeCabinet().state.divider);
        }
        {
            const m = geometry.dividerMeasurements(model.activeCabinet().state.divider);
            if (m) {
                const w = callbacks.divWord(model.activeCabinet().state.divider), hor = m.hor, f = measureNumber, names = hor ? ['Gap below', 'Gap above'] : ['Gap left', 'Gap right'], ws = geometry.widths(), bayL = PANEL + ws.slice(0, d.i).reduce((a, b) => a + b + PANEL, 0);
                [0, 1].forEach(k => {
                    const input = $('#dgap' + k);
                    $('#dgap' + k + '-l').textContent = names[k];
                    input.setAttribute('aria-label', names[k]);
                    ( /** @type {HTMLInputElement} */(input)).max = f(m.before + m.after);
                    if (document.activeElement !== input) {
                        ( /** @type {HTMLInputElement} */(input)).value = f(k ? m.after : m.before);
                    }
                });
                const rows = [['Size · width × height × depth', f(m.width) + ' × ' + f(m.height) + ' × ' + f(m.depth) + unitSuffix()], [hor ? 'Free below / above' : 'Free left / right', f(m.before) + ' / ' + f(m.after) + unitSuffix()], ['X · left → right edge', f(bayL + m.x0) + ' → ' + f(bayL + m.x1) + unitSuffix()], ['Y · bottom → top from floor', f(geometry.interiorFloor() + m.y0) + ' → ' + f(geometry.interiorFloor() + m.y1) + unitSuffix()], ['Z · back → front', f(fittingDepth(model.activeCabinet().state.d).z0) + ' → ' + f(fittingDepth(model.activeCabinet().state.d).z1) + unitSuffix()]];
                const cut = geometry.boardFit(d.i, geometry.dividerRect(d), d.orientation);
                if (cut?.cut) {
                    rows.splice(1, 0, ['Cut to the top', hor ? 'angled · ' + f(cut.length) + unitSuffix() + ' whole board' : 'angled top']);
                }
                $('#dmeas').innerHTML = rows.map(r => '<b>' + r[0] + '</b><span>' + esc(r[1]) + '</span>').join('');
            }
        }
        $('#divider-hint').innerHTML = tags([d.orientation === 'horizontal' ? 'Drag ↕' : 'Drag ↔', 'Boundary snap']);
        syncResizeFields(panel);
    }
    return { editableItemClearance, editableDividerClearance, dividerUI };
}
