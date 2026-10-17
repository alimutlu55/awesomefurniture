import { KITCHEN_PRESETS } from '../../domain/kitchen/kitchen-design';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';
import { kitchenPresetArt } from './kitchen-art';
import { esc } from './editor-format.js';

interface KitchenPanelPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  /** Adds the unit of a preset beside the kitchen it belongs to; false when it does not fit. */
  readonly add: (preset: string) => boolean;
}

/** The Cabinets category of Add: base, wall and tall units, and ready-made ones (drawers, sink, hob and oven,
 * fridge, pantry), drawn from the presets. On a desktop it is a fold of the Add panel; on a phone a category of
 * the catalogue. New units go beside the selected one; Add item fills them in. */
export function createKitchenPanel({ dom, add }: KitchenPanelPorts) {
  const buttons = (extra: string) => KITCHEN_PRESETS.map(p => {
    const unit = kitchenUnit(p.unit), title = esc(p.name + ' · ' + unit.description);
    return `<button type="button" class="kitchen-product" data-add-kitchen="${p.key}"${extra} title="${title}">${kitchenPresetArt(p)}<span>${esc(p.name)}</span></button>`;
  }).join('');
  function render() {
    dom.$('#padd-kitchen').innerHTML = buttons('');
  }
  /** The phone catalogue's Cabinets category. */
  const products = () => buttons(' data-product-category="kitchen" hidden');
  function bind(listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void) {
    listen(dom.$('#pop2'), 'click', e => {
      const preset = (e.target as Element).closest<HTMLElement>('[data-add-kitchen]')?.dataset.addKitchen;
      if (preset) add(preset);
    });
  }
  return { render, products, bind };
}
