import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { moveWall, splitWall } from '../../src/domain/studio/studio-edit';
import { ceilingAt, ceilingFrame, ceilingProblems, moveCeilingPoint, reshapeCeilingPoint, splitCeilingPanel } from '../../src/domain/studio/studio-ceiling';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { wallLine, type Studio } from '../../src/domain/studio/studio';
import { ceilingHandles } from '../../src/presentation/editor/studio-ceiling-drag';
import { createCeilingSplitCursor } from '../../src/presentation/editor/studio-ceiling-split';
import { createWallSplitCursor } from '../../src/presentation/editor/studio-wall-split';

const room = (): Studio => ({ ...rectangleStudio(400, 250), ceilings: [{ id: 'k1', wall: 'w1', run: 'along', depth: 80,
  profile: [{ t: 30, y: 220 }, { t: 100, y: 220 }, { t: 100, y: 160 }, { t: 103, y: 160 }, { t: 370, y: 240 }] }] });
const screen = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: -p.y });

test('cursor traverses both sides of a corner, a vertical step and a 3 cm panel without gaps', () => {
  const studio = room(), c = studio.ceilings![0]!, fr = ceilingFrame(studio, c)!;
  const cursor = createCeilingSplitCursor(screen), h = ceilingHandles(studio, c).find(h => h.kind === 'ceiling-split')!;
  const origin = screen(h);
  for (const [t, y] of [[99.999, 220], [100, 220], [100, 219.999], [100, 197.12345], [100, 160], [100.001, 160], [102.999, 160]]) {
    const floor = fr.at(t!, c.depth), target = screen({ ...floor, y: y! });
    cursor.move(studio, h, target.x - origin.x, target.y - origin.y);
    const next = ceilingHandles(studio, c, cursor.location(c.id)).find(h => h.kind === 'ceiling-split')!;
    assert.ok(Math.abs(next.position! - t!) < 1e-6);
    assert.ok(Math.abs(next.y - y!) < 1e-6);
  }
});

test('dividing a vertical face preserves its surface and rejects a fold back or duplicate point', () => {
  const divided = splitCeilingPanel(room(), 'k1', 1, undefined, .314159)!;
  const c = divided.ceilings![0]!;
  assert.deepEqual(ceilingProblems(divided, c), []);
  assert.equal(c.profile[2]!.t, 100);
  assert.ok(Math.abs(c.profile[2]!.y - (220 - 60 * .314159)) < 1e-8);
  const folded = moveCeilingPoint(divided, 'k1', 2, 100, 230)!;
  assert.match(ceilingProblems(folded, folded.ceilings![0]!).join(), /folds back/);
  const duplicate = moveCeilingPoint(divided, 'k1', 2, 100, 220)!;
  assert.match(ceilingProblems(duplicate, duplicate.ceilings![0]!).join(), /points meet/);
});

test('moving a step preserves its vertical face and leaves unrelated corners and thickness alone', () => {
  const studio = room(), next = reshapeCeilingPoint(studio, 'k1', 2, 90, 150)!;
  assert.deepEqual(next.ceilings![0]!.profile.slice(1, 3), [{ t: 90, y: 220 }, { t: 90, y: 150 }]);
  for (const k of [0, 3, 4]) assert.deepEqual(next.ceilings![0]!.profile[k], studio.ceilings![0]!.profile[k]);
  assert.deepEqual(next.walls, studio.walls);
  assert.deepEqual(studioProblems(next), []);
});

test('pushing an oblique wall keeps adjoining walls on their original lines', () => {
  const base = rectangleStudio(400, 250);
  const studio = { ...base, corners: base.corners.map((c, k) => k === 1 ? { ...c, x: c.x - 80 } : c) };
  const next = moveWall(studio, 'w1', 20)!;
  for (const id of ['w1', 'w2', 'w4']) {
    const w = studio.walls.find(w => w.id === id)!, a = wallLine(studio, w)!, b = wallLine(next, w)!;
    assert.ok(Math.abs(a.ux * b.uz - a.uz * b.ux) < .0005, id + ' stays parallel');
    assert.equal(next.walls.find(x => x.id === id)!.thickness, w.thickness);
  }
  assert.deepEqual(studioProblems(next), []);
});

for (const run of ['along', 'across'] as const) test(`wall split preserves the full ${run} ceiling surface and unique identities`, () => {
  const base = room(), studio = run === 'along' ? base : { ...base, ceilings: [{ ...base.ceilings![0]!, run, depth: 180,
    profile: [{ t: 0, y: 140 }, { t: 180, y: 260 }] }] };
  const next = splitWall(studio, 'w1', 200.12345)!;
  assert.equal(next.ceilings!.length, 2);
  assert.equal(new Set(next.ceilings!.map(c => c.id)).size, 2);
  assert.deepEqual(studioProblems(next), []);
  const fr = ceilingFrame(studio, studio.ceilings![0]!)!;
  for (let s = 35; s < 370; s += 3) for (const d of [5, 35, 75]) {
    const p = fr.at(s, d);
    assert.ok(Math.abs(ceilingAt(next, p) - ceilingAt(studio, p)) < 1e-6);
  }
});

test('shortening a wall trims a slope at its actual height instead of making a vertical spike', () => {
  const studio = { ...room(), ceilings: [{ ...room().ceilings![0]!, profile: [{ t: 30, y: 120 }, { t: 370, y: 240 }] }] };
  const next = moveWall(studio, 'w2', 100)!;
  const before = studio.ceilings![0]!, after = next.ceilings![0]!;
  const end = after.profile.at(-1)!;
  assert.ok(end.t < before.profile.at(-1)!.t);
  assert.ok(Math.abs(end.y - (120 + (end.t - 30) * 120 / 340)) < 1e-8);
  assert.deepEqual(studioProblems(next), []);
});

test('wall cursor uses exact positions and cancel restores its previous location', () => {
  const studio = room(), cursor = createWallSplitCursor(screen), h = cursor.handle(studio, 'w1')!;
  cursor.begin(); cursor.move(studio, h, 17.12345, 0);
  assert.ok(Math.abs(cursor.handle(studio, 'w1')!.position! - h.position! - 17.12345) < 1e-6);
  const split = splitWall(studio, 'w1', cursor.handle(studio, 'w1')!.position)!;
  assert.ok(Math.abs(split.corners.at(-1)!.x - h.x - 17.12345) < 1e-6);
  cursor.cancel(); assert.equal(cursor.handle(studio, 'w1')!.position, h.position);
});
