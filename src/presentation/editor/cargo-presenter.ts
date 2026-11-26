import type { EditorItem } from '../../domain/wardrobe/editor-design';
import { cargoTierOptions, TALL_CARGO_HEIGHT } from '../../domain/kitchen/cargo-pullout';

/** Updates the cargo customization controls in the item settings popover. */
export function updateCargoUI(popover: HTMLElement, item: EditorItem): void {
  const icargo = popover.querySelector<HTMLElement>('#icargo');
  if (!icargo) return;
  const isCargo = item.k === 'cargo';
  icargo.hidden = !isCargo;
  if (!isCargo) return;

  const isTall = item.h >= TALL_CARGO_HEIGHT;
  // Only the counts a frame this high is made with; a count saved before the pull-out was resized is not offered.
  const tierOptions = cargoTierOptions(item.h);
  const activeTiers = item.tiers !== undefined && tierOptions.includes(item.tiers) ? item.tiers : (isTall ? (item.h >= 190 ? 5 : 4) : 2);
  const tiersContainer = icargo.querySelector('#icargo-tiers-btns');
  if (tiersContainer) {
    tiersContainer.innerHTML = tierOptions.map(t =>
      `<button type="button" data-tiers="${t}" class="${t === activeTiers ? 'on' : ''}" aria-pressed="${t === activeTiers}">${t}</button>`
    ).join('');
  }

  const activeStyle = item.basketStyle ?? 'wire';
  icargo.querySelectorAll<HTMLButtonElement>('[data-basket-style]').forEach(b => {
    const on = b.getAttribute('data-basket-style') === activeStyle;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });

  const activeMount = item.cargoMount ?? 'left';
  icargo.querySelectorAll<HTMLButtonElement>('[data-cargo-mount]').forEach(b => {
    const on = b.getAttribute('data-cargo-mount') === activeMount;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}
