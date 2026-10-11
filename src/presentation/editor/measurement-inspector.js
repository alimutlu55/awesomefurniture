import { tags } from './storage-tags.js';
import { syncResizeFields } from './resize-fields.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { measureNumber, capWord, esc } from './editor-format.js';
/** @param {Pick<import('./inspector-presenter.ports').CreateInspectorPresenterPorts, 'dom' | 'geometry' | 'shell' | 'commands' | 'rendering' | 'model' | 'history'> & { callbacks: Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'histUI' | 'hidePop' | 'divWord'> }} ports */
export function createMeasurementInspector({ dom, geometry, shell, commands, rendering, model, history, callbacks }) {
    const { $, document } = dom;
    function editableItemClearance(el, i, j, side) {
        const name = side === 'top' ? 'Distance above item' : 'Distance below item', current = () => {
            const m = geometry.itemMeasurements(i, j);
            return m ? m[side] : 0;
        };
        el.classList.add('editable-clearance');
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', name + ' in centimetres');
        el.title = 'Click to enter a distance';
        const edit = () => {
            if (el.classList.contains('editing')) {
                return;
            }
            const m = geometry.itemMeasurements(i, j), b = geometry.itemYBounds(i, j);
            if (!m || !b) {
                return;
            }
            const input = document.createElement('input'), unit = document.createElement('span');
            input.type = 'number';
            input.min = '0';
            input.step = '0.1';
            input.inputMode = 'decimal';
            input.value = measureNumber(m[side]);
            input.setAttribute('aria-label', name + ' in centimetres');
            unit.textContent = ' cm';
            el.replaceChildren(input, unit);
            el.classList.add('editing');
            el.removeAttribute('role');
            let done = false;
            const finish = (cancel = false) => {
                if (done) {
                    return;
                }
                done = true;
                const value = input.valueAsNumber;
                let res = null;
                if (!cancel) {
                    if (!Number.isFinite(value) || value < 0) {
                        shell.toast('Enter a distance of zero or more centimetres');
                    }
                    else {
                        res = commands.setItemClearance(i, j, side, value);
                    }
                }
                if (res && res.changed) {
                    if (res.limited) {
                        shell.toast('Distance limited by the neighbouring items or the wardrobe boundary');
                    }
                    return;
                }
                el.classList.remove('editing');
                el.setAttribute('role', 'button');
                el.textContent = measureNumber(current()) + ' cm';
                if (res && res.limited) {
                    shell.toast('Distance limited by the neighbouring items or the wardrobe boundary');
                }
                rendering.positionLabels();
            };
            input.onkeydown = e => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finish(false);
                }
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(true);
                }
            };
            input.onblur = () => finish();
            input.focus({ preventScroll: true });
            input.select();
            rendering.positionLabels();
        };
        el.onpointerdown = e => e.stopPropagation();
        el.onclick = () => edit();
        el.onkeydown = e => {
            if (e.target === el && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                e.stopPropagation();
                edit();
            }
        };
    }
    function editableDividerClearance(el, index, side) {
        const describe = () => {
            const m = geometry.dividerMeasurements(index);
            return !m ? 'Clearance' : m.hor ? (side === 'before' ? 'Distance below shelf' : 'Distance above shelf') : (side === 'before' ? 'Distance left of divider' : 'Distance right of divider');
        };
        el.classList.add('editable-clearance');
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', describe() + ' in centimetres');
        el.title = 'Click to enter a distance';
        const edit = () => {
            if (el.classList.contains('editing')) {
                return;
            }
            const m = geometry.dividerMeasurements(index);
            if (!m) {
                return;
            }
            const input = document.createElement('input'), unit = document.createElement('span');
            input.type = 'number';
            input.min = '0';
            ( /** @type {HTMLInputElement} */(input)).max = measureNumber(m.before + m.after);
            input.step = '0.1';
            input.inputMode = 'decimal';
            input.value = measureNumber(m[side]);
            input.setAttribute('aria-label', describe() + ' in centimetres');
            unit.textContent = ' cm';
            el.replaceChildren(input, unit);
            el.classList.add('editing');
            el.removeAttribute('role');
            let done = false;
            const finish = (cancel = false, focus = false) => {
                if (done) {
                    return;
                }
                done = true;
                const value = input.valueAsNumber, before = model.snapshot();
                let changed = false;
                if (!cancel) {
                    if (!Number.isFinite(value) || value < 0) {
                        shell.toast('Enter a distance of zero or more centimetres');
                    }
                    else {
                        changed = commands.setDividerClearance(index, side, value);
                    }
                }
                el.classList.remove('editing');
                el.setAttribute('role', 'button');
                const current = geometry.dividerMeasurements(index);
                el.textContent = measureNumber(current?.[side] || 0) + ' cm';
                if (changed) {
                    history.checkpoint(before);
                    callbacks.histUI();
                    rendering.refreshDividerVisual(index);
                    if (Math.abs(current[side] - value) > .15) {
                        shell.toast('Distance limited by the items or wardrobe boundary');
                    }
                }
                rendering.positionLabels();
                if (focus) {
                    el.focus({ preventScroll: true });
                }
            };
            input.onkeydown = e => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finish(false, true);
                }
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(true, true);
                }
            };
            input.onblur = () => finish();
            input.focus({ preventScroll: true });
            input.select();
            rendering.positionLabels();
        };
        el.onpointerdown = e => e.stopPropagation();
        el.onclick = () => edit();
        el.onkeydown = e => {
            if (e.target === el && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                e.stopPropagation();
                edit();
            }
        };
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
            const w = callbacks.divWord(model.activeCabinet().state.divider);
            $('#divider-title').textContent = dom.width <= 900 && panel.dataset.contextSection === 'resize' ? 'Size' : capWord(w);
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
                const rows = [['Size · width × height × depth', f(m.width) + ' × ' + f(m.height) + ' × ' + f(m.depth) + ' cm'], [hor ? 'Free below / above' : 'Free left / right', f(m.before) + ' / ' + f(m.after) + ' cm'], ['X · left → right edge', f(bayL + m.x0) + ' → ' + f(bayL + m.x1) + ' cm'], ['Y · bottom → top from floor', f(PLINTH + PANEL + m.y0) + ' → ' + f(PLINTH + PANEL + m.y1) + ' cm'], ['Z · back → front', f(.5) + ' → ' + f(model.activeCabinet().state.d - 1.5) + ' cm']];
                $('#dmeas').innerHTML = rows.map(r => '<b>' + r[0] + '</b><span>' + esc(r[1]) + '</span>').join('');
            }
        }
        $('#divider-hint').innerHTML = tags([d.orientation === 'horizontal' ? 'Drag ↕' : 'Drag ↔', 'Boundary snap']);
        syncResizeFields(panel);
    }
    return { editableItemClearance, editableDividerClearance, dividerUI };
}
