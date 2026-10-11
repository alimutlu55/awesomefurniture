import { PURPOSE } from '../../../domain/wardrobe/catalog.js';
/** The selected item: its panel, size fields, purpose, and edge resizing.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./item.ports').BindItemResizeEscapePorts} ports */
export function bindItemResizeEscape({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (interactionState.itemEdgeGesture && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            interactions.finishItemEdgeResize(true);
        }
    }, true);
}
/** @param {import('./item.ports').BindItemResizeBlurPorts} ports */
export function bindItemResizeBlur({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'blur', () => interactions.finishItemEdgeResize(true));
}
/** @param {import('./item.ports').BindItemDimensionsPorts} ports */
export function bindItemDimensions({ dom, camera, interactions, inspector, lifetime }) {
    const { $ } = dom;
    for (const [id, edge] of [['ih', 'top'], ['iw', 'right']]) {
        const input = $('#' + id);
        lifetime.listen(input, 'focus', () => {
            if (dom.width <= 900) {
                camera.camRelease();
                camera.moveViewOn();
            }
        });
        lifetime.listen(input, 'blur', () => {
            if (dom.width <= 900) camera.moveViewOff();
        });
        for (const event of ['change', 'blur']) {
            lifetime.listen(input, event, () => interactions.setManualItemSize(edge, ( /** @type {HTMLInputElement} */(input)).valueAsNumber));
        }
        lifetime.listen(input, 'keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                interactions.setManualItemSize(edge, ( /** @type {HTMLInputElement} */(input)).valueAsNumber);
                input.blur();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                inspector.itemUI();
                input.blur();
            }
        });
    }
}
/** @param {import('./item.ports').BindItemPanelClosePorts} ports */
export function bindItemPanelClose({ dom, inspector }) {
    const { $ } = dom;
    $('#ix').onclick = inspector.hidePop;
}
/** @param {import('./item.ports').BindItemPanelPorts} ports */
export function bindItemPanel({ dom, interactions, inspector, selectionState, geometry, model, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#pop3'), 'click', e => {
        const b = e.target.closest(dom.selector('button'));
        if (!b || dom.controlId(b) === 'ix') {
            return;
        }
        const i = model.activeCabinet().state.sel, a = model.activeCabinet().state.secs[i], j = model.activeCabinet().state.item, it = a[j], d = b.dataset;
        if (!it) {
            return;
        }
        if (d.iwfull) {
            commands.editItem(i, j, { fullWidth: true });
        }
        else if (d.al !== undefined) {
            commands.editItem(i, j, { align: d.al });
        }
        else if (d.t) {
            commands.editItem(i, j, { kind: d.t });
        }
        else if (d.f !== undefined) {
            commands.editItem(i, j, { finish: d.f });
        }
        else if (d.ia === 'up') {
            interactions.performMove(geometry.planItemMove({ i, j }, i, geometry.verticalNeighbor(i, j, 1), true));
        }
        else if (d.ia === 'down') {
            interactions.performMove(geometry.planItemMove({ i, j }, i, geometry.verticalNeighbor(i, j, -1), true));
        }
        else if (d.ia === 'dup') {
            commands.duplicateItem(i, j);
        }
        else if (d.ia === 'str') {
            commands.editItem(i, j, { stretch: true });
        }
        else if (d.ia === 'back') {
            model.activeCabinet().state.item = -1;
            selectionState.pillOn = true;
            inspector.update();
        }
        else if (d.ia === 'sec') {
            $('#move-section').open = true;
            $('#move-bay').focus();
        }
        else if (d.ia === 'del') {
            commands.deleteItem(i, j);
        }
    });
}
/** @param {import('./item.ports').PopulateStoragePurposesPorts} ports */
export function populateStoragePurposes({ dom, }) {
    const { $, document } = dom;
    Object.entries(PURPOSE).forEach(([value, name]) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = name;
        $('#ipurpose').appendChild(o);
    });
}
/** @param {import('./item.ports').BindItemPurposePorts} ports */
export function bindItemPurpose({ dom, model, commands }) {
    const { $ } = dom;
    $('#ipurpose').onchange = e => commands.editItem(model.activeCabinet().state.sel, model.activeCabinet().state.item, { purpose: /** @type {import('../../../domain/wardrobe/wardrobe').StoragePurpose} */ (( /** @type {HTMLInputElement} */(e.target)).value) });
}
