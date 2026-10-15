import { MIN_CABINET_DEPTH } from '../../domain/wardrobe/cabinet-limits';
import { decorateMeasurementBadge } from '../components/measurement-badge';
/** Cabinet metadata adapts its rulers to the shared measurement control. */
export function decorateDimensionScrubber(el: HTMLElement) {
    if (!el.classList.contains('dimension-scrubber')) return;
    const key = ['w', 'd', 'h', 'h-left', 'h-right'].find(k => el.classList.contains('scrub-' + k));
    if (!key) return;
    const value = Number(el.textContent?.match(/[\d.]+/)?.[0] ?? 0), height = key.startsWith('h');
    el.dataset.scrubDimension = key;
    decorateMeasurementBadge(el, { id: key, value, orientation: height ? 'vertical' : 'horizontal',
        label: key === 'w' ? 'Wardrobe width' : key === 'd' ? 'Wardrobe depth'
            : key === 'h-left' ? 'Wardrobe left height' : key === 'h-right' ? 'Wardrobe right height' : 'Wardrobe height',
        min: key === 'w' ? 80 : key === 'd' ? MIN_CABINET_DEPTH : 40, max: key === 'w' ? 400 : key === 'd' ? 80 : 280 });
}

/** Interactive pills must remain above the toolbar even after zooming. */
export function scrubberBottom(el: HTMLElement, canvas: { top: number; height: number }, toolbar: () => { top: number; height: number }) {
    if (!el.classList.contains('measurement-badge')) return 56;
    const bar = toolbar();
    return bar.height ? Math.max(8, canvas.top + canvas.height - bar.top + 8) : 8;
}
