/** One entry/exit motion for the existing mobile bottom sheets. */
const mounted = new WeakMap();
const snapshots = new WeakMap();
const appearance = ['display','position','box-sizing','width','height','min-width','min-height','max-width','max-height','padding','margin','gap','grid-template-columns','grid-template-rows','flex','flex-direction','flex-wrap','align-items','justify-content','overflow','background','border','border-radius','box-shadow','color','font','letter-spacing','line-height','text-align','opacity','transform','white-space','object-fit','appearance','stroke','stroke-width','fill'];
/** @param {HTMLElement} panel
 * @param {{desktop:{matches:boolean};lifetime:Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'cleanup'>}} options */
export function registerMobileSheetMotion(panel, options) {
    if (!panel.animate) return;
    mounted.set(panel, options);
    options.lifetime.cleanup(() => {
        snapshots.get(panel)?.remove();
        snapshots.delete(panel);
        mounted.delete(panel);
    });
}
/** Preserve immediate logical closing, while an inert visual copy slides out.
 * @param {Element} panel */
export function animateMobileSheetClose(panel) {
    const options = mounted.get(panel), win = panel.ownerDocument.defaultView;
    if (!options || options.desktop.matches || win?.matchMedia('(prefers-reduced-motion: reduce)').matches || snapshots.has(panel)) return;
    const r = panel.getBoundingClientRect(), css = win.getComputedStyle(panel);
    if (!r.width || !r.height || css.display === 'none' || css.visibility === 'hidden') return;
    const root = panel.getRootNode(), parent = /** @type {ShadowRoot} */ (root).host || panel.parentElement;
    const origin = parent.getBoundingClientRect();
    const copy = /** @type {HTMLElement} */ (panel.cloneNode(true));
    const sources = [panel, ...panel.querySelectorAll('*')], copies = [copy, ...copy.querySelectorAll('*')];
    sources.forEach((source, i) => {
        const target = /** @type {HTMLElement} */ (copies[i]), style = win.getComputedStyle(source);
        for (const property of appearance) target.style.setProperty(property, style.getPropertyValue(property));
        target.removeAttribute('id');
        target.removeAttribute('data-editor-id');
        target.style.pointerEvents = 'none';
        target.style.animation = 'none';
        target.style.transition = 'none';
    });
    copy.className = 'mobile-sheet-exit';
    copy.dataset.mobileSheetExit = '';
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    Object.assign(copy.style, {position:'absolute',left:`${r.left-origin.left}px`,top:`${r.top-origin.top}px`,right:'auto',bottom:'auto',width:`${r.width}px`,height:`${r.height}px`,minHeight:'0',maxHeight:'none',margin:'0',translate:'none',transform:'none',zIndex:'100'});
    const app = /** @type {ParentNode} */ (root).querySelector('[data-editor-id="app"]');
    (app || root).appendChild(copy);
    sources.forEach((source,i) => { copies[i].scrollTop = source.scrollTop; copies[i].scrollLeft = source.scrollLeft; });
    snapshots.set(panel, copy);
    const duration = parseFloat(css.getPropertyValue('--mobile-sheet-duration')) || 280;
    const easing = css.getPropertyValue('--mobile-sheet-easing').trim() || 'cubic-bezier(.22,1,.36,1)';
    const animation = copy.animate([{transform:'translateY(0)',opacity:css.opacity},{transform:'translateY(calc(100% + 80px))',opacity:0}], {duration,easing,fill:'forwards'});
    const finish = () => { copy.remove(); if (snapshots.get(panel) === copy) snapshots.delete(panel); };
    animation.finished.then(finish, finish);
}

/** Switching tools replaces the sheet; dismiss any outgoing visual copies. */
export function dismissMobileSheetExits(root) {
    for (const copy of root.querySelectorAll('[data-mobile-sheet-exit]')) {
        copy.getAnimations().forEach(animation => animation.cancel());
        copy.remove();
    }
}
