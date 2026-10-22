const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { boundaryPoint, boundaryLengths, advanceBoundary, validBoundary } = require('../src/domain/geometry/boundary.ts');
const { wallBoundary, ceilingBoundary, splitSurfaceBoundary, moveSurfaceBoundaryPoint } = require('../src/domain/studio/studio-boundary.ts');
const { createBoundaryCursor, projectBoundary } = require('../src/presentation/editor/boundary-cursor.ts');
const { ceilingFrame, addCeiling, setCeilingDepth, flipCeiling, ceilingAt } = require('../src/domain/studio/studio-ceiling.ts');
const { setInsideLength, setWallSize, splitWall } = require('../src/domain/studio/studio-edit.ts');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { createStudioRenderer } = require('../src/presentation/viewport/studio-renderer.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { sceneToProject, projectToScene } = require('../src/application/projects/editor-mapper.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≠ ${b}`);
const screen = p => ({ x: p.x + p.z * .4, y: -p.y + p.z * .3 });
const world = p => ({ x: p.t, y: p.y, z: 30 + p.t * .2 });
const irregular = [{ t: 0, y: 0 }, { t: 80, y: 0 }, { t: 80, y: 90 }, { t: 42, y: 90 },
    { t: 42, y: 38 }, { t: 41.999, y: 38 }, { t: 20, y: 70 }, { t: 0, y: 60 }];

for (const perspective of [false, true]) test(`every fraction, corner and tiny edge of a concave boundary is reachable (${perspective ? 'perspective' : 'orthographic'})`, () => {
    const project = perspective ? p => ({ x: p.x * 650 / (p.z + 450), y: -p.y * 650 / (p.z + 450) }) : screen;
    assert.ok(validBoundary(irregular));
    const cursor = createBoundaryCursor(project);
    for (let edge = 0; edge < irregular.length; edge++) for (let n = 0; n <= 100; n++) {
        const expected = boundaryPoint(irregular, { edge, fraction: n / 100 });
        cursor.move('shape', irregular, world, project(world(expected)));
        const actual = cursor.point('shape', irregular);
        close(actual.t, expected.t); close(actual.y, expected.y);
    }
    const expected = boundaryPoint(irregular, { edge: 0, fraction: .1234567890123 });
    const at = projectBoundary(irregular, world, project, project(world(expected)));
    close(boundaryPoint(irregular, at).t, expected.t, 1e-9);
});

test('nearby remote edges cannot steal a continuous drag across a narrow recess', () => {
    const points = [{ t: 0, y: 0 }, { t: 100, y: 0 }, { t: 100, y: 100 }, { t: 51, y: 100 },
        { t: 51, y: 10 }, { t: 50, y: 10 }, { t: 50, y: 100 }, { t: 0, y: 100 }];
    const flat = p => ({ x: p.t, y: p.y, z: 0 }), view = p => ({ x: p.x, y: p.y });
    const at = projectBoundary(points, flat, view, { x: 50, y: 60 }, { edge: 3, fraction: 4 / 9 });
    assert.equal(at.edge, 3, 'moving 1 px sideways cannot teleport 100 px around the notch');
    close(boundaryPoint(points, at).t, 51); close(boundaryPoint(points, at).y, 60);
});

test('keyboard movement follows the perimeter through corners and wraps without endpoint dead zones', () => {
    const points = [{ t: 0, y: 0 }, { t: 100, y: 0 }, { t: 100, y: 30 }, { t: 0, y: 30 }];
    assert.deepEqual(boundaryPoint(points, advanceBoundary(points, { edge: 0, fraction: .995 }, 1)), { t: 100, y: .5 });
    assert.deepEqual(boundaryPoint(points, advanceBoundary(points, { edge: 3, fraction: 1 }, .25)), { t: .25, y: 0 });
    assert.deepEqual(boundaryPoint(points, advanceBoundary(points, { edge: 0, fraction: 0 }, -.25)), { t: 0, y: .25 });
});

for (const kind of ['wall', 'ceiling']) for (const pointerType of ['mouse', 'touch']) {
    test(`${pointerType}: ${kind} plus traverses every edge without editing, preserves capture, cancels and inserts precisely`, t => {
        const f = roomRenderFixture(t, { width: pointerType === 'touch' ? 375 : 1280, wardrobes: 0 });
        if (kind === 'wall') f.editor.select({ kind, id: 'w1' });
        else f.model.scene.studio.ceilings[0].profile = [{ t: 6, y: 205 }, { t: 40, y: 205 }, { t: 40, y: 100 }, { t: 40.001, y: 100 }, { t: 406, y: 140 }];
        f.renderer.build();
        const before = f.model.snapshot(), room = f.model.scene.studio;
        const points = kind === 'wall' ? wallBoundary(room, room.walls[0]) : ceilingBoundary(room, room.ceilings[0]);
        const split = () => f.editor.handles().find(h => h.kind === kind + '-split');
        const node = () => f.nodes.labels.children.find(el => el.getAttribute('aria-label')?.startsWith('Add a ' + kind + ' shape point'));
        const initial = split(), plus = node();
        const fr = kind === 'ceiling' && ceilingFrame(room, room.ceilings[0]);
        const toWorld = p => kind === 'ceiling' ? { ...fr.at(p.t, room.ceilings[0].depth), y: p.y }
            : { x: room.corners[0].x + p.t, y: p.y, z: room.corners[0].z + room.walls[0].thickness / 2 };
        const origin = screen(initial);
        plus.onpointerdown(f.event(pointerType));
        for (let offset = 0; offset < points.length; offset++) {
            const edge = (initial.boundary.edge + offset) % points.length;
            const start = offset ? 0 : initial.boundary.fraction;
            for (let n = 0; n <= 20; n++) {
                const expected = boundaryPoint(points, { edge, fraction: start + (1 - start) * n / 20 });
                const target = screen(toWorld(expected));
                plus.onpointermove(f.event(pointerType, target.x - origin.x, target.y - origin.y));
                const actual = split();
                for (const axis of ['x', 'y', 'z']) close(actual[axis], toWorld(expected)[axis]);
                assert.equal(plus.hasPointerCapture(1), true); assert.equal(node(), plus);
            }
        }
        plus.onpointercancel();
        assert.deepEqual(split(), initial); assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
        const edge = initial.boundary.edge, expected = boundaryPoint(points, { edge, fraction: .123456789 });
        const target = screen(toWorld(expected));
        plus.onpointerdown(f.event(pointerType));
        plus.onpointermove(f.event(pointerType, target.x - origin.x, target.y - origin.y)); plus.onpointerup();
        const chosen = split();
        close(chosen.position, expected.t); close(chosen.y, expected.y);
        node().onclick({ detail: 0 });
        const outline = kind === 'wall' ? f.model.scene.studio.walls[0].outline : f.model.scene.studio.ceilings[0].outline;
        close(outline[edge + 1].t, expected.t); close(outline[edge + 1].y, expected.y);
        assert.deepEqual(studioProblems(f.model.scene.studio), []); assert.equal(f.checkpoints.length, 1);
        assert.ok(f.history.undo()); assert.equal(f.model.snapshot(), before);
    });
}

test('vertical, short and closing ceiling edges accept exact cuts and existing corners remain unchanged', () => {
    let room = addCeiling(rectangleStudio(400, 200), 'w1', 'box');
    room.ceilings[0].profile = [{ t: 6, y: 200 }, { t: 50, y: 200 }, { t: 50, y: 100 }, { t: 50.001, y: 100 }, { t: 406, y: 100 }];
    const points = ceilingBoundary(room, room.ceilings[0]);
    for (const edge of [1, 2, points.length - 1]) {
        const at = { edge, fraction: .123456789 }, expected = boundaryPoint(points, at);
        const next = splitSurfaceBoundary(room, 'ceiling', room.ceilings[0].id, at);
        assert.deepEqual(next.ceilings[0].outline[edge + 1], expected); assert.deepEqual(studioProblems(next), []);
    }
    for (const fraction of [0, 1]) assert.equal(splitSurfaceBoundary(room, 'ceiling', room.ceilings[0].id, { edge: 1, fraction }), null);
});

test('closing-corner controls appear only after an explicit cut and remain editable', t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), c = f.model.scene.studio.ceilings[0];
    assert.ok(f.editor.handles().every(h => h.kind !== 'ceiling' || h.index < c.profile.length));
    f.editor.click(f.editor.handles().find(h => h.kind === 'ceiling-split'));
    const outline = f.model.scene.studio.ceilings[0].outline;
    const h = f.editor.handles().find(h => h.kind === 'ceiling' && h.index === outline.length - 1);
    assert.ok(h); assert.equal(f.editor.nudge(h, 'ArrowDown', false), true);
    assert.equal(f.model.scene.studio.ceilings[0].outline[h.index].y, h.y - 1);
    assert.equal(f.checkpoints.length, 2);
});

test('undoing a custom outline never strands its cursor on an edge that no longer exists', t => {
    const f = roomRenderFixture(t, { wardrobes: 0 });
    let room = f.model.scene.studio;
    for (let k = 0; k < 10; k++) room = splitSurfaceBoundary(room, 'ceiling', 'k1', { edge: 0, fraction: .5 });
    f.model.scene.studio = room; f.renderer.build();
    let h = f.editor.handles().find(h => h.kind === 'ceiling-split');
    for (let k = 0; k < 150; k++) {
        f.editor.nudge(h, 'ArrowRight', true);
        h = f.editor.handles().find(h => h.kind === 'ceiling-split');
        if (h.boundary.edge > 10) break;
    }
    assert.ok(h.boundary.edge > 10);
    f.model.scene.studio = rectangleStudio(400, 160);
    f.model.scene.studio = addCeiling(f.model.scene.studio, 'w1', 'box'); f.renderer.build();
    assert.ok(f.editor.handles().find(h => h.kind === 'ceiling-split'));
});

test('custom wall and ceiling cuts reshape real meshes and round-trip through project persistence', t => {
    const f = roomRenderFixture(t, { wardrobes: 0 });
    let room = splitSurfaceBoundary(f.model.scene.studio, 'wall', 'w1', { edge: 2, fraction: .5 });
    room = moveSurfaceBoundaryPoint(room, 'wall', 'w1', 3, { t: 206, y: 190 });
    const c = room.ceilings[0], points = ceilingBoundary(room, c), edge = points.length - 1;
    room = splitSurfaceBoundary(room, 'ceiling', c.id, { edge, fraction: .123456789 });
    room = moveSurfaceBoundaryPoint(room, 'ceiling', c.id, edge + 1, { t: 12, y: 230 });
    assert.deepEqual(studioProblems(room), []);
    f.model.scene.studio = room;
    const reopened = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('boundary', 'Boundary'), f.model.scene))));
    assert.deepEqual(reopened.studio, room);
    const scene = new THREE.Scene(), renderer = createStudioRenderer(scene); t.after(() => renderer.dispose());
    renderer.sync(room); scene.updateMatrixWorld(true);
    const wall = []; scene.traverse(o => { if (o.userData.studioWall === 'w1' && o.type === 'Mesh') wall.push(o); });
    const ray = y => new THREE.Raycaster(new THREE.Vector3(0, y, 100), new THREE.Vector3(0, 0, -1)).intersectObjects(wall).length;
    assert.ok(ray(150)); assert.equal(ray(240), 0, 'the reshaped wall is actually cut, not just decorated with a moved dot');
    const first = ceilingAt(room, { x: -190, z: 30 });
    const stretched = setCeilingDepth(room, c.id, 100), flipped = flipCeiling(stretched, c.id);
    assert.deepEqual(studioProblems(flipped), []);
    assert.notEqual(first, undefined);
    assert.deepEqual(boundaryLengths(stretched.ceilings[0].outline), boundaryLengths(room.ceilings[0].outline));
    assert.deepEqual(studioProblems(setWallSize(room, 'w1', { height: 300 })), []);
    assert.deepEqual(studioProblems(setInsideLength(room, 'w1', 500)), []);
    assert.deepEqual(studioProblems(splitWall(room, 'w1', 220)), []);
});
