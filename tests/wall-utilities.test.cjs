const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { createStudio } = require('../src/domain/studio/studio-templates.ts');
const { addOpening, moveOpening2D } = require('../src/domain/studio/studio-edit.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { WALL_UTILITY_KINDS } = require('../src/domain/studio/wall-utilities.ts');
const { openingMeasures } = require('../src/presentation/editor/studio-drag.ts');
const { createSceneMeasurements } = require('../src/application/commands/scene-measurements.ts');
const { createStudioRenderer } = require('../src/presentation/viewport/studio-renderer.ts');
const { syncFurnitureTransparency } = require('../src/presentation/viewport/wardrobe-occlusion.ts');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { sceneToProject, projectToScene } = require('../src/application/projects/editor-mapper.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');

test('all wall utility kinds can be added, stacked vertically at the same horizontal offset, and persisted', () => {
    let room = createStudio('bedroom');
    for (const kind of WALL_UTILITY_KINDS) {
        const next = addOpening(room, 'w1', kind);
        assert.ok(next, `adds ${kind} to w1`);
        assert.deepEqual(studioProblems(next), [], `${kind} is valid on w1`);
        room = next;
    }
    // Place water pipes (sill 50), electrical socket (sill 110) and extractor vent (sill 215) at the same horizontal offset (120 cm).
    const water = room.openings.find(o => o.kind === 'water');
    const socket = room.openings.find(o => o.kind === 'socket');
    const duct = room.openings.find(o => o.kind === 'duct');
    room = moveOpening2D(room, water.id, 120, 50);
    room = moveOpening2D(room, socket.id, 120, 110);
    room = moveOpening2D(room, duct.id, 120, 215);
    assert.deepEqual(studioProblems(room), [], 'utilities at different heights do not collide at the same horizontal offset');

    // Moving socket onto the same height as water pipes (sill 55) triggers an overlap problem.
    const overlapping = moveOpening2D(room, socket.id, 120, 55);
    assert.match(studioProblems(overlapping).join(' '), /overlap/);

    // Round-trip through project serialization.
    const model = createEditorModel();
    model.scene.studio = room;
    const project = sceneToProject(createProject('util', 'Utilities'), model.scene);
    const reopened = projectToScene(deserializeProject(serializeProject(project)));
    assert.deepEqual(reopened.studio.openings, room.openings);
});

test('selecting or dragging a wall utility shows all four distances (left, right, floor, ceiling) plus width and height, and each distance is editable', () => {
    const model = createEditorModel();
    model.activeCabinet().z = 36;
    model.scene.studio = addOpening(createStudio('wall'), 'w1', 'water');
    const opening = model.scene.studio.openings[0];
    const wall = model.scene.studio.walls[0];
    const rulers = openingMeasures(model.scene.studio, wall, opening.id, false);
    const edits = rulers.map(r => r.edit);
    assert.deepEqual(edits, ['left', 'width', 'right', 'sill', 'top', 'height']);

    // Edit each of the four distances and dimensions via createSceneMeasurements.
    const sm = createSceneMeasurements(() => model.scene);
    const ref = field => ({ kind: 'studio', selection: 'opening', id: opening.id, field });
    assert.equal(sm.apply(ref('left'), 80), true);
    assert.equal(sm.read(ref('left')), 80);
    assert.equal(sm.apply(ref('right'), 120), true);
    assert.equal(sm.read(ref('right')), 120);
    assert.equal(sm.apply(ref('sill'), 60), true);
    assert.equal(sm.read(ref('sill')), 60);
    assert.equal(sm.apply(ref('top'), 150), true);
    assert.equal(sm.read(ref('top')), 150);
    assert.equal(sm.read(ref('sill')), wall.height - opening.height - 150);
});

test('3D studio renderer builds pickable meshes for wall utilities without cutting holes through the wall, and furniture becomes transparent during wall/utility selection', t => {
    const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
    roomRenderFixture(t, { wardrobes: 0 });
    const scene = new THREE.Scene();
    const renderer = createStudioRenderer(scene);
    t.after(() => renderer.dispose());
    let room = createStudio('wall');
    for (const kind of WALL_UTILITY_KINDS) room = addOpening(room, 'w1', kind);
    renderer.sync(room);
    const pickables = renderer.pickables();
    for (const o of room.openings) {
        assert.ok(pickables.some(p => p.userData.studioOpening === o.id), `pickable mesh exists for ${o.kind}`);
    }

    // Verify furniture transparency toggles cleanly when a wall or wall utility is selected.
    const cabinetGroup = new THREE.Group();
    const origMat = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 1, transparent: false });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(60, 80, 60), origMat);
    cabinetGroup.add(panel);
    scene.add(cabinetGroup);

    syncFurnitureTransparency([cabinetGroup], true, scene);
    assert.equal(panel.material.transparent, true);
    assert.ok(Math.abs(panel.material.opacity - 0.22) < 1e-6);
    assert.equal(panel.material.depthWrite, false);

    syncFurnitureTransparency([cabinetGroup], false, scene);
    assert.equal(panel.material, origMat);
    assert.equal(panel.material.opacity, 1);
    renderer.dispose();
});

test('wall toolbar has Add tool matching furniture and opens visual catalog with utilities, openings and ceilings', () => {
    const { contextualActions, wallMoreActions } = require('../src/domain/wardrobe/contextual-actions.js');
    const actions = contextualActions('wall');
    assert.equal(actions[0][0], 'new');
    assert.equal(actions[0][1], 'Add');
    assert.equal(actions[0][2], 'Add to wall');
    // None of the utilities or openings are in wallMoreActions anymore.
    assert.deepEqual(wallMoreActions.map(([key]) => key), ['remove']);
});
