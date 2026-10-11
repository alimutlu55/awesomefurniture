import { MODS, ADD_ORDER } from '../../../domain/wardrobe/catalog.js';
import { icon } from '../editor-format.js';
/** Add item: the panel, the More items menu and the pill menu.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./add-menu.ports').BindMoreAddMenuPorts} ports */
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
            commands.addMod(/** @type {import('../../../domain/wardrobe/wardrobe').ItemKind} */ (k));
            shell.closeDD();
        };
        $('#more-menu').appendChild(b);
    }
}
/** @param {import('./add-menu.ports').BindPillAddMenuPorts} ports */
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
            commands.addMod(/** @type {import('../../../domain/wardrobe/wardrobe').ItemKind} */ (k));
        };
        elements.pillMenu.appendChild(b);
    }
}
/** @param {import('./add-menu.ports').BindWindowPointerdownPorts} ports */
export function bindWindowPointerdown({ dom, lifetime, elements }) {
    const { window } = dom;
    lifetime.listen(window, 'pointerdown', e => {
        if (!e.target.closest(dom.selector('#pill-menu,.lbl.add'))) {
            elements.pillMenu.hidden = true;
        }
    }, true);
}
/** @param {import('./add-menu.ports').BindPop2Ports} ports */
export function bindPop2({ dom, inspector, model, commands, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#pop2'), 'click', e => {
        const b = e.target.closest(dom.selector('button'));
        if (!b || dom.controlId(b) === 'px') {
            return;
        }
        const i = model.activeCabinet().state.sel, d = b.dataset;
        if (d.r !== undefined) {
            model.activeCabinet().state.item = +d.r;
            inspector.update();
            inspector.swapPop('#pop3');
            inspector.itemUI();
        }
        else if (d.m) {
            commands.addMod(d.m);
        }
        else if (d.possession) {
            commands.addPossessionShelf(d.possession);
        }
        else if (d.a === 'fit') {
            commands.run(() => commands.autofill(i));
        }
        else if (d.a === 'clear') {
            commands.clearSection(i);
        }
        else if (d.a === 'divider') {
            commands.addSpaceDivider();
            if (model.activeCabinet().state.divider >= 0) {
                inspector.showPop(null, '#pop4');
            }
        }
    });
}
