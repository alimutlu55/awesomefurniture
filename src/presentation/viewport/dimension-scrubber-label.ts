/** Dimension badges share one appearance; metadata makes only cabinet rulers
 * interactive. Item and room measurements keep their own editing behavior. */
export function decorateDimensionScrubber(el: HTMLElement) {
    if (!el.classList.contains('dimension-scrubber')) return;
    const key = ['w', 'd', 'h', 'h-left', 'h-right'].find(k => el.classList.contains('scrub-' + k));
    if (!key) return;
    const value = Number(el.textContent?.match(/[\d.]+/)?.[0] ?? 0), height = key.startsWith('h');
    el.dataset.scrubDimension = key;
    el.tabIndex = 0; el.setAttribute('role', 'slider');
    el.setAttribute('aria-label', key === 'w' ? 'Wardrobe width' : key === 'd' ? 'Wardrobe depth'
        : key === 'h-left' ? 'Wardrobe left height' : key === 'h-right' ? 'Wardrobe right height' : 'Wardrobe height');
    el.setAttribute('aria-valuenow', String(value)); el.setAttribute('aria-valuetext', value + ' centimetres');
    el.setAttribute('aria-valuemin', key === 'w' ? '80' : key === 'd' ? '35' : '40');
    el.setAttribute('aria-valuemax', key === 'w' ? '400' : key === 'd' ? '80' : '280');
    el.setAttribute('aria-orientation', height ? 'vertical' : 'horizontal');
    el.title = height ? 'Drag up/down to resize; arrow keys for precise changes' : 'Drag left/right to resize; arrow keys for precise changes';
}

/** Interactive pills must remain above the toolbar even after zooming. */
export function scrubberBottom(el: HTMLElement, canvas: { top: number; height: number }, toolbar: () => { top: number; height: number }) {
    if (!el.classList.contains('dimension-scrubber')) return 56;
    const bar = toolbar();
    return bar.height ? Math.max(8, canvas.top + canvas.height - bar.top + 8) : 8;
}
