const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mountResizeFields } = require('../src/presentation/editor/resize-fields.js');
const { createStudioResizePanel } = require('../src/presentation/editor/studio-resize-panel.ts');
const { moveCeilingPoint } = require('../src/domain/studio/studio-ceiling.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');

function node() {
    const classes = new Set();
    return { hidden: true, setAttribute() {}, getRootNode: () => ({querySelectorAll: () => []}), dataset: {}, children: [], handlers: {}, classList: { add: (...xs) => xs.forEach(x => classes.add(x)),
        remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x) },
        append(...xs) { this.children.push(...xs); }, replaceWith() {}, closest() { return this.label; } };
}
for (const cancel of [false, true]) test(`shared ceiling sizing slider ${cancel ? 'cancels atomically' : 'commits its previews as one undo step'}`, t => {
    const f = roomRenderFixture(t), input = node(), label = node(); input.label = label;
    let control; label.replaceWith = next => control = next;
    mountResizeFields({ dom: { document: { createElement: node } }, fields: [{ input, axis: 'height' }], model: f.model,
        lifetime: { listen: (el, event, fn) => el.handlers[event] = fn },
        history: { checkpoint: s => { f.checkpoints.push(s); f.history.checkpoint(s); } },
        preview: (_input, value) => f.commands.editStudio(room => moveCeilingPoint(room, 'k1', 1, room.ceilings[0].profile[1].t, value), false, true),
        commit: () => f.commands.followCeilings(true), refresh() {} });
    const before = f.model.snapshot(), range = control.children[1];
    for (const value of [185, 165, 145]) { range.valueAsNumber = value; range.handlers.input(); }
    assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, 145);
    assert.equal(f.checkpoints.length, 0); assert.equal(f.model.activeCabinet().state.shape.template, 'room');
    if (cancel) {
        range.handlers.pointercancel(); range.handlers.blur();
        assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
    } else {
        range.handlers.change(); range.handlers.blur();
        assert.equal(f.checkpoints.length, 1); assert.equal(f.history.undo(), true); assert.equal(f.model.snapshot(), before);
    }
});

test('ceiling sizing takes the existing wardrobe panel, reuses its section and releases it on selection change', () => {
    const nodes = {}, dom = { width: 1280, $: key => nodes[key] ??= node(), document: { createElement: node } };
    let selection = { kind: 'ceiling', id: 'k1' }, renders = 0, frames = 0;
    const fields = { root: node(), render: () => renders++ };
    const panel = createStudioResizePanel({ dom, fields, selection: () => selection, prepare() {}, frame: () => frames++ });
    assert.equal(dom.$('#left-body').children.length, 0, 'the ceiling does not add content to the wardrobe panel until opened');
    panel.open(); panel.open();
    assert.equal(dom.$('#left-body').children.length, 1); assert.equal(dom.$('#left-body').children[0].children[1], fields.root);
    assert.equal(dom.$('#left').dataset.contextSection, 'resize'); assert.equal(dom.$('#left').dataset.roomResize, '');
    assert.equal(dom.$('#app').classList.contains('props-open'), true); assert.equal(renders, 2);
    assert.equal(frames, 0, 'opening Size preserves the current camera view');
    selection = null; panel.sync();
    assert.equal(dom.$('#left').dataset.roomResize, undefined); assert.equal(dom.$('#app').classList.contains('props-open'), false);
    selection = { kind: 'ceiling', id: 'k1' }; panel.open(); selection = { kind: 'wall', id: 'w1' }; panel.sync();
    assert.equal(dom.$('#app').classList.contains('props-open'), true);
    assert.equal(dom.$('#left').dataset.roomResize, '', 'switching from a ceiling to a wall keeps the same sizing host');
});

test('wall paint reuses the same editing drawer without creating a popover', () => {
    const nodes = {}, dom = { width: 1280, $: key => nodes[key] ??= node(), document: { createElement: node } };
    let selection = { kind: 'wall', id: 'w1' }, renders = 0;
    const paint = { root: node(), render: () => renders++ };
    const panel = createStudioResizePanel({ dom, fields: { root: node(), render() {} }, paint,
        selection: () => selection, prepare() {}, frame() {} });
    panel.openPaint(); panel.openPaint();
    assert.equal(dom.$('#left-body').children.length, 1);
    assert.equal(dom.$('#left-body').children[0].children[1], paint.root);
    assert.equal(dom.$('#left').dataset.contextSection, 'wall-paint');
    assert.equal(dom.$('#left').dataset.sheetPosition, 'compact');
    assert.equal(dom.$('#app').classList.contains('props-open'), true);
    assert.equal(renders, 2);
    selection = null; panel.sync();
    assert.equal(dom.$('#app').classList.contains('props-open'), false);
});
