import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES } from '../../src/domain/drawings/manufacturing-rules/index';
import { shelfSpan } from '../../src/domain/drawings/manufacturing-rules/shelf-span';
import { SHELF_SPAN, shelfSpanFor } from '../../src/domain/wardrobe/carcass';
import { SELECTION_RULES } from '../../src/domain/planner/selection-config';
import { PANEL } from '../../src/domain/wardrobe/catalog.js';
import type { EditorItem } from '../../src/domain/wardrobe/editor-design';
import { alone, goldenWardrobes, wardrobe, welcomeSpaces } from './rule-fixtures';

/** A shelf spans at most 800 mm between supports in 18 mm board, 1000 mm in 25 mm board (D2), or it bows. */

const spans = (input: Parameters<typeof validateForManufacture>[0]) => validateForManufacture(input).findings.filter(f => f.id.startsWith('shelf-span:'));
const shelves = (n: number) => Array.from({ length: n }, () => ({ k: 'shelf', h: 30 }) as EditorItem);
const bay = (w: number, items: EditorItem[], over = {}) => wardrobe({ w, n: 1, secs: [items, [], [], [], [], []], ...over });

test('one 124 cm bay of three shelves is refused, shelf by shelf, with the fix', () => {
  const found = spans(alone(bay(124, shelves(3))));
  assert.equal(found.length, 3, JSON.stringify(found));
  for (const f of found) {
    assert.equal(f.severity, 'critical');
    assert.equal(f.measured, 1204, 'the clear width between the sides: 1240 − 2 × 18 mm');
    assert.equal(f.limit, 800);
    assert.equal(f.fix, 'Add a partition');
    assert.equal(f.at?.mark, 'W1');
  }
});

test('an 80 cm bay passes; a 100 cm bay is within a 25 mm board, which is the fix', () => {
  assert.deepEqual(spans(alone(bay(80, shelves(3)))), []);
  const found = spans(alone(bay(100, shelves(1))));
  assert.deepEqual(found.map(f => [f.measured, f.fix]), [[964, 'Use 25 mm board']]);
});

test('a divider standing under a long shelf supports it', () => {
  const items = [{ k: 'shelf', h: 30 } as EditorItem];
  const supported = bay(124, items, { dividers: [{ i: 0, orientation: 'vertical', x: 60, y0: 0, y1: 30 }] });
  assert.deepEqual(spans(alone(supported)).filter(f => f.measured! > 800), [], JSON.stringify(spans(alone(supported))));
});

test('the limits come from carcass.ts, and the planner reads the same 800 mm', () => {
  assert.deepEqual(SHELF_SPAN, { 18: 80, 25: 100 });
  assert.equal(shelfSpanFor(PANEL), 80);
  assert.equal(shelfSpanFor(2.5), 100);
  assert.equal(SELECTION_RULES.shelfSpan, 800);
  assert.ok(RULES.includes(shelfSpan));
});

test('no golden wardrobe and no welcome space is refused by the rule', () => {
  for (const [name, design] of goldenWardrobes()) assert.deepEqual(spans(alone(design)), [], name);
  for (const [name, input] of welcomeSpaces()) assert.deepEqual(spans(input), [], name);
});
