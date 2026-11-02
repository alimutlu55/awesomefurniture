const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createViewModes } = require('../src/presentation/editor/view-modes.ts');
const { createSelectionState } = require('../src/presentation/editor/selection-state.js');

test('a fresh editor starts in Wardrobe mode without an object selection', () => {
    const state = createSelectionState();
    assert.equal(state.viewMode, 'furniture');
    assert.equal(state.focusOn, false);
    assert.equal(state.room, null);
});

test('switching spatial modes clears editing selection and frames the correct scope without opening settings', () => {
    const selectionState = createSelectionState(), calls = [], classes = new Set(['props-open']);
    selectionState.viewMode = 'studio';
    const buttons = ['studio', 'furniture'].map(mode => ({ dataset: { viewMode: mode }, setAttribute(k, v) { this[k] = v; } }));
    const app = { dataset: {}, classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) } };
    const wizard = { hidden: true }, switcher = { querySelectorAll: () => buttons };
    const modes = createViewModes({
        dom: { $: id => ({ '#app': app, '#view-modes': switcher, '#wizard': wizard })[id] }, selectionState,
        camera: { frameScene: () => calls.push('room'), frameWardrobe: () => calls.push('wardrobe') },
        inspector: { clearFocus() { selectionState.focusOn = false; calls.push('clear'); }, update: () => calls.push('update') },
        shell: { closeDD: () => calls.push('close menus') }, planner: { closeWizard: () => calls.push('close wizard') },
        lifetime: { listen() {} },
    });
    modes.sync();
    assert.equal(classes.has('props-hidden'), false, 'Studio refresh must not hide an open room drawer');
    selectionState.room = { kind: 'wall', id: 'w1' };
    selectionState.pendingStudioAction = 'door';
    selectionState.focusOn = true;
    modes.change('furniture');
    assert.equal(selectionState.room, null);
    assert.equal(selectionState.pendingStudioAction, null);
    assert.equal(selectionState.focusOn, false);
    assert.equal(app.dataset.viewMode, 'furniture');
    assert.deepEqual(buttons.map(b => b['aria-pressed']), ['false', 'true']);
    assert.equal(classes.has('props-open'), false);
    assert.equal(classes.has('props-hidden'), true);
    assert.deepEqual(calls, ['close menus', 'clear', 'update', 'room'], 'Furniture shows the whole scene, as far away as Studio');
    modes.change('furniture');
    assert.equal(calls.length, 4, 'reselecting the current mode does not reset the camera');
    wizard.hidden = false;
    modes.change('studio');
    assert.deepEqual(calls.slice(4), ['close menus', 'close wizard', 'clear', 'update', 'room']);
    assert.deepEqual(buttons.map(b => b['aria-pressed']), ['true', 'false']);
});

test('2D belongs only to Studio and closes when switching to Furniture', () => {
    const selectionState = createSelectionState(), formats = [], classes = new Set();
    const app = { dataset: {}, classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) } };
    const modes = createViewModes({
        dom: { $: id => ({ '#app': app, '#view-modes': { querySelectorAll: () => [] }, '#wizard': { hidden: true } })[id] },
        selectionState, camera: { frameScene() {} }, inspector: { clearFocus() {}, update() {} },
        shell: { closeDD() {} }, planner: { closeWizard() {} }, lifetime: { listen() {} },
        onStudioFormatChange: format => formats.push(format),
    });
    modes.change('studio');
    modes.setStudioFormat('2d');
    assert.equal(app.dataset.studioView, '2d');
    modes.change('furniture');
    assert.equal(selectionState.studioView, '3d');
    assert.equal(app.dataset.studioView, '3d');
    assert.equal(formats.at(-1), '3d', 'tells the planner to close instead of merely reframing the camera');
    const count = formats.length;
    modes.setStudioFormat('2d');
    assert.equal(formats.length, count, 'cannot activate hidden Studio tools from Furniture mode');
    assert.equal(selectionState.studioView, '3d');
    modes.change('studio');
    assert.equal(selectionState.studioView, '3d', 'Studio returns in 3D until 2D is selected');
    modes.setStudioFormat('2d');
    selectionState.viewMode = 'furniture';
    modes.sync();
    assert.equal(app.dataset.studioView, '3d', 'other furniture-selection flows also clear the 2D format');
});
