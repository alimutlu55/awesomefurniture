import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelRevision, validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import type { DrawingPiece } from '../../src/domain/drawings/room-pieces';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { drawingFixture, drawingInput } from '../../scripts/professional-drawing-fixtures.mjs';

/** Manufacturing validation: checked independently of the drawings, and failing closed. */

const room = () => ({ template: 'custom' as const, corners: [{ id: 'c1', x: 0, z: 0 }, { id: 'c2', x: 400, z: 0 }],
  walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 10, height: 260 }], openings: [] });
const wardrobe = (id: number, x: number, design = createInitialDesign()): DrawingPiece => ({ id, name: 'Wardrobe ' + id, x, y: 0, z: 5 + design.d / 2, angle: 0, design });
const critical = (v: ReturnType<typeof validateForManufacture>) => v.findings.filter(f => f.severity === 'critical');

test('a sound design is ready for manufacture, against a stable revision', () => {
  const input = { studio: room(), pieces: [wardrobe(1, 120), wardrobe(2, 320)] };
  const v = validateForManufacture(input);
  assert.deepEqual(critical(v), [], JSON.stringify(v.findings));
  assert.equal(v.ready, true);
  assert.match(v.revision, /^[0-9a-f]{8}$/);
  assert.equal(validateForManufacture(input).revision, v.revision, 'the same model has the same revision');
  const moved = { ...input, pieces: [wardrobe(1, 121), input.pieces[1]!] };
  assert.notEqual(modelRevision(moved), v.revision, 'any change to the model is a new revision');
  assert.equal(modelRevision({ ...input, pieces: [...input.pieces].reverse() }), v.revision, 'the order pieces are listed in is not a change');
});

test('two pieces in the same place block the export and are named', () => {
  const v = validateForManufacture({ studio: room(), pieces: [wardrobe(1, 120), wardrobe(2, 200)] });
  assert.equal(v.ready, false);
  const clash = critical(v).find(f => f.id.startsWith('clash:'))!;
  assert.deepEqual(clash.marks, ['W1', 'W2']);
  assert.match(clash.message, /W1 and W2/);
  // Touching side by side is a joint, not a clash.
  const d = createInitialDesign();
  assert.equal(validateForManufacture({ studio: room(), pieces: [wardrobe(1, 120), wardrobe(2, 120 + d.w)] }).ready, true);
});

test('a piece taller than its room, or with no real size, blocks the export', () => {
  const tall = { ...createInitialDesign(), h: 280 };
  assert.ok(critical(validateForManufacture({ studio: room(), pieces: [wardrobe(1, 120, tall)] })).some(f => f.id === 'tall:W1'));
  const broken = { ...createInitialDesign(), w: Number.NaN };
  assert.ok(critical(validateForManufacture({ pieces: [wardrobe(1, 120, broken)] })).some(f => f.id === 'size:W1'));
});

test('assembly: fittings that overlap or bays that do not add up to the width block the export', () => {
  const state = createEditorState();
  createDesignCommands(() => state);
  state.secs[0] = [{ k: 'drawer', h: 40, y: 0 }, { k: 'drawer', h: 40, y: 20 }] as typeof state.secs[0];
  const overlap = critical(validateForManufacture({ pieces: [wardrobe(1, 0, state)] }));
  assert.ok(overlap.some(f => f.id === 'fit:W1:0'), JSON.stringify(overlap));
  // Bays are shared out in whole millimetres that add back up exactly, at any width.
  for (const w of [80, 100.3, 199.9, 240, 317.7]) {
    const v = critical(validateForManufacture({ pieces: [wardrobe(1, 0, { ...createInitialDesign(), w })] }));
    assert.deepEqual(v.filter(f => f.id.startsWith('bays:')), [], w + ' cm adds up exactly');
  }
});

test('no false findings on the professional drawing fixtures: L, U, island, rotated, appliance and shelf kitchens', () => {
  for (const kind of ['l', 'u', 'island', 'rotated', 'appliances', 'shelf']) {
    const v = validateForManufacture(drawingInput(drawingFixture(kind)));
    assert.deepEqual(critical(v), [], kind + ': ' + JSON.stringify(critical(v)));
  }
});

test('every kitchen unit and wardrobe template reconciles with its cutting list', () => {
  const pieces: DrawingPiece[] = [
    wardrobe(1, 0),
    { id: 2, name: 'Base', x: 0, y: 0, z: 400, angle: 0, design: createKitchenDesign('base', 'drawers') },
    { id: 3, name: 'Tall', x: 300, y: 0, z: 400, angle: 0, design: createKitchenDesign('tall', 'fridge') },
    { id: 4, name: 'Upper', x: 600, y: 142, z: 400, angle: 0, design: createKitchenDesign('upper', 'upper') },
  ];
  const v = validateForManufacture({ pieces });
  assert.deepEqual(critical(v), [], JSON.stringify(critical(v)));
});
