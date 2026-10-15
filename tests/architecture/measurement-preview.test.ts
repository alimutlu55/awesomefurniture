import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { createMeasurementPreview } from '../../src/application/commands/measurement-preview';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry';

function fixture() {
    const model = createEditorModel(), history = createSceneHistory(model.snapshot, model.restore);
    return { model, history, edit: createMeasurementPreview({ model, checkpoint: history.checkpoint }) };
}
test('shared item badge previews restore their origin, cancel exactly and commit one undo step', () => {
    const { model, history, edit } = fixture();
    model.activeCabinet().state.secs[0] = [{ k: 'drawer', h: 22 }];
    const ref = { kind: 'item-size', section: 0, index: 0, axis: 'h' } as const, before = model.snapshot();
    edit.begin(ref); assert.equal(edit.preview(8), 30); assert.equal(history.undoCount, 0);
    edit.preview(0); assert.equal(model.snapshot(), before);
    edit.preview(12); edit.finish(false); assert.equal(history.undoCount, 1);
    const after = model.snapshot(); history.undo(); assert.equal(model.snapshot(), before);
    history.redo(); assert.equal(model.snapshot(), after);
    edit.begin(ref); edit.preview(-5); edit.finish(true); assert.equal(model.snapshot(), after);
});
test('item gap badges stop at valid positions and reject missing targets', () => {
    const { model, edit } = fixture();
    model.activeCabinet().state.secs[0] = [{ k: 'drawer', h: 22 }];
    const ref = { kind: 'item-gap', section: 0, index: 0, side: 'bottom' } as const;
    edit.begin(ref); assert.equal(edit.preview(20), 20); edit.finish(false);
    edit.begin(ref); assert.ok(edit.preview(1000)! < 1000); edit.finish(false);
    const rules = createWardrobeGeometry(() => model.activeCabinet().state);
    assert.equal(rules.sectionLayoutValid(0), true);
    assert.equal(edit.read({ ...ref, index: 999 }), null);
});
test('shelf size and clearance use the same transaction and preserve fittings', () => {
    const { model, edit, history } = fixture(), state = model.activeCabinet().state;
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: 100, y: 100, area: { x0: 0, x1: 196.4, y0: 0, y1: 218.4 } }];
    const size = { kind: 'board-size', index: 0, axis: 'w' } as const;
    edit.begin(size); assert.equal(edit.preview(-10), 90); edit.finish(false);
    const gap = { kind: 'board-gap', index: 0, side: 'before' } as const, old = edit.read(gap)!;
    edit.begin(gap); assert.equal(edit.preview(10), old + 10); edit.finish(false);
    assert.equal(history.undoCount, 2);
    assert.ok(createWardrobeGeometry(() => model.activeCabinet().state).dividerValid(model.activeCabinet().state.dividers[0]!, 0));
});
test('wall badge works with an empty Studio, including cancel and undo', () => {
    const { model, edit, history } = fixture();
    model.scene.studio = rectangleStudio(300, 250); model.scene.wardrobes = []; model.scene.activeWardrobe = 0;
    const ref = { kind: 'studio', selection: 'wall', id: 'w1', field: 'length' } as const;
    const before = model.snapshot(), start = edit.read(ref)!;
    edit.begin(ref); assert.equal(edit.preview(20), start + 20); edit.finish(true); assert.equal(model.snapshot(), before);
    edit.begin(ref); assert.equal(edit.preview(-20), start - 20); edit.finish(false);
    assert.equal(history.undoCount, 1); history.undo(); assert.equal(model.snapshot(), before);
});
test('opening badges share width and wall-clearance validation without overlapping room ends', async () => {
    const { addOpening } = await import('../../src/domain/studio/studio-edit');
    const { model, edit } = fixture();
    model.scene.wardrobes = []; model.scene.activeWardrobe = 0;
    model.scene.studio = addOpening(rectangleStudio(300, 250), 'w1', 'door')!;
    const id = model.scene.studio.openings[0]!.id;
    const width = { kind: 'studio', selection: 'opening', id, field: 'width' } as const, start = edit.read(width)!;
    edit.begin(width); assert.equal(edit.preview(10), start + 10); edit.finish(false);
    const gap = { ...width, field: 'left' };
    edit.begin(gap); assert.ok(edit.preview(1000)! < 300); edit.finish(false);
    const right = edit.read({ ...width, field: 'right' })!; assert.ok(right >= 0);
});
test('ceiling height badge retains physical validation and cancellation', async () => {
    const { addCeiling } = await import('../../src/domain/studio/studio-ceiling');
    const { model, edit, history } = fixture();
    model.scene.wardrobes = []; model.scene.activeWardrobe = 0;
    model.scene.studio = addCeiling(rectangleStudio(300, 250), 'w1', 'slope')!;
    assert.ok(model.scene.studio);
    const id = model.scene.studio.ceilings![0]!.id, ref = { kind: 'studio', selection: 'ceiling', id, field: 'p0' } as const;
    const before = model.snapshot(), start = edit.read(ref)!;
    edit.begin(ref); assert.equal(edit.preview(-10), start - 10); edit.finish(true); assert.equal(model.snapshot(), before);
    edit.begin(ref); assert.equal(edit.preview(-10), start - 10); edit.finish(false); assert.equal(history.undoCount, 1);
    history.undo(); assert.equal(model.snapshot(), before);
});
test('reach badge follows profile limits and can be cancelled without a checkpoint', () => {
    const { model, edit, history } = fixture(), ref = { kind: 'reach' } as const;
    const before = model.snapshot();
    edit.begin(ref); assert.equal(edit.preview(1000), 210); edit.finish(true);
    assert.equal(model.snapshot(), before); assert.equal(history.undoCount, 0);
    model.activeCabinet().state.profile.accessible = true;
    const locked = edit.read(ref); edit.begin(ref); assert.equal(edit.preview(5), locked); assert.equal(edit.finish(false), false);
});
