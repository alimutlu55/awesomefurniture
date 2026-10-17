import { kitchenStorage } from '../../domain/kitchen/kitchen-storage';
import { esc } from './editor-format.js';
import { tags } from './storage-tags.js';

interface KitchenPlanPorts {
  readonly $: ReturnType<typeof import('./editor-dom.js').createEditorDom>['$'];
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'activeCabinet'>;
}

/** The Storage panel for a kitchen cabinet: what the kitchen along its wall holds (drawers, cupboards, shelves,
 * appliances, worktop), its units, and what a working kitchen still lacks. The same chip and panel as a
 * wardrobe's capacity, so Storage works for any furniture. */
export function createKitchenPlan({ $, model }: KitchenPlanPorts) {
  const rows = (pairs: readonly (readonly [string, string | number])[]) =>
    '<div class="capacity">' + pairs.map(([label, value]) => '<span>' + esc(label) + '</span><b>' + esc(String(value)) + '</b>').join('') + '</div>';
  return {
    render() {
      const s = kitchenStorage(model.scene.wardrobes, model.activeCabinet());
      $('#plan-title').textContent = 'Kitchen';
      $('#plan-summary').hidden = true;
      const held = ([['Drawers', s.drawers], ['Cupboards', s.doors], ['Open shelves', s.open], ['Pantry pull-outs', s.tall]] as const).filter(([, n]) => n > 0);
      $('#plan-capacity').innerHTML = (held.length ? rows(held) : '') + rows([['Appliances', s.appliances.join(', ') || 'None yet'], ['Worktop', s.worktop + ' cm']])
        + tags([s.units.base + ' base · ' + s.units.upper + ' wall · ' + s.units.tall + ' tall']);
      const warn = $('#fit-warn');
      warn.hidden = !s.notes.length;
      warn.textContent = String(s.notes.length);
      warn.title = s.notes.length + (s.notes.length === 1 ? ' note' : ' notes');
      $('#plan-warnings').innerHTML = s.notes.map(n => tags([n], 'warn')).join('');
      $('#score').textContent = '–';
    },
    /** Outer size and what sets it, in place of a wardrobe's hanging length and reach. */
    specs() {
      const c = model.activeCabinet().state;
      return [['Outer', c.w + ' × ' + c.h + ' × ' + c.d + ' cm'], ['Sections', String(c.n)], ['Finish', c.fin]]
        .map(([k, v]) => '<div class="stat"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('');
    },
  };
}
