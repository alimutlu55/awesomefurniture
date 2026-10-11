interface EditorControls {
    "#app": HTMLElementTagNameMap["div"];
    "#view": HTMLElementTagNameMap["main"];
    "#c": HTMLElementTagNameMap["canvas"];
    "#labels": HTMLElementTagNameMap["div"];
    "#item-resize-handles": HTMLElementTagNameMap["div"];
    "#pill-menu": HTMLElementTagNameMap["div"];
    "#move-status": HTMLElementTagNameMap["div"];
    "#empty-scene": HTMLElementTagNameMap["div"];
    "#empty-x": HTMLElementTagNameMap["button"];
    "#empty-launch": HTMLElementTagNameMap["button"];
    "#hint": HTMLElementTagNameMap["div"];
    "#pop2": HTMLElementTagNameMap["div"];
    "#ptitle": HTMLElementTagNameMap["b"];
    "#px": HTMLElementTagNameMap["button"];
    "#section-meta": HTMLElementTagNameMap["p"];
    "#pfree": HTMLElementTagNameMap["span"];
    "#add-intent": HTMLElementTagNameMap["div"];
    "#padd": HTMLElementTagNameMap["div"];
    "#more-count": HTMLElementTagNameMap["span"];
    "#padd2": HTMLElementTagNameMap["div"];
    "#pop3": HTMLElementTagNameMap["div"];
    "#ititle": HTMLElementTagNameMap["b"];
    "#ix": HTMLElementTagNameMap["button"];
    "#ih": HTMLElementTagNameMap["input"];
    "#iw": HTMLElementTagNameMap["input"];
    "#ialign": HTMLElementTagNameMap["div"];
    "#ipurpose": HTMLElementTagNameMap["select"];
    "#ifin": HTMLElementTagNameMap["div"];
    "#imeas": HTMLElementTagNameMap["div"];
    "#itype": HTMLElementTagNameMap["div"];
    "#move-controls": HTMLElementTagNameMap["div"];
    "#move-mode": HTMLElementTagNameMap["button"];
    "#swap-mode": HTMLElementTagNameMap["button"];
    "#move-cancel": HTMLElementTagNameMap["button"];
    "#move-section": HTMLElementTagNameMap["details"];
    "#move-bay": HTMLElementTagNameMap["select"];
    "#move-slot": HTMLElementTagNameMap["select"];
    "#move-apply": HTMLElementTagNameMap["button"];
    "#iback": HTMLElementTagNameMap["button"];
    "#pop4": HTMLElementTagNameMap["div"];
    "#divider-title": HTMLElementTagNameMap["b"];
    "#divider-close": HTMLElementTagNameMap["button"];
    "#divider-dup": HTMLElementTagNameMap["button"];
    "#divider-remove": HTMLElementTagNameMap["button"];
    "#dgap0-l": HTMLElementTagNameMap["span"];
    "#dgap0": HTMLElementTagNameMap["input"];
    "#dgap1-l": HTMLElementTagNameMap["span"];
    "#dgap1": HTMLElementTagNameMap["input"];
    "#dmeas": HTMLElementTagNameMap["div"];
    "#divider-hint": HTMLElementTagNameMap["div"];
    "#topleft": HTMLElementTagNameMap["div"];
    "#menu-btn": HTMLElementTagNameMap["button"];
    "#menu": HTMLElementTagNameMap["div"];
    "#help-menu": HTMLElementTagNameMap["button"];
    "#toolbar": HTMLElementTagNameMap["div"];
    "#props-btn": HTMLElementTagNameMap["button"];
    "#add-anchor": HTMLElementTagNameMap["div"];
    "#more-btn": HTMLElementTagNameMap["button"];
    "#add-label": HTMLElementTagNameMap["span"];
    "#more-menu": HTMLElementTagNameMap["div"];
    "#launch-wizard": HTMLElementTagNameMap["button"];
    "#topright": HTMLElementTagNameMap["div"];
    "#fitchip": HTMLElementTagNameMap["button"];
    "#fit-warn": HTMLElementTagNameMap["span"];
    "#score": HTMLElementTagNameMap["b"];
    "#plan-panel": HTMLElementTagNameMap["div"];
    "#score-sub": HTMLElementTagNameMap["div"];
    "#plan-title": HTMLElementTagNameMap["div"];
    "#plan-summary": HTMLElementTagNameMap["div"];
    "#plan-capacity": HTMLElementTagNameMap["div"];
    "#plan-warnings": HTMLElementTagNameMap["div"];
    "#specs": HTMLElementTagNameMap["div"];
    "#left": HTMLElementTagNameMap["aside"];
    "#wardrobe-select": HTMLElementTagNameMap["select"];
    "#wardrobe-add": HTMLElementTagNameMap["button"];
    "#left-body": HTMLElementTagNameMap["div"];
    "#sliders": HTMLElementTagNameMap["div"];
    "#section-row": HTMLElementTagNameMap["div"];
    "#nseg": HTMLElementTagNameMap["div"];
    "#sec-minus": HTMLElementTagNameMap["button"];
    "#section-count": HTMLElementTagNameMap["span"];
    "#sec-plus": HTMLElementTagNameMap["button"];
    "#section-diagram": HTMLElementTagNameMap["div"];
    "#wardrobe-reach-line": HTMLElementTagNameMap["input"];
    "#reach-height-row": HTMLElementTagNameMap["span"];
    "#wardrobe-reach": HTMLElementTagNameMap["input"];
    "#fins": HTMLElementTagNameMap["div"];
    "#open": HTMLElementTagNameMap["button"];
    "#reset-all": HTMLElementTagNameMap["button"];
    "#remove-wardrobe": HTMLElementTagNameMap["button"];
    "#bl": HTMLElementTagNameMap["div"];
    "#undo2": HTMLElementTagNameMap["button"];
    "#redo2": HTMLElementTagNameMap["button"];
    "#br": HTMLElementTagNameMap["div"];
    "#zoom-out": HTMLElementTagNameMap["button"];
    "#zoom-val": HTMLElementTagNameMap["span"];
    "#zoom-in": HTMLElementTagNameMap["button"];
    "#help-btn": HTMLElementTagNameMap["button"];
    "#help-panel": HTMLElementTagNameMap["div"];
    "#keys": HTMLElementTagNameMap["div"];
    "#qc": HTMLElementTagNameMap["span"];
    "#rank": HTMLElementTagNameMap["div"];
    "#lvl": HTMLElementTagNameMap["span"];
    "#xp": HTMLElementTagNameMap["span"];
    "#xpb": HTMLElementTagNameMap["i"];
    "#quests": HTMLElementTagNameMap["ul"];
    "#clock": HTMLElementTagNameMap["b"];
    "#wizard": HTMLElementTagNameMap["div"];
    "#wizard-size": HTMLElementTagNameMap["p"];
    "#close-wizard": HTMLElementTagNameMap["button"];
    "#need-short": HTMLElementTagNameMap["input"];
    "#need-handbags": HTMLElementTagNameMap["input"];
    "#jackets": HTMLElementTagNameMap["input"];
    "#need-long": HTMLElementTagNameMap["input"];
    "#coats": HTMLElementTagNameMap["input"];
    "#need-pants": HTMLElementTagNameMap["input"];
    "#need-folded": HTMLElementTagNameMap["input"];
    "#need-shoes": HTMLElementTagNameMap["input"];
    "#need-small": HTMLElementTagNameMap["input"];
    "#reach": HTMLElementTagNameMap["input"];
    "#reach-value": HTMLElementTagNameMap["b"];
    "#ideas-count": HTMLElementTagNameMap["span"];
    "#ideas-note": HTMLElementTagNameMap["p"];
    "#ideas": HTMLElementTagNameMap["div"];
    "#w": HTMLElementTagNameMap["input"];
    "#h": HTMLElementTagNameMap["input"];
    "#d": HTMLElementTagNameMap["input"];
    "#wv": HTMLElementTagNameMap["b"];
    "#hv": HTMLElementTagNameMap["b"];
    "#dv": HTMLElementTagNameMap["b"];
    "#item-bar": HTMLElementTagNameMap["div"];
    "#item-type-menu": HTMLElementTagNameMap["div"];
    "#ctx-menu": HTMLElementTagNameMap["div"];
}
/** DOM and global-event ownership for one editor. */
const activeEditors = new WeakMap<Document, HTMLElement | ShadowRoot>();
let nextEditorId = 0;
export const dropdowns = [['menu-btn', 'menu'], ['fitchip', 'plan-panel'], ['help-btn', 'help-panel']];
export function createEditorDom(root: HTMLElement | ShadowRoot) {
    const owner = root.ownerDocument;
    const view = owner.defaultView;
    if (!view)
        throw new Error('An editor needs a browser document.');
    const host = 'host' in root ? root.host as HTMLElement : root;
    const prefix = `wardrobe-${++nextEditorId}-`;
    const cleanup: (() => void)[] = [];
    let disposed = false;
    const activate = () => { if (!disposed)
        activeEditors.set(owner, root); };
    if (!activeEditors.has(owner))
        activate();
    for (const event of ['pointerdown', 'focusin']) {
        root.addEventListener(event, activate);
        cleanup.push(() => root.removeEventListener(event, activate));
    }
    const selector = (value: string) => value.replace(/#([\w-]+)/g, '[data-editor-id="$1"]');
    const setId = (element: HTMLElement, id: string) => { element.dataset.editorId = id; element.id = prefix + id; };
    const normalizeIds = () => {
        for (const element of root.querySelectorAll<HTMLElement>('[id]'))
            if (!element.dataset.editorId)
                setId(element, element.id);
        for (const element of root.querySelectorAll('[for],[aria-labelledby],[aria-describedby],[aria-controls]')) {
            for (const name of ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls']) {
                const value = element.getAttribute(name);
                if (value)
                    element.setAttribute(name, value.split(/\s+/).map(id => id.startsWith(prefix) ? id : prefix + id).join(' '));
            }
        }
    };
    normalizeIds();
    // Window gestures continue outside the canvas; only the active editor receives them.
    const listeners = new Map<EventListenerOrEventListenerObject, Map<string, EventListener>>();
    const windowEvents = {
        addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
            const scoped: EventListener = value => {
                if (disposed)
                    return;
                const target = value.composedPath?.()[0] ?? value.target;
                if (event === 'pointerdown' && root.contains(target && 'nodeType' in target ? target as Node : null))
                    activate();
                if (/^(key|pointer)/.test(event) && activeEditors.get(owner) !== root)
                    return;
                const eventValue = new Proxy(value, { get(event, key) { if (key === 'target')
                        return target; const member = Reflect.get(event, key, event); return typeof member === 'function' ? member.bind(event) : member; } });
                if (typeof handler === 'function')
                    handler(eventValue);
                else
                    handler.handleEvent(eventValue);
            };
            let registered = listeners.get(handler);
            if (!registered)
                listeners.set(handler, registered = new Map());
            registered.set(event, scoped);
            view.addEventListener(event, scoped, options);
            cleanup.push(() => view.removeEventListener(event, scoped, options));
        },
        removeEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
            const scoped = listeners.get(handler)?.get(event);
            if (scoped)
                view.removeEventListener(event, scoped, options);
        }
    };
    const documentScope = {
        querySelector: <E extends Element = HTMLElement>(value: string): E | null => { normalizeIds(); return root.querySelector<E>(selector(value)); },
        querySelectorAll: <E extends Element = HTMLElement>(value: string): NodeListOf<E> => { normalizeIds(); return root.querySelectorAll<E>(selector(value)); },
        getElementById: (id: string): HTMLElement | null => { normalizeIds(); return root.querySelector<HTMLElement>(selector('#' + id)); },
        createElement: <K extends keyof HTMLElementTagNameMap>(tag: K) => owner.createElement(tag),
        createElementNS: (namespace: string, tag: string) => owner.createElementNS(namespace, tag),
        get activeElement() { return ('host' in root ? root.activeElement : null) || (root.contains(owner.activeElement) ? owner.activeElement : null); },
        get documentElement() { return host; },
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => root.addEventListener(type, listener, options),
        removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => root.removeEventListener(type, listener, options)
    };
    const matchMedia = (query: string) => {
        if (!/(min|max)-width/.test(query))
            return view.matchMedia(query);
        const target = new EventTarget();
        const evaluate = () => {
            const min = query.match(/min-width:\s*(\d+)px/), max = query.match(/max-width:\s*(\d+)px/);
            return (!min || host.clientWidth >= Number(min[1])) && (!max || host.clientWidth <= Number(max[1]));
        };
        let matches = evaluate();
        const observer = new ResizeObserver(() => {
            const next = evaluate();
            if (next !== matches) {
                matches = next;
                target.dispatchEvent(new Event('change'));
            }
        });
        observer.observe(host);
        cleanup.push(() => observer.disconnect());
        return Object.defineProperty(target, 'matches', { get: () => matches }) as EventTarget & {
            readonly matches: boolean;
        };
    };
    function queryControl<K extends keyof EditorControls>(value: K): EditorControls[K];
    function queryControl<E extends HTMLElement = HTMLElement>(value: string): E;
    function queryControl(value: string): HTMLElement {
        const element = documentScope.querySelector<HTMLElement>(value);
        if (!element)
            throw new Error('Editor control is missing: ' + value);
        return element;
    }
    return {
        root, host, selector, setId, controlId: (element: HTMLElement) => element.dataset.editorId || element.id,
        $: queryControl, document: documentScope, window: windowEvents, matchMedia,
        get width() { return host.clientWidth; }, get height() { return host.clientHeight; },
        dispose() {
            if (disposed)
                return;
            disposed = true;
            if (activeEditors.get(owner) === root)
                activeEditors.delete(owner);
            for (const fn of cleanup.reverse())
                fn();
        }
    };
}
export const getEditorElements = (dom: ReturnType<typeof createEditorDom>) => ({ app: dom.$('#app'), propsButton: dom.$('#props-btn'), pillMenu: dom.$('#pill-menu') });
