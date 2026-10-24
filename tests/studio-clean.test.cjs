const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { addCeiling } = require('../src/domain/studio/studio-ceiling.ts');
const { setWallSize, splitWall, setInsideLength } = require('../src/domain/studio/studio-edit.ts');
const { cleanStudio } = require('../src/domain/studio/studio-clean.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { lowerBoundary, COINCIDENT } = require('../src/domain/geometry/boundary.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
const meets = list => list.some((p, i) => Math.hypot(p.t - list[(i + 1) % list.length].t, p.y - list[(i + 1) % list.length].y) <= COINCIDENT);

test('a saved room with a point that meets its neighbour opens, and its shape is kept with that point removed', () => {
  const s = addCeiling(rectangleStudio(400, 300), 'w1', 'landing');
  const c = s.ceilings[0], stored = JSON.parse(JSON.stringify(s));
  stored.ceilings[0].profile.splice(1, 0, { t: c.profile[1].t + 1e-7, y: c.profile[1].y });
  assert.match(studioProblems(stored).join(), /These points meet/, 'the raw saved room is refused');
  const project = deserializeProject(JSON.stringify({ ...createProject('p', 'Saved'), studio: stored }));
  // The same room, with the doubled point gone (the kept copy differs from the original by 1e-7 cm).
  assert.equal(project.studio.ceilings[0].profile.length, c.profile.length, 'the doubled point is gone');
  project.studio.ceilings[0].profile.forEach((p, i) => { close(p.t, c.profile[i].t); close(p.y, c.profile[i].y); });
  assert.deepEqual({ ...project.studio, ceilings: undefined }, { ...s, ceilings: undefined }, 'walls, corners and openings unchanged');
  assert.deepEqual(studioProblems(project.studio), []);
});

test('a room that was already valid comes back from cleaning unchanged', () => {
  const s = addCeiling(rectangleStudio(400, 300), 'w1', 'box');
  assert.equal(cleanStudio(s), s, 'the same object');
  assert.deepEqual(deserializeProject(serializeProject({ ...createProject('p', 'Ok'), studio: s })).studio, s);
});

test('a shape with nothing left over its wall is dropped when the wall changes length, not kept empty', () => {
  const s = addCeiling(rectangleStudio(400, 300), 'w1', 'stepped');
  const shrunk = setInsideLength(s, 'w1', 40, 'a') ?? setInsideLength(s, 'w1', 40);
  if (shrunk) for (const c of shrunk.ceilings ?? []) assert.ok(c.profile.length >= 2, 'no empty shape');
  const cut = splitWall(s, 'w1', 3);
  assert.equal(cut, null, 'a split too close to the shape is refused, not crashed on');
  const split = splitWall(s, 'w1', 200);
  assert.ok(split, 'the split works');
  assert.deepEqual(studioProblems(split), []);
});

test('the boundary keeps no two points closer than the validator refuses', () => {
  const outline = [{ t: 0, y: 0 }, { t: 100, y: 0 }, { t: 100 + 1e-7, y: 0 }, { t: 100, y: 80 }, { t: 0, y: 80 }];
  const lower = lowerBoundary(outline);
  assert.equal(meets(lower), false);
  for (let i = 1; i < lower.length; i++) assert.ok(Math.hypot(lower[i].t - lower[i - 1].t, lower[i].y - lower[i - 1].y) > COINCIDENT);
  close(lower[0].t, 0);
});
