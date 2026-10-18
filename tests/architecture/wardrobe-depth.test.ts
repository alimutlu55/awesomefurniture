import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createTactileEdits } from '../../src/application/commands/tactile-edits';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';

test('wardrobe depth reaches 15 cm, clamps smaller requests and preserves the 90 cm maximum', () => {
    const model = createEditorModel(), commands = createSceneCommands(() => model.scene);
    assert.equal(commands.setCabinetSize('d', 15), true); assert.equal(model.activeCabinet().state.d, 15);
    assert.equal(commands.setCabinetSize('d', 14), false); assert.equal(model.activeCabinet().state.d, 15);
    commands.setCabinetSize('d', 100); assert.equal(model.activeCabinet().state.d, 90);
});
test('shallow depth previews never leave incompatible fittings and cancellation/undo restore them', () => {
    const model = createEditorModel(), history = createSceneHistory(model.snapshot, model.restore);
    model.activeCabinet().state.secs[0] = [{ k: 'short', h: 106 }, { k: 'drawer', h: 22 }];
    const before = model.snapshot(), edit = createTactileEdits({ model, checkpoint: history.checkpoint });
    edit.beginDimension('d'); assert.equal(edit.previewDimension(-100), 15);
    assert.equal(model.activeCabinet().state.secs[0]!.length, 0);
    edit.finish(true); assert.equal(model.snapshot(), before); assert.equal(history.undoCount, 0);
    edit.beginDimension('d'); edit.previewDimension(-45); edit.finish(); assert.equal(history.undoCount, 1);
    history.undo(); assert.equal(model.snapshot(), before);
});
test('15 cm depth imports and round trips; undersized specs are rejected', () => {
    const spec = (depth: number) => parseDesignSpec({ specVersion: 1, wardrobes: [{ width: 100, depth }] });
    const built = buildFromSpec(spec(15), 'shallow'); assert.ok(built.ok);
    const reopened = projectToScene(deserializeProject(serializeProject(built.project)));
    assert.ok(reopened); assert.equal(reopened.wardrobes[0]!.state.d, 15);
    assert.equal(buildFromSpec(spec(14.9), 'too-shallow').ok, false);
});
test('Studio creation accepts an explicit 15 cm cabinet and searches below the former 35 cm floor', () => {
    for (const explicit of [true, false]) {
        const model = createEditorModel(); model.scene.studio = rectangleStudio(200, explicit ? 65 : 30);
        model.scene.wardrobes = []; model.scene.activeWardrobe = 0;
        const added = createSceneCommands(() => model.scene).addCabinet(false, undefined, 'w1', { w: 100, ...(explicit ? { d: 15 } : {}) });
        assert.ok(added); assert.ok(added.state.d >= 15 && added.state.d <= (explicit ? 15 : 30));
    }
});

test('creation without a Studio also enforces the 15 cm minimum without consuming an identity', () => {
    const model = createEditorModel(), commands = createSceneCommands(() => model.scene);
    const before = model.snapshot();
    assert.equal(commands.addCabinet(false, undefined, undefined, { d: 14 }), null);
    assert.equal(model.snapshot(), before);
    assert.equal(commands.addCabinet(false, undefined, undefined, { d: 15 })?.state.d, 15);
});
