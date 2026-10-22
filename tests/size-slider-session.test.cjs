const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { createDesignCommands } = require('../src/application/commands/design-commands.ts');
const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');
const { createItemResize } = require('../src/presentation/editor/item-resize.js');
const { bindSizeSlider, syncSizeRange } = require('../src/presentation/editor/size-control.ts');
const { MODS } = require('../src/domain/wardrobe/catalog.js');

function fixture(kind = 'drawer') {
    const state = { ...createEditorState(), w: 123.6, n: 1, sel: 0, item: 0, divider: -1, doors: 'none' };
    state.secs[0] = [{ k: kind, h: MODS[kind].h, x: 30, y: 0, w: 60 }, { k: 'drawer', h: 22, x: 0, y: 0, w: 30 }];
    const model = createEditorModel({ wardrobes: [{ id: 1, name: 'W', x: 0, z: 0, y: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 });
    const geometry = createWardrobeGeometry(() => model.activeCabinet().state), commands = createDesignCommands(() => model.activeCabinet().state);
    const resize = createItemResize({ model, geometry, commands, inspector: { itemUI() {}, histUI() {} }, shellState: { G: {} } });
    const range = { min: '25', max: '90', value: '60', step: '.1', get valueAsNumber() { return Number(this.value); }, handlers: {} };
    const checkpoints = [], refresh = () => {
        const g = geometry.itemGeom(0, 0), edge = geometry.widthEdgeFor(g);
        const max = geometry.itemEdgeSize(g, edge, edge === 'left' ? -Infinity : Infinity, geometry.resizeObstacles(0), 0, geometry.itemMinW(state.secs[0][0]), 15, 200).w;
        syncSizeRange(range, '25', String(max), String(g.w));
    };
    bindSizeSlider({ range, model, history: { checkpoint: s => checkpoints.push(s) }, lifetime: { listen: (el, event, fn) => el.handlers[event] = fn },
        preview: value => resize.setManualItemSize('right', value, false), refresh });
    const emit = (event, value) => { if (value !== undefined) range.value = String(value); range.handlers[event](); };
    return { model, geometry, range, emit, checkpoints };
}

for (const kind of ['drawer', 'sdrawer', 'shelf', 'basket']) test(`${kind}: reversing the Size slider preserves its original anchor and contents`, () => {
    const f = fixture(kind), before = f.model.snapshot();
    f.emit('pointerdown');
    for (const width of [75, 90, 80, 60]) {
        f.emit('input', width);
        assert.equal(f.geometry.itemGeom(0, 0).w, width);
        assert.equal(f.geometry.itemGeom(0, 0).gapL, 30, 'reaching the right side cannot switch the resize anchor');
        assert.equal(f.range.max, '90', 'track scale stays fixed even when the preferred edge changes');
        assert.equal(Number(f.range.value), width);
    }
    f.emit('pointerup'); f.emit('change'); f.emit('blur');
    assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
    f.emit('input', 75); f.emit('pointerup'); f.emit('change');
    assert.equal(f.checkpoints.length, 1);
    f.model.restore(f.checkpoints[0]); assert.equal(f.model.snapshot(), before);
});

for (const ending of ['pointercancel', 'lostpointercapture']) test(`${ending} restores the original slider geometry and leaves the next gesture usable`, () => {
    const f = fixture(), before = f.model.snapshot();
    f.emit('pointerdown'); f.emit('input', 90); f.emit(ending); f.emit('blur');
    assert.equal(f.model.snapshot(), before); assert.equal(f.range.value, '60'); assert.equal(f.checkpoints.length, 0);
    f.emit('pointerdown'); f.emit('input', 80); f.emit('pointerup');
    assert.equal(f.geometry.itemGeom(0, 0).w, 80); assert.equal(f.checkpoints.length, 1);
});

test('a stationary slider press finishes even when no input or change event is emitted', () => {
    const f = fixture(), before = f.model.snapshot();
    f.emit('pointerdown'); f.emit('pointerup');
    f.emit('input', 75); f.emit('pointerup');
    assert.equal(f.checkpoints.length, 1); assert.equal(f.checkpoints[0], before);
});
