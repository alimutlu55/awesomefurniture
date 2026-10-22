import { MIN_CABINET_DEPTH, MIN_WARDROBE_WIDTH } from '../../../domain/wardrobe/cabinet-limits';
import { bindDecorPicker } from '../decor-picker';
import { sizeControlMarkup, bindSizeNumber, bindSizeSlider } from '../size-control';
import { measureNumber, unitSuffix } from '../editor-format.js';
import { createTactileEdits } from '../../../application/commands/tactile-edits';
/** Whole-wardrobe controls: size, finish, doors, wardrobe list, reset.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./cabinet.ports').BindCabinetDimensionsPorts} ports */
export function bindCabinetDimensions({ dom, rendering, inspector, selectionState, model, sceneCommands, history, lifetime }) {
    const { $ } = dom;
    // Sliders and the canvas labels share one reversible, boundary-clamped resize.
    // The slider's transaction records history, so previews do not checkpoint again.
    const edits = createTactileEdits({ model, checkpoint() {} });
    /** @type {Array<[string,string,number,number]>} */ const dimensions = [
        ['w', 'Width', MIN_WARDROBE_WIDTH, 600], ['h', 'Height', 180, 300],
        ['d', 'Depth', MIN_CABINET_DEPTH, 90], ['y', 'From floor', 0, 200]];
    dimensions.forEach(([id, t, mi, ma]) => {
        $('#sliders').insertAdjacentHTML('beforeend', sizeControlMarkup({ label: t, min: mi, max: ma, valueLabelId: id + 'v',
            inputAttributes: { id, inputmode: 'decimal', 'aria-label': id === 'y' ? 'Height above the floor' : 'Wardrobe ' + t.toLowerCase() },
            rangeAttributes: { id: id + '-range', 'data-dimension': id, 'aria-label': id === 'y' ? 'Adjust height above the floor' : 'Adjust wardrobe ' + t.toLowerCase() } }));
        // A kitchen unit with a gap beside it, between the wall or its neighbours: one tap widens it to fill the room.
        if (id === 'w') {
            $('#sliders').insertAdjacentHTML('beforeend', '<button type="button" id="fill-gap" class="fill-gap" hidden></button>');
            lifetime.listen($('#fill-gap'), 'click', () => { if (sceneCommands.fillSpace()) inspector.update(true); });
        }
        const el = $('#' + id);
        const range = /** @type {HTMLInputElement} */ ($('#' + id + '-range'));
        // A wall unit also has a height above the floor: part of its place in the room, not of its size.
        const lift = id === 'y', read = () => lift ? model.activeCabinet().y || 0 : model.activeCabinet().state[id];
        const commit = value => {
            if (value !== read() && (lift ? sceneCommands.setCabinetPose('y', value) : sceneCommands.setCabinetSize(id, value))) {
                inspector.update();
            }
            ( /** @type {HTMLInputElement} */(el)).value = read();
            range.value = read();
            range.setAttribute('aria-valuetext', measureNumber(Number(range.value)) + unitSuffix());
        };
        const started = () => { selectionState.editingSize = /** @type {'w' | 'h' | 'd'} */ (id); };
        let startValue = 0;
        bindSizeSlider({ range, lifetime, model, history,
            started: () => { started(); startValue = read(); if (!lift) edits.beginDimension(/** @type {'w' | 'h' | 'd'} */ (id)); },
            finished: () => { if (!lift) edits.finish(); selectionState.editingSize = false; },
            preview: value => lift ? sceneCommands.previewTranslation(model.activeCabinet().id, { x: model.activeCabinet().x, y: value, z: model.activeCabinet().z }) : edits.previewDimension(value - startValue),
            refresh: () => inspector.update(true) });
        bindSizeNumber({ input: /** @type {HTMLInputElement} */ (el), lifetime, commit,
            started: () => { started(); rendering.build(); }, finished: () => { selectionState.editingSize = false; inspector.update(true); } });
    });
}
/** @param {import('./cabinet.ports').BindFinishSwatchesPorts} ports */
export function bindFinishSwatches({ dom, commands }) {
    bindDecorPicker(dom.$('#fins'), commands);
}
/** @param {import('./cabinet.ports').BindDoorChoicePorts} ports */
export function bindDoorChoice({ dom, commands }) {
    const { $, document } = dom;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-d]')).forEach(b => b.onclick = () => commands.setDoors(/** @type {import('../../../domain/wardrobe/editor-design').EditorDesign['doors']} */ (b.dataset.d)));
    const fins = $('#fins');
    if (fins?.insertAdjacentHTML && !document.querySelector('#door-hang')) {
        fins.insertAdjacentHTML('afterend', '<div id="door-hang" class="door-hang" role="group" aria-label="Door handle and hinge side"><span>Handle side</span><div class="door-hang-seg">'
            + '<button type="button" data-hang="" title="Automatic handle placement">Auto</button>'
            + '<button type="button" data-hang="right" title="Handle on the left · hinges on the right">Left</button>'
            + '<button type="button" data-hang="left" title="Handle on the right · hinges on the left">Right</button></div></div>'
            + '<div id="corner-side" class="door-hang" role="group" aria-label="Corner door side" hidden><span>Corner door</span><div class="door-hang-seg">'
            + '<button type="button" data-hang="corner-l" title="Door on the left half · blind panel on the right">Left half</button>'
            + '<button type="button" data-hang="corner-r" title="Door on the right half · blind panel on the left">Right half</button></div></div>');
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#door-hang [data-hang],#corner-side [data-hang]')).forEach(b => b.onclick = () => commands.setDoorHang(/** @type {'left' | 'right' | 'corner-l' | 'corner-r' | null} */ (b.dataset.hang || null)));
    }
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
export function bindResetAll({ dom, inspector, shell, plannerState, sceneCommands, model }) {
    const { $ } = dom;
    $('#reset-all').onclick = () => {
        if (!sceneCommands.resetCabinet()) {
            return;
        }
        inspector.hidePop();
        plannerState.emptyDismissed = false;
        inspector.update();
        shell.toast(model.activeCabinet().name + ' reset. Undo (Ctrl/Cmd+Z) brings it back.');
    };
}
