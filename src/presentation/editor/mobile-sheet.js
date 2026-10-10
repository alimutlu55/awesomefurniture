/** Shared sheet affordance. Events belong to the mounted editor lifetime. */
/** @param {{ document: Pick<Document, 'createElement'>; lifetime: Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>; desktop: ReturnType<ReturnType<typeof import('./editor-dom.js').createEditorDom>['matchMedia']>; panel: HTMLElement; name: string; close: () => void; bottom?: boolean }} options */
export function mountMobileSheet({ document, lifetime, desktop, panel, name, close, bottom = false }) {
    panel.classList.add('mobile-sheet');
    if (bottom) panel.classList.add('mobile-bottom-sheet');
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'mobile-sheet-handle';
    handle.setAttribute('aria-label', `Close ${name}. Pull down or tap.`);
    handle.innerHTML = '<span aria-hidden="true"></span>';
    panel.prepend(handle);
    let gesture = null, suppressClick = false;
    const reset = () => {
        gesture = null;
        panel.style.translate = '';
        panel.classList.remove('sheet-dragging');
    };
    lifetime.listen(handle, 'pointerdown', e => {
        if (desktop.matches || !e.isPrimary || e.button !== 0) return;
        suppressClick = false;
        gesture = { id: e.pointerId, y: e.clientY, distance: 0 };
        handle.setPointerCapture(e.pointerId);
        panel.classList.add('sheet-dragging');
    });
    lifetime.listen(handle, 'pointermove', e => {
        if (!gesture || gesture.id !== e.pointerId) return;
        gesture.distance = Math.max(0, e.clientY - gesture.y);
        panel.style.translate = `0 ${gesture.distance}px`;
    });
    lifetime.listen(handle, 'pointerup', e => {
        if (!gesture || gesture.id !== e.pointerId) return;
        const distance = gesture.distance;
        suppressClick = distance > 5;
        reset();
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
        if (!desktop.matches && distance >= 64) close();
    });
    lifetime.listen(handle, 'pointercancel', reset);
    lifetime.listen(handle, 'lostpointercapture', reset);
    lifetime.listen(desktop, 'change', reset);
    lifetime.listen(handle, 'click', () => {
        if (!desktop.matches && !suppressClick) close();
        suppressClick = false;
    });
}
