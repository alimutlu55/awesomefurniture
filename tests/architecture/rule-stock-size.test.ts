import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES } from '../../src/domain/drawings/manufacturing-rules/index';
import { stockSize } from '../../src/domain/drawings/manufacturing-rules/stock-size';
import { STOCK } from '../../src/domain/make/make-cut-layout';
import { alone, goldenWardrobes, wardrobe, welcomeSpaces } from './rule-fixtures';

/** Every part fits the stock sheet it is cut from, 2800 × 2070 mm less 10 mm trim all round (D9). */

const oversize = (input: Parameters<typeof validateForManufacture>[0]) => validateForManufacture(input).findings.filter(f => f.id.startsWith('stock-size:'));

test('a 240 × 230 cm wardrobe with nothing to split its back over is refused on its back', () => {
  const found = oversize(alone(wardrobe({ w: 240, h: 230, n: 1 })));
  assert.equal(found.length, 1, JSON.stringify(found));
  const f = found[0]!;
  assert.equal(f.severity, 'critical');
  assert.match(f.message, /Back/);
  assert.equal(f.measured, 2364, 'its width across the grain');
  assert.equal(f.limit, STOCK.width - 2 * STOCK.trim);
  assert.equal(f.fix, 'Split this part');
  assert.equal(f.at?.mark, 'W1');
});

test('a 100 cm wardrobe passes, and so does a 240 cm one whose back is split over a partition', () => {
  assert.deepEqual(oversize(alone(wardrobe({ w: 100 }))), []);
  assert.deepEqual(oversize(alone(wardrobe({ w: 240, n: 3, wt: [1, 1, 1] }))), []);
});

test('a part longer than the sheet with no partition to split it over is refused along its length', () => {
  assert.deepEqual(oversize(alone(wardrobe({ w: 290, n: 3, wt: [1, 1, 1] }))), [], 'with partitions its long boards are split');
  const found = oversize(alone(wardrobe({ w: 290, n: 1 })));
  assert.ok(found.some(f => /Top|Base/.test(f.message) && f.limit === STOCK.length - 2 * STOCK.trim && f.measured! > f.limit!), JSON.stringify(found));
});

test('no golden wardrobe and no welcome space is refused by the rule', () => {
  assert.ok(RULES.includes(stockSize));
  for (const [name, design] of goldenWardrobes()) assert.deepEqual(oversize(alone(design)), [], name);
  for (const [name, input] of welcomeSpaces()) assert.deepEqual(oversize(input), [], name);
});
