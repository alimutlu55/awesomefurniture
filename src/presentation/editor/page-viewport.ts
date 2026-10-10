/** Keep the standalone page in the visible viewport while Safari pans for
 * the keyboard. Embedded editors retain their container-owned sizing. */
export function bindPageViewport(root: HTMLElement, view: Window): () => void {
    const visual = view.visualViewport;
    let frame = 0;
    const resize = () => {
        // Do not counteract intentional page magnification or its panning.
        if (visual && Math.abs(visual.scale - 1) < .01) {
            root.style.height = `${visual.height}px`;
            root.style.width = `${visual.width}px`;
            root.style.transform = `translate(${visual.offsetLeft}px, ${visual.offsetTop}px)`;
        } else {
            root.style.transform = '';
        }
        const focused = root.shadowRoot?.activeElement;
        const editing = !!focused?.matches('input[type="number"],input[type="text"],input:not([type]),textarea,[contenteditable="true"]');
        const keyboard = !!visual && editing && Math.abs(visual.scale - 1) < .01 && visual.height < view.innerHeight - 100;
        root.toggleAttribute('data-keyboard-open', keyboard);
        view.cancelAnimationFrame(frame);
        if (keyboard) frame = view.requestAnimationFrame(() => {
            // Scroll only the editor panel; scrollIntoView can pan the entire
            // document on iOS and reintroduce the blank area below the editor.
            const panel = focused?.closest<HTMLElement>('aside,.pop,.wizard-body');
            if (!panel || !focused) return;
            const inputRect = focused.getBoundingClientRect(), panelRect = panel.getBoundingClientRect();
            const top = panelRect.top + (panel.matches('.pop') ? 64 : 12);
            if (inputRect.top < top) panel.scrollTop += inputRect.top - top;
            else if (inputRect.bottom > panelRect.bottom - 12) panel.scrollTop += inputRect.bottom - panelRect.bottom + 12;
        });
    };
    visual?.addEventListener('resize', resize);
    visual?.addEventListener('scroll', resize);
    root.addEventListener('focusin', resize);
    root.addEventListener('focusout', resize);
    resize();
    return () => {
        visual?.removeEventListener('resize', resize);
        visual?.removeEventListener('scroll', resize);
        root.removeEventListener('focusin', resize);
        root.removeEventListener('focusout', resize);
        view.cancelAnimationFrame(frame);
    };
}
