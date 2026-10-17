import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareMillimetres, toMm } from '../../src/domain/geometry/millimetres';
import { sectionWidths, partitionPositions, sectionOrigins } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { partitionOptions } from '../../src/domain/planner/selection-spaces';
import { PANEL } from '../../src/domain/wardrobe/catalog.js';

/** Carpenter-grade widths: every bay is a whole millimetre, and the bays plus both sides and every
 * partition close exactly on the outer width, for any width, bay count and weighting. */

const WEIGHTS = [[100, 100, 100, 100, 100, 100], [137.2, 81.3, 100, 92.7, 100, 100], [1, 2, 3, 4, 5, 6], [64.267, 64.267, 64.267, 100, 100, 100]];
const isMm = (cm: number) => Math.abs(cm * 10 - Math.round(cm * 10)) < 1e-6;

test('shareMillimetres: whole parts that always add back up to the total', () => {
  assert.deepEqual(shareMillimetres(1928, [1, 1, 1]), [643, 643, 642]);
  assert.deepEqual(shareMillimetres(10, [1, 1, 1]), [4, 3, 3]);
  assert.deepEqual(shareMillimetres(0, [1, 2]), [0, 0]);
  assert.deepEqual(shareMillimetres(7, [0, 0]), [4, 3]);
  for (let total = 0; total < 3000; total += 37) for (const w of WEIGHTS) {
    const parts = shareMillimetres(total, w);
    assert.ok(parts.every(Number.isInteger));
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
  }
  assert.equal(toMm(183.4), 1834);
  assert.equal(toMm(0.1 + 0.2), 3);
});

test('bays are whole millimetres and close exactly on the outer width (Σ bays + (n + 1) × panel = W)', () => {
  for (let w10 = 600; w10 <= 3000; w10 += 7) for (let n = 1; n <= 6; n++) for (const wt of WEIGHTS) {
    const w = w10 / 10, ws = sectionWidths({ w, n, wt });
    assert.equal(ws.length, n);
    assert.ok(ws.every(isMm), `W ${w}, ${n} bays: ${ws.join(', ')} are whole millimetres`);
    assert.equal(ws.reduce((a, x) => a + toMm(x), 0) + (n + 1) * toMm(PANEL), w10, `W ${w}, ${n} bays add up`);
    // Shown at 0.1 cm, the numbers a person reads add up too.
    assert.equal(ws.reduce((a, x) => a + Math.round(x * 10), 0) + (n + 1) * 18, w10);
  }
});

test('partitions and bay origins sit on the millimetre grid and tile the width without gaps', () => {
  const design = { w: 183.4, n: 4, wt: [137.2, 81.3, 100, 92.7, 100, 100] };
  const ws = sectionWidths(design), origins = sectionOrigins(design), parts = partitionPositions(design);
  assert.ok([...origins, ...parts].every(isMm));
  origins.forEach((o, k) => {
    if (k < parts.length) assert.ok(Math.abs(o + ws[k]! - parts[k]!) < 1e-9, 'bay ends at its partition');
    if (k > 0) assert.ok(Math.abs(parts[k - 1]! + PANEL - o) < 1e-9, 'partition is one board thick');
  });
  assert.ok(Math.abs(origins[ws.length - 1]! + ws[ws.length - 1]! + PANEL - design.w) < 1e-9, 'last bay ends at the right side panel');
});

test('a width off the millimetre grid (older saves) still closes exactly', () => {
  const ws = sectionWidths({ w: 200.03, n: 3, wt: [100, 100, 100] });
  assert.ok(Math.abs(ws.reduce((a, b) => a + b, 0) + 4 * PANEL - 200.03) < 1e-9);
});

test('Auto design plans bays in whole millimetres that close on the inner width', () => {
  for (const w of [90, 160, 183.4, 200, 241.7]) {
    for (const ws of partitionOptions({ w, h: 230, d: 60 } as never)) {
      assert.ok(ws.every(isMm), `W ${w}: ${ws.join('/')}`);
      assert.equal(ws.reduce((a, x) => a + toMm(x), 0) + (ws.length + 1) * 18, toMm(w));
    }
  }
});
