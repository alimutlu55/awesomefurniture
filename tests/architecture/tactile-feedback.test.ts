import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTactileFeedback } from '../../src/presentation/editor/tactile-feedback';

for (const reduced of [false, true]) test(`tactile feedback respects reduced motion (${reduced}) and never changes a cabinet`, () => {
    let vibrations = 0; const animations: unknown[] = [];
    const feedback = createTactileFeedback({ navigator: { vibrate() { vibrations++; return true; } } as never,
        matchMedia: (() => ({ matches: reduced })) as never });
    feedback.begin(200); feedback.tick(200); assert.equal(vibrations, 0);
    feedback.tick(201); assert.equal(vibrations, reduced ? 0 : 1);
    feedback.tick(201); assert.equal(vibrations, reduced ? 0 : 1, 'stationary values never tick');
    feedback.settle({ animate(frames: unknown) { animations.push(frames); } } as unknown as HTMLElement);
    assert.equal(animations.length, reduced ? 0 : 1);
    if (!reduced) assert.deepEqual(animations[0], [{ scale: '1' }, { scale: '1.02' }, { scale: '.995' }, { scale: '1' }]);
});
test('unsupported vibration and unavailable animations remain optional', () => {
    const feedback = createTactileFeedback({ navigator: {} as never, matchMedia: (() => ({ matches: false })) as never });
    feedback.begin(0); assert.doesNotThrow(() => feedback.tick(1)); assert.doesNotThrow(() => feedback.settle(null));
});
