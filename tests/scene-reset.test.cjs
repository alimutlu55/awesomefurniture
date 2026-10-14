const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createSceneCommands } = require('../src/application/commands/scene-commands.ts');
const { createSceneHistory } = require('../src/application/history/scene-history.ts');
const { createStudio } = require('../src/domain/studio/studio-templates.ts');
const { addCeiling } = require('../src/domain/studio/studio-ceiling.ts');

test('Reset everything restores the default scene and Undo restores the complete previous design', () => {
    const model = createEditorModel();
    model.scene.studio = addCeiling(createStudio('bedroom'), 'w1', 'slope');
    const cabinet = structuredClone(model.activeCabinet());
    cabinet.id = 2; cabinet.name = 'Custom wardrobe'; cabinet.x = 250;
    cabinet.state.fin = 'Walnut'; cabinet.state.w = 120; cabinet.state.doors = 'hinged';
    model.scene.wardrobes.push(cabinet);
    model.scene.activeWardrobe = 2; model.scene.nextWardrobeId = 3;
    const before = model.snapshot();
    const history = createSceneHistory(model.snapshot, model.restore);
    const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.checkpoint() });
    commands.resetScene();
    assert.deepEqual(model.scene, createEditorModel().scene);
    assert.equal(history.undoCount, 1);
    assert.ok(history.undo());
    assert.equal(model.snapshot(), before);
    assert.ok(history.redo());
    assert.equal(model.scene.studio, undefined);
    assert.equal(model.scene.wardrobes.length, 1);
    assert.equal(model.activeCabinet().name, 'Wardrobe 1');
});

test('Reset everything also restores the default wardrobe from an empty room', () => {
    const model = createEditorModel({ studio: createStudio('bedroom'), wardrobes: [], activeWardrobe: 0, nextWardrobeId: 8 });
    createSceneCommands(() => model.scene).resetScene();
    assert.deepEqual(model.scene, createEditorModel().scene);
});
