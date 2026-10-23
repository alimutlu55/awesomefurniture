const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { solidPoint, interpolateSolid, solidEdges } = require('../src/domain/geometry/solid-boundary.ts');
const { surfaceSolid, splitSolidBoundary, moveSolidBoundaryPoint, replaceSurfaceSections } = require('../src/domain/studio/studio-solid-boundary.ts');
const { createSolidBoundaryCursor } = require('../src/presentation/editor/solid-boundary-cursor.ts');
const { createCeilingSplitCursor } = require('../src/presentation/editor/studio-ceiling-split.ts');
const { ceilingHandles } = require('../src/presentation/editor/studio-ceiling-drag.ts');
const { CEILING_SHAPES, addCeiling, ceilingAt, ceilingFrame } = require('../src/domain/studio/studio-ceiling.ts');
const { rectangleStudio, createStudio, STUDIO_TEMPLATES } = require('../src/domain/studio/studio-templates.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { wallLine } = require('../src/domain/studio/studio.ts');
const { createCeilingViews } = require('../src/presentation/viewport/studio-ceilings.ts');
const { wallSectionGeometry } = require('../src/presentation/viewport/solid-section-geometry.ts');
const { ceilingClearance } = require('../src/domain/studio/studio-clearance.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
const { moveSurfaceBoundaryPoint } = require('../src/domain/studio/studio-boundary.ts');
const { createWallBoundaryEditing } = require('../src/presentation/editor/studio-wall-boundary.ts');
const { sceneToProject, projectToScene } = require('../src/application/projects/editor-mapper.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
const close = (a, b, message = '') => assert.ok(Math.abs(a - b) < 1e-7, `${message}: ${a} != ${b}`);

for (const kind of ['wall', 'ceiling']) for (const cut of ['outer', 'inner']) test(`${kind} ${cut}: one cut adds exactly one control at the chosen 3D point and moves no others`, t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), id = kind === 'wall' ? 'w1' : 'k1';
    f.editor.select({ kind, id }); f.renderer.build();
    const pointKind = kind === 'wall' ? ['corner', 'wall-point'] : ['ceiling'];
    const controls = () => f.editor.handles().filter(h => pointKind.includes(h.kind));
    const locations = () => controls().map(h => [h.x, h.y, h.z]);
    const before = locations();
    for (let step = 0; step < 3; step++) {
        const at = { edge: 0, section: cut === 'outer' ? surfaceSolid(f.model.scene.studio, kind, id).sections.length - 1 : 0,
            fraction: .37123456789, ...(cut === 'depth' ? { across: true } : {}) };
        const solid = surfaceSolid(f.model.scene.studio, kind, id), expected = solid.world(solidPoint(solid.edges, at));
        const previous = locations(), snapshot = f.model.snapshot();
        const plus = f.editor.handles().find(h => h.kind === kind + '-split');
        f.editor.click({ ...plus, boundary: at });
        const current = locations();
        assert.equal(current.length, previous.length + 1);
        for (const p of previous) assert.ok(current.some(q => p.every((v, i) => Math.abs(v - q[i]) < 1e-7)), 'no control moves or appears at another corner');
        assert.ok(current.some(p => Math.hypot(p[0] - expected.x, p[1] - expected.y, p[2] - expected.z) < 1e-7));
        const persisted = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('one', 'One'), f.model.scene))));
        assert.deepEqual(persisted.studio, f.model.scene.studio);
        assert.ok(f.history.undo()); assert.equal(f.model.snapshot(), snapshot);
        assert.ok(f.history.redo()); f.renderer.build(); assert.deepEqual(locations(), current);
    }
    assert.equal(controls().length, before.length + 3);
});

test('uncut walls retain their two floor corners without extra boundary or back-face dots', t => {
    const f = roomRenderFixture(t, { wardrobes: 0 });
    f.editor.select({ kind: 'wall', id: 'w1' }); f.renderer.redrawStudio();
    assert.equal(f.editor.handles().filter(h => h.kind === 'corner').length, 2);
    assert.equal(f.editor.handles().filter(h => h.kind === 'wall-point').length, 0);
    assert.equal(f.editor.handles().filter(h => h.kind === 'wall-split').length, 1);
    assert.equal(f.nodes.labels.children.filter(el => el.classList.contains('point')).length, 2);
    const editing = createWallBoundaryEditing(projection());
    for (const template of STUDIO_TEMPLATES) {
        const room = createStudio(template.id);
        for (const wall of room.walls) assert.deepEqual(editing.handles(room, wall).map(h => h.kind), ['wall-split']);
    }
});

for (const cut of ['profile', 'depth']) test(`${cut} cut: each wall end retains one corner control that moves the connected wall`, t => {
    const f = roomRenderFixture(t, { wardrobes: 0 });
    f.model.scene.studio.ceilings = [];
    f.editor.select({ kind: 'wall', id: 'w1' });
    const at = cut === 'profile' ? { edge: 2, fraction: .5 } : { section: 0, edge: 2, across: true, fraction: .37 };
    f.model.scene.studio = splitSolidBoundary(f.model.scene.studio, 'wall', 'w1', at); f.renderer.build();
    const room = f.model.scene.studio, line = wallLine(room, room.walls[0]);
    const controls = f.editor.handles();
    for (const end of [line.a, line.b]) {
        const nearby = controls.filter(h => ['corner', 'wall-point'].includes(h.kind) && Math.hypot(h.x - end.x, h.y, h.z - end.z) <= room.walls[0].thickness);
        assert.equal(nearby.length, 1, 'the floor corner must not have a second profile or back-face handle');
        assert.equal(nearby[0].kind, 'corner');
    }
    const corner = controls.find(h => h.kind === 'corner' && h.id === line.a.id);
    const node = f.nodes.labels.children.find(el => el.dataset.roomHandle === corner.key);
    const count = controls.length, before = f.model.snapshot(), original = { x: corner.x, z: corner.z };
    node.onpointerdown(f.event('touch'));
    for (const dx of [10, 20, 30]) {
        node.onpointermove(f.event('touch', dx, 0));
        assert.equal(f.editor.handles().length, count, 'moving keeps the same control count');
        assert.equal(f.nodes.labels.children.find(el => el.dataset.roomHandle === corner.key), node);
        const moved = f.editor.handles().find(h => h.key === corner.key);
        close(moved.x, original.x + dx); close(moved.z, original.z);
        const wall = f.model.scene.studio.walls[0], current = wallLine(f.model.scene.studio, wall);
        close(current.a.x, moved.x); close(current.a.z, moved.z);
        assert.ok(node.hasPointerCapture(1));
    }
    node.onpointerup(); assert.equal(f.checkpoints.length, 1);
    assert.ok(f.history.undo()); assert.equal(f.model.snapshot(), before);
});

for (const shape of CEILING_SHAPES) test(`${shape.name}: default ceiling dots remain on the original profile only`, () => {
    const room = addCeiling(rectangleStudio(400, 240), 'w1', shape.id), c = room.ceilings[0], frame = ceilingFrame(room, c);
    const handles = ceilingHandles(room, c), dots = handles.filter(h => h.kind === 'ceiling');
    assert.equal(dots.length, c.profile.length);
    assert.ok(handles.every(h => h.section === undefined));
    for (const [k, h] of dots.entries()) {
        const p = c.profile[k], at = c.run === 'along' ? frame.at(p.t, c.depth) : frame.at((frame.along.from + frame.along.to) / 2, p.t);
        close(h.x, at.x); close(h.z, at.z); close(h.y, p.y);
    }
});

for (const kind of ['wall', 'ceiling']) for (const section of [0, 1]) test(`${kind}: a rim cut on face ${section} stays one bend through the thickness`, t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), id = kind === 'wall' ? 'w1' : 'k1';
    f.model.scene.studio = splitSolidBoundary(f.model.scene.studio, kind, id, { edge: 2, section, fraction: .37 });
    const part = kind === 'wall' ? f.model.scene.studio.walls[0] : f.model.scene.studio.ceilings[0];
    assert.equal(part.sections, undefined, 'a rim cut must not create independently editable duplicate faces');
    f.editor.select({ kind, id }); f.renderer.build();
    const controls = f.editor.handles(), h = controls.find(h => h.kind === (kind === 'wall' ? 'wall-point' : 'ceiling') && h.index === 3);
    const node = f.nodes.labels.children.find(el => el.dataset.roomHandle === h.key);
    node.onpointerdown(f.event('touch'));
    node.onpointermove(f.event('touch', 0, 20)); node.onpointerup();
    assert.equal(f.editor.handles().length, controls.length);
    assert.ok(f.editor.handles().every(h => h.section === undefined));
    const solid = surfaceSolid(f.model.scene.studio, kind, id);
    assert.deepEqual(solid.sections[0].outline, solid.sections[1].outline, 'both faces move with the same bend');
    assert.notDeepEqual(solid.sections[0].outline, part.outline, 'the wall or ceiling actually reshapes');
});

for (const kind of ['wall', 'ceiling']) test(`${kind}: previously saved matching end faces edit as one profile without duplicate handles`, t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), id = kind === 'wall' ? 'w1' : 'k1';
    const original = surfaceSolid(f.model.scene.studio, kind, id);
    f.model.scene.studio = replaceSurfaceSections(f.model.scene.studio, kind, id, original.sections);
    f.editor.select({ kind, id }); f.renderer.build();
    const controls = f.editor.handles(), h = controls.find(h => h.kind === (kind === 'wall' ? 'wall-point' : 'ceiling') && h.index === 2);
    assert.equal(new Set(controls.map(h => h.key)).size, controls.length);
    const node = f.nodes.labels.children.find(el => el.dataset.roomHandle === h.key);
    node.onpointerdown(f.event('touch'));
    node.onpointermove(f.event('touch', 0, 20)); node.onpointerup();
    assert.equal(f.editor.handles().length, controls.length);
    const solid = surfaceSolid(f.model.scene.studio, kind, id);
    assert.deepEqual(solid.sections[0].outline, solid.sections[1].outline);
    assert.notDeepEqual(solid.sections[0].outline, original.sections[0].outline);
});

for (const kind of ['wall', 'ceiling']) test(`${kind}: black-dot edits remain in 2D even with depth slices saved by an older version`, t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), id = kind === 'wall' ? 'w1' : 'k1';
    const original = surfaceSolid(f.model.scene.studio, kind, id);
    const middle = { u: .37, outline: original.sections[0].outline.map((p, index) => index === 2 ? { ...p, y: p.y - 5 } : p) };
    f.model.scene.studio = replaceSurfaceSections(f.model.scene.studio, kind, id, [original.sections[0], middle, original.sections[1]]);
    f.editor.select({ kind, id }); f.renderer.build();
    const before = surfaceSolid(f.model.scene.studio, kind, id).sections;
    const controls = f.editor.handles(), h = controls.find(h => h.kind === (kind === 'wall' ? 'wall-point' : 'ceiling') && h.index === 2);
    assert.equal(controls.filter(p => p.kind === h.kind && p.index === h.index).length, 1);
    const node = f.nodes.labels.children.find(el => el.dataset.roomHandle === h.key);
    node.onpointerdown(f.event('touch')); node.onpointermove(f.event('touch', 0, 15)); node.onpointerup();
    const after = surfaceSolid(f.model.scene.studio, kind, id).sections;
    assert.equal(f.editor.handles().length, controls.length);
    assert.deepEqual(after.map(s => s.u), before.map(s => s.u), 'no travel into another depth plane');
    for (let k = 0; k < after.length; k++) close(after[k].outline[2].y - before[k].outline[2].y, -15);
});

function projection() {
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 10000);
    camera.position.set(470, 210, 580); camera.lookAt(0, 150, 30); camera.updateMatrixWorld();
    return p => { const q = new THREE.Vector3(p.x, p.y, p.z).project(camera); return { x: q.x * 400, y: -q.y * 400 }; };
}
test('a sharply returning 3D edge remains reachable even when its projection almost folds back on itself', () => {
    const outline = [{ t: 0, y: 100 }, { t: 100, y: 100 }, { t: .0001, y: 100.001 }, { t: 0, y: 200 }];
    const edges = solidEdges([{ u: 0, outline }, { u: 1, outline }]);
    const world = p => ({ x: p.t, y: p.y, z: p.u * 50 }), screen = p => ({ x: p.x + p.z * .2, y: p.y });
    const at = { edge: 1, fraction: .001, section: 1 }, expected = solidPoint(edges, at), cursor = createSolidBoundaryCursor(screen);
    cursor.move('fold', edges, world, screen(world(expected)), { edge: 0, fraction: .999, section: 1 });
    const actual = solidPoint(edges, cursor.location('fold'));
    close(actual.t, expected.t); close(actual.y, expected.y); close(actual.u, expected.u);
});
for (const shape of CEILING_SHAPES) test(`${shape.name}: outer edge turns through depth to the actual inner corner and continues on the wall-side rim`, () => {
    const room = addCeiling(rectangleStudio(400, 240), 'w1', shape.id), c = room.ceilings[0];
    const solid = surfaceSolid(room, 'ceiling', c.id), screen = projection(), cursor = createSolidBoundaryCursor(screen);
    const edge = 0, path = [
        [{ edge, fraction: .5, section: 1 }, { edge, fraction: 0, section: 1 }],
        [{ edge, fraction: 1, section: 0, across: true }, { edge, fraction: 0, section: 0, across: true }],
        [{ edge, fraction: 0, section: 0 }, { edge, fraction: 1, section: 0 }],
    ];
    let previous = path[0][0];
    for (const [a, b] of path) for (let n = 0; n <= 40; n++) {
        const at = { ...a, fraction: a.fraction + (b.fraction - a.fraction) * n / 40 }, expected = solidPoint(solid.edges, at);
        cursor.move(c.id, solid.edges, solid.world, screen(solid.world(expected)), previous);
        const chosen = cursor.location(c.id), actual = solidPoint(solid.edges, chosen);
        close(actual.t, expected.t, 'run'); close(actual.y, expected.y, 'height'); close(actual.u, expected.u, 'depth');
        previous = chosen;
    }
    assert.equal(cursor.location(c.id).section, 0);
});

test('every ring and depth edge of every room wall and ceiling shape is addressable in 3D', () => {
    const screen = projection();
    for (const template of STUDIO_TEMPLATES) {
        const room = createStudio(template.id);
        for (const w of room.walls) {
            const solids = [surfaceSolid(room, 'wall', w.id)];
            for (const shape of CEILING_SHAPES) {
                const next = addCeiling(room, w.id, shape.id);
                if (next) solids.push(surfaceSolid(next, 'ceiling', next.ceilings.at(-1).id));
            }
            for (const solid of solids.filter(Boolean)) for (const edge of solid.edges) for (const fraction of [0, .0001, .123456789, .5, .9999, 1]) {
                const at = { ...edge.location, fraction }, expected = interpolateSolid(edge.a, edge.b, fraction);
                const cursor = createSolidBoundaryCursor(screen);
                cursor.move('test', solid.edges, solid.world, screen(solid.world(expected)), at);
                const p = solidPoint(solid.edges, cursor.location('test'));
                close(p.t, expected.t); close(p.y, expected.y); close(p.u, expected.u);
            }
        }
    }
});

test('the ceiling cursor reaches the wall-side inner corner rather than remaining on its outer profile plane', () => {
    const room = addCeiling(rectangleStudio(400, 200), 'w1', 'landing'), c = room.ceilings[0];
    const solid = surfaceSolid(room, 'ceiling', c.id), screen = projection(), cursor = createCeilingSplitCursor(screen);
    const edge = 0, h = ceilingHandles(room, c, { edge, fraction: 0, section: 1 }).find(h => h.kind === 'ceiling-split');
    cursor.begin();
    for (let n = 0; n <= 100; n++) {
        const p = interpolateSolid(solid.sections[0].outline[edge] && { ...solid.sections[0].outline[edge], u: 1 },
            { ...solid.sections[0].outline[edge], u: 0 }, n / 100);
        const target = screen(solid.world(p)), origin = screen(h);
        cursor.move(room, h, target.x - origin.x, target.y - origin.y);
    }
    const located = ceilingHandles(room, c, cursor.location(c.id)).find(h => h.kind === 'ceiling-split');
    const inner = solid.world({ ...solid.sections[0].outline[edge], u: 0 });
    for (const axis of ['x', 'y', 'z']) close(located[axis], inner[axis], axis);
    assert.ok(Math.hypot(located.x - h.x, located.z - h.z) > 10, 'the cursor really moved through depth');
});

for (const kind of ['wall', 'ceiling']) test(`${kind}: a depth-edge location exposes one 2D corner without creating depth slices`, t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), id = kind === 'wall' ? 'w1' : 'k1';
    f.editor.select({ kind, id }); f.renderer.build();
    const before = f.editor.handles().filter(h => ['corner', 'wall-point', 'ceiling'].includes(h.kind));
    const edge = kind === 'wall' ? 2 : f.model.scene.studio.ceilings[0].profile.length;
    const at = { section: 0, edge, across: true, fraction: .37123456789 };
    const original = surfaceSolid(f.model.scene.studio, kind, id), expected = original.world(solidPoint(original.edges, at));
    const plus = f.editor.handles().find(h => h.kind === kind + '-split');
    f.editor.click({ ...plus, boundary: at });
    let room = f.model.scene.studio;
    const part = kind === 'wall' ? room.walls[0] : room.ceilings[0];
    assert.equal(part.sections, undefined);
    const handles = f.editor.handles().filter(h => ['corner', 'wall-point', 'ceiling'].includes(h.kind));
    assert.equal(handles.length, before.length + 1);
    const h = handles.find(h => h.kind === (kind === 'wall' ? 'wall-point' : 'ceiling') && h.index === edge);
    for (const axis of ['x', 'y', 'z']) close(h[axis], expected[axis]);
    assert.equal(splitSolidBoundary(room, kind, id, at), null, 'the same 2D corner cannot be duplicated at another depth');
    room = moveSurfaceBoundaryPoint(room, kind, id, edge, { t: part.outline[edge].t, y: part.outline[edge].y - 15 });
    assert.ok(room); assert.deepEqual(studioProblems(room), []);
    const solid = surfaceSolid(room, kind, id);
    assert.equal(solid.sections.length, 2); assert.deepEqual(solid.sections[0].outline, solid.sections[1].outline);
    f.model.scene.studio = room;
    const next = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('solid', 'Solid'), f.model.scene))));
    assert.deepEqual(next.studio, room);
});

test('a 2D ceiling bend changes the mesh and physical clearance uniformly across its depth', () => {
    let room = addCeiling(rectangleStudio(400, 240), 'w1', 'box');
    room = splitSolidBoundary(room, 'ceiling', room.ceilings[0].id, { edge: 0, section: 0, fraction: .5 });
    const c = room.ceilings[0], p = c.outline[1];
    room = moveSurfaceBoundaryPoint(room, 'ceiling', c.id, 1, { ...p, y: p.y - 30 });
    const scene = new THREE.Scene(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), line = new THREE.LineBasicMaterial();
    const view = createCeilingViews(scene, material, line); view.sync(room); scene.updateMatrixWorld(true);
    const meshes = []; scene.traverse(o => { if (o.userData.studioCeiling === c.id) meshes.push(o); });
    const fr = ceilingFrame(room, room.ceilings[0]);
    for (const u of [.15, .4, .7, .98]) {
        const floor = fr.at(p.t + 10, c.depth * u), top = { template: 'custom', top: [{ x: 0, y: 210 }, { x: 10, y: 210 }] };
        assert.equal(ceilingClearance(room, { x: floor.x, z: floor.z, angle: 0, w: 10, d: 1 })(top), true);
        const hits = new THREE.Raycaster(new THREE.Vector3(floor.x, 1, floor.z), new THREE.Vector3(0, 1, 0)).intersectObjects(meshes);
        assert.ok(hits.length); close(hits[0].point.y, ceilingAt(room, floor));
    }
    assert.equal(room.ceilings[0].sections, undefined);
    view.dispose(); material.dispose(); line.dispose();
});

test('doors and windows stay open through a wall with independent 3D corners', () => {
    const outline = [{ t: 0, y: 0 }, { t: 400, y: 0 }, { t: 400, y: 260 }, { t: 0, y: 260 }];
    const wall = { id: 'w1', a: 'a', b: 'b', height: 260, thickness: 12, sections: [{ u: 0, outline }, { u: .37, outline }, { u: 1, outline }] };
    const openings = [{ id: 'door', wall: 'w1', kind: 'door', offset: 80, width: 80, height: 205, sill: 0 },
        { id: 'window', wall: 'w1', kind: 'window', offset: 250, width: 80, height: 100, sill: 90 }];
    const geometry = wallSectionGeometry(wall, openings), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    const hits = (x, y) => new THREE.Raycaster(new THREE.Vector3(x, y, 100), new THREE.Vector3(0, 0, -1)).intersectObject(mesh).length;
    assert.equal(hits(80, 100), 0); assert.equal(hits(250, 140), 0); assert.ok(hits(150, 140));
    geometry.dispose(); material.dispose();
});

test('a return-edge control reshapes only the 2D profile with capture, cancellation and one-step undo', t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), before = f.model.snapshot();
    const h = f.editor.handles().find(h => h.kind === 'ceiling-split');
    f.editor.click({ ...h, boundary: { section: 0, edge: 4, across: true, fraction: .37 } });
    const split = f.model.snapshot(), part = f.model.scene.studio.ceilings[0];
    assert.equal(part.sections, undefined); assert.equal(f.checkpoints.length, 1);
    const node = f.nodes.labels.children.find(el => el.dataset.roomHandle === 'ceiling:k1:4');
    assert.ok(node); const y = part.outline[4].y;
    node.onpointerdown(f.event('touch'));
    for (const dy of [10, 20, 30]) {
        node.onpointermove(f.event('touch', 0, dy));
        assert.ok(node.hasPointerCapture(1)); assert.equal(f.model.scene.studio.ceilings[0].outline[4].y, y - dy);
    }
    node.onpointercancel(); assert.equal(f.model.snapshot(), split); assert.equal(f.checkpoints.length, 1);
    node.onpointerdown(f.event('touch')); node.onpointermove(f.event('touch', 0, 20)); node.onpointerup();
    assert.equal(f.checkpoints.length, 2);
    assert.ok(f.history.undo()); assert.equal(f.model.snapshot(), split);
    assert.ok(f.history.undo()); assert.equal(f.model.snapshot(), before);
});
