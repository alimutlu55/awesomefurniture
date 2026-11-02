import { decorBadge, getDecor, type TargetZone } from '../../domain/materials/decor-catalog';
import { materialZoneFields, resolveMaterials, HANDLE_FINISHES, ACCESSORY_FINISHES } from '../../domain/materials/configured-materials';
import { designerPalettes } from '../../domain/materials/designer-palettes';
import { HANDLES, resolveHandle, type HandleKind, type HandleSize } from '../../domain/wardrobe/handles';
import { appendDecorBrowser } from './decor-browser';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import type { createDesignCommands } from '../../application/commands/design-commands';

type Commands = Pick<ReturnType<typeof createDesignCommands>, 'setDecor' | 'setLinkedDecors' | 'setHandleFinish' | 'setHandle' | 'setAccessoryFinish' | 'applyDesignerPalette'>;
const finishLabels: Record<string, string> = { matte_black: 'Matte black', brushed_brass: 'Brushed brass',
  anodized_champagne: 'Anodized champagne', handleless_tip_on: 'Handleless · push-to-open', brushed_steel: 'Brushed steel' };

export function bindDecorPicker(root: HTMLElement, commands: Commands) {
  const document = root.ownerDocument;
  root.classList.add('decor-picker');
  root.innerHTML = '<label class="decor-link"><input type="checkbox" data-decor-link> Match fronts to carcass</label>';
  const palettes = document.createElement('div'); palettes.className = 'decor-palettes';
  palettes.setAttribute('role', 'group'); palettes.setAttribute('aria-label', 'Designer palettes');
  for (const palette of designerPalettes) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.designerPalette = palette.id;
    button.textContent = palette.name; button.onclick = () => commands.applyDesignerPalette(palette.id); palettes.appendChild(button);
  }
  root.prepend(palettes);
  for (const [zone, title] of [['carcass', 'Inside / Carcass'], ['fronts', 'Exterior Fronts'], ['drawers', 'Drawer interiors'],
    ['backing', 'Back panels'], ['worktop', 'Worktop'], ['backsplash', 'Backsplash']] as const) {
    const section = document.createElement('details');
    section.dataset.decorSection = zone; section.open = zone === 'carcass';
    section.innerHTML = `<summary>${title}<small data-decor-summary="${zone}"></small></summary>`;
    appendDecorBrowser(section, zone, title, commands.setDecor);
    root.appendChild(section);
  }
  const linked = root.querySelector<HTMLInputElement>('[data-decor-link]')!;
  linked.onchange = () => commands.setLinkedDecors(linked.checked);
  // The handle: its kind and size (from the handle registry), then its finish, in the same fields as the finishes.
  const handleField = (label: string, name: string) => {
    const field = document.createElement('label'); field.className = 'decor-finish-field'; field.textContent = label;
    const select = document.createElement('select'); select.dataset.handle = name; select.setAttribute('aria-label', label);
    field.appendChild(select); root.appendChild(field);
    return select;
  };
  const kind = handleField('Handle', 'kind'), size = handleField('Handle size', 'size');
  for (const h of HANDLES) { const option = document.createElement('option'); option.value = h.key; option.textContent = h.name; kind.appendChild(option); }
  const sizeOf = (value: string): HandleSize => value === 'full' ? 'full' : Number(value);
  kind.onchange = () => commands.setHandle(kind.value as HandleKind, sizeOf(size.value));
  size.onchange = () => commands.setHandle(kind.value as HandleKind, sizeOf(size.value));
  for (const [key, label, values] of [['handle', 'Handle finish', HANDLE_FINISHES], ['accessory', 'Internal accessories', ACCESSORY_FINISHES]] as const) {
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
  const ids = Object.fromEntries(Object.entries(materialZoneFields).map(([zone, field]) => [zone, materials[field]])) as Record<TargetZone, string | undefined>;
  for (const section of root.querySelectorAll<HTMLElement>('[data-decor-section]')) {
    const zone = section.dataset.decorSection as TargetZone;
    section.dataset.selectedDecor = ids[zone] ?? '';
    section.hidden = (zone === 'worktop' || zone === 'backsplash') && design.product !== 'kitchen';
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-decor-id]')) {
    const selected = ids[button.dataset.decorZone as keyof typeof ids] === button.dataset.decorId;
    button.classList.toggle('on', selected); button.setAttribute('aria-pressed', String(selected));
  }
  for (const summary of root.querySelectorAll<HTMLElement>('[data-decor-summary]')) {
    const id = ids[summary.dataset.decorSummary as keyof typeof ids];
    summary.textContent = id ? decorBadge(getDecor(id)) : 'Match carcass';
  }
  const linked = root.querySelector<HTMLInputElement>('[data-decor-link]');
  if (linked) linked.checked = materials.linkedDecors ?? false;
  const handle = root.querySelector<HTMLSelectElement>('[data-material-finish="handle"]');
  const accessory = root.querySelector<HTMLSelectElement>('[data-material-finish="accessory"]');
  if (handle) handle.value = materials.handleFinish;
  const current = resolveHandle(materials), kind = root.querySelector<HTMLSelectElement>('[data-handle="kind"]'), size = root.querySelector<HTMLSelectElement>('[data-handle="size"]');
  if (kind) { kind.value = current.kind.key; kind.disabled = current.none; }
  if (size) {
    // Only the sizes this kind comes in; a knob has none, so the field hides.
    size.replaceChildren(...(current.kind.sizes as readonly HandleSize[]).map(s => {
      const option = root.ownerDocument.createElement('option'); option.value = String(s); option.textContent = s === 'full' ? 'Full height' : s + ' mm'; return option;
    }));
    size.value = String(current.size ?? ''); size.disabled = current.none;
    size.closest<HTMLElement>('.decor-finish-field')!.hidden = current.kind.sizes.length === 0;
  }
  if (accessory) accessory.value = materials.internalAccessoryFinish;
}
