import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES } from '../../src/domain/drawings/manufacturing-rules/index';
import { leafSize } from '../../src/domain/drawings/manufacturing-rules/leaf-size';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { alone, goldenWardrobes, wardrobe, welcomeSpaces } from './rule-fixtures';

/** A hinged door leaf is at most 600 mm wide and 2400 mm tall (D1): wider leaves sag and overload their hinges. */

const leaves = (input: Parameters<typeof validateForManufacture>[0]) => validateForManufacture(input).findings.filter(f => f.id.startsWith('leaf-'));

/** One leaf set on the bottom opening of each listed bay, where the automatic layout would hang two (D8). */
const oneLeaf = (...bays: number[]) => ({ fronts: { leaves: Object.fromEntries(bays.map(b => [b + '.0', { leaves: 1 }])) } });

test('one leaf set across a 120 cm bay is refused, with the split that clears it', () => {
  const found = leaves(alone(wardrobe({ w: 120, n: 1, doors: 'hinged', ...oneLeaf(0) })));
  assert.equal(found.length, 1, JSON.stringify(found));
  const f = found[0]!;
  assert.equal(f.severity, 'critical');
  assert.equal(f.measured, 1198);
  assert.equal(f.limit, 600);
  assert.equal(f.fix, 'Split into 2 leaves of 599 mm');
  assert.equal(f.at?.mark, 'W1');
  assert.equal(typeof f.at?.board, 'number');
});

test('a 60 cm bay passes; two 999 mm leaves set on a 200 cm wardrobe do not; the automatic pairs do', () => {
  assert.deepEqual(leaves(alone(wardrobe({ w: 60, n: 1, doors: 'hinged' }))), []);
  assert.deepEqual(leaves(alone(wardrobe({ w: 200, n: 2, wt: [1, 1], doors: 'hinged' }))), []);
  const wide = leaves(alone(wardrobe({ w: 200, n: 2, wt: [1, 1], doors: 'hinged', ...oneLeaf(0, 1) })));
  assert.equal(wide.length, 2);
  assert.deepEqual(wide.map(f => f.fix), ['Split into 2 leaves of 499 mm', 'Split into 2 leaves of 499 mm']);
});

test('a bay too wide for a pair of leaves needs a partition', () => {
  const found = leaves(alone(wardrobe({ w: 150, n: 1, doors: 'hinged' })));
  assert.deepEqual(found.map(f => [f.fix, f.measured]), [['Add a partition', 748], ['Add a partition', 748]]);
});

test('a leaf taller than 2400 mm is refused; no doors, no leaves', () => {
  const tall = leaves(alone(wardrobe({ w: 60, h: 270, n: 1, doors: 'hinged' })));
  assert.deepEqual(tall.map(f => [f.id.split(':')[0], f.limit]), [['leaf-height', 2400]]);
  assert.ok(tall[0]!.measured! > 2400);
  assert.deepEqual(leaves(alone(wardrobe({ w: 120, n: 1, doors: 'none' }))), []);
});

test('kitchen appliance doors are not checked; a kitchen cupboard door is', () => {
  assert.deepEqual(leaves(alone(createKitchenDesign('tall', 'fridge'))), []);
  for (const unit of ['base', 'upper'] as const) assert.deepEqual(leaves(alone(createKitchenDesign(unit, unit === 'base' ? 'drawers' : 'upper'))), [], unit);
});

test('no golden wardrobe and no welcome space is refused by the rule', () => {
  for (const [name, design] of goldenWardrobes()) assert.deepEqual(leaves(alone(design)), [], name);
  for (const [name, input] of welcomeSpaces()) assert.deepEqual(leaves(input), [], name);
});

test('the rule is in the list the manufacturing check runs', () => assert.ok(RULES.includes(leafSize)));
