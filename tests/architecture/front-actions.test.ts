import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openAction } from '../../src/presentation/editor/front-actions';
import { createEditorState } from '../../src/application/projects/editor-state';

// Open doors (P1-12): shows the chosen piece open, doors and drawers, and closes it again. Not saved beyond the doors'
// own open state, not an undo step.
test('Open doors shows the piece open, drawers included, and closes it again', () => {
  const state = { ...createEditorState(), doors: 'hinged' as const, open: false };
  const model = { scene: { wardrobes: [{ id: 1, state }], activeWardrobe: 1 }, activeCabinet: () => ({ state }) } as never;
  const renderState: { showOpen: object | null } = { showOpen: null };
  assert.equal(openAction('fronts', { model, renderState }), false, 'only its own key');
  assert.ok(openAction('open-doors', { model, renderState }));
  assert.equal(state.open, true); assert.equal(renderState.showOpen, state, 'drawers out with the doors');
  assert.ok(openAction('open-doors', { model, renderState }));
  assert.equal(state.open, false); assert.equal(renderState.showOpen, null);
  // Doors opened from the Doors panel (to work inside) are shown fully open by Open doors, not closed by it.
  state.open = true;
  openAction('open-doors', { model, renderState });
  assert.equal(state.open, true); assert.equal(renderState.showOpen, state);
});
