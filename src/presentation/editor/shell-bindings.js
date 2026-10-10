import { dropdowns } from './editor-dom.js';
/** DOM event bindings call application commands through the mounted view ports. */
/** @param {import('./shell-bindings.ports').BindMoreBtnPorts} ports */
export function bindMoreBtn({ dom, inspector, shell, selectionState, model, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#more-btn'), 'click', () => {
        shell.closeDD();
        model.activeCabinet().state.item = -1;
        model.activeCabinet().state.divider = -1;
        selectionState.pillOn = true;
        inspector.update();
        inspector.showPop(null, '#pop2');
        $('#px').focus();
    });
}
/** @param {import('./shell-bindings.ports').BindInspectorControls2Ports} ports */
export function bindInspectorControls2({ dom, shell, lifetime }) {
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
/** @param {import('./shell-bindings.ports').BindInspectorControls3Ports} ports */
export function bindInspectorControls3({ dom, shell, lifetime }) {
    const { document } = dom;
    for (const id of ['reset-all']) {
        lifetime.listen(document.getElementById(id), 'click', () => shell.closeDD());
    }
}
/** @param {import('./shell-bindings.ports').BindWindowPointerdown2Ports} ports */
export function bindWindowPointerdown2({ dom, shell, lifetime }) {
    const { window } = dom;
    lifetime.listen(window, 'pointerdown', e => {
        if (!e.target.closest(dom.selector('.dd,#menu-btn,#more-btn,#fitchip,#help-btn'))) {
            shell.closeDD();
        }
    }, true);
}
/** @param {import('./shell-bindings.ports').BindWindowKeydown7Ports} ports */
export function bindWindowKeydown7({ dom, shell, lifetime }) {
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
        if (e.target.matches('#sliders input,#wardrobe-reach,#ih,#iw,.editable-clearance input')) {
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
/** @param {import('./shell-bindings.ports').BindInspectorControls4Ports} ports */
export function bindInspectorControls4({ dom, inspector, shell, lifetime, elements }) {
    const { document, matchMedia } = dom;
    const desktop = matchMedia('(min-width:901px)');
    const settingsLabel = document.createElement('span');
    settingsLabel.className = 'mobile-settings-label';
    settingsLabel.textContent = 'Settings';
    elements.propsButton.append(settingsLabel);
    const syncToggle = () => {
        const visible = !elements.app.classList.contains('props-hidden') && (desktop.matches || elements.app.classList.contains('props-open'));
        const label = visible ? 'Hide settings' : 'Show settings';
        elements.propsButton.setAttribute('aria-pressed', String(visible));
        elements.propsButton.setAttribute('aria-expanded', String(visible));
        elements.propsButton.setAttribute('aria-label', label);
        elements.propsButton.setAttribute('data-tip', label);
    };
    lifetime.listen(elements.propsButton, 'click', () => {
        shell.closeDD();
        const visible = !elements.app.classList.contains('props-hidden') && (desktop.matches || elements.app.classList.contains('props-open'));
        if (visible) {
            inspector.clearFocus();
            elements.app.classList.add('props-hidden');
            elements.app.classList.remove('props-open');
        } else {
            if (document.querySelector('.pop.show')) inspector.clearFocus();
            elements.app.classList.remove('props-hidden');
            elements.app.classList.add('props-open');
        }
        syncToggle();
    });
    lifetime.listen(desktop, 'change', syncToggle);
    lifetime.listen(dom.$('#view'), 'click', e => {
        if (desktop.matches || !elements.app.classList.contains('props-open') || /** @type {HTMLElement} */ (e.target).tagName !== 'CANVAS') return;
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
    const { $, matchMedia } = dom;
    {
        const mq = matchMedia('(min-width:901px)'), left = $('#left');
        const place = () => {
            // Anchor menus to the whole editor on phones, so a narrow toolbar
            // button cannot push a full-width menu outside the screen.
            for (const [panel, anchor] of [['#plan-panel', '#topright'], ['#menu', '#topleft']]) {
                const p = $(panel), parent = mq.matches ? $(anchor) : elements.app;
                if (p.parentNode !== parent) parent.appendChild(p);
            }
            // Touch users need an alternative to dragging and keyboard swaps.
            const movement = $('#move-controls').closest('details');
            movement.hidden = mq.matches;
            movement.style.display = mq.matches ? 'none' : '';
            const dividerActions = $('#divider-dup').parentElement;
            dividerActions.style.display = mq.matches ? 'none' : '';
            for (const id of ['#pop3', '#pop4']) {
                const p = $(id);
                if (mq.matches) {
                    if (p.parentNode !== left) {
                        left.appendChild(p);
                    }
                }
                else if (p.parentNode !== elements.app) {
                    elements.app.appendChild(p);
                }
            }
            inspector.syncResponsive();
        };
        lifetime.listen(mq, 'change', place);
        place();
        const back = () => mq.matches ? inspector.goUp('section') : inspector.hidePop();
        $('#ix').onclick = back;
        $('#divider-close').onclick = back;
    }
}
/** @param {import('./shell-bindings.ports').BindRemoveWardrobePorts} ports */
export function bindRemoveWardrobe({ dom, camera, interactions, inspector, shell, interactionState, selectionState, model, sceneCommands }) {
    const { $ } = dom;
    $('#remove-wardrobe').onclick = () => {
        if (model.scene.wardrobes.length < 2) {
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
        inspector.hidePop();
        selectionState.pillOn = false;
        selectionState.deep = false;
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
/** @param {import('./shell-bindings.ports').BindCPorts} ports */
export function bindC({ dom, lifetime }) {
    const { document } = dom;
    lifetime.listen(document.getElementById('c'), 'pointerdown', () => document.getElementById('hint').classList.add('gone'), { once: true });
}
