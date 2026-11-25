import { ROOMS, categoryPath, furnitureCategory, leafCategories, type RoomKey } from '../../domain/furniture/furniture-taxonomy';
import { esc } from './editor-format.js';

export interface CatalogState { room: RoomKey | 'all'; category: string | null }

/**
 * Add furniture as furniture shops lay it out: first a tile per category, filtered by room, then the pieces of the one
 * picked with a way back. Everything comes from the taxonomy (furniture-taxonomy.ts) and the product cards already in the
 * sheet, each tagged with its category: a tile's picture is its first piece's, and a category with no pieces has no tile.
 * A new kind of furniture is a taxonomy entry and an item pointing at it; nothing here changes.
 */
export function renderFurnitureCatalog(host: HTMLElement, products: HTMLElement, show: (category: string) => void, state: CatalogState) {
  const cards = (id: string) => Array.from(products.querySelectorAll<HTMLElement>(`[data-product-category="${id}"]`));
  function draw() {
    const open = state.category ? furnitureCategory(state.category) : undefined;
    host.dataset.view = open ? 'pieces' : 'categories';
    if (open) {
      host.innerHTML = '<button type="button" class="fc-back" data-fc-back>‹ All furniture</button>'
        + `<b class="fc-title">${esc(open.label)}</b><small class="fc-path">${esc(categoryPath(open.id).join(' › '))}</small>`;
      show(open.id);
      return;
    }
    show('');
    const rooms: [string, string][] = [['all', 'All rooms'], ...ROOMS.map(r => [r.key, r.label] as [string, string])];
    const tiles = leafCategories().filter(c => cards(c.id).length > 0 && (state.room === 'all' || c.rooms.includes(state.room)));
    host.innerHTML = '<div class="fc-rooms" role="group" aria-label="Room">'
      + rooms.map(([key, label]) => `<button type="button" data-fc-room="${key}" aria-pressed="${state.room === key}">${esc(label)}</button>`).join('')
      + '</div><div class="fc-tiles">' + tiles.map(c => {
        const items = cards(c.id), art = items[0]?.querySelector('svg')?.outerHTML ?? '';
        return `<button type="button" class="fc-tile" data-fc-category="${c.id}">${art}<b>${esc(c.label)}</b>`
          + `<small>${items.length} ${items.length === 1 ? 'design' : 'designs'}</small></button>`;
      }).join('') + '</div>';
  }
  host.onclick = event => {
    const target = event.target as HTMLElement;
    const room = target.closest<HTMLElement>('[data-fc-room]'), tile = target.closest<HTMLElement>('[data-fc-category]');
    if (room) state.room = room.dataset.fcRoom as CatalogState['room'];
    else if (tile) state.category = tile.dataset.fcCategory ?? null;
    else if (target.closest('[data-fc-back]')) state.category = null;
    else return;
    draw();
    (host.querySelector<HTMLElement>(tile ? '[data-fc-back]' : room ? `[data-fc-room="${state.room}"]` : '[data-fc-category]'))?.focus();
  };
  draw();
}
