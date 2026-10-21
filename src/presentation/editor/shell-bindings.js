import { takeMobilePanel } from './mobile-panel-owner.js';
import { animateMobileSheetClose } from './mobile-sheet-motion.js';
import { mountMobileSheet } from './mobile-sheet.js';
import { dropdowns } from './editor-dom.js';
/** DOM event bindings call application commands through the mounted view ports. */
/** What each add context of the Add sheet opens on. 'furniture' is every kind of furniture, one tab each. */
const ADD_FOLDS = { room: ['.room-add'], wall: ['.room-add'], wardrobe: ['.shape-add'], kitchen: ['.kitchen-add'], furniture: ['.shape-add', '.kitchen-add'] };
/** Opens the Add sheet on what can be added to the scene: the room's parts, a new wardrobe or kitchen cabinets, or
 * any furniture.
 * @param {Pick<import('./shell-bindings.ports').BindFurnitureButtonsPorts, 'dom' | 'inspector' | 'shell'>} ports
 * @param {'room' | 'wall' | 'ceilings' | 'wardrobe' | 'kitchen' | 'furniture'} context */
export function openSceneAdd({ dom, inspector, shell }, context) {
    shell.closeDD();
    if (context !== 'wall' && context !== 'ceilings') inspector.clearFocus();
    inspector.showPop(null, '#pop2', context);
    for (const fold of ADD_FOLDS[context] ?? []) /** @type {HTMLDetailsElement} */ (dom.$('#pop2').querySelector(fold)).open = true;
}
/** Walls adds to the room. Add opens what furniture can be added, a tab per kind; furniture already in the room is
 * chosen by tapping it. Keep the view: its facing wall decides where.
 * @param {import('./shell-bindings.ports').BindFurnitureButtonsPorts} ports */
export function bindFurnitureButtons(ports) {
    const { dom, camera, lifetime } = ports, { $ } = dom;
    lifetime.listen($('#walls-btn'), 'click', () => { openSceneAdd(ports, 'room'); camera.frameScene(); });
    lifetime.listen($('#add-furniture-btn'), 'click', () => openSceneAdd(ports, 'furniture'));
}
/** @param {import('./shell-bindings.ports').BindDropdownOpenPorts} ports */
export function bindDropdownOpen({ dom, shell, lifetime }) {
    const { document } = dom;
    for (const [b, p] of dropdowns) {
        lifetime.listen(document.getElementById(b), 'click', e => {
            e.stopPropagation();
            shell.openDD(b, p);
        });
    }
}
/** @param {import('./shell-bindings.ports').BindHelpMenuPorts} ports */
export function bindHelpMenu({ dom, shell, lifetime }) {
    const { document } = dom;
    lifetime.listen(document.getElementById('help-menu'), 'click', () => {
        shell.closeDD();
        shell.openDD('help-btn', 'help-panel');
    });
}
/** @param {import('./shell-bindings.ports').BindResetClosesDropdownPorts} ports */
export function bindResetClosesDropdown({ dom, shell, lifetime }) {
    const { document } = dom;
    for (const id of ['reset-all']) {
        lifetime.listen(document.getElementById(id), 'click', () => shell.closeDD());
    }
}
/** @param {import('./shell-bindings.ports').BindDropdownOutsideClosePorts} ports */
export function bindDropdownOutsideClose({ dom, shell, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointerdown', e => {
        if (!e.target.closest(dom.selector('.dd,#menu-btn,#fitchip,#help-btn'))) {
            shell.closeDD();
        }
    }, true);
}
/** @param {import('./shell-bindings.ports').BindDropdownEscapePorts} ports */
export function bindDropdownEscape({ dom, shell, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'keydown', e => {
        if (e.key === 'Escape' && shell.closeDD()) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }, true);
}
/** @param {import('./shell-bindings.ports').BindPlanPanelPorts} ports */
export function bindPlanPanel({ dom, shell, lifetime }) {
    const { document } = dom;
    const close = /** @type {HTMLButtonElement} */ (dom.$('#plan-panel').querySelector('.storage-panel-close'));
    lifetime.listen(close, 'click', () => dom.$('#fitchip').click());
    lifetime.listen(dom.$('#fitchip'), 'click', () => {
        const panel = dom.$('#plan-panel');
        if (!panel.hidden) close.focus();
        else dom.$('#menu-btn').focus();
    });
    lifetime.listen(document.getElementById('plan-panel'), 'click', e => {
        if (e.target.closest(dom.selector('[data-storage]'))) {
            shell.closeDD();
        }
    });
}
/** @param {import('./shell-bindings.ports').BindDocumentFocusinPorts} ports */
export function bindDocumentFocusin({ dom, camera, lifetime }) {
    const { document } = dom;
    lifetime.listen(document, 'focusin', e => {
        if (e.target.matches('#sliders input,#ih,#iw,.measurement-badge input')) {
            camera.camRelease();
        }
    });
}
/** @param {import('./shell-bindings.ports').BindZoomInPorts} ports */
export function bindZoomIn({ dom, camera }) {
    const { document } = dom;
    document.getElementById('zoom-in').onclick = e => {
        camera.cameraZoom(1 / 1.2);
        if (e.detail) {
            const button = /** @type {HTMLElement} */ (e.currentTarget);
            button.blur();
        }
    };
}
/** @param {import('./shell-bindings.ports').BindZoomOutPorts} ports */
export function bindZoomOut({ dom, camera }) {
    const { document } = dom;
    document.getElementById('zoom-out').onclick = e => {
        camera.cameraZoom(1.2);
        if (e.detail) {
            const button = /** @type {HTMLElement} */ (e.currentTarget);
            button.blur();
        }
    };
}
/** @param {import('./shell-bindings.ports').BindPropertiesTogglePorts} ports */
export function bindPropertiesToggle({ dom, inspector, shell, lifetime, elements }) {
    const { document, matchMedia } = dom;
    const desktop = matchMedia?.('(min-width:901px)') ?? { matches: false };
    const settingsLabel = document.createElement('span');
    settingsLabel.className = 'mobile-settings-label';
    settingsLabel.textContent = 'Settings';
    elements.propsButton.append(settingsLabel);
    const syncToggle = () => {
        const visible = !elements.app.classList.contains('props-hidden') && elements.app.classList.contains('props-open');
        const label = visible ? 'Hide settings' : 'Show settings';
        elements.propsButton.setAttribute('aria-pressed', String(visible));
        elements.propsButton.setAttribute('aria-expanded', String(visible));
        elements.propsButton.setAttribute('aria-label', label);
        elements.propsButton.setAttribute('data-tip', label);
    };
    lifetime.listen(elements.propsButton, 'click', () => {
        shell.closeDD();
        const visible = !elements.app.classList.contains('props-hidden') && elements.app.classList.contains('props-open');
        if (visible) {
            animateMobileSheetClose(dom.$('#left'));
            inspector.clearFocus();
            elements.app.classList.add('props-hidden');
            elements.app.classList.remove('props-open');
        } else {
            if (document.querySelector('.pop.show')) inspector.clearFocus();
            takeMobilePanel(dom, dom.$('#left'));
            elements.app.classList.remove('props-hidden');
            elements.app.classList.add('props-open');
        }
        syncToggle();
    });
    const view = dom.$('#view');
    // Touch gestures need not produce a compatibility click. Dismiss after
    // the canvas handles the release, including taps on its overlaid labels.
    lifetime.listen(view, 'pointerup', e => {
        if (desktop.matches || !e.isPrimary || !elements.app.classList.contains('props-open')) return;
        // Releasing an editing handle commits its change; it does not leave the tool.
        const target = /** @type {Element} */ (e.target);
        if (target.closest('.shape-handle,.item-resize-handle')) return;
        // Orbiting to reach the rear edge stays inside the Shape session.
        if (dom.$('#left').dataset.contextSection === 'shape') return;
        animateMobileSheetClose(dom.$('#left'));
        elements.app.classList.add('props-hidden');
        elements.app.classList.remove('props-open');
        syncToggle();
    });
    syncToggle();
}
/** @param {import('./shell-bindings.ports').ObserveInspectorPanelsPorts} ports */
export function observeInspectorPanels({ dom, shell, lifetime }) {
    const { document } = dom;
    document.querySelectorAll('.pop').forEach(p => lifetime.observe(new MutationObserver(shell.sync), p, { attributes: true, attributeFilter: ['class'] }));
}
/** @param {import('./shell-bindings.ports').BindResponsiveInspectorsPorts} ports */
export function bindResponsiveInspectors({ dom, inspector, model, lifetime, elements }) {
    const { $, document, matchMedia } = dom;
    const desktop = matchMedia?.('(min-width:901px)') ?? { matches: false };
    const left = $('#left');
    /** @type {Array<[HTMLElement, string, () => void]>} */
    const sheets = [
        [left, 'Settings', () => {
            animateMobileSheetClose(left);
            elements.app.classList.add('props-hidden');
            elements.app.classList.remove('props-open');
            elements.propsButton.setAttribute('aria-expanded', 'false');
            elements.propsButton.setAttribute('aria-pressed', 'false');
        }],
        [$('#pop2'), 'Add item', () => inspector.hidePop()],
        [$('#pop3'), 'Item settings', () => inspector.hidePop()],
        [$('#pop4'), 'Divider settings', () => inspector.hidePop()],
        [$('#plan-panel'), 'Storage details', () => $('#fitchip').click()],
        [$('#menu'), 'Menu', () => $('#menu-btn').click()],
        [/** @type {HTMLElement} */ ($('#wizard').querySelector('.wizard-shell')), 'Auto design', () => $('#close-wizard').click()],
    ];
    const wizard = $('#wizard').querySelector('.wizard-shell');
    for (const [panel, name, close] of sheets) {
        mountMobileSheet({ document, lifetime, panel, name, close, scene: elements.app,
            fullscreen: panel === wizard, bottom: [left, $('#pop2'), $('#pop3'), $('#pop4'), wizard].includes(panel), docked: desktop });
    }
    // Every panel belongs to the editor, independent of screen width.
    for (const id of ['#plan-panel', '#menu', '#pop3', '#pop4']) {
        const panel = $(id);
        if (panel.parentNode !== elements.app) elements.app.appendChild(panel);
    }
    inspector.syncResponsive();
    $('#ix').onclick = () => inspector.hidePop();
    $('#divider-close').onclick = () => inspector.hidePop();
}
/** @param {import('./shell-bindings.ports').BindRemoveWardrobePorts} ports */
export function bindRemoveWardrobe({ dom, camera, interactions, inspector, shell, interactionState, selectionState, model, sceneCommands }) {
    const { $ } = dom;
    $('#remove-wardrobe').onclick = () => {
        if (!model.scene.wardrobes.length) {
            return;
        }
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag();
        }
        if (interactionState.rotationGesture) {
            interactions.finishRotation();
        }
        interactions.cancelMovement();
        const name = sceneCommands.removeCabinet();
        selectionState.shapeEditing = false;
        inspector.hidePop();
        selectionState.pillOn = true;
        selectionState.deep = true;
        inspector.update();
        camera.fit();
        shell.toast(name + ' removed. Undo (Ctrl/Cmd+Z) brings it back.');
    };
}
/** @param {import('./shell-bindings.ports').BindDividerDupPorts} ports */
export function bindDividerDup({ dom, commands }) {
    const { $ } = dom;
    $('#divider-dup').onclick = () => commands.duplicateDivider();
}
/** @param {import('./shell-bindings.ports').BindCanvasHintDismissPorts} ports */
export function bindCanvasHintDismiss({ dom, lifetime }) {
    const { document } = dom;
    lifetime.listen(document.getElementById('c'), 'pointerdown', () => document.getElementById('hint').classList.add('gone'), { once: true });
}
