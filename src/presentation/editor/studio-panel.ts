import { ROOM_PARTS, roomPartArt, studioChoices } from './studio-art';
import { isWallUtility, OPENING_KINDS } from '../../domain/studio/wall-utilities';
import type { OpeningKind } from '../../domain/studio/studio';
import { CEILING_SHAPES } from '../../domain/studio/studio-ceiling';
import { ceilingArt } from './studio-ceiling-panel';
import { esc } from './editor-format.js';
import type { RoomSelection } from '../viewport/studio-renderer';
import { fixtureProducts } from './fixture-art';

interface StudioPanelPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene'>;
  readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'placeStudio' | 'addStudioWall' | 'addStudioOpening'>>;
  readonly getSelection: () => RoomSelection;
  readonly callbacks: {
    /** A built-in room was placed (or removed): show it whole. */
    placed(): void;
    chooseCeiling(shape: string): void;
    /** A wall or opening was added: select it for editing. */
    added(selection: RoomSelection): void;
    refresh(): void;
  };
}

/** Walls offers a wall and built-in room plans, including "No room".
 * Openings and utilities belong to the selected wall's Add menu. */
export function createStudioPanel({ dom, model, sceneCommands, getSelection, callbacks }: StudioPanelPorts) {
  let choices: ReturnType<typeof studioChoices> | null = null;
  const active = () => model.scene.studio?.template ?? 'none';
  const room = () => !!model.scene.studio;

  /** Buttons for both layouts: parts first, then rooms. `extra` adds the phone catalogue's attributes. */
  function buttons(extra: (category: string) => string, art: (c: ReturnType<typeof studioChoices>[number]) => string, includeWallItems = false) {
    choices ??= studioChoices('product-art studio-plan-art');
    const current = active();
    const parts = ROOM_PARTS.filter(p => includeWallItems || p.kind === 'wall').map(p => {
      const needsRoom = p.kind !== 'wall' && !room();
      const off = needsRoom ? ' no' : '', disabled = needsRoom ? ' aria-disabled="true"' : '', title = esc(needsRoom ? 'Add a room first' : p.description);
      const cat = isWallUtility(p.kind) ? 'utilities' : p.kind === 'wall' ? 'room' : 'openings';
      return `<button type="button" class="room-product${off}" data-add-room="${p.kind}"${disabled}${extra(cat)} title="${title}">${roomPartArt(p.kind)}<span>${esc(p.name)}</span></button>`;
    });
    // Without a room, "No room" is what you have: it goes last, after the rooms to choose from.
    const rooms = (room() ? choices : [...choices.filter(c => c.id !== 'none'), ...choices.filter(c => c.id === 'none')]).map(c => {
      const on = c.id === current;
      const name = esc(c.id === 'none' ? c.name : c.name + ' room'), title = esc(c.name + ' · ' + c.description);
      return `<button type="button" class="room-product room-choice${on ? ' on' : ''}" data-studio="${c.id}" aria-pressed="${on}"${extra('room')} title="${title}">${art(c)}<span>${name}</span></button>`;
    });
    // Without a room, show room plans before individual parts.
    return room() ? parts.join('') + rooms.join('') : rooms.join('') + parts.join('');
  }

  function render() {
    dom.$('#padd-room').innerHTML = buttons(() => '', c => c.art);
    const chosen = choices!.find(c => c.id === active());
    dom.$('#studio-caption').textContent = active() === 'custom' ? 'Your own room · select a wall to change it'
      : chosen && chosen.id !== 'none' ? chosen.name + ': ' + chosen.description : 'Add a room, or walls one by one, around your wardrobes.';
  }
  /** The shared catalogue filters walls, wall attachments and ceiling shapes into their own pickers. */
  const products = () => {
    return buttons(cat => ` data-product-category="${cat}" hidden`, c => c.art, true)
      + fixtureProducts() + CEILING_SHAPES.map(c => `<button type="button" class="room-product" data-product-category="ceilings" data-add-ceiling="${c.id}" hidden title="${esc(c.description)}">`
        + `${ceilingArt(c)}<span>${esc(c.name)}</span></button>`).join('');
  };

  function bind(listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void) {
    listen(dom.$('#pop2'), 'click', e => {
      const button = (e.target as Element).closest<HTMLElement>('[data-studio],[data-add-room],[data-add-ceiling]');
      if (!button) return;
      if (button.dataset.addCeiling) { callbacks.chooseCeiling(button.dataset.addCeiling); return; }
      const studio = button.dataset.studio, part = button.dataset.addRoom;
      if (studio) {
        if (studio !== active() && sceneCommands.placeStudio(studio as never)) callbacks.placed();
        else callbacks.refresh();
        return;
      }
      const sel = getSelection();
      const wall = sel?.kind === 'wall' ? sel.id : sel?.kind === 'opening' ? model.scene.studio?.openings.find(o => o.id === sel.id)?.wall : undefined;
      if (part === 'wall') {
        const id = sceneCommands.addStudioWall(wall);
        if (id) callbacks.added({ kind: 'wall', id });
        else callbacks.refresh();
      } else if (part && (OPENING_KINDS as readonly string[]).includes(part)) {
        const id = sceneCommands.addStudioOpening(part as OpeningKind, wall);
        if (id) callbacks.added({ kind: 'opening', id });
        else callbacks.refresh();
      }
    });
  }

  return { render, products, bind };
}
