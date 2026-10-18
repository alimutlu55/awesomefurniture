import { KITCHEN_PRESETS } from '../../domain/kitchen/kitchen-design';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';
import { kitchenPresetArt } from './kitchen-art';
import { esc } from './editor-format.js';
import { hasTrait } from '../../domain/wardrobe/fittings';

interface KitchenPanelPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  /** Adds the unit of a preset beside the kitchen it belongs to; false when it does not fit. */
  readonly add: (preset: string) => boolean;
}

/** The Cabinets category of Add: base, wall and tall units, and ready-made ones (drawers, sink, hob and oven,
 * fridge, pantry), drawn from the presets. On a desktop it is a fold of the Add panel; on a phone a category of
 * the catalogue. New units go beside the selected one; Add item fills them in. */
export function createKitchenPanel({ dom, add }: KitchenPanelPorts) {
  const card = (p: typeof KITCHEN_PRESETS[number], extra: string) => {
    const unit = kitchenUnit(p.unit), title = esc(p.name + ' · ' + unit.description);
    return `<button type="button" class="kitchen-product" data-add-kitchen="${p.key}"${extra} title="${title}">${kitchenPresetArt(p)}<span>${esc(p.name)}</span></button>`;
  };

  /** The panel's sections: cabinets by where they stand, and what holds an appliance or a sink on its own. */
  const sectionOf = (p: typeof KITCHEN_PRESETS[number]) => (p.parts as readonly (readonly [string, number])[]).some(([kind]) => hasTrait(kind, 'appliance')) ? 'Sinks and appliances'
    : p.unit === 'upper' ? 'Wall cabinets' : p.unit === 'tall' ? 'Tall cabinets' : 'Base cabinets';
  const SECTIONS = ['Base cabinets', 'Sinks and appliances', 'Wall cabinets', 'Tall cabinets'];
  /** Every card in the order of the sections, so related ones sit together. */
  const buttons = (extra: string) => SECTIONS.flatMap(section => KITCHEN_PRESETS.filter(p => sectionOf(p) === section)).map(p => card(p, extra)).join('');
  function render() {
    const sections = SECTIONS;
    dom.$('#padd-kitchen').innerHTML = sections.map(section => {
      const cards = KITCHEN_PRESETS.filter(p => sectionOf(p) === section).map(p => card(p, '')).join('');
      return cards ? `<p class="kitchen-group">${esc(section)}</p>${cards}` : '';
    }).join('');
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
