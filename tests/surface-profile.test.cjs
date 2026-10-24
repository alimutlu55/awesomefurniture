const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { roomHeight } = require('../src/domain/studio/studio.ts');
const { addCeiling, ceilingAt, ceilingFrame, CEILING_SHAPES, replaceCeiling } = require('../src/domain/studio/studio-ceiling.ts');
const { liftCeilingOuterEdge, outerEdgeHeight } = require('../src/domain/studio/ceiling-edge.ts');
const { surfaceProfile, withSurfaceProfile, surfaceProblems } = require('../src/domain/studio/surface-profile.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { signedArea, slideEdge, addPoint } = require('../src/domain/geometry/profile-polygon.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const room = shape => addCeiling(rectangleStudio(400, 250), 'w1', shape);
const ref = s => ({ kind: 'ceiling', id: s.ceilings.at(-1).id });
const sample = (before, after, c) => {
  const fr = ceilingFrame(before, c);
  for (const t of [20, 120, 220, 320]) for (const d of [5, 30]) close(ceilingAt(after, fr.at(t, d)), ceilingAt(before, fr.at(t, d)), 1e-3);
};
const roundTrip = s => deserializeProject(serializeProject({ ...createProject('p', 'Shapes'), studio: s })).studio;

for (const shape of CEILING_SHAPES) test(`${shape.name}: read as a profile and written back unchanged, it saves and keeps the same clear heights`, () => {
  const s = room(shape.id), p = surfaceProfile(s, ref(s));
  assert.ok(signedArea(p.points) > 0, 'counter-clockwise');
  assert.ok(p.points.every(q => q.y <= roomHeight(s) + 1e-9), 'top corners on the room ceiling');
  const written = withSurfaceProfile(s, ref(s), p.points);
  assert.deepEqual(studioProblems(written), []);
  sample(s, written, s.ceilings[0]);
  assert.deepEqual(roundTrip(written), written);
});

test('a pillar stands on the floor: nothing fits under it, and it is a valid room', () => {
  const s = room('pillar'), c = s.ceilings[0], xs = c.outline.map(p => p.t), mid = (Math.min(...xs) + Math.max(...xs)) / 2, fr = ceilingFrame(s, c);
  assert.deepEqual(studioProblems(s), []);
  assert.equal(ceilingAt(s, fr.at(mid, 10)), 0);
  assert.equal(ceilingAt(s, fr.at(mid + 100, 10)), roomHeight(s));
});

test('editing a ceiling whose outer edge is lifted keeps its top above the room, so a later lift still meets the ceiling', () => {
  const lifted = liftCeilingOuterEdge(room('box'), 'k1', -30), r = ref(lifted), p = surfaceProfile(lifted, r);
  const lower = p.points.reduce((i, q, k) => q.y < p.points[i].y ? k : i, 0);
  const bottom = p.points.findIndex((q, k) => Math.abs(q.y - p.points[lower].y) < 1e-6 && Math.abs(p.points[(k + 1) % p.points.length].y - q.y) < 1e-6);
  const moved = slideEdge(p.points, bottom, -10, p.bounds);
  const next = withSurfaceProfile(lifted, r, moved.points), c = next.ceilings[0];
  assert.deepEqual(studioProblems(next), []);
  assert.ok(c.outline.filter(q => q.roof).every(q => q.y > roomHeight(next)), 'its top corners are raised and marked');
  close(outerEdgeHeight(c), outerEdgeHeight(lifted.ceilings[0]) + 10);
  assert.deepEqual(studioProblems(liftCeilingOuterEdge(next, 'k1', -20)), []);
});

test('a wall takes a sloped top: its height is its highest point, and back to a rectangle it is plain again', () => {
  const s = rectangleStudio(400, 250), wall = { kind: 'wall', id: 'w1' }, p = surfaceProfile(s, wall);
  const bent = addPoint(p.points, 2).points.map((q, k) => k === 3 ? { x: q.x, y: 180 } : q), high = s.walls[0].height;
  const sloped = withSurfaceProfile(s, wall, bent);
  assert.deepEqual(studioProblems(sloped), []);
  assert.equal(sloped.walls[0].height, high); assert.equal(sloped.walls[0].outline.length, 5);
  assert.deepEqual(roundTrip(sloped), sloped);
  const plain = withSurfaceProfile(sloped, wall, p.points);
  assert.equal(plain.walls[0].outline, undefined);
  assert.deepEqual(plain.walls[0], s.walls[0]);
});

test('a profile that breaks a rule is refused with what to do, and is never written', () => {
  const s = room('stepped'), r = ref(s), p = surfaceProfile(s, r);
  // The top left corner swapped with the bottom left one: the left edges cross.
  const crossed = p.points.map((q, k) => k === 0 ? { x: q.x, y: p.points[5].y } : k === 5 ? { x: q.x, y: p.points[0].y } : q);
  assert.equal(withSurfaceProfile(s, r, crossed), null);
  const broken = { ...s, ceilings: [{ ...s.ceilings[0], outline: crossed.map(q => ({ t: q.x, y: q.y })) }] };
  assert.match(surfaceProblems(broken, r)[0], /cross|thinner|edge/);
  assert.equal(withSurfaceProfile(s, r, p.points.map(q => ({ ...q, x: q.x + 1000 }))), null, 'off its wall');
});

test('starting over from another shape keeps the ceiling where it was', () => {
  const s = room('pillar'), next = replaceCeiling(s, 'k1', 'box');
  assert.equal(next.ceilings.length, 1); assert.equal(next.ceilings[0].id, 'k1'); assert.equal(next.ceilings[0].outline, undefined);
  assert.deepEqual(studioProblems(next), []);
});

test('a pillar is an obstacle where it stands on the floor; ceilings that hang are not', () => {
  const { studioObstacles } = require('../src/domain/studio/studio-obstacles.ts');
  const s = room('pillar'), shapes = studioObstacles(s).filter(o => o.id.startsWith('shape:'));
  assert.equal(shapes.length, 1);
  const xs = s.ceilings[0].outline.map(p => p.t);
  close(shapes[0].state.w, Math.max(...xs) - Math.min(...xs)); close(shapes[0].state.d, s.ceilings[0].depth);
  for (const id of ['stairs', 'landing', 'slope', 'box', 'stepped']) assert.equal(studioObstacles(room(id)).filter(o => o.id.startsWith('shape:')).length, 0, id);
});
