const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { roomHeight } = require('../src/domain/studio/studio.ts');
const { addCeiling, ceilingAt, ceilingFrame, setCeilingDepth } = require('../src/domain/studio/studio-ceiling.ts');
const { liftCeilingOuterEdge } = require('../src/domain/studio/ceiling-edge.ts');
const { setWallSize } = require('../src/domain/studio/studio-edit.ts');
const { surfaceProfile, withSurfaceProfile, primaryView } = require('../src/domain/studio/surface-profile.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { studioObstacles } = require('../src/domain/studio/studio-obstacles.ts');
const { ceilingClearance } = require('../src/domain/studio/studio-clearance.ts');
const { regularShape } = require('../src/domain/wardrobe/shape/wardrobe-shape.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const roundTrip = s => deserializeProject(serializeProject({ ...createProject('p', 'Sides'), studio: s })).studio;
const beam = () => addCeiling(rectangleStudio(400, 300), 'w1', 'box'); // 220 high, 60 deep, along the back wall
const ref = { kind: 'ceiling', id: 'k1' };

test('a shape opens from the front, a roof sloping to its wall from the side; the other side starts plain', () => {
  const s = beam(), front = surfaceProfile(s, ref), side = surfaceProfile(s, ref, 'side');
  assert.equal(primaryView(s, ref), 'front'); assert.equal(front.primary, true); assert.equal(side.primary, false);
  assert.deepEqual(side.points.map(p => [p.x, p.y]), [[0, 220], [60, 220], [60, 260], [0, 260]], 'straight out to its depth, its full height');
  const roof = addCeiling(rectangleStudio(400, 300), 'w1', 'slope'), r = { kind: 'ceiling', id: 'k1' };
  assert.equal(primaryView(roof, r), 'side'); assert.equal(surfaceProfile(roof, r, 'front').primary, false);
  assert.equal(withSurfaceProfile(s, ref, side.points, 'side').ceilings[0].section, undefined, 'plain is not kept');
});

test('a beam chamfered from the side: the solid is what both sides allow', () => {
  const s = beam(), side = surfaceProfile(s, ref, 'side');
  // Its outer bottom corner cut back: 220 high at the wall, rising to 250 at 60 cm out.
  const chamfer = [{ x: 0, y: 220 }, { x: 30, y: 220 }, { x: 60, y: 250 }, { x: 60, y: 260 }, { x: 0, y: 260 }];
  const next = withSurfaceProfile(s, ref, chamfer, 'side'), c = next.ceilings[0], fr = ceilingFrame(next, c);
  assert.deepEqual(studioProblems(next), []);
  assert.equal(c.depth, 60); assert.ok(c.section);
  const mid = (fr.along.from + fr.along.to) / 2;
  close(ceilingAt(next, fr.at(mid, 10)), 220); close(ceilingAt(next, fr.at(mid, 45)), 235); close(ceilingAt(next, fr.at(mid, 59)), 249);
  close(ceilingAt(next, fr.at(mid, 70)), roomHeight(next), 1e-6);
  assert.deepEqual(roundTrip(next), next);
  // A wardrobe 20 cm deep under the chamfer: 228 tall fits from 40 cm out (230 there), not near the wall (220).
  const at = (d, h) => ceilingClearance(next, { x: fr.at(mid, d).x, z: fr.at(mid, d).z, angle: 0, w: 40, d: 20 })(regularShape(40, h));
  assert.equal(at(50, 228), false); assert.equal(at(20, 228), true);
});

for (const rise of [20, -20]) test(`a beam with its outer edge ${rise > 0 ? 'lifted' : 'lowered'} is drawn sloped from the side, and shaping it there keeps the same solid`, () => {
  const lifted = liftCeilingOuterEdge(beam(), 'k1', rise), side = surfaceProfile(lifted, ref, 'side');
  assert.deepEqual(side.points.map(p => [p.x, p.y]), [[0, 220], [60, 220 + rise], [60, 260], [0, 260]]);
  const next = withSurfaceProfile(lifted, ref, side.points, 'side'), c = next.ceilings[0], fr = ceilingFrame(next, c);
  assert.equal(c.edgeRise, undefined, 'the lift is now its side outline'); assert.ok(c.section);
  assert.deepEqual(studioProblems(next), []);
  for (const t of [fr.along.from + 1, (fr.along.from + fr.along.to) / 2]) for (const d of [1, 20, 45, 59])
    close(ceilingAt(next, fr.at(t, d)), ceilingAt(lifted, fr.at(t, d)), 1e-6);
});

test('deeper or shallower, a side outline stretches; a side outline means no edge lift', () => {
  const chamfered = withSurfaceProfile(beam(), ref, [{ x: 0, y: 220 }, { x: 30, y: 220 }, { x: 60, y: 250 }, { x: 60, y: 260 }, { x: 0, y: 260 }], 'side');
  const deeper = setCeilingDepth(chamfered, 'k1', 120), side = deeper.ceilings[0].section;
  assert.equal(deeper.ceilings[0].depth, 120); assert.deepEqual(side.map(p => p.t), [0, 60, 120, 120, 0]);
  assert.equal(liftCeilingOuterEdge(chamfered, 'k1', 20), null);
});

test('a pillar narrowed from the side is a smaller obstacle', () => {
  const s = addCeiling(rectangleStudio(400, 300), 'w1', 'pillar'), side = surfaceProfile(s, ref, 'side');
  assert.equal(side.points.length, 4);
  const slim = withSurfaceProfile(s, ref, [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 260 }, { x: 0, y: 260 }], 'side');
  const box = studioObstacles(slim).find(o => o.id.startsWith('shape:'));
  close(box.state.d, 20); assert.equal(slim.ceilings[0].depth, 20);
});

test('a hipped roof: its front stops short of the wall ends, and nothing comes down beyond it', () => {
  const s = addCeiling(rectangleStudio(400, 300), 'w1', 'slope'), r = { kind: 'ceiling', id: 'k1' }, front = surfaceProfile(s, r, 'front');
  const x0 = front.bounds.minX, x1 = front.bounds.maxX, low = Math.min(...front.points.map(p => p.y));
  const hip = [{ x: x0 + 100, y: low }, { x: x1 - 100, y: low }, { x: x1 - 50, y: 260 }, { x: x0 + 50, y: 260 }];
  const next = withSurfaceProfile(s, r, hip, 'front'), fr = ceilingFrame(next, next.ceilings[0]);
  assert.deepEqual(studioProblems(next), []);
  close(fr.along.from, x0 + 50); close(fr.along.to, x1 - 50);
  assert.equal(ceilingAt(next, fr.at(x0 + 10, 5)), roomHeight(next), 'beyond the hip, the full room height');
  assert.ok(ceilingAt(next, fr.at((x0 + x1) / 2, 5)) < 200, 'under the middle, the low edge');
});

test('a wall shaped from the side: thinner at the top, kept in proportion when it changes size', () => {
  const s = rectangleStudio(400, 300), wall = { kind: 'wall', id: 'w1' }, side = surfaceProfile(s, wall, 'side');
  assert.deepEqual(side.points.map(p => [p.x, p.y]), [[-12, 0], [0, 0], [0, 260], [-12, 260]]);
  const ledge = [{ x: -12, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 120 }, { x: -6, y: 120 }, { x: -6, y: 260 }, { x: -12, y: 260 }];
  const next = withSurfaceProfile(s, wall, ledge, 'side');
  assert.deepEqual(studioProblems(next), []); assert.equal(next.walls[0].section.length, 6);
  assert.deepEqual(roundTrip(next), next);
  const thick = setWallSize(next, 'w1', { thickness: 24 });
  assert.deepEqual(thick.walls[0].section.map(p => p.t), [-24, 0, 0, -12, -12, -24]);
  assert.equal(withSurfaceProfile(next, wall, side.points, 'side').walls[0].section, undefined, 'back to plain');
  assert.equal(withSurfaceProfile(next, wall, ledge.map(p => ({ ...p, x: p.x + 5 })), 'side'), null, 'not beyond its own faces');
});
