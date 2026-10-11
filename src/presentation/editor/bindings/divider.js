/** Divider panel and divider dragging.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./divider.ports').BindDividerClosePorts} ports */
export function bindDividerClose({ dom, inspector }) {
    const { $ } = dom;
    $('#divider-close').onclick = () => inspector.hidePop();
}
/** @param {import('./divider.ports').BindDividerGapPorts} ports */
export function bindDividerGap({ dom, rendering, inspector, shell, geometry, model, commands, history }) {
    const { $ } = dom;
    [0, 1].forEach(k => {
        const input = $('#dgap' + k), side = k ? 'after' : 'before';
        const commit = () => {
            const index = model.activeCabinet().state.divider, value = ( /** @type {HTMLInputElement} */(input)).valueAsNumber;
            if (!model.activeCabinet().state.dividers?.[index]) {
                return;
            }
            if (!Number.isFinite(value) || value < 0) {
                shell.toast('Enter a distance of zero or more centimetres');
                inspector.dividerUI();
                return;
            }
            const before = model.snapshot(), changed = commands.setDividerClearance(index, side, value);
            if (changed) {
                history.checkpoint(before);
                inspector.histUI();
                rendering.refreshDividerVisual(index);
                const cur = geometry.dividerMeasurements(index);
                if (cur && Math.abs(cur[side] - value) > .15) {
                    shell.toast('Distance limited by the items or wardrobe boundary');
                }
            }
            inspector.dividerUI();
            rendering.positionLabels();
        };
        input.onkeydown = e => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                commit();
                input.blur();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                inspector.dividerUI();
                input.blur();
            }
        };
        input.onchange = commit;
    });
}
/** Height of a vertical divider, typed in centimetres.
 * @param {import('./divider.ports').BindDividerHeightPorts} ports */
export function bindDividerHeight({ dom, inspector, model, commands, shell }) {
    const { $ } = dom;
    const input = $('#dheight');
    const commit = () => {
        const index = model.activeCabinet().state.divider, value = ( /** @type {HTMLInputElement} */(input)).valueAsNumber;
        if (!model.activeCabinet().state.dividers?.[index]) return;
        if (!Number.isFinite(value)) {
            shell.toast('Enter a height in centimetres');
            inspector.dividerUI();
            return;
        }
        commands.setDividerHeight(index, value);
        inspector.update(true);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
}
/** @param {import('./divider.ports').BindDividerRemovePorts} ports */
export function bindDividerRemove({ dom, commands }) {
    const { $ } = dom;
    $('#divider-remove').onclick = () => commands.removeDivider();
}
/** @param {import('./divider.ports').BindDividerDragMovePorts} ports */
export function bindDividerDragMove({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointermove', e => interactions.moveDividerDrag(e));
}
/** @param {import('./divider.ports').BindDividerDragEndPorts} ports */
export function bindDividerDragEnd({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointerup', () => interactions.finishDividerDrag());
}
/** @param {import('./divider.ports').BindDividerDragCancelPorts} ports */
export function bindDividerDragCancel({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointercancel', () => interactions.finishDividerDrag(true));
}
/** @param {import('./divider.ports').BindDividerDragBlurPorts} ports */
export function bindDividerDragBlur({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'blur', () => interactions.finishDividerDrag(true));
}
/** @param {import('./divider.ports').BindDividerDragEscapePorts} ports */
export function bindDividerDragEscape({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (interactionState.dividerGesture && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            interactions.finishDividerDrag(true);
        }
    }, true);
}
