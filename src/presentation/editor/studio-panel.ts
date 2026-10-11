import { studioChoices } from './studio-art';
import { esc } from './editor-format.js';

interface StudioPanelPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene'>;
  readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'placeStudio'>>;
  readonly callbacks: { refresh(): void; frameRoom(): void; renderEditor(): void };
}

/** The Room section: a chip per built-in studio, drawn from its own plan, and "No room". Choosing one
 * places it around the wardrobes (one undo step) and frames it. */
export function createStudioPanel({ dom, model, sceneCommands, callbacks }: StudioPanelPorts) {
  let choices: ReturnType<typeof studioChoices> | null = null;
  const active = () => model.scene.studio?.template ?? 'none';

  function render() {
    callbacks.renderEditor();
    choices ??= studioChoices();
    const current = active(), chosen = choices.find(c => c.id === current);
    const chip = (c: ReturnType<typeof studioChoices>[number]) => {
      const on = c.id === current, title = esc(c.name + ' · ' + c.description);
      return `<button type="button" class="shape-chip${on ? ' on' : ''}" data-studio="${c.id}" aria-pressed="${on}" title="${title}">${c.art}<span>${esc(c.name)}</span></button>`;
    };
    dom.$('#studio-templates').innerHTML = choices.map(chip).join('');
    dom.$('#studio-caption').textContent = current === 'custom' ? 'Your own room · drag walls and corners to change it' : chosen ? chosen.name + ': ' + chosen.description : '';
  }

  function bind(listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void) {
    listen(dom.$('#studio-templates'), 'click', e => {
      const chip = (e.target as Element).closest<HTMLElement>('[data-studio]');
      if (!chip || chip.dataset.studio === active()) return;
      if (sceneCommands.placeStudio(chip.dataset.studio as never)) callbacks.frameRoom();
      callbacks.refresh();
    });
  }

  return { render, bind };
}
