const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { roomHeight } = require('../src/domain/studio/studio.ts');
const { surfaceBoundary, splitSurfaceBoundary, moveSurfaceControl, boundaryControlHeight, setBoundaryControlHeight } = require('../src/domain/studio/surface-boundary.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { addCeiling, ceilingAt, ceilingFrame, flipCeiling, setCeilingDepth } = require('../src/domain/studio/studio-ceiling.ts');
const { splitWall, setWallSize, setWallLength } = require('../src/domain/studio/studio-edit.ts');
const { liftCeilingOuterEdge, liftWholeCeiling } = require('../src/domain/studio/ceiling-edge.ts');
const { tiltedCeilingGeometry } = require('../src/presentation/viewport/tilted-ceiling-geometry.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);
function room(shape = 'landing', rise = 0) {
  const s = addCeiling(rectangleStudio(400, 250), 'w1', shape);
  return rise ? liftCeilingOuterEdge(s, s.ceilings[0].id, rise) : s;
}

test('a return-edge control is at the chosen depth and moves both faces together without changing thickness', () => {
  const s = room('box'), id = s.ceilings[0].id, boundary = surfaceBoundary(s, 'ceiling', id), edge = boundary.edges.find(e => e.kind === 'return' && e.a.y < 250);
  const cut = splitSurfaceBoundary(s, 'ceiling', id, { edge: edge.key, fraction: .37 }), after = surfaceBoundary(cut, 'ceiling', id);
  const index = after.controls.length - 1, control = after.controls[index], from = after.points[control.index];
  const next = moveSurfaceControl(cut, 'ceiling', id, index, { t: from.t + 10, y: from.y - 10 }), moved = surfaceBoundary(next, 'ceiling', id);
  assert.deepEqual(studioProblems(next), []);
  const a = moved.world({ ...moved.points[control.index], u: 0 }), b = moved.world({ ...moved.points[control.index], u: 1 });
  close(Math.hypot(a.x - b.x, a.z - b.z), s.ceilings[0].depth);
  close(a.y, b.y); assert.deepEqual(next.walls, s.walls);
});

test('top cuts remain visible, serialize, flip and keep their heights when depth changes', () => {
  const s = room('box'), id = s.ceilings[0].id, b = surfaceBoundary(s, 'ceiling', id);
  const e = b.edges.find(e => e.kind === 'rim' && e.a.u === 1 && e.a.y === 260 && e.b.y === 260);
  const added = splitSurfaceBoundary(s, 'ceiling', id, { edge: e.key, fraction: .41 }), index = added.ceilings[0].boundaryControls.length - 1;
  const cut = setBoundaryControlHeight(added, 'ceiling', id, index, 240);
  assert.deepEqual(studioProblems(cut), []); assert.equal(boundaryControlHeight(cut, 'ceiling', id, index), 240);
  const project = { ...createProject('p1', 'Cuts'), studio: cut }, decoded = deserializeProject(serializeProject(project));
  assert.deepEqual(decoded.studio, cut);
  const deeper = setCeilingDepth(cut, id, 120); assert.equal(boundaryControlHeight(deeper, 'ceiling', id, index), 240);
  const flipped = flipCeiling(cut, id); assert.deepEqual(studioProblems(flipped), []);
  const left = splitWall(cut, 'w1', 200); assert.deepEqual(studioProblems(left), []);
  assert.equal(left.ceilings.length, 2); assert.ok(left.ceilings.every(c => c.outline));
});

test('custom wall faces resize as a whole and retain their outline after dividing the wall', () => {
  const s = room('box'), b = surfaceBoundary(s, 'wall', 'w1'), e = b.edges.find(e => e.kind === 'rim' && e.a.t === e.b.t && e.a.u === 1);
  const added = splitSurfaceBoundary(s, 'wall', 'w1', { edge: e.key, fraction: .5 }), i = added.walls[0].boundaryControls.length - 1;
  const p = added.walls[0].outline[added.walls[0].boundaryControls[i].index];
  const cut = moveSurfaceControl(added, 'wall', 'w1', i, { t: p.t + (p.t > 200 ? -15 : 15), y: p.y });
  assert.deepEqual(studioProblems(cut), []);
  for (const next of [setWallLength(cut, 'w1', 450), setWallSize(cut, 'w1', { height: 300 }), splitWall(cut, 'w1', 200)]) {
    assert.deepEqual(studioProblems(next), []); assert.ok(next.walls[0].outline);
  }
});

test('nonfinite and out-of-room control moves are refused', () => {
  const s = room('box'), b = surfaceBoundary(s, 'ceiling', s.ceilings[0].id), e = b.edges.find(e => e.kind === 'rim' && e.a.y < 260 && e.b.y < 260);
  const added = splitSurfaceBoundary(s, 'ceiling', s.ceilings[0].id, { edge: e.key, fraction: .5 }), id = added.ceilings[0].id, i = added.ceilings[0].boundaryControls.length - 1;
  assert.equal(moveSurfaceControl(added, 'ceiling', id, i, { t: NaN, y: 200 }), null);
  assert.equal(moveSurfaceControl(added, 'ceiling', id, i, { t: 200, y: 400 }), null);
});

for (const rise of [-30, 25]) test(`tilted polygon ${rise}: every top contour closes and a top cut survives later lifting`, () => {
  const s = room('landing', rise), id = s.ceilings[0].id, b = surfaceBoundary(s, 'ceiling', id);
  const e = b.edges.find(e => e.key.startsWith('caprim:1:'));
  assert.ok(e, 'room-top boundary exists');
  const added = splitSurfaceBoundary(s, 'ceiling', id, { edge: e.key, fraction: .3 });
  assert.deepEqual(studioProblems(added), []);
  const c = added.ceilings[0], geometry = tiltedCeilingGeometry(c, roomHeight(added)), mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld();
  for (const t of [70, 150, 200, 300, 370]) for (const z of [1, 20, 50, 90]) {
    const fr = ceilingFrame(added, c), expected = ceilingAt(added, fr.at(t, z));
    if (expected >= 260) continue;
    const up = new THREE.Raycaster(new THREE.Vector3(t, 0, z), new THREE.Vector3(0, 1, 0)).intersectObject(mesh);
    const down = new THREE.Raycaster(new THREE.Vector3(t, 400, z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh);
    assert.ok(up.length && down.length, `closed ${t}/${z}`); close(up[0].point.y, expected); close(down[0].point.y, 260);
  }
  assert.deepEqual(studioProblems(liftCeilingOuterEdge(added, id, -5)), []);
  assert.deepEqual(studioProblems(liftWholeCeiling(added, id, -5)), []);
  geometry.dispose(); mesh.material.dispose();
});
