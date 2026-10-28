import { decorBadge, type TargetZone } from '../../domain/materials/decor-catalog';
import { browseMaterials, materialFilters, type MaterialFilter } from '../../domain/materials/material-browser';
import { bindLoadingImage } from '../components/loading-image';

/** Each role keeps its own search/filter so switching zones never changes another role's selection. */
export function appendDecorBrowser(section: HTMLElement, zone: TargetZone, title: string, select: (zone: TargetZone, id: string) => void) {
  const doc = section.ownerDocument, search = doc.createElement('input');
  search.type = 'search'; search.className = 'decor-search'; search.placeholder = 'Search code, brand or color';
  search.setAttribute('aria-label', `Search ${title.toLowerCase()} materials`);
  const pills = doc.createElement('div'); pills.className = 'decor-filters'; pills.setAttribute('role', 'group'); pills.setAttribute('aria-label', `${title} material categories`);
  const grid = doc.createElement('div'); grid.className = 'decor-grid';
  const empty = doc.createElement('p'); empty.className = 'decor-empty'; empty.textContent = 'No materials match this search.';
  empty.setAttribute('role', 'status');
  let filter: MaterialFilter = 'all';
  const render = () => {
    grid.replaceChildren();
    for (const sku of browseMaterials(zone, search.value, filter)) {
      const button = doc.createElement('button');
      button.type = 'button'; button.className = 'decor-option'; button.dataset.decorZone = zone; button.dataset.decorId = sku.id;
      button.title = `${sku.name} · ${decorBadge(sku)}`;
      button.setAttribute('aria-label', `${title}: ${sku.name}, ${decorBadge(sku)}`);
      const selected = section.dataset.selectedDecor === sku.id;
      button.classList.toggle('on', selected); button.setAttribute('aria-pressed', String(selected));
      const swatch = doc.createElement('span'); swatch.className = 'decor-swatch'; swatch.dataset.family = sku.category;
      swatch.style.backgroundColor = sku.pbr.baseHex;
      const image = sku.pbr.swatchUrl ?? sku.pbr.textureUrl;
      if (image) {
        const thumbnail = doc.createElement('img');
        thumbnail.alt = ''; thumbnail.loading = 'lazy'; thumbnail.decoding = 'async';
        thumbnail.src = image; swatch.append(thumbnail); bindLoadingImage(thumbnail, swatch);
      }
      const name = doc.createElement('span'); name.textContent = sku.name; name.setAttribute('translate', 'no');
      const badge = doc.createElement('small'); badge.textContent = `${sku.manufacturer} · ${sku.code} ${sku.surfaceStructure}`;
      button.append(swatch, name, badge); button.onclick = () => select(zone, sku.id); grid.appendChild(button);
    }
    empty.hidden = grid.childElementCount > 0;
    for (const pill of pills.querySelectorAll<HTMLElement>('button')) pill.setAttribute('aria-pressed', String(pill.dataset.materialFilter === filter));
  };
  for (const option of materialFilters) {
    if (!browseMaterials(zone, '', option.id).length) continue;
    const pill = doc.createElement('button'); pill.type = 'button'; pill.textContent = option.label; pill.dataset.materialFilter = option.id;
    pill.onclick = () => { filter = option.id; render(); }; pills.appendChild(pill);
  }
  search.oninput = render;
  section.append(search, pills, grid, empty); render();
}
