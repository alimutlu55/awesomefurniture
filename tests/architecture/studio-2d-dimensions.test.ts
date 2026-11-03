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
    assert.equal(actual.filter(d => d.id.startsWith('clearance-')).length, expected.length);
    assert.ok(actual.length >= 3);
    assert.deepEqual(actual.filter(d => d.id.startsWith('clearance-')).map(d => d.a), expected.map(g => g.from));
    const markup = renderPlanLabels(layoutPlanLabels({ studio, wardrobes: [cabinet], selection, activeCabinet: active, transform }));
    assert.ok(markup.includes('clearance-'));
  }
  assert.ok(renderFixtures(studio, { kind: 'fixture', id: 'f1' }).includes('data-fixture-id="f1"'));
});

test('selecting either a door or window measures the shared edge-to-edge clearance, not through the neighbour', () => {
  const base = createStudio('bedroom');
  const studio = { ...base, openings: [
    { ...base.openings[1]!, id: 'window', wall: 'w2', offset: 100, width: 120 },
    { ...base.openings[0]!, id: 'door', wall: 'w2', offset: 246, width: 80 },
  ] };
  for (const id of ['window', 'door']) {
    const selection = { kind: 'opening' as const, id };
    const dimensions = selectedDimensions(studio, [], selection, null);
    const gap = dimensions.find(d => Math.abs(Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) - 46) < .01);
    assert.ok(gap, `${id} includes the 46 cm gap between window and door`);
    assert.equal(gap.a.z, 154); assert.equal(gap.b.z, 200);
    assert.equal(dimensions.length, 3, 'nearest neighbour, own size, and outer wall end');
    assert.ok(dimensions.find(d => d.accent)!.text.includes('×'));
    const labels = layoutPlanLabels({ studio, wardrobes: [], selection, transform });
    assert.ok(labels.some(l => l.id === gap.id && l.text === gap.text), 'shared gap is actually visible');
    assert.ok(!dimensions.some(d => Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) > 100 && !d.accent),
      'neither clearance measures through the other item');
  }
  const chain = selectedDimensions(studio, [], { kind: 'wall', id: 'w2' }, null);
  assert.equal(chain.length, 5, 'a wall selection still shows the complete chain');
});

test('opening neighbour clearances are independent of registry order and follow a reversed wall', () => {
  const base = createStudio('bedroom');
  const studio = { ...base, openings: [
    { ...base.openings[0]!, id: 'door', wall: 'w4', offset: 246, width: 80 },
    { ...base.openings[1]!, id: 'window', wall: 'w4', offset: 100, width: 120 },
  ] };
  for (const id of ['door', 'window']) {
    const dims = selectedDimensions(studio, [], { kind: 'opening', id }, null);
    assert.ok(dims.some(d => Math.abs(Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) - 46) < .01));
    assert.equal(dims.filter(d => d.accent).length, 1);
  }
});
