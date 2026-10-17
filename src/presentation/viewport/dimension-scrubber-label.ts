import { MIN_CABINET_DEPTH } from '../../domain/wardrobe/cabinet-limits';
import { furnitureModule, type FurnitureModule } from '../../domain/furniture/furniture';
import type { FurnitureDesign } from '../../domain/furniture/furniture-module';
import { decorateMeasurementBadge } from '../components/measurement-badge';
/** Cabinet metadata adapts its rulers to the shared measurement control, within the limits of the furniture it
 * measures (a wall cabinet's width is not a wardrobe's). Without a design: a wardrobe's. */
export function decorateDimensionScrubber(el: HTMLElement, design?: FurnitureDesign) {
    if (!el.classList.contains('dimension-scrubber')) return;
    const key = ['w', 'd', 'h', 'h-left', 'h-right'].find(k => el.classList.contains('scrub-' + k));
    if (!key) return;
    const value = Number(el.textContent?.match(/[\d.]+/)?.[0] ?? 0), height = key.startsWith('h');
    const module: FurnitureModule | null = design ? furnitureModule(design) : null, sizes = design && module ? module.sizes(design) : null;
    const noun = module ? module.noun.charAt(0).toUpperCase() + module.noun.slice(1) : 'Wardrobe';
    const [min, max] = sizes ? sizes[height ? 'h' : key as 'w' | 'd'] : key === 'w' ? [80, 400] : key === 'd' ? [MIN_CABINET_DEPTH, 80] : [40, 280];
    el.dataset.scrubDimension = key;
    decorateMeasurementBadge(el, { id: key, value, orientation: height ? 'vertical' : 'horizontal',
        label: key === 'w' ? noun + ' width' : key === 'd' ? noun + ' depth'
            : key === 'h-left' ? noun + ' left height' : key === 'h-right' ? noun + ' right height' : noun + ' height',
        min: height && !sizes ? 40 : min, max });
}

/** Size pills sit beside their lines, away from the furniture: the width below the floor, the depth and heights on
 * the side facing away from its middle (`middleX`, its screen x). Centred on their lines they would cover the
 * fittings at its edges, and a finger pressing one of those would land on the pill instead. Screen pixels. */
export function scrubberAside(el: HTMLElement, x: number, y: number, ew: number, eh: number, middleX?: () => number) {
    if (el.classList.contains('scrub-w')) return { x, y: y + eh / 2 + 4 };
    if (!el.classList.contains('dimension-scrubber') || !middleX) return { x, y };
    return { x: x + Math.sign(x - middleX() || 1) * (ew / 2 + 4), y };
}

/** Interactive pills must remain above the toolbar even after zooming. */
export function scrubberBottom(el: HTMLElement, canvas: { top: number; height: number }, toolbar: () => { top: number; height: number }) {
    if (!el.classList.contains('measurement-badge')) return 56;
    const bar = toolbar();
    return bar.height ? Math.max(8, canvas.top + canvas.height - bar.top + 8) : 8;
}
