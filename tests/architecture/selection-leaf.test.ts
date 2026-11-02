import test from 'node:test';
import assert from 'node:assert/strict';
import { chosenLeaf, createSelectionState } from '../../src/presentation/editor/selection-state.js';

// A chosen door leaf holds while its wardrobe is focused and its bay is chosen with nothing inside it.
test('a chosen leaf lets go when anything else is chosen', () => {
  const s = { ...createSelectionState(), focusOn: true, deep: true, leaf: { wardrobe: 3, bay: 1, key: '1.0.0' } };
  const state = { sel: 1, item: -1, divider: -1 };
  assert.equal(chosenLeaf(s, 3, state), '1.0.0');
  assert.equal(chosenLeaf(s, 4, state), null, 'another wardrobe');
  assert.equal(chosenLeaf(s, 3, { ...state, sel: 0 }), null, 'another bay');
  assert.equal(chosenLeaf(s, 3, { ...state, item: 2 }), null, 'a fitting');
  assert.equal(chosenLeaf(s, 3, { ...state, divider: 0 }), null, 'a board');
  assert.equal(chosenLeaf({ ...s, deep: false }, 3, state), null, 'back to the wardrobe');
  assert.equal(chosenLeaf({ ...s, focusOn: false }, 3, state), null, 'nothing chosen');
  assert.equal(createSelectionState().leaf, null, 'none to begin with');
});
