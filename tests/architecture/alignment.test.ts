import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALIGN_HOLD, alignTo, nearestValue, resolveAlignment, smallestMove, type AlignTarget } from '../../src/domain/geometry/alignment';

/** The one alignment rule shared by every editor: room corners and walls, openings, wall and ceiling shapes,
 * fitting edges, boards and whole wardrobes. */

const t = (v: number, label = 'edge', extra: Partial<AlignTarget> = {}): AlignTarget => ({ v, label, ...extra });

test('catches the nearest line within the tolerance, and nothing beyond it', () => {
  const lines = [t(10, 'a'), t(14, 'b'), t(30, 'c')];
  assert.equal(resolveAlignment(13, lines, { tolerance: 2 })?.label, 'b');
  assert.equal(resolveAlignment(11, lines, { tolerance: 2 })?.label, 'a');
  assert.equal(resolveAlignment(22, lines, { tolerance: 2 }), null, 'no guide when nothing is near');
  assert.equal(resolveAlignment(12, lines, { tolerance: 2 })?.label, 'a', 'equally near: the one listed first');
  assert.equal(resolveAlignment(12, [], { tolerance: 2 }), null);
});

test('a held line stays caught until the pointer is ALIGN_HOLD tolerances away, so close lines do not flicker', () => {
  const lines = [t(10, 'a'), t(13, 'b')], lock = lines[0]!;
  assert.equal(resolveAlignment(12, lines, { tolerance: 2, lock })?.label, 'a', 'b is nearer, but a is held');
  assert.equal(resolveAlignment(10 + 2 * ALIGN_HOLD, lines, { tolerance: 2, lock })?.label, 'a', 'held to the edge of the hold');
  assert.equal(resolveAlignment(10 + 2 * ALIGN_HOLD + .01, lines, { tolerance: 2, lock })?.label, 'b', 'past the hold: the nearest');
  assert.equal(resolveAlignment(12, lines, { tolerance: 2, lock: t(10, 'gone') })?.label, 'b', 'a lock no longer offered is dropped');
});

test('a line the part cannot reach is never offered, held or not', () => {
  const lines = [t(10, 'a'), t(14, 'b')];
  assert.equal(resolveAlignment(13.5, lines, { tolerance: 2, within: [0, 12] }), null, 'b is beyond the reachable range');
  assert.equal(resolveAlignment(11, lines, { tolerance: 2, within: [0, 12] })?.label, 'a');
  assert.equal(resolveAlignment(13, lines, { tolerance: 3, lock: lines[1]!, within: [0, 12] })?.label, 'a', 'an unreachable held line lets go');
});

test('a weaker kind (a matching size) loses to an edge at nearly the same distance', () => {
  const lines = [t(10.4, 'Same height', { kind: 'size', penalty: .7 }), t(9.6, 'Aligned', { kind: 'edge' })];
  assert.equal(resolveAlignment(10.3, lines, { tolerance: 2 })?.label, 'Aligned');
  assert.equal(resolveAlignment(11.5, lines, { tolerance: 2 })?.label, 'Same height', 'the edge is out of reach');
  // A held line is the same line by its kind, whatever its label says.
  assert.equal(resolveAlignment(9.9, [t(9.5, 'Aligned with divider', { kind: 'edge' })], { tolerance: 1, lock: t(9.5, 'Aligned', { kind: 'edge' }) })?.label, 'Aligned with divider');
});

test('the helpers each editor uses', () => {
  assert.deepEqual(alignTo(5.5, [{ v: 5, label: 'Wall' }], null, 1), { v: 5, label: 'Wall' });
  assert.equal(nearestValue(48, [0, 50, 100], 3), 50);
  assert.equal(nearestValue(45, [0, 50, 100], 3), null);
  assert.equal(smallestMove([4, -3, .01], 6), -3, 'the smallest move that lines it up');
  assert.equal(smallestMove([.01, 9], 6), 0, 'already in line, or too far: no move');
  assert.equal(smallestMove([3, -3], 6), 3, 'equal moves: the one listed first');
});

test('property: the result is always one of the targets, reachable, and within the tolerance (or the hold)', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 2000; n++) {
    const targets = Array.from({ length: 1 + Math.floor(rand() * 8) }, (_, i) => t(Math.round(rand() * 2000) / 10, 'l' + i, { kind: rand() < .3 ? 'size' : 'edge', penalty: rand() < .3 ? rand() : 0 }));
    const raw = rand() * 200, tolerance = .2 + rand() * 6, lo = rand() * 100, within = [lo, lo + rand() * 150] as const;
    const lock = rand() < .5 ? targets[Math.floor(rand() * targets.length)]! : null;
    const got = resolveAlignment(raw, targets, { tolerance, lock, within });
    const again = resolveAlignment(raw, [...targets], { tolerance, lock, within });
    assert.equal(got, again, 'deterministic');
    if (!got) {
      assert.ok(targets.every(x => x.v < within[0] - 1e-6 || x.v > within[1] + 1e-6 || Math.abs(x.v - raw) > tolerance), 'nothing reachable was in reach');
      continue;
    }
    assert.ok(targets.includes(got));
    assert.ok(got.v >= within[0] - 1e-6 && got.v <= within[1] + 1e-6, 'reachable');
    const held = lock && Math.abs(got.v - lock.v) < 1e-6 && (got.kind ?? got.label) === (lock.kind ?? lock.label);
    assert.ok(Math.abs(got.v - raw) <= tolerance * (held ? ALIGN_HOLD : 1) + 1e-9, 'within reach');
  }
});
