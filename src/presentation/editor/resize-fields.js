import { syncKitchenConstruction } from './kitchen-construction-fields';
import { furnitureModule } from '../../domain/furniture/furniture';
import { bindSizeSlider, syncSizeRange } from './size-control';
import { createCabinetSizeRange } from '../../application/commands/cabinet-size-range';

/** Whole-piece limits are queried when Size opens, and after each completed edit.
 * Hidden controls must not run boundary searches during an item drag.
 * @param {ReturnType<typeof import('./editor-dom.js').createEditorDom>} dom
 * @param {Pick<ReturnType<typeof import('../../application/projects/editor-model').createEditorModel>, 'scene'>} model */
export function createCabinetSizeSync(dom, model) {
    const query = createCabinetSizeRange(() => model.scene);
    /** @type {Record<'w' | 'h' | 'd', [number, number]> | undefined} */
    let bounds;
    return (design, editingSize) => {
        const panel = dom.$('#left'), open = dom.$('#app').classList.contains('props-open')
            && panel.dataset.contextSection === 'resize' && panel.dataset.roomResize === undefined;
        if (!bounds || (open && !editingSize)) bounds = query() ?? undefined;
        syncCabinetSizeLimits(dom, design, editingSize, bounds);
    };
}

/** Size fields and sliders take the selected furniture's limits (a wall cabinet's are not a wardrobe's). A slider
 * being dragged keeps its scale while a gesture changes the front/rear height difference.
 * @param {ReturnType<typeof import('./editor-dom.js').createEditorDom>} dom
 * @param {import('../../domain/wardrobe/editor-design').EditorDesign} design
 * @param {false | 'w' | 'h' | 'd'} editingSize */
export function syncCabinetSizeLimits(dom, design, editingSize, sizes = furnitureModule(design).sizes(design)) {
    syncKitchenConstruction(dom, design);
    for (const axis of /** @type {const} */ (['w', 'h', 'd'])) {
        const min = String(Math.min(sizes[axis][0], design[axis])), max = String(Math.max(sizes[axis][1], design[axis]));
        const input = /** @type {HTMLInputElement} */ (dom.$('#' + axis));
        input.min = min;
        input.max = max;
        const range = /** @type {HTMLInputElement | null} */ (dom.document.querySelector('[data-dimension="' + axis + '"]'));
        if (range) syncSizeRange(range, editingSize === axis ? range.min : min, editingSize === axis ? range.max : max, String(design[axis]));
        input.value = String(design[axis]);
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
        syncSizeRange(range, input.min || '0', input.max || '400', input.value, input.disabled);
        range.setAttribute('aria-label', 'Adjust ' + input.getAttribute('aria-label').toLowerCase());
        range.setAttribute('aria-valuetext', input.value + ' cm');
    }
}
