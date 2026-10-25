import { LENGTH_UNITS, type LengthUnit } from '../../domain/geometry/length-units';
import { bindLengthInputs } from './length-inputs';
import { currentLengthUnit, onLengthUnitChange, setLengthUnit } from './length-unit-state';

interface Ports {
  dom: { $(selector: string): HTMLElement; document: { createElement(tag: 'div'): HTMLElement } };
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  /** Redraw what shows lengths: the model's measurements, the panels and the studio. */
  redraw(): void;
}

/** "Units" in the editor menu (the three dots): millimetres, centimetres or inches, for every length the editor
 * shows or takes. Also makes the editor's length fields unit-aware and redraws when the unit changes. */
export function bindLengthUnits({ dom, lifetime, redraw }: Ports) {
  const menu = dom.$('#menu'), row = dom.document.createElement('div');
  row.className = 'mi unit-row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Measurement units');
  row.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17h18v-5h-2.5v2.5H16V12h-2.5v2.5H11V12H8.5v2.5H6V12H3z"/></svg><span>Units</span>'
    + '<span class="unit-seg">' + LENGTH_UNITS.map(u => `<button type="button" data-unit="${u.key}" title="${u.name}" aria-label="${u.name}">${u.short}</button>`).join('') + '</span>';
  (menu.querySelector('[data-menu-group="preferences"]') ?? menu).append(row);
  const show = (unit: LengthUnit) => row.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
  show(currentLengthUnit());
  // Choosing a unit keeps the menu open: people try each and look at the model.
  lifetime.listen(row, 'click', e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-unit]');
    if (!button) return;
    e.stopPropagation();
    setLengthUnit(button.dataset.unit as LengthUnit);
  });
  lifetime.cleanup(onLengthUnitChange(unit => { show(unit); redraw(); }));
  bindLengthInputs(menu.getRootNode() as ShadowRoot | Document, undo => lifetime.cleanup(undo));
  lifetime.cleanup(() => row.remove());
}
