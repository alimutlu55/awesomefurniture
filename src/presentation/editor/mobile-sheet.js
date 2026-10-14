import { registerMobileSheetMotion } from './mobile-sheet-motion.js';
/** Shared sheet affordance. Events belong to the mounted editor lifetime. */
/** `docked` matches while the panel is the desktop inspector: it keeps its place, so drag gestures are off.
 * @param {{ document: Pick<Document, 'createElement'>; lifetime: Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen' | 'cleanup'>;
 *   panel: HTMLElement; name: string; close: () => void; bottom?: boolean; fullscreen?: boolean; scene?: HTMLElement; docked?: { readonly matches: boolean } }} options */
export function mountMobileSheet({ document, lifetime, panel, name, close, bottom = false, fullscreen = false, scene, docked }) {
    panel.classList.add('mobile-sheet');
    if (bottom) {
        panel.classList.add('mobile-bottom-sheet');
        registerMobileSheetMotion(panel, { lifetime });
        panel.dataset.sheetPosition = fullscreen ? 'full' : 'compact';
    }
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'mobile-sheet-handle';
    handle.setAttribute('aria-label', bottom ? `${name} panel. Drag up to expand, down to lower. Tap to change height.` : `Close ${name}. Pull down or tap.`);
    handle.innerHTML = '<span aria-hidden="true"></span>';
    panel.prepend(handle);
    let gesture = null, suppressClick = false;
    const syncScene = () => {
        if (!scene || !bottom || fullscreen) return;
        scene.dataset.sheetDragging = '';
        scene.style.setProperty('--mobile-sheet-drag-inset', `${Math.max(0, scene.getBoundingClientRect().bottom - panel.getBoundingClientRect().top)}px`);
    };
    const reset = () => {
        gesture = null;
        panel.style.translate = '';
        panel.style.removeProperty('--mobile-sheet-drag-height');
        delete panel.dataset.sheetDragging;
        panel.classList.remove('sheet-dragging');
        if (scene) {
            delete scene.dataset.sheetDragging;
            scene.style.removeProperty('--mobile-sheet-drag-inset');
        }
    };
    const usableSurface = target => !target || handle.contains(target) || !target.closest('button,input,select,textarea,a,[contenteditable="true"],[role="slider"]');
    const scrollArea = target => {
        for (let el = target; el && panel.contains(el); el = el.parentElement) {
            if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
        }
        return null;
    };
    const start = (id, x, y, target, touch = false) => {
        suppressClick = false;
        if (docked?.matches || !usableSurface(target)) return false;
        gesture = { id, x, y, distance: 0, height: panel.getBoundingClientRect().height, position: panel.dataset.sheetPosition, touch, active: !touch, onHandle: !target || handle.contains(target), scroll: target ? scrollArea(target) : null };
        if (!touch) panel.classList.add('sheet-dragging');
        return true;
    };
    const move = (x, y) => {
        if (!gesture) return false;
        const distance = y - gesture.y;
        if (!gesture.active) {
            if (Math.max(Math.abs(x - gesture.x), Math.abs(distance)) < 8) return false;
            if (Math.abs(x - gesture.x) > Math.abs(distance)) { reset(); return false; }
            // Content scrolls normally. A downward pull at its top belongs to
            // the sheet; an upward pull expands a compact sheet first.
            if (!gesture.onHandle && gesture.scroll && (gesture.scroll.scrollTop > 0 || distance < 0 && gesture.position !== 'compact')) { reset(); return false; }
            gesture.active = true;
            panel.classList.add('sheet-dragging');
        }
        gesture.distance = distance;
        if (bottom && (distance < 0 || gesture.position !== 'compact')) {
            panel.dataset.sheetDragging = '';
            panel.style.setProperty('--mobile-sheet-drag-height', `${Math.max(96, gesture.height - distance)}px`);
        }
        else panel.style.translate = `0 ${Math.max(0, distance)}px`;
        syncScene();
        return true;
    };
    const finish = () => {
        if (!gesture) return;
        const { distance, position, active } = gesture;
        suppressClick = active && Math.abs(distance) > 5;
        reset();
        if (!active) return;
        if (bottom && distance <= -64) panel.dataset.sheetPosition = fullscreen ? 'full' : 'expanded';
        else if (bottom && distance >= 64 && position !== 'compact') panel.dataset.sheetPosition = 'compact';
        else if (distance >= 64) close();
    };
    lifetime.listen(panel, 'pointerdown', e => {
        if (e.pointerType === 'touch' || !e.isPrimary || e.button !== 0) return;
        if (start(e.pointerId, e.clientX, e.clientY, e.target)) handle.setPointerCapture(e.pointerId);
    });
    lifetime.listen(panel, 'pointermove', e => {
        if (gesture && !gesture.touch && gesture.id === e.pointerId) move(e.clientX, e.clientY);
    });
    lifetime.listen(panel, 'pointerup', e => {
        if (!gesture || gesture.touch || gesture.id !== e.pointerId) return;
        finish();
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    });
    lifetime.listen(panel, 'pointercancel', e => { if (!gesture?.touch) reset(); });
    lifetime.listen(panel, 'lostpointercapture', e => { if (!gesture?.touch) reset(); });
    lifetime.listen(panel, 'touchstart', e => {
        if (e.touches.length !== 1) { reset(); return; }
        const t = e.touches[0];
        start(t.identifier, t.clientX, t.clientY, e.target, true);
    }, { passive: true });
    lifetime.listen(panel, 'touchmove', e => {
        if (!gesture?.touch) return;
        const t = [...e.touches].find(t => t.identifier === gesture.id);
        if (t && move(t.clientX, t.clientY)) e.preventDefault();
    }, { passive: false });
    lifetime.listen(panel, 'touchend', finish);
    lifetime.listen(panel, 'touchcancel', reset);
    lifetime.listen(panel, 'click', e => {
        if (suppressClick && e.isTrusted) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
    }, { capture: true });
    lifetime.listen(handle, 'click', () => {
        if (!suppressClick) {
            if (bottom) panel.dataset.sheetPosition = panel.dataset.sheetPosition === 'compact' ? (fullscreen ? 'full' : 'expanded') : 'compact';
            else close();
        }
        suppressClick = false;
    });
}
