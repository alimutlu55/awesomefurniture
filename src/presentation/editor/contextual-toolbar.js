import { contextualActions, furnitureMenus, wardrobeMoreActions, itemMoreActions, wallMoreActions, studioMoreActions, fieldActions } from '../../domain/wardrobe/contextual-actions.js';
import { icon, ibIcon } from './editor-format.js';
const mounted = new WeakMap();
/** Reusable selection toolbar. Command execution and selection stay with its host. `autoDesign` is the Auto design
 * button: it waits hidden among the defaults, and the Interior menu of furniture that Auto design can plan presses it. */
export function createContextualToolbar({ document, root, app, undo, redo, getSelection, execute, replacements, controls, lifetime, autoDesign }) {
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
    let menuTrigger;
    let borrowed = [];
    const close = () => {
        for (const [node, placeholder] of borrowed) placeholder.replaceWith(node);
        borrowed = [];
        menu.hidden = true;
        root.querySelectorAll('[aria-haspopup="menu"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    };
    const icons = {new:icon('plus'),interior:icon('divider'),fronts:icon('doors'),resize:icon('sliders'),shape:icon('wardrobe'),sections:icon('divider'),more:icon('more'),duplicate:ibIcon('dup'),remove:ibIcon('del'),replace:ibIcon('typ'),
        'wall-size':icon('sliders'),'opening-size':icon('sliders'),split:icon('split'),'wall-paint':icon('material'),door:icon('room-door'),window:icon('room-window'),
        ceiling:icon('room-stairs'),'ceiling-size':icon('sliders'),'ceiling-shape':icon('room-stairs'),'surface-shape':icon('shape-edit'),flip:icon('flip'),walls:icon('room-wall')};
    const menuIcons = {auto:icon('spark'),'add-item':icon('plus'),new:icon('plus'),
        shape:icon('wardrobe'),sections:icon('divider'),material:icon('material'),doors:icon('doors'),duplicate:ibIcon('dup'),reset:icon('reset'),remove:ibIcon('del'),
        stores:icon('drawer'),replace:ibIcon('typ'),door:icon('room-door'),window:icon('room-window'),archway:icon('room-archway'),
        water:icon('room-water'),socket:icon('room-socket'),duct:icon('room-duct'),gas:icon('room-gas'),radiator:icon('room-radiator'),switch:icon('room-switch'),
        'add-wall':icon('room-wall'),split:icon('split'),'wall-size':icon('sliders')};
    const moreActions = {...Object.fromEntries(Object.entries(furnitureMenus).map(([kind, menus]) => [kind, menus.more])),item:itemMoreActions,wall:wallMoreActions,studio:studioMoreActions};
    /** The tools that open a menu, and what each lists for the selection. */
    const menuOf = (key, selection) => key === 'more' ? moreActions[selection] ?? wardrobeMoreActions
        : key === 'interior' ? furnitureMenus[selection]?.interior : key === 'replace' ? replacements() : undefined;
    const opensMenu = key => key === 'more' || key === 'interior' || key === 'replace';
    function positionMenu(trigger) {
        menuTrigger = trigger;
        const bounds = app.getBoundingClientRect(), anchor = trigger.getBoundingClientRect();
        const center = anchor.x + anchor.width / 2 - bounds.x;
        const left = Math.max(12, Math.min(center - menu.offsetWidth / 2, bounds.width - menu.offsetWidth - 12));
        menu.style.left = left + 'px';
        menu.style.setProperty('--popover-pointer', Math.max(24, Math.min(center - left, menu.offsetWidth - 24)) + 'px');
        trigger.setAttribute('aria-expanded', 'true');
    }
    function showControls(key, label, trigger) {
        close();
        const nodes = controls(key);
        if (!nodes.length) return;
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', label);
        menu.classList.add('contextual-control-popover');
        const title = document.createElement('b');
        title.textContent = label;
        menu.replaceChildren(title);
        for (const node of nodes) {
            const placeholder = document.createElement('span');
            placeholder.hidden = true;
            node.replaceWith(placeholder);
            borrowed.push([node, placeholder]);
            menu.append(node);
        }
        menu.hidden = false;
        positionMenu(trigger);
        menu.tabIndex = -1;
        menu.focus({preventScroll:true});
    }
    function showMenu(options, trigger, force = false) {
        const opening = force || menu.hidden || menuTrigger !== trigger || menu.classList.contains('contextual-control-popover');
        close();
        if (!opening) return;
        menu.setAttribute('role', 'menu');
        menu.removeAttribute('aria-label');
        menu.classList.remove('contextual-control-popover');
        const items = document.createElement('div');
        items.className = 'contextual-menu-items';
        items.append(...options.map(([key, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.action = key;
            b.setAttribute('role', 'menuitem');
            b.dataset.action = key;
            if (menuIcons[key]) b.innerHTML = menuIcons[key];
            const text = document.createElement('span');
            text.textContent = label;
            b.append(text);
            if (key === 'stores') b.disabled = !controls(key).length;
            b.onclick = () => key === 'stores' || fieldActions.includes(key) ? showControls(key, label, trigger) : key === 'auto' && autoDesign ? (close(), autoDesign.click()) : (close(), execute(key));
            return b;
        }));
        menu.replaceChildren(items);
        menu.hidden = false;
        positionMenu(trigger);
        menu.querySelector('button')?.focus({preventScroll:true});
    }
    const render = () => {
        const selection = getSelection();
        if (selection === context) return;
        context = selection;
        close();
        root.dataset.context = selection;
        root.style.setProperty('--contextual-action-count', String(contextualActions(selection).length));
        root.setAttribute('aria-label', selection === 'none' ? 'Furniture' : selection + ' editing actions');
        if (autoDesign && row.contains(autoDesign)) defaults.append(autoDesign);
        // Nothing selected: the defaults (the furniture to choose, More) show instead of a row.
        row.replaceChildren(...(selection === 'none' ? [] : contextualActions(selection)).filter(([key]) => !['undo','redo'].includes(key)).map(([key,label,name]) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'tb'; b.dataset.action = key;
            b.setAttribute('aria-label', name ?? label);
            if (name) b.title = name;
            b.innerHTML = icons[key] + '<span>' + label + '</span>';
            if (opensMenu(key)) {b.setAttribute('aria-haspopup','menu'); b.setAttribute('aria-expanded','false');}
            if (fieldActions.includes(key)) {b.setAttribute('aria-haspopup','dialog'); b.setAttribute('aria-expanded','false');}
            b.onclick = () => opensMenu(key) ? showMenu(menuOf(key, selection),b)
                : fieldActions.includes(key) ? (menu.hidden || menuTrigger !== b ? showControls(key,label,b) : close()) : (close(),execute(key));
            return b;
        }));
    };
    lifetime.listen(app, 'pointerdown', e => { if (!menu.contains(e.target) && !row.contains(e.target)) close(); });
    lifetime.listen(app, 'keydown', e => {
        if (e.key !== 'Escape' || menu.hidden) return;
        e.preventDefault(); e.stopPropagation();
        close(); row.querySelector('[aria-haspopup="menu"]')?.focus();
    });
    lifetime.listen(menu, 'keydown', e => {
        if (e.key !== 'Escape' || menu.getAttribute('role') !== 'dialog') return;
        e.preventDefault(); e.stopPropagation(); close(); menuTrigger?.focus();
    }, true);
    lifetime.listen(menu, 'keydown', e => {
        if (menu.getAttribute('role') !== 'menu') return;
        if (!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
        e.preventDefault();
        const buttons = [...menu.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
    });
    mounted.set(root, render);
    lifetime.cleanup(() => { close(); mounted.delete(root); menu.remove(); });
    render();
    return { render, close };
}
export function refreshContextualToolbar(root) { mounted.get(root)?.(); }
