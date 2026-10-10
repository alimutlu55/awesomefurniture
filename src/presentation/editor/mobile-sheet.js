/** Shared sheet affordance. Events belong to the mounted editor lifetime. */
/** @param {{ document: Pick<Document, 'createElement'>; lifetime: Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>; desktop: ReturnType<ReturnType<typeof import('./editor-dom.js').createEditorDom>['matchMedia']>; panel: HTMLElement; name: string; close: () => void; bottom?: boolean; fullscreen?: boolean }} options */
export function mountMobileSheet({ document, lifetime, desktop, panel, name, close, bottom = false, fullscreen = false }) {
    panel.classList.add('mobile-sheet');
    if (bottom) {
        panel.classList.add('mobile-bottom-sheet');
        panel.dataset.sheetPosition = fullscreen ? 'full' : 'compact';
    }
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'mobile-sheet-handle';
    handle.setAttribute('aria-label', bottom ? `${name} panel. Drag up to expand, down to lower. Tap to change height.` : `Close ${name}. Pull down or tap.`);
    handle.innerHTML = '<span aria-hidden="true"></span>';
    panel.prepend(handle);
    let gesture = null, suppressClick = false;
    const reset = () => {
        gesture = null;
        panel.style.translate = '';
        panel.style.removeProperty('--mobile-sheet-drag-height');
        delete panel.dataset.sheetDragging;
        panel.classList.remove('sheet-dragging');
    };
    lifetime.listen(handle, 'pointerdown', e => {
        if (desktop.matches || !e.isPrimary || e.button !== 0) return;
        suppressClick = false;
        gesture = { id: e.pointerId, y: e.clientY, distance: 0, height: panel.getBoundingClientRect().height, position: panel.dataset.sheetPosition };
        handle.setPointerCapture(e.pointerId);
        panel.classList.add('sheet-dragging');
    });
    lifetime.listen(handle, 'pointermove', e => {
        if (!gesture || gesture.id !== e.pointerId) return;
        gesture.distance = e.clientY - gesture.y;
        if (bottom && (gesture.distance < 0 || gesture.position !== 'compact')) {
            panel.dataset.sheetDragging = '';
            panel.style.setProperty('--mobile-sheet-drag-height', `${Math.max(96, gesture.height - gesture.distance)}px`);
        }
        else panel.style.translate = `0 ${Math.max(0, gesture.distance)}px`;
    });
    lifetime.listen(handle, 'pointerup', e => {
        if (!gesture || gesture.id !== e.pointerId) return;
        const distance = gesture.distance, position = gesture.position;
        suppressClick = Math.abs(distance) > 5;
        reset();
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
        if (desktop.matches) return;
        if (bottom && distance <= -64) panel.dataset.sheetPosition = fullscreen ? 'full' : 'expanded';
        else if (bottom && distance >= 64 && position !== 'compact') panel.dataset.sheetPosition = 'compact';
        else if (distance >= 64) close();
    });
    lifetime.listen(handle, 'pointercancel', reset);
    lifetime.listen(handle, 'lostpointercapture', reset);
    lifetime.listen(desktop, 'change', reset);
    lifetime.listen(handle, 'click', () => {
        if (!desktop.matches && !suppressClick) {
            if (bottom) panel.dataset.sheetPosition = panel.dataset.sheetPosition === 'compact' ? (fullscreen ? 'full' : 'expanded') : 'compact';
            else close();
        }
        suppressClick = false;
    });
}
