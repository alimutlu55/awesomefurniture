const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { createStudio } = require('../src/domain/studio/studio-templates.ts');
const { paintWalls, wallAppearance } = require('../src/domain/studio/studio-paint.ts');
const { splitWall } = require('../src/domain/studio/studio-edit.ts');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createSceneHistory } = require('../src/application/history/scene-history.ts');
const { createSceneCommands } = require('../src/application/commands/scene-commands.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { sceneToProject, projectToScene } = require('../src/application/projects/editor-mapper.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');

test('wall paint changes only the selected wall and preserves room geometry', () => {
    const room = createStudio('bedroom'), before = JSON.stringify(room);
    const next = paintWalls(room, 'w1', { color: '#9da995', finish: 'satin' });
    assert.equal(JSON.stringify(room), before);
    assert.equal(next.walls[1], room.walls[1]);
    assert.deepEqual(wallAppearance(next.walls[0]), { color: '#9da995', finish: 'satin' });
    assert.equal(next.corners, room.corners);
    assert.equal(next.openings, room.openings);
});

test('Apply to all walls changes every wall, while no-op and invalid choices leave the room untouched', () => {
    const room = createStudio('bedroom');
    const next = paintWalls(room, 'w1', { color: '#637380', finish: 'eggshell' }, true);
    assert.ok(next.walls.every(w => w.color === '#637380' && w.finish === 'eggshell'));
    assert.equal(paintWalls(next, 'w1', { color: '#637380' }, true), null);
    assert.equal(paintWalls(room, 'missing', { color: '#637380' }, true), null);
    assert.equal(paintWalls(room, 'w1', { color: 'bad' }), null);
    assert.equal(paintWalls(room, 'w1', { finish: 'bad' }), null);
});

test('split walls retain the selected paint and surface finish', () => {
    const room = paintWalls(createStudio('bedroom'), 'w1', { color: '#c7aaa0', finish: 'satin' });
    const next = splitWall(room, 'w1');
    assert.equal(next.walls.filter(w => w.color === '#c7aaa0' && w.finish === 'satin').length, 2);
});

test('paint survives save/reopen and legacy wall data still uses the existing default appearance', () => {
    const model = createEditorModel();
    model.scene.studio = paintWalls(createStudio('bedroom'), 'w1', { color: '#9da995', finish: 'eggshell' });
    const project = sceneToProject(createProject('paint', 'Paint'), model.scene);
    const reopened = projectToScene(deserializeProject(serializeProject(project)));
    assert.deepEqual(reopened.studio, model.scene.studio);
    assert.deepEqual(wallAppearance(reopened.studio.walls[1]), { color: '#e2d9cc', finish: 'matte' });
    const invalid = structuredClone(project); invalid.studio.walls[0].color = 'invalid';
    assert.throws(() => serializeProject(invalid));
});

test('painting supports Undo/Redo without changing wardrobe dimensions or contents', () => {
    const model = createEditorModel(); model.scene.studio = createStudio('bedroom'); model.activeCabinet().z = 36;
    const before = model.snapshot(), wardrobe = JSON.stringify(model.activeCabinet());
    const history = createSceneHistory(model.snapshot, model.restore);
    const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.checkpoint() });
    commands.editStudio(room => paintWalls(room, 'w1', { color: '#9da995' }, true));
    assert.equal(JSON.stringify(model.activeCabinet()), wardrobe);
    assert.equal(history.undoCount, 1);
    history.undo(); assert.equal(model.snapshot(), before);
    history.redo(); assert.ok(model.scene.studio.walls.every(w => w.color === '#9da995'));
});

test('the renderer applies per-wall color and sheen, including ceilings attached to that wall', t => {
    const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
    const f = roomRenderFixture(t, { wardrobes: 0 });
    const { createStudioRenderer } = require('../src/presentation/viewport/studio-renderer.ts');
    const scene = new THREE.Scene(), renderer = createStudioRenderer(scene);
    t.after(() => renderer.dispose());
    renderer.sync(paintWalls(f.model.scene.studio, 'w1', { color: '#9da995', finish: 'satin' }));
    const surfaces = [];
    scene.traverse(o => { if (o.isMesh && (o.geometry.type === 'ExtrudeGeometry')) surfaces.push(o); });
    const wall = surfaces.find(o => o.userData.studioWall === 'w1');
    const ceiling = surfaces.find(o => o.userData.studioCeiling === 'k1');
    const expected = new THREE.Color('#9da995').convertSRGBToLinear();
    assert.ok(wall.material.color.equals(expected));
    assert.equal(wall.material.roughness, .35);
    assert.ok(ceiling.material.color.equals(expected));
    assert.ok(ceiling.material.emissive.equals(expected));
});
