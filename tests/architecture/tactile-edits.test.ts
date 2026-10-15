import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createTactileEdits } from '../../src/application/commands/tactile-edits';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry';
import { changeAccordionShelf } from '../../src/application/commands/accordion-shelves';

function fixture() {
    const model = createEditorModel(), history = createSceneHistory(model.snapshot, model.restore);
    return { model, history, edits: createTactileEdits({ model, checkpoint: history.checkpoint }) };
}
test('dimension scrubbing previews live, reverses without drift, commits once and cancels atomically', () => {
    const { model, history, edits } = fixture(), before = model.snapshot();
    edits.beginDimension('w'); assert.equal(edits.previewDimension(20), 220); assert.equal(history.undoCount, 0);
    edits.previewDimension(0); assert.equal(model.snapshot(), before);
    edits.previewDimension(35); assert.equal(edits.finish(), true); assert.equal(history.undoCount, 1);
    const after = model.snapshot(); history.undo(); assert.equal(model.snapshot(), before);
    history.redo(); assert.equal(model.snapshot(), after);
    edits.beginDimension('d'); edits.previewDimension(15); edits.finish(true); assert.equal(model.snapshot(), after);
    assert.equal(history.undoCount, 1);
});
test('scrubbing stops at a studio wall and stays there instead of resetting to the original width', () => {
    const f = fixture(); f.model.scene.studio = rectangleStudio(220, 115);
    f.model.scene.wardrobes = []; f.model.scene.activeWardrobe = 0;
    assert.ok(createSceneCommands(() => f.model.scene).addCabinet(false, undefined, 'w1', { w: 200, from: 10 }));
    f.edits.beginDimension('w'); const value = f.edits.previewDimension(100)!;
    assert.ok(value > 200 && value <= 220);
    assert.equal(f.edits.previewDimension(200), value);
    const collision = createCabinetGeometry(() => f.model.scene.wardrobes, () => studioObstacles(f.model.scene.studio));
    assert.equal(collision.cabinetCollides(f.model.activeCabinet()), false); f.edits.finish();
    assert.equal(f.history.undoCount, 1);
});
test('each stepped height badge edits its own edge while the other edge and rear retain their heights', () => {
    const f = fixture(), state = f.model.activeCabinet().state;
    state.shape = { template: 'sloped', top: [{ x: 0, y: 205 }, { x: 200, y: 141 }], back: [210, 150] }; state.h = 210;
    f.edits.beginDimension('h-right'); assert.equal(f.edits.previewDimension(10), 151); f.edits.finish();
    const shape = f.model.activeCabinet().state.shape!;
    assert.deepEqual(shape.top.map(p => p.y), [205, 151]); assert.deepEqual(shape.back, [210, 150]);
});
test('accordion adds several valid shelves, reverses, cancels and records the whole gesture once', () => {
    const f = fixture(), before = f.model.snapshot();
    f.edits.beginShelves(0, 80, 110); assert.equal(f.edits.previewShelves(3), 3);
    assert.equal(f.model.activeCabinet().state.dividers.length, 3); assert.equal(f.history.undoCount, 0);
    const rules = createWardrobeGeometry(() => f.model.activeCabinet().state);
    assert.ok(f.model.activeCabinet().state.dividers.every((d, k) => rules.dividerValid(d, k)));
    f.edits.previewShelves(0); assert.equal(f.model.snapshot(), before);
    f.edits.previewShelves(2); f.edits.finish(); assert.equal(f.history.undoCount, 1);
    const after = f.model.snapshot(); f.history.undo(); assert.equal(f.model.snapshot(), before);
    f.history.redo(); assert.equal(f.model.snapshot(), after);
    f.edits.beginShelves(0, 80, 110); assert.equal(f.edits.previewShelves(-1), -1);
    f.edits.finish(true); assert.equal(f.model.snapshot(), after);
});
test('shelf edits preserve other sections, fittings and their positions, and stop below sloped ceilings', () => {
    const f = fixture(), state = f.model.activeCabinet().state;
    state.n = 2; state.wt = [1, 1, 1, 1, 1, 1]; state.secs[0] = [{ k: 'shelf', h: 45 }];
    state.shape = { template: 'sloped', top: [{ x: 0, y: 180 }, { x: 200, y: 80 }] }; state.h = 180;
    const items = structuredClone(state.secs), rules = createWardrobeGeometry(() => state), layout = JSON.stringify(rules.computeLayout(0));
    for (let n = 0; n < 10; n++) changeAccordionShelf(state, 0, 30, 100, 1);
    assert.deepEqual(state.secs, items); assert.equal(JSON.stringify(rules.computeLayout(0)), layout);
    assert.ok(state.dividers.every((d, k) => d.i === 0 && rules.dividerValid(d, k)));
    assert.equal(changeAccordionShelf(state, 1, 500, 100, 1), false);
});
test('an accordion in another visible wardrobe edits that wardrobe and undo restores the previous selection', () => {
    const f = fixture(), second = structuredClone(f.model.activeCabinet()); second.id = 2; second.x = 250;
    f.model.scene.wardrobes.push(second); const before = f.model.snapshot();
    f.edits.beginShelves(0, 50, 100, 2); f.edits.previewShelves(2); f.edits.finish();
    assert.equal(f.model.scene.wardrobes[0]!.state.dividers.length, 0);
    assert.equal(f.model.scene.wardrobes[1]!.state.dividers.length, 2);
    assert.equal(f.model.scene.activeWardrobe, 2);
    f.history.undo(); assert.equal(f.model.snapshot(), before);
    f.edits.beginShelves(0, 50, 100, 2); f.edits.previewShelves(1); f.edits.finish(true);
    assert.equal(f.model.snapshot(), before);
    f.edits.beginShelves(0, 50, 100, 2); assert.equal(f.edits.finish(), false);
    assert.equal(f.model.snapshot(), before); assert.equal(f.history.undoCount, 0);
});
