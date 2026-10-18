import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLength, fromCm, lengthNumber, stepIn, toCm } from '../../src/domain/geometry/length-units';

/** Display units never change the design: it stays centimetres, and a unit only changes how a length is shown and read. */

test('lengths are shown in the chosen unit, exactly', () => {
  assert.equal(formatLength(183.4, 'cm'), '183.4 cm');
  assert.equal(formatLength(183.4, 'mm'), '1834 mm');
  assert.equal(formatLength(183.4, 'in'), '72.2 in');
  assert.equal(formatLength(2.54, 'in'), '1 in');
  assert.equal(lengthNumber(-3, 'cm'), '0', 'a displayed length is never negative');
  assert.equal(formatLength(64.3, 'mm'), '643 mm');
});

test('what is typed in a unit reads back to the same centimetres the design keeps (well inside its 1 mm resolution)', () => {
  for (const cm of [0, 0.1, 1.8, 22.4, 64.3, 183.4, 230, 279.9]) for (const unit of ['mm', 'cm', 'in'] as const) {
    const back = toCm(fromCm(cm, unit, true), unit);
    assert.ok(Math.abs(back - cm) <= (unit === 'in' ? 0.0135 : 0.005), `${cm} cm via ${unit} came back as ${back}`);
  }
  assert.equal(toCm(1834, 'mm'), 183.4);
  assert.equal(toCm(72, 'in'), 182.88);
});

test('field steps follow the unit', () => {
  assert.equal(stepIn(0.5, 'cm'), '0.5');
  assert.equal(stepIn(0.5, 'mm'), '5');
  assert.equal(stepIn(0.1, 'mm'), '1');
  assert.equal(stepIn(0.5, 'in'), 'any');
});
