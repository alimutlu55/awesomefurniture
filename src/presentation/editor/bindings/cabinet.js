import { FIN } from '../../../domain/wardrobe/catalog.js';
/** Whole-wardrobe controls: size, finish, reach, doors, wardrobe list, reset.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./cabinet.ports').BindCabinetDimensionsPorts} ports */
export function bindCabinetDimensions({ dom, rendering, inspector, selectionState, model, sceneCommands, history, lifetime }) {
    const { $ } = dom;
    /** @type {Array<[string,string,number,number]>} */ const dimensions = [['w', 'Width', 80, 400], ['h', 'Height', 180, 280], ['d', 'Depth', 35, 80]];
    dimensions.forEach(([id, t, mi, ma]) => {
        $('#sliders').insertAdjacentHTML('beforeend', `<div class="size-control"><label class="size-row" for="${id}"><span>${t}<b id="${id}v"></b></span><span class="size-field"><input type="number" inputmode="numeric" id="${id}" min="${mi}" max="${ma}" step="1" aria-label="Wardrobe ${t.toLowerCase()}"><small>cm</small></span></label><input class="size-range" type="range" id="${id}-range" data-dimension="${id}" min="${mi}" max="${ma}" step="1" aria-label="Adjust wardrobe ${t.toLowerCase()}"></div>`);
        const el = $('#' + id);
        const range = /** @type {HTMLInputElement} */ ($('#' + id + '-range'));
        const commit = value => {
            if (value !== model.activeCabinet().state[id] && sceneCommands.setCabinetSize(id, value)) {
                inspector.update();
            }
            ( /** @type {HTMLInputElement} */(el)).value = model.activeCabinet().state[id];
            range.value = model.activeCabinet().state[id];
            range.setAttribute('aria-valuetext', range.value + ' cm');
        };
        lifetime.listen(el, 'change', () => commit(( /** @type {HTMLInputElement} */(el)).valueAsNumber));
        let before = null;
        const finishSlide = (cancel = false) => {
            if (before === null) return;
            const snapshot = before;
            before = null;
            selectionState.editingSize = false;
            if (cancel) model.restore(snapshot);
            else if (model.snapshot() !== snapshot) history.checkpoint(snapshot);
            inspector.update(true);
        };
        lifetime.listen(range, 'input', () => {
            if (before === null) before = model.snapshot();
            selectionState.editingSize = true;
            sceneCommands.setCabinetSize(id, range.valueAsNumber, false);
            inspector.update(true);
        });
        // Preview each input, but save only the original state in Undo.
        lifetime.listen(range, 'change', () => finishSlide());
        lifetime.listen(range, 'blur', () => finishSlide());
        lifetime.listen(range, 'pointercancel', () => finishSlide(true));
        lifetime.listen(el, 'focus', () => {
            selectionState.editingSize = true;
            rendering.build();
        });
        lifetime.listen(el, 'blur', () => {
            selectionState.editingSize = false;
            rendering.build();
        });
        lifetime.listen(el, 'keydown', e => {
            if (e.key === 'Enter') {
                el.blur();
            }
        });
    });
}
/** @param {import('./cabinet.ports').BindFinishSwatchesPorts} ports */
export function bindFinishSwatches({ dom, commands }) {
    const { $, document } = dom;
    Object.entries(FIN).forEach(([n, [c]]) => {
        const b = document.createElement('button');
        b.className = 'sw';
        b.dataset.f = n;
        b.title = n;
        b.style.background = String(c);
        b.onclick = () => commands.setFinish(/** @type {import('../../../domain/wardrobe/editor-design').EditorDesign['fin']} */ (n));
        $('#fins').appendChild(b);
    });
}
/** @param {import('./cabinet.ports').BindReachChangePorts} ports */
export function bindReachChange({ dom, inspector, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wardrobe-reach'), 'change', e => {
        commands.setWardrobeReach(e.target.valueAsNumber);
        inspector.reachUI();
    });
}
/** @param {import('./cabinet.ports').BindReachBlurPorts} ports */
export function bindReachBlur({ dom, inspector, model, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wardrobe-reach'), 'blur', e => {
        if (Number.isFinite(e.target.valueAsNumber) && e.target.valueAsNumber !== model.activeCabinet().state.profile.reach) {
            commands.setWardrobeReach(e.target.valueAsNumber);
        }
        inspector.reachUI();
    });
}
/** @param {import('./cabinet.ports').BindReachEnterPorts} ports */
export function bindReachEnter({ dom, inspector, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wardrobe-reach'), 'keydown', e => {
        if (e.key === 'Enter') {
            commands.setWardrobeReach(e.target.valueAsNumber);
            inspector.reachUI();
            e.target.blur();
        }
        else if (e.key === 'Escape') {
            e.stopPropagation();
            inspector.reachUI();
            e.target.blur();
        }
    });
}
/** @param {import('./cabinet.ports').BindReachLineTogglePorts} ports */
export function bindReachLineToggle({ dom, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wardrobe-reach-line'), 'change', e => commands.setReachLine(e.target.checked));
}
/** @param {import('./cabinet.ports').BindDoorChoicePorts} ports */
export function bindDoorChoice({ dom, commands }) {
    const { document } = dom;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-d]')).forEach(b => b.onclick = () => commands.setDoors(/** @type {import('../../../domain/wardrobe/editor-design').EditorDesign['doors']} */ (b.dataset.d)));
}
/** @param {import('./cabinet.ports').RenderDoorChoicesPorts} ports */
export function renderDoorChoices({ dom, }) {
    const { document } = dom;
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-d]'))) {
        const k = b.dataset.d, art = k === 'none' ? '<circle cx="23" cy="22" r="12"/><path d="m15 13 16 18"/>' : '<path d="M5 3h36v38H5zM17 3v38M29 3v38" fill="' + (k === 'glass' ? '#b1b0a780' : '#a49a89') + '"/><path d="M15 20v5m16-5v5"/>';
        b.innerHTML = '<span class="door-art"><svg viewBox="0 0 46 46" fill="none" stroke="#77736c" stroke-width="1">' + art + '</svg></span><span>' + b.textContent + '</span>';
        b.setAttribute('aria-label', k === 'none' ? 'No doors' : k + ' doors');
    }
}
/** @param {import('./cabinet.ports').BindDoorsOpenTogglePorts} ports */
export function bindDoorsOpenToggle({ dom, model }) {
    const { $ } = dom;
    $('#open').onclick = () => {
        model.activeCabinet().state.open = !model.activeCabinet().state.open;
    };
}
/** @param {import('./cabinet.ports').BindWardrobeSelectPorts} ports */
export function bindWardrobeSelect({ dom, inspector }) {
    const { $ } = dom;
    $('#wardrobe-select').onchange = e => inspector.selectCabinet(Number(( /** @type {HTMLInputElement} */(e.target)).value));
}
/** @param {import('./cabinet.ports').BindWardrobeAddPorts} ports */
export function bindWardrobeAdd({ dom, inspector }) {
    const { $ } = dom;
    $('#wardrobe-add').onclick = () => inspector.addCabinet();
}
/** @param {import('./cabinet.ports').BindResetAllPorts} ports */
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
