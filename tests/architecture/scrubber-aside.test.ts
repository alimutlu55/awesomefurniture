import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrubberAside } from '../../src/presentation/viewport/dimension-scrubber-label';

/** Size pills stand beside their lines, away from the furniture, so a press on a fitting at its edge reaches the
 * fitting rather than the pill (a finger near an interactive pill lands on it). */
const pill = (...classes: string[]) => ({ classList: { contains: (c: string) => classes.includes(c) } }) as unknown as HTMLElement;

test('the width pill hangs below its line', () => {
  assert.deepEqual(scrubberAside(pill('dimension-scrubber', 'scrub-w'), 200, 500, 80, 20, () => 200), { x: 200, y: 514 });
});
test('depth and height pills move to the side away from the furniture', () => {
  assert.deepEqual(scrubberAside(pill('dimension-scrubber', 'scrub-d'), 300, 480, 70, 20, () => 200), { x: 339, y: 480 });
  assert.deepEqual(scrubberAside(pill('dimension-scrubber', 'scrub-h'), 120, 400, 80, 20, () => 200), { x: 76, y: 400 });
});
test('other labels stay where they are', () => {
  assert.deepEqual(scrubberAside(pill('dim'), 120, 400, 80, 20, () => 200), { x: 120, y: 400 });
  assert.deepEqual(scrubberAside(pill('dimension-scrubber', 'scrub-h'), 120, 400, 80, 20), { x: 120, y: 400 });
});
