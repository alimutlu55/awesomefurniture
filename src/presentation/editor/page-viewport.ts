/** Keep the standalone page in the visible viewport while Safari pans for
 * the keyboard. Embedded editors retain their container-owned sizing. */
export function bindPageViewport(root: HTMLElement, view: Window): () => void {
    const visual = view.visualViewport;
    let frame = 0;
    // Some mobile browsers shrink innerHeight along with the visual viewport.
    // Compare with the space available before focus, not the current layout.
    let availableHeight = visual?.height ?? view.innerHeight;
    let availableWidth = visual?.width ?? view.innerWidth;
    const resize = () => {
        const focused = root.shadowRoot?.activeElement;
        let studioDimension = focused?.getAttribute?.('data-room-field') != null;
        const encoded = focused?.closest?.('[data-scene-measurement]')?.getAttribute?.('data-scene-measurement');
        if (encoded) try { studioDimension ||= JSON.parse(decodeURIComponent(encoded)).kind === 'studio'; } catch { /* Not a dimension reference. */ }
        // Do not counteract intentional page magnification or its panning.
        if (visual && Math.abs(visual.scale - 1) < .01) {
            // Keep the same projection and touch positions while a room dimension opens the keyboard.
            root.style.height = `${studioDimension ? availableHeight : visual.height}px`;
            root.style.width = `${visual.width}px`;
            root.style.transform = `translate(${visual.offsetLeft}px, ${visual.offsetTop}px)`;
        } else {
            root.style.transform = '';
        }
        const editing = !!focused?.matches('input[type="number"],input[type="text"],input:not([type]),textarea,[contenteditable="true"]');
        if (visual && Math.abs(visual.scale - 1) < .01) {
            if (Math.abs(visual.width - availableWidth) > 50) {
                availableWidth = visual.width;
                availableHeight = visual.height;
            } else if (!editing) availableHeight = Math.max(availableHeight, visual.height);
        }
        const keyboard = !!visual && editing && Math.abs(visual.scale - 1) < .01 && visual.height < availableHeight - 100;
        root.toggleAttribute('data-keyboard-open', keyboard);
        view.cancelAnimationFrame(frame);
        if (editing) frame = view.requestAnimationFrame(() => {
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
    // The editor fills its frame and never scrolls as a whole. Safari scrolls it anyway when something focuses
    // a control that is still sliding in from below the screen, leaving the editor shifted up over a blank area.
    const unscroll = () => { if (root.scrollTop || root.scrollLeft) root.scrollTo(0, 0); };
    visual?.addEventListener('resize', resize);
    visual?.addEventListener('scroll', resize);
    root.addEventListener('scroll', unscroll);
    root.addEventListener('focusin', resize);
    root.addEventListener('focusout', resize);
    resize();
    return () => {
        visual?.removeEventListener('resize', resize);
        visual?.removeEventListener('scroll', resize);
        root.removeEventListener('focusin', resize);
        root.removeEventListener('focusout', resize);
        root.removeEventListener('scroll', unscroll);
        view.cancelAnimationFrame(frame);
    };
}
