import { resizeHeightMinimum } from '../../domain/wardrobe/cabinet-size-limits';

/** Keep the slider's scale stable while a gesture changes the front/rear height difference.
 * @param {ReturnType<typeof import('./editor-dom.js').createEditorDom>} dom
 * @param {import('../../domain/wardrobe/shape/wardrobe-shape').ShapedDesign} design
 * @param {false | 'w' | 'h' | 'd'} editingSize */
export function syncCabinetHeightMinimum(dom, design, editingSize) {
    const min = String(resizeHeightMinimum(design));
    dom.$('#h').min = min;
    const range = /** @type {HTMLInputElement | null} */ (dom.document.querySelector('[data-dimension="h"]'));
    if (range && editingSize !== 'h') range.min = min;
}

/** Wrap existing bound dimension inputs in the shared value-and-slider layout. */
export function mountResizeFields({ dom, lifetime, fields, preview, model, history, refresh }) {
    for (const { input, axis } of fields) {
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
        let before = null;
        const finish = (cancel = false) => {
            if (before === null) return;
            const original = before;
            before = null;
            if (cancel) model.restore(original);
            else if (model.snapshot() !== original) history.checkpoint(original);
            refresh();
        };
        lifetime.listen(range, 'input', () => {
            if (before === null) before = model.snapshot();
            preview(input, range.valueAsNumber);
            refresh();
        });
        lifetime.listen(range, 'change', () => finish());
        lifetime.listen(range, 'blur', () => finish());
        lifetime.listen(range, 'pointercancel', () => finish(true));
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
