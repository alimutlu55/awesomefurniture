import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES, type Rule } from '../../src/domain/drawings/manufacturing-rules/index';
import type { DrawingPiece } from '../../src/domain/drawings/room-pieces';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';

/** Engineering rules: each one reports the limit, what the design measures and the change that clears it. */

const wardrobe = (id: number, x: number, design = createInitialDesign()): DrawingPiece => ({ id, name: 'Wardrobe ' + id, x, y: 0, z: 5 + design.d / 2, angle: 0, design });

test('a rule added to the list reports its limit, measured value, fix and part through the manufacturing check', () => {
  const stub: Rule = (_input, pieces) => pieces.map(p => ({ id: 'stub:' + p.mark, severity: 'critical', area: 'assembly', marks: [p.mark],
    message: p.mark + ' is too wide', rule: 'Stub limit', limit: 600, measured: 1180, fix: 'Split into 2 leaves of 590 mm', at: { mark: p.mark, board: 3 } }));
  const input = { pieces: [wardrobe(1, 0)] };
  const v = validateForManufacture(input, [], [...RULES, stub]);
  const found = v.findings.find(f => f.id === 'stub:W1');
  assert.ok(found, JSON.stringify(v.findings));
  assert.equal(found.limit, 600);
  assert.equal(found.measured, 1180);
  assert.equal(found.fix, 'Split into 2 leaves of 590 mm');
  assert.deepEqual(found.at, { mark: 'W1', board: 3 });
  assert.equal(v.ready, false, 'a critical rule finding blocks the export');
});

test('rules run after the existing checks, which keep their ids and order', () => {
  const input = { pieces: [wardrobe(1, 0), wardrobe(2, 50)] };
  const before = validateForManufacture(input, [], []).findings;
  const stub: Rule = () => [{ id: 'stub', severity: 'warning', area: 'assembly', marks: [], message: 'last', rule: 'Stub' }];
  const after = validateForManufacture(input, [], [stub]).findings;
  assert.deepEqual(after.slice(0, before.length), before);
  assert.equal(after.at(-1)!.id, 'stub');
  assert.ok(before.length > 0, 'the overlapping pieces give existing findings to compare');
});

test('the default list is what validateForManufacture runs', () => {
  const input = { pieces: [wardrobe(1, 0)] };
  assert.deepEqual(validateForManufacture(input).findings, validateForManufacture(input, [], RULES).findings);
});
