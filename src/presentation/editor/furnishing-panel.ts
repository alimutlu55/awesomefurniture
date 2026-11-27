import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import { FURNISHING_FINISHES, FURNISHING_FINISH_NAMES, furnishingKind } from '../../domain/studio/furnishings/furnishing-kinds';
import type { FurnishingFinishGroup } from '../../domain/studio/furnishings/furnishing-kinds';
import { setFurnishingLook, setFurnishingType } from '../../domain/studio/furnishings/furnishing-edit';
import type { RoomSelection } from '../viewport/studio-renderer';
import { furnishingTypeArt } from './furnishing-art';
import { esc } from './editor-format.js';

interface FurnishingPanelPorts {
  document: Pick<Document, 'createElement'>;
  getStudio(): Studio | undefined;
  getSelection(): RoomSelection;
  sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/furnishing-commands').createFurnishingCommands>, 'editFurnishing'>>;
  refresh(): void;
  listen(target: EventTarget, event: string, handler: (e: Event) => void): void;
}

/** A selected furnishing's Type (a bed's size, a rug's) and Finish (fabric, wood), in the fixtures' panel style: pictures
 * for types, swatches for finishes. A choice applies at once, as one undo step; a type that would not fit is refused with
 * the reason. The panel always shows what the room is now. */
export function createFurnishingPanel({ document, getStudio, getSelection, sceneCommands, refresh, listen }: FurnishingPanelPorts) {
  const root = document.createElement('div');
  root.className = 'fixture-panel furnishing-panel';
  let view: 'fixture-type' | 'fixture-finish' = 'fixture-type';
  const selected = (): StudioFurnishing | undefined => {
    const s = getSelection();
    return s?.kind === 'furnishing' ? getStudio()?.furnishings?.find(f => f.id === s.id) : undefined;
  };
  const card = (data: string, on: boolean, art: string, name: string, note: string) =>
    `<button type="button" class="fixture-choice" ${data} aria-pressed="${on}" title="${esc(name + ' · ' + note)}">${art}<b>${esc(name)}</b><small>${esc(note)}</small></button>`;

  function typeMarkup(f: StudioFurnishing) {
    const k = furnishingKind(f.kind)!;
    return '<div class="fixture-choices" role="group" aria-label="Type">'
      + k.types.map(t => card(`data-furnishing-type="${t.id}"`, t.id === f.type, furnishingTypeArt(f.kind, t.size, t.name), t.name, t.note)).join('') + '</div>';
  }
  function finishMarkup(f: StudioFurnishing) {
    return furnishingKind(f.kind)!.finishes.map((group: FurnishingFinishGroup) => {
      const chosen = f[group] ?? FURNISHING_FINISHES[group][0]!.id;
      return `<b class="fixture-label">${FURNISHING_FINISH_NAMES[group]}</b><div class="wall-paint-swatches fixture-swatches" role="group" aria-label="${FURNISHING_FINISH_NAMES[group]}">`
        + FURNISHING_FINISHES[group].map(x => `<button type="button" data-furnishing-finish="${group}:${x.id}" aria-pressed="${x.id === chosen}" title="${esc(x.name)}">`
          + `<i style="background:${x.color}"></i><span>${esc(x.name)}</span></button>`).join('') + '</div>';
    }).join('');
  }

  function render() {
    const f = selected();
    if (!f || !furnishingKind(f.kind)) { root.innerHTML = ''; return; }
    const html = view === 'fixture-type' ? typeMarkup(f) : finishMarkup(f);
    if (root.innerHTML !== html) root.innerHTML = html;
  }
  listen(root, 'click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-furnishing-type],[data-furnishing-finish]'), f = selected();
    if (!b || !f) return;
    const { furnishingType: type, furnishingFinish: look } = b.dataset;
    if (type) sceneCommands.editFurnishing(f.id, r => setFurnishingType(r, f.id, type));
    else if (look) {
      const [group, id] = look.split(':') as [FurnishingFinishGroup, string];
      sceneCommands.editFurnishing(f.id, r => setFurnishingLook(r, f.id, { [group]: id === FURNISHING_FINISHES[group][0]!.id ? undefined : id }));
    }
    refresh();
    render();
  });
  return { root, render, show(next: 'fixture-type' | 'fixture-finish') { view = next; render(); } };
}
