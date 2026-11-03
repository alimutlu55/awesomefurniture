import type { EditorItem } from '../../domain/wardrobe/editor-design';

/** Updates the cargo customization controls in the item settings popover. */
export function updateCargoUI(popover: HTMLElement, item: EditorItem): void {
  const icargo = popover.querySelector<HTMLElement>('#icargo');
  if (!icargo) return;
  const isCargo = item.k === 'cargo';
  icargo.hidden = !isCargo;
  if (!isCargo) return;

  const isTall = item.h >= 100;
  const activeTiers = item.tiers ?? (isTall ? (item.h >= 190 ? 5 : 4) : 2);
  const tierOptions = isTall ? [3, 4, 5, 6] : [2, 3];
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
}
