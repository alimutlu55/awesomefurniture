import type { Studio, StudioFixture } from '../../domain/studio/studio';
import { FINISHES, FINISH_NAMES, TAPS, fixtureKind, fixtureType } from '../../domain/studio/fixtures/fixture-kinds';
import type { FinishGroup } from '../../domain/studio/fixtures/fixture-kinds';
import { currentSetup } from '../../domain/studio/fixtures/fixture-setup';
import { setFixtureLook, setFixtureType } from '../../domain/studio/fixtures/fixture-edit';
import type { RoomSelection } from '../viewport/studio-renderer';
import { basinArt, setupArt } from './fixture-art';
import { esc } from './editor-format.js';

interface FixturePanelPorts {
  document: Pick<Document, 'createElement'>;
  getStudio(): Studio | undefined;
  getSelection(): RoomSelection;
  sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/fixture-commands').createFixtureCommands>, 'editFixture' | 'setFixtureSetup'>>;
  refresh(): void;
  listen(target: EventTarget, event: string, handler: (e: Event) => void): void;
}
export type FixturePanelView = 'fixture-type' | 'fixture-finish';

/** A selected fixture's Type (how it is fitted: a toilet's setups with their boxing, a basin's type and its tap) and
 * Finish (ceramic, metal, cabinet fronts). Choices are pictures, as the wall paint is; a choice applies at once, as one
 * undo step, and the panel always shows what the room is now. */
export function createFixturePanel({ document, getStudio, getSelection, sceneCommands, refresh, listen }: FixturePanelPorts) {
  const root = document.createElement('div');
  root.className = 'fixture-panel';
  let view: FixturePanelView = 'fixture-type';
  const selected = (): StudioFixture | undefined => {
    const s = getSelection();
    return s?.kind === 'fixture' ? getStudio()?.fixtures?.find(f => f.id === s.id) : undefined;
  };
  const card = (data: string, on: boolean, art: string, name: string, note: string) =>
    `<button type="button" class="fixture-choice" ${data} aria-pressed="${on}" title="${esc(name + ' · ' + note)}">${art}<b>${esc(name)}</b><small>${esc(note)}</small></button>`;

  function typeMarkup(studio: Studio, f: StudioFixture) {
    const k = fixtureKind(f.kind)!;
    if (k.setups) {
      const now = currentSetup(studio, f)?.id;
      return '<p class="fixture-lead">How is it fitted?</p><div class="fixture-choices" role="group" aria-label="How it is fitted">'
        + k.setups.map(s => card(`data-fixture-setup="${s.id}"`, s.id === now, setupArt(s.type, s.boxing, s.name + ', ' + s.note), s.name, s.note)).join('') + '</div>'
        + '<p class="fixture-note">A boxing is part of the room: select it to size, shape or paint it.</p>';
    }
    const tap = f.tap ?? 'deck';
    return '<div class="fixture-choices" role="group" aria-label="Type">'
      + k.types.map(t => card(`data-fixture-type="${t.id}"`, t.id === f.type, basinArt(t.id, tap, t.name), t.name, t.note)).join('') + '</div>'
      + (k.tap ? '<b class="fixture-label">Tap</b><div class="fixture-choices two" role="group" aria-label="Tap">'
        + TAPS.map(t => card(`data-fixture-tap="${t.id}"`, t.id === tap, basinArt(f.type, t.id, t.name), t.name, t.note)).join('') + '</div>' : '');
  }
  function finishMarkup(f: StudioFixture) {
    const k = fixtureKind(f.kind)!, cabinet = !!fixtureType(f.kind, f.type)?.cabinet;
    return k.finishes.filter(g => g !== 'front' || cabinet).map(group => {
      const chosen = f[group] ?? FINISHES[group][0]!.id;
      return `<b class="fixture-label">${FINISH_NAMES[group]}</b><div class="wall-paint-swatches fixture-swatches" role="group" aria-label="${FINISH_NAMES[group]}">`
        + FINISHES[group].map(x => `<button type="button" data-fixture-finish="${group}:${x.id}" aria-pressed="${x.id === chosen}" title="${esc(x.name)}">`
          + `<i class="finish-${group}" style="background:${x.color}"></i><span>${esc(x.name)}</span></button>`).join('') + '</div>';
    }).join('');
  }

  function render() {
    const studio = getStudio(), f = selected();
    if (!studio || !f || !fixtureKind(f.kind)) { root.innerHTML = ''; return; }
    const html = view === 'fixture-type' ? typeMarkup(studio, f) : finishMarkup(f);
    if (root.innerHTML !== html) root.innerHTML = html;
  }
  listen(root, 'click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-fixture-setup],[data-fixture-type],[data-fixture-tap],[data-fixture-finish]'), f = selected();
    if (!b || !f) return;
    const { fixtureSetup: setup, fixtureType: type, fixtureTap: tap, fixtureFinish: look } = b.dataset;
    if (setup) sceneCommands.setFixtureSetup(f.id, setup);
    else if (type) sceneCommands.editFixture(f.id, r => setFixtureType(r, f.id, type));
    else if (tap) sceneCommands.editFixture(f.id, r => setFixtureLook(r, f.id, { tap: tap === 'wall' ? 'wall' : undefined }));
    else if (look) {
      const [group, id] = look.split(':') as [FinishGroup, string];
      sceneCommands.editFixture(f.id, r => setFixtureLook(r, f.id, { [group]: id === FINISHES[group][0]!.id ? undefined : id }));
    }
    refresh();
    render();
  });
  return { root, render, show(next: FixturePanelView) { view = next; render(); }, view: () => view };
}
