const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bindSizeSlider, bindSizeNumber, sizeControlMarkup } = require('../src/presentation/editor/size-control.ts');
const { setInsideLength, setWallSize } = require('../src/domain/studio/studio-edit.ts');
const { wallFace } = require('../src/domain/studio/studio.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');

for (const cancel of [false, true]) for (const axis of ['length', 'height', 'thickness']) {
    test(`wall ${axis} shared slider ${cancel ? 'restores the original scene on cancel' : 'previews and commits one undo step'}`, t => {
        const f = roomRenderFixture(t, { wardrobes: 0 }), range = { handlers: {} };
        const before = f.model.snapshot();
        bindSizeSlider({ range, lifetime: { listen: (el, type, fn) => el.handlers[type] = fn }, model: f.model,
            history: { checkpoint: s => { f.checkpoints.push(s); f.history.checkpoint(s); } },
            preview: value => f.commands.editStudio(r => axis === 'length' ? setInsideLength(r, 'w1', value)
                : setWallSize(r, 'w1', { [axis]: value }), false, true),
            commit: () => f.commands.followCeilings(true), refresh() {} });
        const values = axis === 'length' ? [420, 440, 460] : axis === 'height' ? [245, 235, 225] : [14, 16, 18];
        for (const value of values) { range.valueAsNumber = value; range.handlers.input(); }
        const wall = f.model.scene.studio.walls.find(w => w.id === 'w1');
        assert.equal(axis === 'length' ? wallFace(f.model.scene.studio, wall).length : wall[axis], values.at(-1));
        assert.equal(f.checkpoints.length, 0);
        if (cancel) {
            range.handlers.pointercancel(); range.handlers.blur();
            assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
        } else {
            range.handlers.change(); range.handlers.blur();
            assert.equal(f.checkpoints.length, 1); assert.equal(f.history.undo(), true); assert.equal(f.model.snapshot(), before);
        }
    });
}

test('shared sizing numeric entry retains focus, change and Enter behavior', () => {
    const events = [], input = { valueAsNumber: 245, handlers: {}, blur() { this.handlers.blur(); } };
    bindSizeNumber({ input, lifetime: { listen: (el, type, fn) => el.handlers[type] = fn },
        commit: value => events.push(value), started: () => events.push('start'), finished: () => events.push('finish') });
    input.handlers.focus(); input.handlers.change(); input.handlers.keydown({ key: 'Enter' });
    assert.deepEqual(events, ['start', 245, 'finish']);
});

test('all shared sizing rows use the same numeric and range settings', () => {
    for (const label of ['Wardrobe width', 'Length', 'Height 1', 'Width']) {
        const html = sizeControlMarkup({ label, min: 30, max: 2000 });
        assert.match(html, /class="size-control resize-field-control"/);
        assert.match(html, /type="number".*min="30" max="2000" step="1"/);
        assert.match(html, /class="size-range" type="range" min="30" max="2000" step="1"/);
    }
});
