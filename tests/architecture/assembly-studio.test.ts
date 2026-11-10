import test from 'node:test';
import assert from 'node:assert/strict';
import { createMakePlayer } from '../../src/presentation/make/make-player';
import { makePiece } from '../../src/domain/make/make-parts';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';

const piece = () => makePiece({ pieces: [{ id: 1, name: 'Cabinet', x: 0, y: 0, z: 0, angle: 0, design: createInitialDesign() }] }, 1)!;
const sample = (p: ReturnType<typeof createMakePlayer>) => {
  const film = p.film()!;
  return { head: p.head, boards: p.timeline!.boardStep.map((_, i) => film.arrive(i)), holes: p.timeline!.holeStep.map((_, i) => film.hole(i)), hardware: p.timeline!.itemStep.map((_, i) => film.fit(i)) };
};
test('reverse playback and direct seeking produce identical geometry, holes and hardware', () => {
  const p = createMakePlayer(); p.load(piece());
  const t = p.duration * .63; p.seek(t); const expected = sample(p);
  p.seek(t + 10); p.direction(-1); p.toggle(); p.advance(10);
  assert.deepEqual(sample(p), expected);
  p.pause(); p.advance(10); assert.deepEqual(sample(p), expected, 'Explore keeps the exact assembly state');
  p.direction(1); p.toggle(); p.advance(2); assert.equal(p.time, t + 2, 'resume continues from the paused time');
});
test('playback clamps both ends and restarts in its selected direction', () => {
  const p = createMakePlayer(); p.load(piece()); p.toggle(); p.advance(p.duration + 10);
  assert.equal(p.time, p.duration); assert.equal(p.playing, false);
  p.direction(-1); p.toggle(); p.advance(p.duration + 10);
  assert.equal(p.time, 0); assert.equal(p.playing, false);
  p.toggle(); assert.equal(p.time, p.duration); p.pause();
  p.seek(NaN); assert.equal(p.time, p.duration); p.seek(-20); assert.equal(p.time, 0);
});
test('changing speed preserves the playhead and scales forward and reverse playback', () => {
  const p = createMakePlayer(); p.load(piece());
  p.seek(5); p.toggle(); p.setSpeed(1.25);
  assert.equal(p.time, 5);
  p.advance(2); assert.equal(p.time, 7.5);
  p.setSpeed(1.5); p.direction(-1);
  p.advance(2); assert.equal(p.time, 4.5);
  p.animateTo(4); p.advance(2);
  assert.equal(p.time, 4); assert.equal(p.playing, false);
  p.setSpeed(1); p.direction(1); p.toggle(); p.advance(2);
  assert.equal(p.time, 6);
});
test('playback shows the boards in use and Explore can still show the staged parts', () => {
  const model = piece(), p = createMakePlayer(); p.load(model);
  const line = p.timeline!, later = line.boardStep.findIndex(step => step > 0);
  assert.ok(later >= 0);
  assert.equal(p.film(true)!.visible!(later), false);
  const start = line.steps[line.boardStep[later]!]!.place;
  p.seek(start[0] + (start[1] - start[0]) * .9);
  assert.equal(p.film(true)!.visible!(later), true);
  p.seek(p.duration);
  assert.ok(model.boards.every((_, i) => p.film(true)!.visible!(i)));
  p.seek(0);
  assert.equal(p.film()!.visible, undefined);
});
test('chapter and component entry points use the existing timeline starts', () => {
  const model = piece(), p = createMakePlayer(); p.load(model);
  for (const part of model.parts) {
    const k = model.steps.findIndex(s => s.boards.some(i => part.ids.includes(i)));
    assert.ok(k >= 0); p.chapter(k);
    assert.equal(p.time, p.timeline!.steps[k]!.start);
    assert.equal(p.head.step, k);
  }
});
