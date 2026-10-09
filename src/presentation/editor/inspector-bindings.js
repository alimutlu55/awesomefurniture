import { MODS, PURPOSE, FIN, ADD_ORDER } from '../../domain/wardrobe/catalog.js';
import { icon } from './editor-format.js';
/** DOM event bindings call application commands through the mounted view ports. */
/** @param {import('./inspector-bindings.ports').BindInspectorControlsPorts} ports */
export function bindInspectorControls({ dom, rendering, lifetime }) {
    const { matchMedia } = dom;
    lifetime.listen(matchMedia('(prefers-color-scheme: dark)'), 'change', rendering.theme);
}
/** @param {import('./inspector-bindings.ports').BindDividerClosePorts} ports */
export function bindDividerClose({ dom, inspector }) {
    const { $ } = dom;
    $('#divider-close').onclick = () => inspector.hidePop();
}
/** @param {import('./inspector-bindings.ports').BindDgapPorts} ports */
export function bindDgap({ dom, rendering, inspector, shell, geometry, model, commands, history }) {
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
/** @param {import('./inspector-bindings.ports').BindDividerRemovePorts} ports */
export function bindDividerRemove({ dom, commands }) {
    const { $ } = dom;
    $('#divider-remove').onclick = () => commands.removeDivider();
}
/** @param {import('./inspector-bindings.ports').BindWindowPointermovePorts} ports */
export function bindWindowPointermove({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointermove', e => interactions.moveDividerDrag(e));
}
/** @param {import('./inspector-bindings.ports').BindWindowPointerupPorts} ports */
export function bindWindowPointerup({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointerup', () => interactions.finishDividerDrag());
}
/** @param {import('./inspector-bindings.ports').BindWindowPointercancelPorts} ports */
export function bindWindowPointercancel({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointercancel', () => interactions.finishDividerDrag(true));
}
/** @param {import('./inspector-bindings.ports').BindWindowBlurPorts} ports */
export function bindWindowBlur({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'blur', () => interactions.finishDividerDrag(true));
}
/** @param {import('./inspector-bindings.ports').BindWindowKeydownPorts} ports */
export function bindWindowKeydown({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (interactionState.dividerGesture && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            interactions.finishDividerDrag(true);
        }
    }, true);
}
/** @param {import('./inspector-bindings.ports').BindSecMinusPorts} ports */
export function bindSecMinus({ dom, commands }) {
    const { $ } = dom;
    $('#sec-minus').onclick = () => commands.changeSections(-1);
}
/** @param {import('./inspector-bindings.ports').BindSecPlusPorts} ports */
export function bindSecPlus({ dom, commands }) {
    const { $ } = dom;
    $('#sec-plus').onclick = () => commands.changeSections(1);
}
/** @param {import('./inspector-bindings.ports').BindSectionDiagramPorts} ports */
export function bindSectionDiagram({ dom, inspector, model, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#section-diagram'), 'click', e => {
        const i = e.target.closest(dom.selector('[data-sec]'));
        if (!i) {
            return;
        }
        model.activeCabinet().state.sel = +i.dataset.sec;
        model.activeCabinet().state.item = -1;
        inspector.update();
    });
}
/** @param {import('./inspector-bindings.ports').BindCabinetDimensionsPorts} ports */
export function bindCabinetDimensions({ dom, rendering, inspector, selectionState, model, sceneCommands, lifetime }) {
    const { $ } = dom;
    /** @type {Array<[string,string,number,number]>} */ const dimensions = [['w', 'Width', 80, 400], ['h', 'Height', 180, 280], ['d', 'Depth', 35, 80]];
    dimensions.forEach(([id, t, mi, ma]) => {
        $('#sliders').insertAdjacentHTML('beforeend', `<label class="size-row" for="${id}"><span>${t}<b id="${id}v"></b></span><span class="size-field"><input type="number" id="${id}" min="${mi}" max="${ma}" step="1" aria-label="Wardrobe ${t.toLowerCase()}"><small>cm</small></span></label>`);
        const el = $('#' + id);
        lifetime.listen(el, 'change', () => {
            if (sceneCommands.setCabinetSize(id, ( /** @type {HTMLInputElement} */(el)).valueAsNumber)) {
                inspector.update();
            }
            ( /** @type {HTMLInputElement} */(el)).value = model.activeCabinet().state[id];
        });
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
/** @param {import('./inspector-bindings.ports').BindFinishSwatchesPorts} ports */
export function bindFinishSwatches({ dom, commands }) {
    const { $, document } = dom;
    Object.entries(FIN).forEach(([n, [c]]) => {
        const b = document.createElement('button');
        b.className = 'sw';
        b.dataset.f = n;
        b.title = n;
        b.style.background = String(c);
        b.onclick = () => commands.setFinish(/** @type {import('../../domain/wardrobe/editor-design').EditorDesign['fin']} */ (n));
        $('#fins').appendChild(b);
    });
}
/** @param {import('./inspector-bindings.ports').BindWardrobeReachPorts} ports */
export function bindWardrobeReach({ dom, inspector, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wardrobe-reach'), 'change', e => {
        commands.setWardrobeReach(e.target.valueAsNumber);
        inspector.reachUI();
    });
}
/** @param {import('./inspector-bindings.ports').BindWardrobeReach2Ports} ports */
export function bindWardrobeReach2({ dom, inspector, model, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wardrobe-reach'), 'blur', e => {
        if (Number.isFinite(e.target.valueAsNumber) && e.target.valueAsNumber !== model.activeCabinet().state.profile.reach) {
            commands.setWardrobeReach(e.target.valueAsNumber);
        }
        inspector.reachUI();
    });
}
/** @param {import('./inspector-bindings.ports').BindWardrobeReach3Ports} ports */
export function bindWardrobeReach3({ dom, inspector, commands, lifetime }) {
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
/** @param {import('./inspector-bindings.ports').BindWardrobeReachLinePorts} ports */
export function bindWardrobeReachLine({ dom, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wardrobe-reach-line'), 'change', e => commands.setReachLine(e.target.checked));
}
/** @param {import('./inspector-bindings.ports').BindMoreAddMenuPorts} ports */
export function bindMoreAddMenu({ dom, shell, commands }) {
    const { $, document } = dom;
    for (const k of ADD_ORDER) {
        const m = MODS[k], b = document.createElement('button');
        b.className = 'mi';
        b.dataset.m = k;
        b.setAttribute('role', 'menuitem');
        b.setAttribute('aria-keyshortcuts', m.k);
        b.innerHTML = icon(k) + '<span>' + m.n + '</span><kbd>' + m.k + '</kbd>';
        b.onclick = () => {
            commands.addMod(/** @type {import('../../domain/wardrobe/wardrobe').ItemKind} */ (k));
            shell.closeDD();
        };
        $('#more-menu').appendChild(b);
    }
}
/** @param {import('./inspector-bindings.ports').BindPillAddMenuPorts} ports */
export function bindPillAddMenu({ dom, commands, elements }) {
    const { document } = dom;
    for (const k of ADD_ORDER) {
        const m = MODS[k], b = document.createElement('button');
        b.className = 'mi';
        b.dataset.m = k;
        b.setAttribute('role', 'menuitem');
        b.setAttribute('aria-keyshortcuts', m.k);
        b.innerHTML = icon(k) + '<span>' + m.n + '</span><kbd>' + m.k + '</kbd>';
        b.onclick = () => {
            elements.pillMenu.hidden = true;
            commands.addMod(/** @type {import('../../domain/wardrobe/wardrobe').ItemKind} */ (k));
        };
        elements.pillMenu.appendChild(b);
    }
}
/** @param {import('./inspector-bindings.ports').BindWindowPointerdownPorts} ports */
export function bindWindowPointerdown({ dom, lifetime, elements }) {
    const { window } = dom;
    lifetime.listen(window, 'pointerdown', e => {
        if (!e.target.closest(dom.selector('#pill-menu,.lbl.add'))) {
            elements.pillMenu.hidden = true;
        }
    }, true);
}
/** @param {import('./inspector-bindings.ports').BindDataDPorts} ports */
export function bindDataD({ dom, commands }) {
    const { document } = dom;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-d]')).forEach(b => b.onclick = () => commands.setDoors(/** @type {import('../../domain/wardrobe/editor-design').EditorDesign['doors']} */ (b.dataset.d)));
}
/** @param {import('./inspector-bindings.ports').BindOpenPorts} ports */
export function bindOpen({ dom, model }) {
    const { $ } = dom;
    $('#open').onclick = () => {
        model.activeCabinet().state.open = !model.activeCabinet().state.open;
    };
}
/** @param {import('./inspector-bindings.ports').BindUndo2Ports} ports */
export function bindUndo2({ dom, inspector }) {
    const { $ } = dom;
    $('#undo2').onclick = inspector.undo;
}
/** @param {import('./inspector-bindings.ports').BindRedo2Ports} ports */
export function bindRedo2({ dom, inspector }) {
    const { $ } = dom;
    $('#redo2').onclick = inspector.redo;
}
/** @param {import('./inspector-bindings.ports').BindWindowKeydown2Ports} ports */
export function bindWindowKeydown2({ dom, inspector, selectionState, model, commands, lifetime }) {
    const { $, window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (!(e.metaKey || e.ctrlKey) || e.altKey || !$('#wizard').hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
            return;
        }
        const k = e.key.toLowerCase();
        if (k === 'z') {
            e.preventDefault();
            e.shiftKey ? inspector.redo() : inspector.undo();
        }
        else if (k === 'y') {
            e.preventDefault();
            inspector.redo();
        }
        else if (k === 'd' && selectionState.focusOn && model.activeCabinet().state.item >= 0) {
            e.preventDefault();
            commands.duplicateItem();
        }
    });
}
/** @param {import('./inspector-bindings.ports').BindWardrobeSelectPorts} ports */
export function bindWardrobeSelect({ dom, inspector }) {
    const { $ } = dom;
    $('#wardrobe-select').onchange = e => inspector.selectCabinet(Number(( /** @type {HTMLInputElement} */(e.target)).value));
}
/** @param {import('./inspector-bindings.ports').BindWardrobeAddPorts} ports */
export function bindWardrobeAdd({ dom, inspector }) {
    const { $ } = dom;
    $('#wardrobe-add').onclick = () => inspector.addCabinet();
}
/** @param {import('./inspector-bindings.ports').BindWindowKeydown5Ports} ports */
export function bindWindowKeydown5({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (interactionState.itemEdgeGesture && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            interactions.finishItemEdgeResize(true);
        }
    }, true);
}
/** @param {import('./inspector-bindings.ports').BindWindowBlur3Ports} ports */
export function bindWindowBlur3({ dom, interactions, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'blur', () => interactions.finishItemEdgeResize(true));
}
/** @param {import('./inspector-bindings.ports').BindMoveModePorts} ports */
export function bindMoveMode({ dom, interactions }) {
    const { $ } = dom;
    $('#move-mode').onclick = () => interactions.armMovement('move');
}
/** @param {import('./inspector-bindings.ports').BindSwapModePorts} ports */
export function bindSwapMode({ dom, interactions }) {
    const { $ } = dom;
    $('#swap-mode').onclick = () => interactions.armMovement('swap');
}
/** @param {import('./inspector-bindings.ports').BindMoveCancelPorts} ports */
export function bindMoveCancel({ dom, interactions }) {
    const { $ } = dom;
    $('#move-cancel').onclick = interactions.cancelMovement;
}
/** @param {import('./inspector-bindings.ports').BindMoveBayPorts} ports */
export function bindMoveBay({ dom, inspector }) {
    const { $ } = dom;
    $('#move-bay').onchange = () => {
        $('#move-slot').value = '';
        inspector.moveSlotUI();
    };
}
/** @param {import('./inspector-bindings.ports').BindMoveSlotPorts} ports */
export function bindMoveSlot({ dom, inspector }) {
    const { $ } = dom;
    $('#move-slot').onchange = inspector.moveSlotUI;
}
/** @param {import('./inspector-bindings.ports').BindMoveApplyPorts} ports */
export function bindMoveApply({ dom, interactions, geometry, model }) {
    const { $ } = dom;
    $('#move-apply').onclick = () => interactions.performMove(geometry.planItemMove({ i: model.activeCabinet().state.sel, j: model.activeCabinet().state.item }, +$('#move-bay').value, +$('#move-slot').value));
}
/** @param {import('./inspector-bindings.ports').BindWindowKeydown6Ports} ports */
export function bindWindowKeydown6({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (e.key === 'Shift' && interactionState.lastMoveEvent && (interactionState.drag?.started || interactionState.moveMode)) {
            interactions.previewAt({ ...interactionState.lastMoveEvent, clientX: interactionState.lastMoveEvent.clientX, clientY: interactionState.lastMoveEvent.clientY, shiftKey: true });
        }
    });
}
/** @param {import('./inspector-bindings.ports').BindWindowKeyupPorts} ports */
export function bindWindowKeyup({ dom, interactions, interactionState, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keyup', e => {
        if (e.key === 'Shift' && interactionState.lastMoveEvent && (interactionState.drag?.started || interactionState.moveMode)) {
            interactions.previewAt({ clientX: interactionState.lastMoveEvent.clientX, clientY: interactionState.lastMoveEvent.clientY, shiftKey: false });
        }
    });
}
/** @param {import('./inspector-bindings.ports').BindItemDimensionsPorts} ports */
export function bindItemDimensions({ dom, interactions, inspector, lifetime }) {
    const { $ } = dom;
    for (const [id, edge] of [['ih', 'top'], ['iw', 'right']]) {
        const input = $('#' + id);
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
/** @param {import('./inspector-bindings.ports').BindIxPorts} ports */
export function bindIx({ dom, inspector }) {
    const { $ } = dom;
    $('#ix').onclick = inspector.hidePop;
}
/** @param {import('./inspector-bindings.ports').BindPop3Ports} ports */
export function bindPop3({ dom, interactions, inspector, selectionState, geometry, model, commands, lifetime }) {
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
/** @param {import('./inspector-bindings.ports').PopulateStoragePurposesPorts} ports */
export function populateStoragePurposes({ dom, }) {
    const { $, document } = dom;
    Object.entries(PURPOSE).forEach(([value, name]) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = name;
        $('#ipurpose').appendChild(o);
    });
}
/** @param {import('./inspector-bindings.ports').BindIpurposePorts} ports */
export function bindIpurpose({ dom, model, commands }) {
    const { $ } = dom;
    $('#ipurpose').onchange = e => commands.editItem(model.activeCabinet().state.sel, model.activeCabinet().state.item, { purpose: /** @type {import('../../domain/wardrobe/wardrobe').StoragePurpose} */ (( /** @type {HTMLInputElement} */(e.target)).value) });
}
/** @param {import('./inspector-bindings.ports').BindEmptyXPorts} ports */
export function bindEmptyX({ dom, plannerState }) {
    const { $ } = dom;
    $('#empty-x').onclick = () => {
        plannerState.emptyDismissed = true;
        $('#empty-scene').hidden = true;
    };
}
/** @param {import('./inspector-bindings.ports').BindLaunchWizardPorts} ports */
export function bindLaunchWizard({ dom, planner }) {
    const { $ } = dom;
    $('#launch-wizard').onclick = planner.openWizard;
}
/** @param {import('./inspector-bindings.ports').BindEmptyLaunchPorts} ports */
export function bindEmptyLaunch({ dom, planner }) {
    const { $ } = dom;
    $('#empty-launch').onclick = planner.openWizard;
}
/** @param {import('./inspector-bindings.ports').BindCloseWizardPorts} ports */
export function bindCloseWizard({ dom, planner }) {
    const { $ } = dom;
    $('#close-wizard').onclick = planner.closeWizard;
}
/** @param {import('./inspector-bindings.ports').BindWizardPorts} ports */
export function bindWizard({ dom, planner, lifetime }) {
    const { $ } = dom;
    $('#wizard').querySelectorAll('input,select').forEach(el => {
        lifetime.listen(el, 'input', planner.markIdeasDirty);
        lifetime.listen(el, 'change', planner.markIdeasDirty);
    });
}
/** @param {import('./inspector-bindings.ports').BindIdeasPorts} ports */
export function bindIdeas({ dom, planner, shell, plannerState, geometry, commands }) {
    const { $ } = dom;
    $('#ideas').onclick = e => {
        const b = ( /** @type {HTMLElement} */(e.target)).closest(dom.selector('[data-idea]'));
        if (!b) {
            return;
        }
        if (plannerState.ideasConfig !== JSON.stringify({ ...geometry.plannerConfig(), ...planner.readPreferences(), engaged: 0 })) {
            planner.refreshIdeas(true);
            shell.toast('Setup changed. Choose from the refreshed ideas.');
            return;
        }
        commands.applyProposal(plannerState.ideas[+( /** @type {HTMLElement} */(b)).dataset.idea]);
        planner.closeWizard();
    };
}
/** @param {import('./inspector-bindings.ports').BindWizard2Ports} ports */
export function bindWizard2({ dom, planner, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wizard'), 'click', e => {
        if (e.target === $('#wizard')) {
            planner.closeWizard();
        }
    });
}
/** @param {import('./inspector-bindings.ports').BindWizard3Ports} ports */
export function bindWizard3({ dom, lifetime }) {
    const { $, document } = dom;
    lifetime.listen($('#wizard'), 'keydown', e => {
        if (e.key !== 'Tab') {
            return;
        }
        const focusable = [...$('#wizard').querySelectorAll('button,input,select,a,summary')].filter(el => !( /** @type {HTMLInputElement} */(el)).disabled && el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            ( /** @type {HTMLElement} */(last)).focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            ( /** @type {HTMLElement} */(first)).focus();
        }
    });
}
/** @param {import('./inspector-bindings.ports').BindToolbarPorts} ports */
export function bindToolbar({ dom, }) {
    const { $ } = dom;
    $('#toolbar').insertAdjacentHTML('beforeend', '<span class="sep"></span>');
}
/** @param {import('./inspector-bindings.ports').BindDataD2Ports} ports */
export function bindDataD2({ dom, }) {
    const { document } = dom;
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-d]'))) {
        const k = b.dataset.d, art = k === 'none' ? '<circle cx="23" cy="22" r="12"/><path d="m15 13 16 18"/>' : '<path d="M5 3h36v38H5zM17 3v38M29 3v38" fill="' + (k === 'glass' ? '#b1b0a780' : '#a49a89') + '"/><path d="M15 20v5m16-5v5"/>';
        b.innerHTML = '<span class="door-art"><svg viewBox="0 0 46 46" fill="none" stroke="#77736c" stroke-width="1">' + art + '</svg></span><span>' + b.textContent + '</span>';
        b.setAttribute('aria-label', k === 'none' ? 'No doors' : k + ' doors');
    }
}
