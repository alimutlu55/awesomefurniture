import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cabinetDoorAreas } from '../../src/domain/wardrobe/door-layout';
import { PANEL, PLINTH } from '../../src/domain/wardrobe/catalog.js';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import type { EditorState } from '../../src/application/projects/editor-scene';

/** Door leaves: where their edges fall on the carcass, for every overlay and reveal. Centimetres. */

const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} ≠ ${b}`);
function doors(change: Partial<EditorState> = {}) {
  const state = createEditorState();
  Object.assign(state, { doors: 'hinged', dividers: [] }, change);
  return { state, areas: cabinetDoorAreas(state, createWardrobeGeometry(() => state).widths()) };
}

test('full overlay: leaves cover both outer sides and meet on the partitions\' centre lines', () => {
  const { state, areas } = doors({ w: 200, n: 2, wt: [1, 1, 1, 1, 1, 1] });
  const [a, b] = areas, bay = (200 - 3 * PANEL) / 2;
  close(a!.x0, .1, 'left edge half a reveal inside the left face');
  close(b!.x1, state.w - .1, 'right edge half a reveal inside the right face');
  close(a!.x1, PANEL + bay + PANEL / 2 - .1, 'left leaf stops half a reveal short of the partition\'s centre');
  close(b!.x0, PANEL + bay + PANEL / 2 + .1, 'right leaf starts half a reveal past it');
  close(a!.x1 - a!.x0, b!.x1 - b!.x0, 'equal bays get equal leaves');
  close(a!.y0, PLINTH + .2, 'one reveal above the plinth');
});
