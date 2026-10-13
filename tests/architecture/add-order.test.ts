import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { categoriesForSpace, createAddSuggestions, orderForSpace } from '../../src/presentation/editor/add-suggestions.js';

/** The phone Add item sheet follows the selected space: products and category pills in the order that suits it. */

function sheetFor(cuts: number[]) {
  const built = buildFromSpec(parseDesignSpec({ specVersion: 1, wardrobes: [{ width: 100, height: 230 }] }), 'p');
  assert.ok(built.ok);
  const state: any = projectToScene(built.project)!.wardrobes[0]!.state;
  state.dividers = cuts.map(y => ({ i: 0, orientation: 'horizontal', y }));
  const geometry: any = createWardrobeGeometry(() => state), add = createAddSuggestions(() => state, geometry);
  return geometry.sectionSpaces(0).map((q: any) => {
    state.sel = 0; state.space = { i: 0, x: (q.x0 + q.x1) / 2, y: (q.y0 + q.y1) / 2 };
    const ordered = orderForSpace(add.addSuggestions().list);
    return { bottom: q.y0, pills: categoriesForSpace(ordered, ['storage', 'hanging', 'drawers', 'shelves']), first: ordered.filter(x => x.fit).map(x => x.k) };
  }).sort((a: any, c: any) => a.bottom - c.bottom);
}

test('floor, within reach and above reach each lead with what suits them', () => {
  const [floor, reach, high] = sheetFor([60, 185]);
  assert.equal(floor.first[0], 'shoe', 'shoes at floor level');
  assert.equal(floor.pills.at(-1), 'hanging', 'nothing hangs in a low space');
  assert.equal(reach.pills[0], 'hanging', 'within reach, hanging first');
  assert.notEqual(reach.pills[0], 'storage');
  assert.equal(reach.first[0], 'short');
  assert.equal(high.first[0], 'seasonal', 'above reach, boxes first');
  assert.equal(high.pills.at(-1), 'hanging');
});

test('a full-height space leads with hanging, storage never first', () => {
  const [full] = sheetFor([]);
  assert.equal(full.pills[0], 'hanging');
  assert.deepEqual(full.first.slice(0, 2), ['short', 'long']);
});
