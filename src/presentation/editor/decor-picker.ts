import { decorBadge, decorCatalog, getDecor, type TargetZone } from '../../domain/materials/decor-catalog';
import { resolveMaterials, HANDLE_FINISHES, ACCESSORY_FINISHES } from '../../domain/materials/configured-materials';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import type { createDesignCommands } from '../../application/commands/design-commands';

type Commands = Pick<ReturnType<typeof createDesignCommands>, 'setDecor' | 'setLinkedDecors' | 'setHandleFinish' | 'setAccessoryFinish'>;
const groups = [{ category: 'woodgrain', label: 'Woodgrains · Oak & Walnut' },
  { category: 'unicolor', label: 'Unicolor Mattes' }, { category: 'stone_textile', label: 'Stone & Textile' }];
const finishLabels: Record<string, string> = { matte_black: 'Matte black', brushed_brass: 'Brushed brass',
  anodized_champagne: 'Anodized champagne', handleless_tip_on: 'Handleless · push-to-open', brushed_steel: 'Brushed steel' };

export function bindDecorPicker(root: HTMLElement, commands: Commands) {
  const document = root.ownerDocument;
  root.classList.add('decor-picker');
  root.innerHTML = '<label class="decor-link"><input type="checkbox" data-decor-link> Match fronts to carcass</label>';
  for (const [zone, title] of [['carcass', 'Carcass'], ['fronts', 'Fronts'], ['worktop', 'Worktop']] as const) {
    const section = document.createElement('details');
    section.dataset.decorSection = zone;
    section.open = zone === 'carcass';
    section.innerHTML = `<summary>${title}<small data-decor-summary="${zone}"></small></summary>`;
    for (const group of groups) {
      const options = decorCatalog.filter(sku => sku.category === group.category && sku.allowedZones.includes(zone));
      if (!options.length) continue;
      const heading = document.createElement('p');
      heading.className = 'decor-group-label'; heading.textContent = group.label; section.appendChild(heading);
      const grid = document.createElement('div'); grid.className = 'decor-grid';
      for (const sku of options) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'decor-option'; button.dataset.decorZone = zone; button.dataset.decorId = sku.id;
        button.title = `${decorBadge(sku)} · ${sku.edgeBandingSpec} · Grain: ${sku.grainDirection}`;
        button.setAttribute('aria-label', `${title}: ${sku.name}, ${button.title}`);
        const swatch = document.createElement('span'); swatch.className = 'decor-swatch';
        swatch.style.backgroundColor = sku.pbr.baseHex;
        if (sku.pbr.textureUrl) swatch.style.backgroundImage = `url("${sku.pbr.textureUrl}")`;
        const name = document.createElement('span'); name.textContent = sku.name;
        const badge = document.createElement('small'); badge.textContent = decorBadge(sku);
        const edge = document.createElement('small'); edge.textContent = sku.edgeBandingSpec;
        button.append(swatch, name, badge, edge);
        button.onclick = () => commands.setDecor(zone, sku.id);
        grid.appendChild(button);
      }
      section.appendChild(grid);
    }
    root.appendChild(section);
  }
  const linked = root.querySelector<HTMLInputElement>('[data-decor-link]')!;
  linked.onchange = () => commands.setLinkedDecors(linked.checked);
  for (const [key, label, values] of [['handle', 'Handles / pulls', HANDLE_FINISHES], ['accessory', 'Internal accessories', ACCESSORY_FINISHES]] as const) {
    const field = document.createElement('label'); field.className = 'decor-finish-field'; field.textContent = label;
    const select = document.createElement('select'); select.dataset.materialFinish = key; select.setAttribute('aria-label', label);
    for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = finishLabels[value]!; select.appendChild(option); }
    select.onchange = () => key === 'handle' ? commands.setHandleFinish(select.value as typeof HANDLE_FINISHES[number])
      : commands.setAccessoryFinish(select.value as typeof ACCESSORY_FINISHES[number]);
    field.appendChild(select); root.appendChild(field);
  }
}

export function syncDecorPicker(root: HTMLElement, design: EditorDesign) {
  const materials = resolveMaterials(design);
  const ids: Record<Exclude<TargetZone, 'backing'>, string | undefined> = {
    carcass: materials.carcassDecorId, fronts: materials.frontDecorId, worktop: materials.worktopDecorId,
  };
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-decor-id]')) {
    const selected = ids[button.dataset.decorZone as keyof typeof ids] === button.dataset.decorId;
    button.classList.toggle('on', selected); button.setAttribute('aria-pressed', String(selected));
  }
  for (const summary of root.querySelectorAll<HTMLElement>('[data-decor-summary]')) {
    const id = ids[summary.dataset.decorSummary as keyof typeof ids];
    summary.textContent = id ? decorBadge(getDecor(id)) : 'Select a board SKU';
  }
  const linked = root.querySelector<HTMLInputElement>('[data-decor-link]');
  if (linked) linked.checked = materials.linkedDecors ?? false;
  const handle = root.querySelector<HTMLSelectElement>('[data-material-finish="handle"]');
  const accessory = root.querySelector<HTMLSelectElement>('[data-material-finish="accessory"]');
  if (handle) handle.value = materials.handleFinish;
  if (accessory) accessory.value = materials.internalAccessoryFinish;
  const worktop = root.querySelector<HTMLElement>('[data-decor-section="worktop"]');
  if (worktop) worktop.hidden = design.product !== 'kitchen';
}
