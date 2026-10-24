const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { ceilingAt, ceilingFrame, addCeiling } = require('../src/domain/studio/studio-ceiling.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { liftCeilingOuterEdge, liftWholeCeiling, outerEdgeHeight } = require('../src/domain/studio/ceiling-edge.ts');
const { tiltedCeilingGeometry } = require('../src/presentation/viewport/tilted-ceiling-geometry.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
const { createSceneMeasurements } = require('../src/application/commands/scene-measurements.ts');
const { ceilingClearance } = require('../src/domain/studio/studio-clearance.ts');
const { regularShape, resolveShape } = require('../src/domain/wardrobe/shape/wardrobe-shape.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');

function room(profile = [{ t: 30, y: 180 }, { t: 370, y: 220 }]) {
    return { ...rectangleStudio(400, 250), ceilings: [{ id: 'k1', wall: 'w1', run: 'along', depth: 100, profile }] };
}

test('outer-edge lift keeps the wall profile fixed and varies linearly into the room', () => {
    const before = room(), next = liftCeilingOuterEdge(before, 'k1', 30), c = next.ceilings[0], fr = ceilingFrame(next, c);
    assert.deepEqual(c.profile, before.ceilings[0].profile);
    assert.equal(before.ceilings[0].edgeRise, undefined);
    assert.deepEqual(next.walls, before.walls);
    for (const d of [0, 25, 50, 100]) assert.equal(ceilingAt(next, fr.at(200, d)), 200 + 30 * d / 100);
    assert.deepEqual(studioProblems(next), []);
    assert.deepEqual(ceilingAt(liftCeilingOuterEdge(next, 'k1', -30), fr.at(200, 50)), 200);
});

test('an across-room roof pivots about its existing wall attachment', () => {
    const before = addCeiling(rectangleStudio(400, 250), 'w1', 'slope');
    const c = before.ceilings[0], next = liftCeilingOuterEdge(before, c.id, -30).ceilings[0];
    assert.deepEqual(next.profile[0], c.profile[0]);
    assert.equal(next.profile.at(-1).y, c.profile.at(-1).y - 30);
    assert.equal(next.depth, c.depth);
});

for (const rise of [-50, 30, 70]) test(`rendered underside matches physical clearance for a ${rise} cm outer-edge lift`, () => {
    const before = room([{ t: 30, y: 160 }, { t: 160, y: 260 }, { t: 160, y: 200 }, { t: 370, y: 240 }]);
    const next = liftCeilingOuterEdge(before, 'k1', rise), c = next.ceilings[0], fr = ceilingFrame(next, c);
    assert.deepEqual(studioProblems(next), []);
    const geometry = tiltedCeilingGeometry(c, 260), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.updateMatrixWorld();
    const positions = geometry.getAttribute('position');
    for (let k = 0; k < positions.count; k++) {
        assert.ok(Number.isFinite(positions.getX(k)) && Number.isFinite(positions.getY(k)) && Number.isFinite(positions.getZ(k)));
        assert.ok(positions.getY(k) <= 260 + 1e-5);
    }
    for (const s of [40, 100, 155, 165, 240, 350]) for (const d of [1, 25, 75, 99]) {
        const expected = ceilingAt(next, fr.at(s, d));
        const hits = new THREE.Raycaster(new THREE.Vector3(s, 0, d), new THREE.Vector3(0, 1, 0)).intersectObject(mesh);
        if (expected < 260 - .001) {
            assert.ok(hits.length > 0, `solid at ${s},${d}`);
            assert.ok(Math.abs(hits[0].point.y - expected) < .001, `underside at ${s},${d}`);
        } else assert.equal(hits.length, 0, 'the raised underside ends where it meets the top');
    }
    geometry.dispose(); material.dispose();
});

test('clearance checks both the fixed wall edge and the tilted room edge', () => {
    for (const rise of [-40, 40]) {
        const studio = liftCeilingOuterEdge(room([{ t: 30, y: 200 }, { t: 370, y: 200 }]), 'k1', rise);
        const fr = ceilingFrame(studio, studio.ceilings[0]), at = fr.at(200, 50);
        const blocked = ceilingClearance(studio, { ...at, angle: 0, w: 40, d: 40 });
        const lowest = 200 + rise * (rise < 0 ? .7 : .3);
        assert.equal(blocked(regularShape(40, lowest)), false);
        assert.equal(blocked(regularShape(40, lowest + 2)), true);
    }
});

test('outer-edge adjustments and whole-ceiling moves remain distinct and survive saving', () => {
    const tilted = liftCeilingOuterEdge(room(), 'k1', 25), next = liftWholeCeiling(tilted, 'k1', 10);
    assert.equal(next.ceilings[0].edgeRise, 25);
    next.ceilings[0].profile.forEach((p, k) => assert.equal(p.y, tilted.ceilings[0].profile[k].y + 10));
    const project = { ...createProject('edge-test', 'Tilted ceiling'), studio: next };
    assert.deepEqual(deserializeProject(serializeProject(project)), project);
});

for (const [width, pointerType] of [[1280, 'mouse'], [375, 'touch']]) {
    test(`${pointerType}: dedicated lift grip anchors the wall, refits furniture, and commits once with undo/redo`, t => {
        const f = roomRenderFixture(t, { width }), before = f.model.snapshot();
        const attached = structuredClone(f.model.scene.studio.ceilings[0].profile);
        const button = f.nodes.labels.children.find(el => el.getAttribute('aria-label')?.startsWith('Lift outer edge.'));
        assert.ok(button);
        button.onpointerdown(f.event(pointerType));
        for (const y of [-10, -20, -30]) {
            button.onpointermove(f.event(pointerType, 0, y));
            assert.equal(button.hasPointerCapture(1), true);
            assert.deepEqual(f.model.scene.studio.ceilings[0].profile, attached);
            assert.equal(f.model.scene.studio.ceilings[0].edgeRise, -y);
            assert.equal(f.checkpoints.length, 0);
            for (const c of f.model.scene.wardrobes) assert.equal(ceilingClearance(f.model.scene.studio, { ...c, w: c.state.w, d: c.state.d })(resolveShape(c.state)), false);
        }
        button.onpointerup(); const after = f.model.snapshot();
        assert.equal(f.checkpoints.length, 1);
        f.history.undo(); assert.equal(f.model.snapshot(), before);
        f.history.redo(); assert.equal(f.model.snapshot(), after);
        f.renderer.build();
        const current = f.nodes.labels.children.find(el => el.getAttribute('aria-label')?.startsWith('Lift outer edge.'));
        current.onpointerdown(f.event(pointerType)); current.onpointermove(f.event(pointerType, 0, 20)); current.onpointercancel();
        assert.equal(f.model.snapshot(), after);
    });
}

test('typing outer edge height uses the anchored operation and point dimensions reflect the new visible height', t => {
    const f = roomRenderFixture(t, { wardrobes: 0 }), measurements = createSceneMeasurements(() => f.model.scene);
    const ref = { kind: 'studio', selection: 'ceiling', id: 'k1', field: 'outer' }, before = structuredClone(f.model.scene.studio.ceilings[0].profile);
    const height = measurements.read(ref);
    assert.equal(measurements.apply(ref, height + 25), true);
    assert.deepEqual(f.model.scene.studio.ceilings[0].profile, before);
    assert.equal(measurements.read(ref), height + 25);
    assert.equal(measurements.read({ ...ref, field: 'p0' }), before[0].y + 25);
});
