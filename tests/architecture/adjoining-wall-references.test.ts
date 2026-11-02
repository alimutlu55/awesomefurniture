import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { surfaceProfile } from '../../src/domain/studio/surface-profile';
import { adjoiningWallReferences } from '../../src/presentation/editor/adjoining-wall-references';
import { neighbourPoints } from '../../src/presentation/editor/studio-align';
import { autoProfileValue, snapCorner, snapSlide, snapMove, profileSmartGuides } from '../../src/presentation/editor/surface-shape-snap';
import { applyShapeField } from '../../src/presentation/editor/surface-shape-fields';
import { drawingBox, drawingMarkup } from '../../src/presentation/editor/surface-shape-drawing';

function fixture(view: 'front' | 'side' = 'front') {
  const original = createStudio('bedroom');
  const room = { ...original, walls: original.walls.map(w => w.id === 'w2' ? { ...w, height: 230 } : w) };
  const s = surfaceProfile(room, { kind: 'wall', id: 'w1' }, view)!;
  const adjoining = adjoiningWallReferences(room, s);
  return { room, s: { ...s, adjoining } };
}

test('front unfolds only connected walls beside their own corner and fits their dashed references', () => {
  const { s } = fixture();
  assert.deepEqual(s.adjoining.map(w => w.id).sort(), ['w2', 'w4']);
  const right = s.adjoining.find(w => w.id === 'w2')!;
  assert.ok(right.points.every(p => p.x >= s.context.to && p.y <= 230));
  assert.ok(s.adjoining.find(w => w.id === 'w4')!.points.every(p => p.x <= s.context.from));
  const box = drawingBox(s, s.points);
  for (const wall of s.adjoining) for (const p of wall.points) assert.ok(p.x >= box.x && p.x <= box.x + box.w);
  const markup = drawingMarkup({ profile: s, points: s.points, pick: null, guides: [], px: 1, problem: false, box });
  assert.equal((markup.match(/class="shape-adjoining"/g) ?? []).length, 2);
  assert.equal((markup.match(/data-corner=/g) ?? []).length, s.points.length, 'references add no editable handles');
});

test('side references project into the room, and isolated walls have no adjoining references', () => {
  const { room, s } = fixture('side');
  assert.equal(s.adjoining.length, 2);
  assert.ok(s.adjoining.flatMap(w => w.points).some(p => p.x > 0));
  assert.ok(neighbourPoints(room, s, []).some(p => p.y === 230));
  const isolated = createStudio('wall'), wall = surfaceProfile(isolated, { kind: 'wall', id: 'w1' })!;
  assert.deepEqual(adjoiningWallReferences(isolated, wall), []);
});

test('adjoining wall height aligns corners, edges, whole shapes and typed sizes with the shared tolerance', () => {
  const { room, s } = fixture(), levels = { ...s.context, points: neighbourPoints(room, s, []) };
  const points = s.points.map(p => ({ ...p, y: p.y ? 220 : 0 }));
  assert.equal(snapCorner(points, 2, { x: points[2]!.x, y: 229.95 }, s.bounds, levels, 1, .1).at.y, 230);
  assert.equal(snapCorner(points, 2, { x: points[2]!.x, y: 229 }, s.bounds, levels, 1, .1).at.y, 230);
  assert.equal(snapCorner(points, 2, { x: points[2]!.x, y: 228.9 }, s.bounds, levels, 1, .1).at.y, 228.9);
  assert.ok(Math.abs(snapSlide(points, 2, 9.95, s.bounds, levels, 1, .1).d - 10) < 1e-6);
  assert.equal(snapMove(points, 0, 9.95, s.bounds, levels, 1, .1).dy, 10);
  assert.equal(autoProfileValue(229.95, v => applyShapeField(s, points, null, 'height', v), s.bounds, levels), 230);
  assert.ok(profileSmartGuides(points.map(p => ({ ...p, y: p.y ? 230 : 0 })), s.bounds, levels, 1).some(g => g.a.y === 230 && g.b.y === 230));
});


test('10 mm size snapping catches from either side and releases beyond the threshold at every zoom', () => {
  const { room, s } = fixture(), levels = { ...s.context, points: neighbourPoints(room, s, []) };
  const points = s.points.map(p => ({ ...p, y: p.y ? 220 : 0 }));
  for (const px of [.01, .1, 1, 10]) for (const delta of [-1, -.5, .5, 1, -1.1, 1.1]) {
    const caught = Math.abs(delta) <= 1, target = 230 + delta;
    const expected = caught ? 230 : target;
    assert.ok(Math.abs(snapCorner(points, 2, { x: points[2]!.x, y: target }, s.bounds, levels, px, .1).at.y - expected) < 1e-6);
    assert.ok(Math.abs(snapSlide(points, 2, 10 + delta, s.bounds, levels, px, .1).d - (caught ? 10 : 10 + delta)) < 1e-6);
    assert.ok(Math.abs(snapMove(points, 0, 10 + delta, s.bounds, levels, px, .1).dy - (caught ? 10 : 10 + delta)) < 1e-6);
    assert.ok(Math.abs(autoProfileValue(target, v => applyShapeField(s, points, null, 'height', v), s.bounds, levels) - expected) < 1e-6);
  }
});
