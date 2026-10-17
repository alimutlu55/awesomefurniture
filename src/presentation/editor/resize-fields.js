import { furnitureModule } from '../../domain/furniture/furniture';
import { bindSizeSlider } from './size-control';

/** Size fields and sliders take the selected furniture's limits (a wall cabinet's are not a wardrobe's). A slider
 * being dragged keeps its scale while a gesture changes the front/rear height difference.
 * @param {ReturnType<typeof import('./editor-dom.js').createEditorDom>} dom
 * @param {import('../../domain/furniture/furniture-module').FurnitureDesign} design
 * @param {false | 'w' | 'h' | 'd'} editingSize */
export function syncCabinetSizeLimits(dom, design, editingSize) {
    const sizes = furnitureModule(design).sizes(design);
    for (const axis of /** @type {const} */ (['w', 'h', 'd'])) {
        const [min, max] = sizes[axis].map(String), input = /** @type {HTMLInputElement} */ (dom.$('#' + axis));
        input.min = min;
        input.max = max;
        const range = /** @type {HTMLInputElement | null} */ (dom.document.querySelector('[data-dimension="' + axis + '"]'));
        if (range && editingSize !== axis) { range.min = min; range.max = max; }
    }
}

/** Wrap existing bound dimension inputs in the shared value-and-slider layout. */
export function mountResizeFields({ dom, lifetime, fields, preview, model, history, refresh, commit = () => {} }) {
    for (const { input, axis } of fields) {
        const existing = input.closest('.resize-field-control')?.querySelector?.('input[type="range"]');
        if (existing) {
            bindSizeSlider({ range: existing, lifetime, model, history, preview: value => preview(input, value), refresh, commit });
            continue;
        }
        const label = input.closest('label'), control = dom.document.createElement('div');
        control.className = 'resize-field-control';
        control.dataset.axis = axis;
        label.classList.add('size-row');
        label.replaceWith(control);
        control.append(label);
        const range = dom.document.createElement('input');
        range.type = 'range';
        range.className = 'size-range mobile-resize-range';
        control.append(range);
        bindSizeSlider({ range, lifetime, model, history, preview: value => preview(input, value), refresh, commit });
    }
}

export function syncResizeFields(container) {
    for (const control of container.querySelectorAll('.resize-field-control')) {
        const input = control.querySelector('input[type="number"]'), range = control.querySelector('input[type="range"]');
        range.min = input.min || '0';
        range.max = input.max || '400';
        range.step = input.step || '0.5';
        range.value = input.value;
        range.disabled = input.disabled || Number(range.max) <= Number(range.min);
        range.setAttribute('aria-label', 'Adjust ' + input.getAttribute('aria-label').toLowerCase());
        range.setAttribute('aria-valuetext', input.value + ' cm');
    }
}
