import { MODS } from '../../../domain/wardrobe/catalog.js';
import { createActionBar } from '../action-bar.js';
/** Item menus in the view: the item type menu, the context menu and the mobile Cancel move button.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./item-menus.ports').BindViewPorts} ports */
export function bindView({ dom, inspector, picking, renderState, selectionState, resources, model, lifetime }) {
    const { $, document, window } = dom;
    const cancelMove = document.createElement('button');
    cancelMove.type = 'button';
    cancelMove.className = 'mobile-cancel-move';
    cancelMove.textContent = 'Cancel move';
    cancelMove.hidden = true;
    $('#view').append(cancelMove);
    lifetime.listen(cancelMove, 'click', () => $('#move-cancel').click());
    (function buildItemBar() {
        selectionState.itemBar = createActionBar(document, 'Item actions', [{key:'dup',title:'Duplicate (Ctrl/Cmd+D)'},{key:'del',title:'Remove (Delete)'},{key:'typ',title:'Change type'}]);
        dom.setId(selectionState.itemBar, 'item-bar');
        selectionState.itemBar.hidden = true;
        selectionState.itemTypeMenu = document.createElement('div');
        dom.setId(selectionState.itemTypeMenu, 'item-type-menu');
        selectionState.itemTypeMenu.hidden = true;
        selectionState.itemTypeMenu.innerHTML = Object.entries(MODS).filter(([k]) => k !== 'void').map(([k, m]) => '<button type="button" data-itm="' + k + '">' + (k === 'short' ? 'Hanging rail' : m.n) + '</button>').join('');
        selectionState.ctxMenu = document.createElement('div');
        dom.setId(selectionState.ctxMenu, 'ctx-menu');
        selectionState.ctxMenu.hidden = true;
        selectionState.ctxMenu.setAttribute('role', 'menu');
        selectionState.ctxMenu.innerHTML = [['dup', 'Duplicate', 'Ctrl/Cmd+D'], ['del', 'Remove', 'Del'], ['mov', 'Move on model', ''], ['swap', 'Swap with another item', ''], ['al-l', 'Align left', ''], ['al-c', 'Centre', ''], ['al-r', 'Align right', ''], ['full', 'Full width', '']].map(([k, t, h]) => '<button type="button" role="menuitem" data-cm="' + k + '"' + (k === 'del' ? ' class="dl"' : '') + '>' + t + (h ? '<kbd>' + h + '</kbd>' : '') + '</button>').join('');
        $('#view').append(selectionState.itemBar, selectionState.itemTypeMenu, selectionState.ctxMenu);
        for (const el of [selectionState.itemBar, selectionState.itemTypeMenu, selectionState.ctxMenu]) {
            lifetime.listen(el, 'pointerdown', e => e.stopPropagation());
            lifetime.listen(el, 'mousedown', e => e.preventDefault());
            lifetime.listen(el, 'contextmenu', e => e.preventDefault());
        }
        selectionState.itemBar.onclick = e => {
            const b = e.target.closest(dom.selector('[data-ib]'));
            if (!b || b.disabled) {
                return;
            }
            const k = b.dataset.ib;
            if (model.activeCabinet().state.divider >= 0 && (k === 'dup' || k === 'del')) {
                $(k === 'dup' ? '#divider-dup' : '#divider-remove').click();
                return;
            }
            if (k === 'typ') {
                const was = !selectionState.itemTypeMenu.hidden;
                inspector.closeItemMenus();
                selectionState.itemTypeMenu.hidden = was;
                if (!was) {
                    inspector.placeItemTypeMenu();
                }
                return;
            }
            inspector.itemAction(k);
        };
        selectionState.itemTypeMenu.onclick = e => {
            const b = e.target.closest(dom.selector('[data-itm]'));
            if (b) {
                inspector.itemAction('t-' + b.dataset.itm);
            }
        };
        selectionState.ctxMenu.onclick = e => {
            const b = e.target.closest(dom.selector('[data-cm]'));
            if (b) {
                inspector.itemAction(b.dataset.cm);
            }
        };
        lifetime.listen(window, 'pointerdown', e => {
            if (!e.target.closest(dom.selector('#item-bar,#item-type-menu,#ctx-menu'))) {
                inspector.closeItemMenus();
            }
        }, true);
        lifetime.listen(window, 'keydown', e => {
            if (e.key === 'Escape' && ((!selectionState.itemTypeMenu.hidden) || (!selectionState.ctxMenu.hidden))) {
                e.stopImmediatePropagation();
                inspector.closeItemMenus();
            }
        }, true);
        lifetime.listen(resources.cv, 'wheel', inspector.closeItemMenus, { passive: true });
        lifetime.listen(resources.cv, 'contextmenu', e => {
            if (!selectionState.focusOn || !inspector.inside()) {
                return;
            }
            const m = picking.cast(e, renderState.allItemHits);
            if (!m || m.object.userData.wardrobe !== model.scene.activeWardrobe || m.object.userData.divider !== undefined) {
                inspector.closeItemMenus();
                return;
            }
            e.preventDefault();
            const u = m.object.userData;
            model.activeCabinet().state.divider = -1;
            selectionState.deep = true;
            selectionState.pillOn = false;
            model.activeCabinet().state.sel = u.i;
            model.activeCabinet().state.item = u.j;
            inspector.update();
            inspector.showPop(e, '#pop3');
            inspector.closeItemMenus();
            const vr = $('#view').getBoundingClientRect();
            selectionState.ctxMenu.hidden = false;
            inspector.placeFloating(selectionState.ctxMenu, e.clientX - vr.left, e.clientY - vr.top);
        });
    })();
}
