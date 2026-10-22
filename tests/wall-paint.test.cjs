const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { createStudio } = require('../src/domain/studio/studio-templates.ts');
const { paintWalls, wallAppearance } = require('../src/domain/studio/studio-paint.ts');
const { splitWall, moveWall } = require('../src/domain/studio/studio-edit.ts');
const { createCabinetGeometry } = require('../src/domain/geometry/cabinet-geometry.js');
const { studioObstacles } = require('../src/domain/studio/studio-obstacles.ts');
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

for (const all of [false, true]) test(`paint and sheen work behind overlapping furniture (${all ? 'all walls' : 'selected wall'})`, () => {
    const model = createEditorModel(); model.scene.studio = createStudio('bedroom');
    const collision = createCabinetGeometry(() => [], () => studioObstacles(model.scene.studio));
    assert.equal(collision.cabinetCollides(model.activeCabinet()), true, 'reproduce an existing wall overlap');
    const before = model.snapshot(), wardrobe = JSON.stringify(model.activeCabinet()), messages = [];
    const history = createSceneHistory(model.snapshot, model.restore);
    const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.checkpoint(), report: m => messages.push(m) });
    assert.equal(commands.editStudio(room => paintWalls(room, 'w1', { color: '#637380' }, all)), true);
    assert.equal(commands.editStudio(room => paintWalls(room, 'w1', { finish: 'satin' }, all)), true);
    const painted = model.scene.studio.walls.filter(w => w.color === '#637380' && w.finish === 'satin');
    assert.equal(painted.length, all ? model.scene.studio.walls.length : 1);
    assert.equal(JSON.stringify(model.activeCabinet()), wardrobe);
    assert.deepEqual(messages, []);
    assert.equal(history.undoCount, 2);
    history.undo(); assert.equal(wallAppearance(model.scene.studio.walls[0]).finish, 'matte');
    history.undo(); assert.equal(model.snapshot(), before);
    history.redo(); history.redo(); assert.equal(wallAppearance(model.scene.studio.walls[0]).finish, 'satin');
    assert.equal(commands.editStudio(room => paintWalls(room, 'w1', { finish: 'satin' }, all)), false);
    assert.equal(history.undoCount, 2, 'unchanged paint adds no history');
    const snapshot = model.snapshot();
    assert.equal(commands.editStudio(room => paintWalls(moveWall(room, 'w1', 40), 'w1', { color: '#c7aaa0' }, all)), false);
    assert.match(messages.at(-1), /wardrobe is in the way/, 'paint cannot bypass collision checks on a wall move');
    assert.equal(model.snapshot(), snapshot);
    assert.equal(commands.editStudio(room => ({ ...room, walls: room.walls.map(w => ({ ...w, color: 'bad' })) })), false);
    assert.match(messages.at(-1), /valid wall paint/);
    assert.equal(history.undoCount, 2);
});

test('painting under a ceiling never refits furniture or changes its contents', () => {
    const model = createEditorModel(); model.scene.studio = createStudio('under-stairs'); model.activeCabinet().z = 36;
    const before = JSON.stringify(model.activeCabinet());
    const commands = createSceneCommands(() => model.scene);
    assert.equal(commands.editStudio(room => paintWalls(room, 'w1', { color: '#637380' })), true);
    assert.equal(JSON.stringify(model.activeCabinet()), before);
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

test('deleting the last wall clears its floor and supports rendering a new first wall', t => {
    const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
    roomRenderFixture(t, { wardrobes: 0 });
    const { createStudioRenderer } = require('../src/presentation/viewport/studio-renderer.ts');
    const { removeWall } = require('../src/domain/studio/studio-edit.ts');
    const renderer = createStudioRenderer(new THREE.Scene()), wall = createStudio('wall');
    t.after(() => renderer.dispose());
    renderer.sync(wall); assert.ok(renderer.pickables().length > 0);
    assert.doesNotThrow(() => renderer.sync(removeWall(wall, 'w1')));
    assert.equal(renderer.pickables().length, 0);
    assert.doesNotThrow(() => renderer.sync(wall)); assert.ok(renderer.pickables().length > 0);
});
