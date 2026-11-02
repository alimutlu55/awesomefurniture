import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { surfaceProfile, withSurfaceProfile } from '../../src/domain/studio/surface-profile';
import { adjoiningWallReferences } from '../../src/presentation/editor/adjoining-wall-references';
import { autoAlignWallProfile } from '../../src/presentation/editor/surface-shape-auto-align';

function fixture(view: 'front' | 'side' = 'front') {
  const original = createStudio('bedroom');
  const room = { ...original, walls: original.walls.map(w => w.id === 'w2' ? { ...w, height: 230 } : w) };
  const profile = surfaceProfile(room, { kind: 'wall', id: 'w1' }, view)!;
  const s = { ...profile, adjoining: adjoiningWallReferences(room, profile) };
  return { room, s };
}

test('one tap aligns a sloped wall to the actual adjoining heights, and is idempotent', () => {
  const { room, s } = fixture();
  const edited = { ...s, points: s.points.map((p, i) => ({ ...p, y: i === 2 ? 238.7 : i === 3 ? 258.5 : p.y })) };
  const next = autoAlignWallProfile(edited)!;
  assert.ok(next);
  assert.equal(next[2]!.y, 230);
  assert.equal(next[3]!.y, 260);
  const updated = withSurfaceProfile(room, s.ref, next, s.view);
  assert.ok(updated, 'the aligned outline passes the room edit rules');
  assert.equal(autoAlignWallProfile({ ...s, points: next }), null);
  assert.equal(edited.points[2]!.y, 238.7, 'does not mutate the source');
});

test('alignment fits inset sides and a raised floor while preserving custom inner corners', () => {
  const { s } = fixture();
  const points = [
    { x: s.context.from + 5, y: 10 }, { x: s.context.to - 5, y: 10 },
    { x: s.context.to - 5, y: 220 }, { x: 200, y: 210, pinned: true },
    { x: s.context.from + 5, y: 250 },
  ];
  const next = autoAlignWallProfile({ ...s, points })!;
  assert.equal(next[0]!.x, s.context.from);
  assert.equal(next[1]!.x, s.context.to);
  assert.equal(next[0]!.y, 0);
  assert.equal(next[1]!.y, 0);
  assert.deepEqual(next[3], points[3]);
});

test('side alignment uses the room height and keeps the wall thickness', () => {
  const { s } = fixture('side');
  const next = autoAlignWallProfile({ ...s, points: s.points.map(p => ({ ...p, y: p.y ? 240 : 0 })) })!;
  assert.equal(next[2]!.y, s.context.top);
  assert.equal(next[3]!.y, s.context.top);
  assert.deepEqual(next.map(p => p.x), s.points.map(p => p.x));
});
