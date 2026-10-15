import type { createEditorDom } from './editor-dom';

/** Feedback is optional: reduced motion and browsers without vibration work
 * identically. Bounce the pill, never the physical cabinet past a room boundary. */
export function createTactileFeedback(dom: Pick<ReturnType<typeof createEditorDom>, 'navigator' | 'matchMedia'>) {
    const reduced = dom.matchMedia('(prefers-reduced-motion: reduce)');
    let last = -Infinity, value: number | undefined;
    return {
        begin(initial: number) { value = Math.round(initial); },
        tick(next: number) {
            const rounded = Math.round(next), now = performance.now();
            if (value === rounded) return;
            value = rounded;
            if (reduced.matches || now - last < 70) return;
            last = now;
            try { dom.navigator.vibrate?.(4); } catch { /* Optional hardware capability. */ }
        },
        settle(el: HTMLElement | null) {
            value = undefined;
            if (!reduced.matches) el?.animate?.([{ scale: '1' }, { scale: '1.02' }, { scale: '.995' }, { scale: '1' }],
                { duration: 240, easing: 'ease-out' });
        },
    };
}
