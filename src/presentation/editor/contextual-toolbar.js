import { contextualActions, wardrobeMoreActions } from '../../domain/wardrobe/contextual-actions.js';
import { icon, ibIcon } from './editor-format.js';
const mounted = new WeakMap();
/** Reusable selection toolbar. Command execution and selection stay with its host. */
export function createContextualToolbar({ document, root, app, undo, redo, getSelection, execute, replacements, lifetime }) {
    const defaults = document.createElement('div');
    defaults.className = 'contextual-defaults';
    defaults.append(...root.childNodes);
    const row = document.createElement('div');
    row.className = 'contextual-actions';
    const history = document.createElement('div');
    history.className = 'contextual-history';
    for (const [button, label] of [[undo, 'Undo'], [redo, 'Redo']]) {
        const text = document.createElement('span');
        text.className = 'contextual-history-label';
        text.textContent = label;
        button.append(text);
    }
    history.append(undo, redo);
    root.append(defaults, row, history);
    const menu = document.createElement('div');
    menu.className = 'contextual-popover';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    app.append(menu);
    let context;
    const close = () => { menu.hidden = true; row.querySelectorAll('[aria-haspopup="menu"]').forEach(b => b.setAttribute('aria-expanded', 'false')); };
    const icons = {move:ibIcon('mov'),resize:icon('sliders'),sections:icon('divider'),more:icon('more'),duplicate:ibIcon('dup'),remove:ibIcon('del'),replace:ibIcon('typ')};
    const menuIcons = {material:icon('material'),reach:icon('reach'),doors:icon('doors'),duplicate:ibIcon('dup'),reset:icon('reset'),remove:ibIcon('del')};
    function showMenu(options, trigger) {
        const opening = menu.hidden;
        close();
        if (!opening) return;
        const items = document.createElement('div');
        items.className = 'contextual-menu-items';
        items.append(...options.map(([key, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('role', 'menuitem');
            b.dataset.action = key;
            if (menuIcons[key]) b.innerHTML = menuIcons[key];
            const text = document.createElement('span');
            text.textContent = label;
            b.append(text);
            b.onclick = () => { close(); execute(key); };
            return b;
        }));
        menu.replaceChildren(items);
        menu.hidden = false;
        const bounds = app.getBoundingClientRect(), anchor = trigger.getBoundingClientRect();
        const center = anchor.x + anchor.width / 2 - bounds.x;
        const left = Math.max(12, Math.min(center - menu.offsetWidth / 2, bounds.width - menu.offsetWidth - 12));
        menu.style.left = left + 'px';
        menu.style.setProperty('--popover-pointer', Math.max(24, Math.min(center - left, menu.offsetWidth - 24)) + 'px');
        trigger.setAttribute('aria-expanded', 'true');
        menu.querySelector('button')?.focus({preventScroll:true});
    }
    const render = () => {
        const selection = getSelection();
        if (selection === context) return;
        context = selection;
        close();
        root.dataset.context = selection;
        root.style.setProperty('--contextual-action-count', String(contextualActions(selection).length));
        root.setAttribute('aria-label', selection === 'none' ? 'Wardrobe actions' : selection + ' editing actions');
        row.replaceChildren(...contextualActions(selection).filter(([key]) => !['undo','redo','add','auto'].includes(key)).map(([key,label]) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'tb'; b.dataset.action = key;
            b.setAttribute('aria-label', label);
            b.innerHTML = icons[key] + '<span>' + label + '</span>';
            if (key === 'more' || key === 'replace') {b.setAttribute('aria-haspopup','menu'); b.setAttribute('aria-expanded','false');}
            b.onclick = () => key === 'more' ? showMenu(wardrobeMoreActions,b) : key === 'replace' ? showMenu(replacements(),b) : (close(),execute(key));
            return b;
        }));
    };
    lifetime.listen(app, 'pointerdown', e => { if (!menu.contains(e.target) && !row.contains(e.target)) close(); });
    lifetime.listen(app, 'keydown', e => { if (e.key === 'Escape' && !menu.hidden) {close(); row.querySelector('[aria-haspopup="menu"]')?.focus();} });
    lifetime.listen(menu, 'keydown', e => {
        if (!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
        e.preventDefault();
        const buttons = [...menu.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
    });
    mounted.set(root, render);
    lifetime.cleanup(() => { mounted.delete(root); menu.remove(); });
    render();
    return { render, close };
}
export function refreshContextualToolbar(root) { mounted.get(root)?.(); }
