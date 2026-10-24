const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { roomHeight } = require('../src/domain/studio/studio.ts');
const { surfaceBoundary, edgePoint, splitSurfaceBoundary, moveSurfaceControl, boundaryControlHeight, setBoundaryControlHeight } = require('../src/domain/studio/surface-boundary.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { addCeiling, ceilingAt, ceilingFrame, flipCeiling, setCeilingDepth } = require('../src/domain/studio/studio-ceiling.ts');
const { splitWall, setWallSize, setWallLength } = require('../src/domain/studio/studio-edit.ts');
const { liftCeilingOuterEdge, liftWholeCeiling } = require('../src/domain/studio/ceiling-edge.ts');
const { createSurfaceBoundaryCursor } = require('../src/presentation/editor/surface-boundary-cursor.ts');
const { boundaryHandles } = require('../src/presentation/editor/surface-boundary-controls.ts');
const { tiltedCeilingGeometry } = require('../src/presentation/viewport/tilted-ceiling-geometry.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');

const screen = p => ({ x: (p.x + p.z * .37) * 600 / (p.z + 600), y: (-p.y + p.z * .28) * 600 / (p.z + 600) });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);
const part = (room, kind) => kind === 'wall' ? room.walls[0] : room.ceilings[0];
function room(shape = 'landing', rise = 0) {
  const s = addCeiling(rectangleStudio(400, 250), 'w1', shape);
  return rise ? liftCeilingOuterEdge(s, s.ceilings[0].id, rise) : s;
}

for (const [kind, shape, rise] of [['wall', 'box', 0], ['ceiling', 'landing', 0], ['ceiling', 'slope', 0], ['ceiling', 'landing', 25]]) {
  test(`${kind}/${shape}/${rise}: plus reaches every physical boundary continuously and adding there preserves the solid`, () => {
    const s = room(shape, rise), id = part(s, kind).id, boundary = surfaceBoundary(s, kind, id), snapshot = JSON.stringify(s);
    const cursor = createSurfaceBoundaryCursor(kind, screen), initial = cursor.handle(s, id);
    assert.ok(boundary.edges.length >= 9);
    for (const edge of boundary.edges) for (const fraction of [.001234567, .371234567, .998765432]) {
      const at = boundary.world(edgePoint(edge, fraction)), target = screen(at), origin = screen(initial);
      cursor.move(s, initial, target.x - origin.x, target.y - origin.y);
      const h = cursor.handle(s, id), projected = screen(h);
      close(projected.x, target.x); close(projected.y, target.y);
      assert.equal(JSON.stringify(s), snapshot, 'positioning never edits the shape');
      // Use the exact edge to disambiguate boundaries that overlap in projection.
      const next = splitSurfaceBoundary(s, kind, id, { edge: edge.key, fraction });
      assert.ok(next, `inserts ${edge.key}`); assert.deepEqual(studioProblems(next), [], `valid ${edge.key}`);
      const after = surfaceBoundary(next, kind, id), added = after.controls.at(-1), p = after.points[added.index];
      close(boundaryControlHeight(next, kind, id, after.controls.length - 1), at.y);
      close(after.world({ ...p, u: added.u }).x, at.x); close(after.world({ ...p, u: added.u }).z, at.z);
      assert.equal(part(next, kind).boundaryControls.length, boundary.controls.length + 1);
      if (kind === 'ceiling') for (const t of [50, 100, 200, 300]) for (const depth of [10, 40, 80]) {
        const fr = ceilingFrame(s, s.ceilings[0]); close(ceilingAt(next, fr.at(t, depth)), ceilingAt(s, fr.at(t, depth)));
      }
    }
  });
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
  assert.equal(boundaryHandles(next, 'ceiling', id).length, after.controls.length);
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

test('self-intersections and nonfinite or detached controls are refused', () => {
  const s = room('box'), b = surfaceBoundary(s, 'ceiling', s.ceilings[0].id), e = b.edges.find(e => e.kind === 'rim' && e.a.y < 260 && e.b.y < 260);
  const added = splitSurfaceBoundary(s, 'ceiling', s.ceilings[0].id, { edge: e.key, fraction: .5 }), id = added.ceilings[0].id, i = added.ceilings[0].boundaryControls.length - 1;
  assert.equal(moveSurfaceControl(added, 'ceiling', id, i, { t: NaN, y: 200 }), null);
  assert.equal(moveSurfaceControl(added, 'ceiling', id, i, { t: 200, y: 400 }), null);
  const malformed = { ...added, ceilings: [{ ...added.ceilings[0], boundaryControls: [{ index: 999, u: 1 }] }] };
  assert.ok(studioProblems(malformed).length);
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

for (const pointer of ['mouse', 'touch']) test(`${pointer}: drag plus to a ceiling end, release, tap, reshape, cancel and undo`, t => {
  const f = roomRenderFixture(t, { width: pointer === 'touch' ? 375 : 1280, wardrobes: 0 }), s = f.model.scene.studio;
  const b = surfaceBoundary(s, 'ceiling', 'k1'), e = b.edges.find(e => e.kind === 'rim' && e.a.u === 1 && e.a.t === e.b.t);
  const current = f.editor.handles().find(h => h.kind === 'ceiling-split'), target = b.world(edgePoint(e, .4));
  const project = p => ({ x: p.x + p.z * .4, y: -p.y + p.z * .3 }), a = project(current), d = project(target);
  const button = () => f.nodes.labels.children.find(el => el.getAttribute('aria-label')?.startsWith('Add a ceiling shape point here'));
  const before = f.model.snapshot();
  button().onpointerdown(f.event(pointer)); button().onpointermove(f.event(pointer, d.x - a.x, d.y - a.y)); button().onpointerup();
  assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
  close(f.editor.handles().find(h => h.kind === 'ceiling-split').y, target.y);
  button().onclick({ detail: 0 }); assert.equal(f.checkpoints.length, 1);
  const h = f.editor.handles().filter(h => h.kind === 'boundary-point').at(-1), cut = f.model.snapshot();
  const dot = f.nodes.labels.children.find(el => el.getAttribute('aria-label') === h.label);
  dot.onpointerdown(f.event(pointer)); dot.onpointermove(f.event(pointer, 5, 5));
  assert.notEqual(f.model.snapshot(), cut); dot.onpointercancel(); assert.equal(f.model.snapshot(), cut);
  assert.equal(f.history.undo(), true); assert.equal(f.model.snapshot(), before);
});
