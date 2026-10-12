import { ROOM_PARTS, roomPartArt, studioChoices } from './studio-art';
import { esc } from './editor-format.js';
import type { RoomSelection } from '../viewport/studio-renderer';

interface StudioPanelPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene'>;
  readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'placeStudio' | 'addStudioWall' | 'addStudioOpening'>>;
  readonly getSelection: () => RoomSelection;
  readonly callbacks: {
    /** A built-in room was placed (or removed): show it whole. */
    placed(): void;
    /** A wall or opening was added: select it for editing. */
    added(selection: RoomSelection): void;
    refresh(): void;
  };
}

/** The Walls category of Add item: walls, doors, windows and archways to add to the room, and the
 * built-in rooms (drawn from their own plans), with "No room". On a desktop it is a fold in the Add
 * item panel; on a phone a category of the catalogue. */
export function createStudioPanel({ dom, model, sceneCommands, getSelection, callbacks }: StudioPanelPorts) {
  let choices: ReturnType<typeof studioChoices> | null = null;
  const active = () => model.scene.studio?.template ?? 'none';
  const room = () => !!model.scene.studio;

  /** Buttons for both layouts: parts first, then rooms. `extra` adds the phone catalogue's attributes. */
  function buttons(extra: string, art: (c: ReturnType<typeof studioChoices>[number]) => string) {
    choices ??= studioChoices('product-art studio-plan-art');
    const current = active();
    const parts = ROOM_PARTS.map(p => {
      const needsRoom = p.kind !== 'wall' && !room();
      const off = needsRoom ? ' no' : '', disabled = needsRoom ? ' aria-disabled="true"' : '', title = esc(needsRoom ? 'Add a room first' : p.description);
      return `<button type="button" class="room-product${off}" data-add-room="${p.kind}"${disabled}${extra} title="${title}">${roomPartArt(p.kind)}<span>${esc(p.name)}</span></button>`;
    });
    // Without a room, "No room" is what you have: it goes last, after the rooms to choose from.
    const rooms = (room() ? choices : [...choices.filter(c => c.id !== 'none'), ...choices.filter(c => c.id === 'none')]).map(c => {
      const on = c.id === current;
      const name = esc(c.id === 'none' ? c.name : c.name + ' room'), title = esc(c.name + ' · ' + c.description);
      return `<button type="button" class="room-product room-choice${on ? ' on' : ''}" data-studio="${c.id}" aria-pressed="${on}"${extra} title="${title}">${art(c)}<span>${name}</span></button>`;
    });
    // Without a room, a room comes first: doors, windows and archways need one.
    return room() ? parts.join('') + rooms.join('') : rooms.join('') + parts.join('');
  }

  function render() {
    dom.$('#padd-room').innerHTML = buttons('', c => c.art);
    const chosen = choices!.find(c => c.id === active());
    dom.$('#studio-caption').textContent = active() === 'custom' ? 'Your own room · select a wall to change it'
      : chosen && chosen.id !== 'none' ? chosen.name + ': ' + chosen.description : 'Add a room, or walls one by one, around your wardrobes.';
  }
  /** The phone catalogue's Walls category. */
  const products = () => buttons(' data-product-category="room" hidden', c => c.art);

  function bind(listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void) {
    listen(dom.$('#pop2'), 'click', e => {
      const button = (e.target as Element).closest<HTMLElement>('[data-studio],[data-add-room]');
      if (!button) return;
      const studio = button.dataset.studio, part = button.dataset.addRoom;
      if (studio) {
        if (studio !== active() && sceneCommands.placeStudio(studio as never)) callbacks.placed();
        else callbacks.refresh();
        return;
      }
      const wall = getSelection()?.kind === 'wall' ? getSelection()!.id : undefined;
      if (part === 'wall') {
        const id = sceneCommands.addStudioWall(wall);
        if (id) callbacks.added({ kind: 'wall', id });
        else callbacks.refresh();
      } else if (part === 'door' || part === 'window' || part === 'archway') {
        const id = sceneCommands.addStudioOpening(part, wall);
        if (id) callbacks.added({ kind: 'opening', id });
        else callbacks.refresh();
      }
    });
  }

  return { render, products, bind };
}
