import { DEFAULT_REACH, MAX_REACH, MIN_REACH } from '../../domain/wardrobe/max-reach';

interface Ports {
  dom: { $(selector: string): HTMLElement; document: { createElement(tag: 'div'): HTMLElement } };
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  /** The project's max reach (cm), or undefined when none is set. */
  current(): number | undefined;
  set(value: number | null): void;
}

/** "Max reach" in the editor menu (the three dots): the highest a person comfortably reaches, one height for the whole
 * project. Off, the editor plans for the usual height and shows no reach; on, every wardrobe and cabinet follows it, and the
 * reach line shows on a selected piece that rises to it. The field is a length field: it shows the chosen unit. */
export function bindMaxReachMenu({ dom, lifetime, current, set }: Ports) {
  const menu = dom.$('#menu'), row = dom.document.createElement('div');
  row.className = 'mi reach-menu-row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Max reach');
  row.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V4M8 8l4-4 4 4M6 21h12"/></svg><span>Max reach</span>'
    + '<label class="reach-field"><input type="number" min="' + MIN_REACH + '" max="' + MAX_REACH + '" step="1" aria-label="Max reach height"><small>cm</small></label>'
    + '<button type="button" class="reach-switch" role="switch" aria-label="Use a max reach for this project"><i></i></button>';
  (menu.querySelector('[data-menu-group="preferences"]') ?? menu).append(row);
  const input = row.querySelector('input')!, toggle = row.querySelector<HTMLButtonElement>('.reach-switch')!;
  const sync = () => {
    const value = current();
    toggle.setAttribute('aria-checked', String(value !== undefined));
    input.disabled = value === undefined;
    row.classList.toggle('is-off', value === undefined);
    if (document.activeElement !== input) input.value = String(value ?? DEFAULT_REACH);
  };
  sync();
  // Switching on starts at the usual height; off clears it everywhere. The menu stays open to see the effect.
  lifetime.listen(toggle, 'click', e => { e.stopPropagation(); set(current() === undefined ? DEFAULT_REACH : null); sync(); });
  const commit = () => { if (current() !== undefined && Number.isFinite(input.valueAsNumber)) set(input.valueAsNumber); sync(); };
  lifetime.listen(input, 'change', commit);
  lifetime.listen(input, 'keydown', e => {
    const key = (e as KeyboardEvent).key;
    if (key === 'Enter') { commit(); input.blur(); } else if (key === 'Escape') { e.stopPropagation(); sync(); input.blur(); }
  });
  lifetime.listen(row, 'click', e => e.stopPropagation());
  // Undo, redo and a loaded project change it behind the menu's back: show the truth each time the menu opens.
  const watch = new MutationObserver(sync);
  watch.observe(menu, { attributes: true, attributeFilter: ['hidden', 'class'] });
  lifetime.cleanup(() => { watch.disconnect(); row.remove(); });
  return { sync };
}
