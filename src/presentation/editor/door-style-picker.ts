import { FRONT_OVERLAYS, FRONT_REVEALS_MM, FRONT_STYLES, frontStyle, resolveFronts, type FrontOverlay, type FrontRevealMm, type FrontStyle } from '../../domain/wardrobe/front-styles';
import { resolveMaterials } from '../../domain/materials/configured-materials';
import { getDecor } from '../../domain/materials/decor-catalog';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import type { createDesignCommands } from '../../application/commands/design-commands';

type Commands = Pick<ReturnType<typeof createDesignCommands>, 'setFrontStyle' | 'setFrontOverlay' | 'setFrontReveal'>;

/** Each style drawn as its door seen from the front, in the Doors cards' own size and ink. */
const ART: Record<FrontStyle, string> = {
  slab: '<path d="M11 3h24v38H11z"/><path d="M30 19v6"/>',
  shaker: '<path d="M11 3h24v38H11z"/><path d="M15.5 7.5h15v29h-15z"/><path d="M30 19v6" stroke-width="1.4"/>',
  profiled: '<path d="M11 3h24v38H11z"/><rect x="13.5" y="5.5" width="19" height="33" rx="2.5"/><rect x="15.5" y="7.5" width="15" height="29" rx="1.5"/>',
  rail: '<path d="M11 3h24v38H11z"/><path d="M11 7.5h24" stroke-width="2.2"/>',
};

/**
 * The cabinet's door style in the Fronts panel: a card for each style (FRONT_STYLES, drawn), then the gap round each
 * door and how the doors sit on the carcass (the overlays the style can hang), as the panel's own segmented controls.
 * Each choice is one undo step. A style made only in some decors says so when the fronts' decor is not one of them.
 */
export function appendDoorStyle(root: HTMLElement, commands: Commands) {
  const document = root.ownerDocument, section = document.createElement('div');
  section.className = 'door-style'; section.dataset.doorStyle = '';
  const seg = (label: string, name: string, values: readonly { value: string; text: string; title?: string }[]) =>
    `<div class="door-hang" role="group" aria-label="${label}"><span>${label}</span><div class="door-hang-seg">`
    + values.map(v => `<button type="button" data-${name}="${v.value}"${v.title ? ` title="${v.title}"` : ''}>${v.text}</button>`).join('') + '</div></div>';
  section.innerHTML = '<div class="door-hang"><span>Door style</span></div>'
    + `<div class="door-grid door-styles" role="group" aria-label="Door style">${FRONT_STYLES.map(s => `<button type="button" data-front-style="${s.key}">`
      + `<span class="door-art"><svg viewBox="0 0 46 44" fill="none" stroke="#77736c" stroke-width="1">${ART[s.key]}</svg></span><span>${s.name}</span></button>`).join('')}</div>`
    + '<p class="door-style-note" hidden></p>'
    + seg('Gap', 'front-reveal', FRONT_REVEALS_MM.map(mm => ({ value: String(mm), text: mm + ' mm', title: 'The gap round each door' })))
    + seg('Overlay', 'front-overlay', FRONT_OVERLAYS.map(o => ({ value: o.key, text: o.key === 'full' ? 'Full' : o.key === 'half' ? 'Half' : 'Inset', title: o.name })));
  for (const b of section.querySelectorAll<HTMLButtonElement>('[data-front-style]')) b.onclick = () => commands.setFrontStyle(b.dataset.frontStyle as FrontStyle);
  for (const b of section.querySelectorAll<HTMLButtonElement>('[data-front-reveal]')) b.onclick = () => commands.setFrontReveal(Number(b.dataset.frontReveal) as FrontRevealMm);
  for (const b of section.querySelectorAll<HTMLButtonElement>('[data-front-overlay]')) b.onclick = () => commands.setFrontOverlay(b.dataset.frontOverlay as FrontOverlay);
  root.appendChild(section);
}

/** Shows the cabinet's style, gap and overlay as chosen; hidden when it has no hinged doors. */
export function syncDoorStyle(root: HTMLElement, design: EditorDesign) {
  const section = root.querySelector<HTMLElement>('[data-door-style]');
  if (!section) return;
  section.hidden = design.doors === 'none' || design.product === 'kitchen';
  const fronts = resolveFronts(design), style = frontStyle(fronts.style)!;
  const mark = (b: HTMLElement, on: boolean) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); };
  for (const b of section.querySelectorAll<HTMLElement>('[data-front-style]')) mark(b, b.dataset.frontStyle === fronts.style);
  for (const b of section.querySelectorAll<HTMLElement>('[data-front-reveal]')) mark(b, Number(b.dataset.frontReveal) === fronts.reveal);
  for (const b of section.querySelectorAll<HTMLButtonElement>('[data-front-overlay]')) {
    mark(b, b.dataset.frontOverlay === fronts.overlay);
    b.hidden = !(style.overlays as readonly string[]).includes(b.dataset.frontOverlay!);
  }
  // A frame and panel, or a routed edge, is machined: only in the decors the style is made in.
  const decor = getDecor(resolveMaterials(design).frontDecorId), note = section.querySelector<HTMLElement>('.door-style-note')!;
  note.hidden = (style.decors as readonly string[]).includes(decor.category);
  note.textContent = note.hidden ? '' : 'This style is not made in the chosen front decor. Choose another under Exterior Fronts; until then these doors are shown as slabs.';
}
