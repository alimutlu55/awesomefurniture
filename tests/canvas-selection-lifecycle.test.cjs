const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { createDesignCommands } = require('../src/application/commands/design-commands.ts');
const { createSceneCommands } = require('../src/application/commands/scene-commands.ts');
const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');
const { createCabinetGeometry } = require('../src/domain/geometry/cabinet-geometry.js');
const { createEditorGestures } = require('../src/presentation/editor/editor-gestures.js');
const { createInteractionState } = require('../src/presentation/editor/interaction-state.js');
const { createSelectionState } = require('../src/presentation/editor/selection-state.js');
const bindings = require('../src/presentation/editor/bindings/canvas.js');
const { MODS } = require('../src/domain/wardrobe/catalog.js');

/** Real selection and drag implementations, with a deterministic picking boundary and DOM pointer capture. */
function fixture(width = 375) {
    const design = createEditorState();
    design.n = 1; design.w = 100; design.secs = [[{ k: 'shelf', h: 30, y: 0, x: 0, w: 96.4 }]];
    design.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: 96.4, y: 100 }];
    const model = createEditorModel({ wardrobes: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 0, angle: 0, state: design }], activeWardrobe: 1, nextWardrobeId: 2 });
    const state = () => model.activeCabinet().state;
    model.snapshot(); // Assign stable identities before measuring cancellation against the original design.
    const selectionState = createSelectionState(), interactionState = createInteractionState();
    Object.assign(selectionState, { focusOn: true, deep: true }); state().divider = 0;
    const nodes = new Map(), node = () => {
        const classes = new Set();
        return { dataset: {}, style: {}, matches: () => false, querySelector: () => null,
            classList: { contains: k => classes.has(k), add: (...ks) => ks.forEach(k => classes.add(k)), remove: (...ks) => ks.forEach(k => classes.delete(k)) } };
    };
    const windowEvents = {}, handlers = new Map(), captures = new Set(), lost = new Set();
    const cv = { ...node(), focus() {}, setPointerCapture: id => { captures.add(id); lost.delete(id); },
        hasPointerCapture: id => captures.has(id), releasePointerCapture: id => { captures.delete(id); lost.add(id); } };
    const dom = { width, window: windowEvents, $: id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, matchMedia: () => ({ matches: true }) };
    const lifetime = { listen(target, name, fn) { const key = (target === cv ? 'canvas:' : 'window:') + name; handlers.set(key, [...(handlers.get(key) ?? []), fn]); } };
    const group = new THREE.Group(), bay = new THREE.Mesh(), divider = new THREE.Mesh(new THREE.BoxGeometry(96.4, 5, 60)), fitting = new THREE.Mesh();
    bay.userData = { wardrobe: 1, i: 0 }; divider.userData = { wardrobe: 1, i: 0, divider: 0 }; fitting.userData = { wardrobe: 1, i: 0, j: 0 }; group.add(bay, divider, fitting);
    const renderState = { Gr: group, allHits: [bay], hits: [bay], allItemHits: [divider, fitting], ihits: [divider, fitting], wardrobeGroups: [group], outs: [] };
    const picking = { cast: (e, arr) => (e.zone === 'fitting' && arr.includes(fitting) ? { object: fitting } : e.zone === 'divider' && arr.includes(divider) ? { object: divider } : ['bay', 'divider', 'fitting'].includes(e.zone) && arr.includes(bay) ? { object: bay } : undefined),
        pieceAt: e => e.zone === 'frame' ? 1 : undefined, hitAt: () => -1,
        frontPoint: e => new THREE.Vector3(e.clientX, e.clientY, 0), groundPoint: e => new THREE.Vector3(e.clientX, 0, e.clientY), screenPoint: p => ({ x: p.x, y: p.z - p.y }) };
    const cameraState = { tgt: new THREE.Vector3(), vs: 0, vz: 1, el: .4 };
    const camera = { camRelease() {}, moveViewOff() {}, frameMobileInspector() {}, frameScene() {}, panBy() {} };
    let panel = '#pop4';
    const reset = () => { Object.assign(state(), { item: -1, divider: -1, space: null }); selectionState.deep = selectionState.pillOn = false; panel = null; };
    const inspector = { inside: () => selectionState.deep || state().item >= 0 || state().divider >= 0, update() {}, histUI() {}, movementUI() {}, reopenItemPanel() {},
        hidePop: () => { panel = null; }, showPop: (_e, id) => { panel = id; },
        selectSpaceAt: (i, p) => { state().space = { i, x: p.x, y: p.y }; },
        selectCabinet: () => { reset(); selectionState.focusOn = true; }, clearFocus: () => { reset(); selectionState.focusOn = false; } };
    const rendering = { holdOverlay() {}, clearPreview() {}, wallGuide() {}, assist() {}, build() {}, refreshDividerVisual() {} };
    const geometry = createWardrobeGeometry(state), checkpoints = [];
    const interactions = createEditorGestures({ dom, camera, rendering, inspector, picking, model, cameraState, interactionState, renderState, selectionState,
        geometry, cabinetGeometry: createCabinetGeometry(() => model.scene.wardrobes), commands: createDesignCommands(state),
        sceneCommands: createSceneCommands(() => model.scene), resources: { cv }, history: { checkpoint: s => checkpoints.push(s) } });
    const ports = { dom, camera, rendering, inspector, picking, model, geometry, cameraState, interactionState, renderState, selectionState, interactions,
        resources: { cv }, lifetime, touch: { release() {}, stopFollowing() {}, followEdge() {}, pinch() {}, turn() {} }, shell: { toast() {} } };
    for (const bind of [bindings.bindCanvasPointerdown, bindings.bindCanvasPointermove, bindings.bindCanvasPointerup,
        bindings.bindCanvasPointercancel, bindings.bindCanvasLostpointercapture, bindings.bindCanvasGestureBlur, bindings.bindCanvasGestureEscape]) bind(ports);
    const event = (id, zone, pointerType = 'touch') => ({ pointerId: id, pointerType, button: 0, clientX: id * 50, clientY: 100, zone, timeStamp: id * 1000,
        preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} });
    const emit = (name, e) => {
        const surface = ['blur', 'keydown'].includes(name) ? 'window:' : 'canvas:';
        for (const fn of handlers.get(surface + name) ?? []) fn(e);
        if (surface === 'canvas:' && name !== 'lostpointercapture') for (const fn of handlers.get('window:' + name) ?? []) fn(e);
        for (const id of [...lost]) { lost.delete(id); for (const fn of handlers.get('canvas:lostpointercapture') ?? []) fn({ pointerId: id }); }
    };
    const tap = (id, zone = 'background', type = 'touch') => { const e = event(id, zone, type); emit('pointerdown', e); emit('pointerup', e); };
    return { state, model, fitting, picking, selectionState, interactionState, interactions, cv, emit, event, tap, captures, checkpoints, get panel() { return panel; } };
}

for (const width of [375, 1280]) for (const selected of ['item', 'divider']) {
    test(`${width}px: clicking the same wardrobe's frame releases its ${selected} and its editing panel`, () => {
        const f = fixture(width);
        Object.assign(f.state(), { item: selected === 'item' ? 0 : -1, divider: selected === 'divider' ? 0 : -1, space: { i: 0, x: 20, y: 30 } });
        f.tap(1, 'frame', width === 375 ? 'touch' : 'mouse');
        assert.equal(f.state().item, -1); assert.equal(f.state().divider, -1); assert.equal(f.state().space, null);
        assert.equal(f.selectionState.deep, false); assert.equal(f.selectionState.focusOn, true); assert.equal(f.panel, null);
    });
}

for (const zone of ['background', 'bay']) test(`a finger tap with natural movement still ${zone === 'background' ? 'clears selection' : 'selects the empty bay'}`, () => {
    const f = fixture(), e = f.event(1, zone);
    f.emit('pointerdown', e);
    f.emit('pointermove', { ...e, clientX: e.clientX + 6, clientY: e.clientY + 2 });
    f.emit('pointerup', { ...e, clientX: e.clientX + 6, clientY: e.clientY + 2 });
    assert.equal(f.selectionState.focusOn, zone !== 'background');
    assert.equal(f.state().divider, -1);
    assert.equal(f.state().item, -1);
    assert.equal(f.panel, null);
});

test('a small finger movement on a whole selected wardrobe selects its space without moving furniture', () => {
    const f = fixture(), e = f.event(1, 'bay');
    const cast = f.picking.cast;
    f.picking.cast = (event, hits) => { const hit = cast(event, hits); return hit && { ...hit, point: new THREE.Vector3(0, 140, 30) }; };
    Object.assign(f.selectionState, { deep: false }); f.state().divider = -1;
    const pose = { x: f.model.activeCabinet().x, z: f.model.activeCabinet().z };
    f.emit('pointerdown', e); assert.ok(f.interactionState.wardrobeGesture);
    const release = { ...e, clientX: e.clientX + 6, clientY: e.clientY + 2 };
    f.emit('pointermove', release); f.emit('pointerup', release);
    assert.equal(f.selectionState.deep, true);
    assert.equal(f.interactionState.wardrobeGesture, null);
    assert.equal(f.model.activeCabinet().x, pose.x); assert.equal(f.model.activeCabinet().z, pose.z);
    assert.equal(f.checkpoints.length, 0);
});

for (const order of [[1, 2], [2, 1]]) test(`a second finger on a selected divider yields to pinch and drains pointers in order ${order}`, () => {
    const f = fixture(), before = f.state().dividers.map(d => ({ ...d }));
    const a = f.event(1, 'divider'), b = f.event(2, 'background');
    f.emit('pointerdown', a); assert.ok(f.interactionState.dividerGesture);
    f.emit('pointerdown', b);
    assert.equal(f.interactionState.dividerGesture, null, 'a second finger takes over from divider movement');
    assert.equal(f.interactionState.ptrs.size, 2, 'both live fingers belong to the camera');
    for (const id of order) f.emit('pointerup', id === 1 ? a : b);
    assert.equal(f.interactionState.ptrs.size, 0); assert.equal(f.captures.size, 0);
    assert.deepEqual(f.state().dividers, before); assert.equal(f.checkpoints.length, 0);
    f.tap(3);
    assert.equal(f.selectionState.focusOn, false, 'the next background tap releases the selection');
    assert.equal(f.state().divider, -1);
});

for (const ending of ['pointercancel', 'lostpointercapture', 'blur']) test(`${ending} during a divider press drains the gesture and the next click works`, () => {
    const f = fixture(), e = f.event(1, 'divider'); f.emit('pointerdown', e);
    if (ending === 'lostpointercapture') f.cv.releasePointerCapture(1);
    f.emit(ending, e);
    assert.equal(f.interactionState.dividerGesture, null);
    assert.equal(f.interactionState.ptrs.size, 0); assert.equal(f.captures.size, 0);
    f.tap(2);
    assert.equal(f.selectionState.focusOn, false);
});

test('a cancelled click finishing rotation cannot swallow the next background click', () => {
    const f = fixture();
    // A rotation begun from the toolbar is finished by the next press on the canvas.
    f.interactionState.rotationGesture = { id: 1, original: 0, from: { x: 0, z: 0 } };
    const e = f.event(1, 'background'); f.emit('pointerdown', e); f.emit('pointercancel', e);
    f.tap(2);
    assert.equal(f.selectionState.focusOn, false);
});

for (const ending of ['pointercancel', 'lostpointercapture', 'blur', 'Escape']) test(`${ending} rolls back a moved divider and drains the old release`, () => {
    const f = fixture(), before = f.state().dividers.map(d => ({ ...d })), e = f.event(1, 'divider');
    f.emit('pointerdown', e); f.emit('pointermove', { ...e, clientY: e.clientY + 15 });
    assert.notDeepEqual(f.state().dividers, before, 'the board really moved before cancellation');
    if (ending === 'Escape') f.emit('keydown', { ...e, key: 'Escape' });
    else {
        if (ending === 'lostpointercapture') f.cv.releasePointerCapture(1);
        f.emit(ending, e);
    }
    assert.deepEqual(f.state().dividers, before); assert.equal(f.checkpoints.length, 0);
    assert.equal(f.interactionState.ptrs.size, 0); assert.equal(f.captures.size, 0);
    f.emit('pointerup', e);
    assert.equal(f.panel, '#pop4', 'a cancelled release cannot reopen or change an editing surface');
    f.tap(2);
    assert.equal(f.selectionState.focusOn, false);
});

test('a successful divider drag commits once and its next canvas click is independent', () => {
    const f = fixture(), e = f.event(1, 'divider');
    f.emit('pointerdown', e); f.emit('pointermove', { ...e, clientY: e.clientY + 15 }); f.emit('pointerup', e);
    assert.equal(f.checkpoints.length, 1); assert.equal(f.interactionState.ptrs.size, 0); assert.equal(f.captures.size, 0);
    const committed = f.state().dividers.map(d => ({ ...d })); f.tap(2);
    assert.equal(f.selectionState.focusOn, false); assert.deepEqual(f.state().dividers, committed);
});

test('an unowned pointer release cannot finish another pointer\'s divider drag', () => {
    const f = fixture(), e = f.event(1, 'divider'); f.emit('pointerdown', e);
    f.emit('pointerup', f.event(99, 'background'));
    assert.ok(f.interactionState.dividerGesture); assert.equal(f.interactionState.ptrs.size, 1);
    f.emit('pointerup', e); f.tap(2); assert.equal(f.selectionState.focusOn, false);
});

for (const ending of ['pointercancel', 'lostpointercapture', 'blur']) test(`${ending} during right-button pan cannot swallow the next mouse click`, () => {
    const f = fixture(1280), e = { ...f.event(1, 'background', 'mouse'), button: 2 };
    f.emit('pointerdown', e); assert.ok(f.interactionState.panGesture);
    if (ending === 'lostpointercapture') f.cv.releasePointerCapture(1);
    f.emit(ending, e); assert.equal(f.interactionState.panGesture, null); assert.equal(f.captures.size, 0);
    f.emit('pointerup', e); f.tap(1, 'background', 'mouse');
    assert.equal(f.selectionState.focusOn, false);
});

for (const child of ['section', 'item', 'divider']) test(`${child} selection locks furniture movement and rotation at the gesture boundary`, () => {
    const f = fixture();
    Object.assign(f.state(), { item: child === 'item' ? 0 : -1, divider: child === 'divider' ? 0 : -1 });
    f.selectionState.deep = child === 'section';
    const before = f.model.snapshot();
    f.interactions.beginWardrobeDrag(f.event(1, 'frame'), 'floor');
    f.interactions.beginRotation(f.event(1, 'frame'), { classList: { add() {} }, setAttribute() {} });
    assert.equal(f.interactionState.wardrobeGesture, null); assert.equal(f.interactionState.rotationGesture, null);
    const e = f.event(1, 'frame'); f.emit('pointerdown', e); f.emit('pointermove', { ...e, clientX: e.clientX + 40 }); f.emit('pointerup', e);
    assert.equal(f.model.snapshot(), before); assert.equal(f.interactionState.wardrobeGesture, null);
    assert.equal(f.checkpoints.length, 0);
});

for (const shape of ['box', 'roof-cut']) test(`${shape} fitting drag measures the selected item rather than assuming a box-shaped hit mesh`, () => {
    const f = fixture(); Object.assign(f.state(), { item: 0, divider: -1 });
    f.fitting.geometry = shape === 'box' ? new THREE.BoxGeometry(96.4, 30, 60) : new THREE.ExtrudeGeometry(new THREE.Shape([
        new THREE.Vector2(-48.2, 9.8), new THREE.Vector2(48.2, 9.8), new THREE.Vector2(48.2, 39.8), new THREE.Vector2(-48.2, 29.8)
    ]), { depth: 60, bevelEnabled: false });
    if (shape === 'box') f.fitting.position.y = 24.8;
    const e = f.event(1, 'fitting'); f.emit('pointerdown', e);
    const g = f.interactionState.drag;
    assert.equal(g.cx, 0); assert.ok(Math.abs(g.cy - 24.8) < .001);
    assert.ok(Math.abs(g.hw - 48.2) < .001); assert.equal(g.hh, 15);
    assert.equal(g.offsetX, e.clientX); assert.ok(Math.abs(g.offsetY - (e.clientY - 24.8)) < .001);
    assert.equal(f.interactionState.wardrobeGesture, null);
});

test('every catalog fitting uses the same interior drag route with finite model-based grab geometry', () => {
    for (const [kind, spec] of Object.entries(MODS)) {
        if (kind === 'void') continue;
        const f = fixture();
        f.state().h = 500; f.state().dividers = [];
        f.state().secs[0] = [{ k: kind, h: spec.h, y: 0, x: 0, w: 96.4 }];
        Object.assign(f.state(), { item: 0, divider: -1 });
        f.emit('pointerdown', f.event(1, 'fitting'));
        const g = f.interactionState.drag;
        assert.deepEqual(g?.from, { i: 0, j: 0 }, kind + ' is grabbed as an item');
        assert.ok([g.cx, g.cy, g.hw, g.hh, g.offsetX, g.offsetY].every(Number.isFinite), kind + ' has valid grab geometry');
        assert.equal(f.interactionState.wardrobeGesture, null, kind + ' cannot move its furniture');
    }
});
