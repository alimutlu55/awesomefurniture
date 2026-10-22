import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createCabinetSizeRange } from '../../src/application/commands/cabinet-size-range';
import { createTactileEdits } from '../../src/application/commands/tactile-edits';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';

test('an empty wardrobe resizes to 20 cm and clamps smaller requests, with a 600 cm maximum', () => {
    const model = createEditorModel(), commands = createSceneCommands(() => model.scene);
    assert.equal(createCabinetSizeRange(() => model.scene)()!.w[0], 20);
    assert.equal(commands.setCabinetSize('w', 20), true); assert.equal(model.activeCabinet().state.w, 20);
    assert.equal(commands.setCabinetSize('w', 19), false); assert.equal(model.activeCabinet().state.w, 20);
    commands.setCabinetSize('w', 700); assert.equal(model.activeCabinet().state.w, 600);
});

test('20 cm width previews support cancel and one-step undo', () => {
    const model = createEditorModel(), history = createSceneHistory(model.snapshot, model.restore);
    const before = model.snapshot(), edit = createTactileEdits({ model, checkpoint: history.checkpoint });
    edit.beginDimension('w'); assert.equal(edit.previewDimension(-300), 20);
    edit.finish(true); assert.equal(model.snapshot(), before); assert.equal(history.undoCount, 0);
    edit.beginDimension('w'); edit.previewDimension(-180); edit.finish(); assert.equal(history.undoCount, 1);
    history.undo(); assert.equal(model.snapshot(), before);
});

test('existing fittings keep their minimum clear width when the carcass minimum is 20 cm', () => {
    const model = createEditorModel(), commands = createSceneCommands(() => model.scene);
    model.activeCabinet().state.secs[0] = [{ k: 'short', h: 106 }];
    commands.setCabinetSize('w', 20);
    assert.equal(model.activeCabinet().state.w, 48.6, '45 cm rail plus two 18 mm sides');
    assert.equal(model.activeCabinet().state.secs[0]!.length, 1);
});

test('20 cm specifications import and survive save/reload; undersized specifications are rejected', () => {
    const spec = (width: number) => parseDesignSpec({ specVersion: 1, wardrobes: [{ width }] });
    const built = buildFromSpec(spec(20), 'narrow'); assert.ok(built.ok);
    const reopened = projectToScene(deserializeProject(serializeProject(built.project)));
    assert.ok(reopened); assert.equal(reopened.wardrobes[0]!.state.w, 20); assert.equal(reopened.wardrobes[0]!.state.n, 1);
    assert.equal(buildFromSpec(spec(19.9), 'too-narrow').ok, false);
});

test('creation on an open floor enforces 20 cm without consuming an identity on failure', () => {
    const model = createEditorModel(), commands = createSceneCommands(() => model.scene);
    const before = model.snapshot();
    assert.equal(commands.addCabinet(false, undefined, undefined, { w: 19.9 }), null);
    assert.equal(model.snapshot(), before);
    assert.equal(commands.addCabinet(false, undefined, undefined, { w: 20 })?.state.w, 20);
});

test('studio creation accepts an exact 20 cm width and adapts defaults to a 20 cm wall', () => {
    for (const explicit of [true, false]) {
        const model = createEditorModel({ wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio: rectangleStudio(20, 100) });
        const added = createSceneCommands(() => model.scene).addCabinet(false, undefined, 'w1', explicit ? { w: 20 } : {});
        assert.ok(added); assert.equal(added.state.w, 20); assert.equal(added.state.n, 1);
    }
});
