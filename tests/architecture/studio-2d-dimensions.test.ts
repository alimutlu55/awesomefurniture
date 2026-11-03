import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { createEditorState } from '../../src/application/projects/editor-state';
import { FIXTURES } from '../../src/domain/studio/fixtures/fixture-kinds';
import { fixtureObstacles } from '../../src/domain/studio/fixtures/fixture-place';
import { cabinetBox, fixtureBoxes, selectedDimensions } from '../../src/presentation/editor/studio-2d-dimensions';
import { gapsAround } from '../../src/domain/studio/scene-gaps';
import { renderFixtures } from '../../src/presentation/editor/studio-2d-fixtures';
import { layoutPlanLabels, renderPlanLabels } from '../../src/presentation/editor/studio-2d-labels';

const cabinet = { id: 1, name: 'Wardrobe', x: 0, y: 0, z: 180, angle: 0, state: createEditorState() };
const transform = { width: 1440, height: 900, zoom: 1.5, panX: 0, panZ: 175 };
test('selected opening shows its two end gaps and its width and height, on dimension lines', () => {
  const studio = createStudio('bedroom'), selection = { kind: 'opening' as const, id: 'o1' };
  const dimensions = selectedDimensions(studio, [], selection, null);
  assert.equal(dimensions.length, 3);
  assert.equal(dimensions.filter(d => d.accent).length, 1);
  assert.ok(dimensions.find(d => d.accent)!.text.includes('×'));
  const markup = renderPlanLabels(layoutPlanLabels({ studio, wardrobes: [], selection, transform }));
  assert.ok(markup.includes('chain-w2-')); assert.ok(markup.includes('sp2d-dimension-line'));
  assert.ok(!markup.includes('sp2d-dimension-leader'));
});
test('wardrobe and fixture clearances use exactly the shared measuring rule', () => {
  const base = createStudio('bedroom');
  const kind = FIXTURES[0]!;
  const studio = { ...base, fixtures: [{ id: 'f1', wall: 'w1', kind: kind.key, type: kind.types[0]!.id,
    offset: 100, width: 40, depth: 60, height: 40 }] };
  const fixtures = fixtureBoxes(studio), box = cabinetBox(cabinet), others = [box, ...fixtures];
  assert.equal(fixtures.length, fixtureObstacles(studio).length);
  for (const [selection, active, subject] of [[null, 1, box], [{ kind: 'fixture' as const, id: 'f1' }, null, fixtures[0]!]] as const) {
    const actual = selectedDimensions(studio, [cabinet], selection, active);
    const expected = gapsAround(subject, others, studio, ['left', 'right', 'back', 'front']).filter(g => g.distance >= .1);
    assert.equal(actual.length, expected.length);
    assert.ok(actual.length >= 3);
    assert.deepEqual(actual.map(d => d.a), expected.map(g => g.from));
    const markup = renderPlanLabels(layoutPlanLabels({ studio, wardrobes: [cabinet], selection, activeCabinet: active, transform }));
    assert.ok(markup.includes('clearance-'));
  }
  assert.ok(renderFixtures(studio, { kind: 'fixture', id: 'f1' }).includes('data-fixture-id="f1"'));
});
