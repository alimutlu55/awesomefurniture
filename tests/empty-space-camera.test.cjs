const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { createStudio } = require('../src/domain/studio/studio-templates.ts');
const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');
const { createCabinetGeometry } = require('../src/domain/geometry/cabinet-geometry.js');
const { createCameraState } = require('../src/presentation/viewport/camera-state.ts');
const { createInteractionState } = require('../src/presentation/editor/interaction-state.js');
const { createSceneSelection } = require('../src/presentation/editor/scene-selection.js');
const { createCameraController } = require('../src/presentation/viewport/camera-controller.js');
const { bindCanvasPointerdown, bindCanvasPointerup } = require('../src/presentation/editor/bindings/canvas.js');

function fixture(t, width, studio = true) {
    const previous = global.getComputedStyle;
    global.getComputedStyle = () => ({ getPropertyValue: () => '0' });
    t.after(() => { global.getComputedStyle = previous; });
    const state = createEditorState();
    state.secs[0] = [{ k: 'shelf', h: 30, x: 0, y: 100, w: 196.4 }];
    const wardrobes = [
        { id: 1, x: -80, y: 0, z: 30, angle: 0, state },
        { id: 2, x: 110, y: 0, z: 30, angle: 0, state: { ...createEditorState(), w: 100, h: 190 } }
    ];
    const model = { scene: { wardrobes, activeWardrobe: 1, studio: studio ? createStudio('bedroom') : null }, activeCabinet: () => wardrobes[0] };
    const selectionState = { focusOn: true, deep: true, pillOn: true, room: null };
    const interactionState = createInteractionState(), cameraState = createCameraState();
    const renderState = { allHits: [], allItemHits: [], ihits: [], outs: [], wardrobeGroups: [] };
    let height = 600, hit = null, roomHit = null, overviewCalls = 0;
    const element = { dataset: {}, getBoundingClientRect: () => ({ width, height }), classList: { contains: () => true }, matches: () => false, querySelector: () => null };
    const dom = { width, $: () => element, document: { documentElement: {}, querySelector: () => null } };
    const handlers = {}, cv = { ...element, style: {}, focus() {}, setPointerCapture() {}, hasPointerCapture: () => false };
    const resources = { cv }, picking = { hitAt: () => -1,
        cast: (_e, objects) => objects === renderState.allHits ? hit : objects === roomObjects ? roomHit : null };
    const inspector = {
        inside: () => selectionState.deep, layoutPop() {}, hidePop() {}, update() {}, selectCabinet() {}, showPop() {},
        clearFocus() { selectionState.focusOn = selectionState.deep = selectionState.pillOn = false; state.item = state.divider = -1; height = 812; }
    };
    const camera = createCameraController({ dom, inspector, picking, cameraState, interactionState, renderState,
        geometry: createWardrobeGeometry(() => state), cabinetGeometry: createCabinetGeometry(() => wardrobes), resources, model,
        viewport: { resize() {} }, clock: { now: () => 0 } });
    const frameScene = camera.frameScene;
    camera.frameScene = () => { overviewCalls++; frameScene(); };
    const roomObjects = [], room = { pickables: () => roomObjects, pick: () => { selectionState.room = { kind: 'wall', id: 'w1' }; return true; } };
    const interactions = { ...createSceneSelection({ dom, inspector, picking, camera, selectionState, renderState, model, resources, room }), cancelMovement() {} };
    const ports = { dom, inspector, picking, camera, selectionState, renderState, model, resources, interactions, interactionState,
        lifetime: { listen: (_target, event, fn) => { handlers[event] = fn; } } };
    bindCanvasPointerdown(ports); bindCanvasPointerup(ports);
    // The fitting has just been added with its panel open and its wardrobe framed.
    camera.frameMobileInspector(); camera.cameraTick(1000, 1 / 60);
    const tap = pointerType => {
        const e = { button: 0, pointerId: 1, pointerType, clientX: 10, clientY: 20 };
        handlers.pointerdown(e); handlers.pointerup(e);
    };
    return { camera, cameraState, interactionState, selectionState, model, tap,
        get overviewCalls() { return overviewCalls; }, setHeight: n => { height = n; },
        hit: () => { hit = { object: { userData: { wardrobe: 1, i: 0 } }, distance: 10 }; },
        wall: () => { roomHit = { object: { userData: { studioWall: 'w1' } }, distance: 5 }; } };
}

for (const [width, pointerType] of [[375, 'touch'], [1280, 'mouse']]) {
    test(`${pointerType}: empty-space tap after adding a fitting frames the studio and both wardrobes`, t => {
        const f = fixture(t, width), snapshot = JSON.stringify(f.model.scene);
        const before = f.cameraState.dist;
        f.tap(pointerType);
        assert.equal(f.selectionState.focusOn, false);
        assert.equal(f.overviewCalls, 1);
        f.camera.cameraTick(2000, 1 / 60);
        assert.ok(f.cameraState.dist > before, 'the view backs away rather than zooming into the wardrobe');
        assert.equal(f.cameraState.tgt.x, 0); assert.equal(f.cameraState.tgt.z, 175);
        assert.equal(f.cameraState.tgt.y, 130);
        assert.equal(JSON.stringify(f.model.scene), snapshot, 'a background tap does not alter the design');
        const distance = f.cameraState.dist;
        f.tap(pointerType); f.camera.cameraTick(2000, 1 / 60);
        assert.equal(f.cameraState.dist, distance, 'repeated taps do not keep zooming out');
        f.setHeight(650); f.camera.resize(); f.camera.cameraTick(2000, 1 / 60);
        assert.equal(f.cameraState.tgt.z, 175, 'viewport changes retain studio framing');
        assert.equal(f.cameraState.tgt.y, 130);
    });
}

test('background overview works without room walls and contains every wardrobe', t => {
    const f = fixture(t, 375, false);
    f.tap('touch'); f.camera.cameraTick(2000, 1 / 60);
    assert.equal(f.cameraState.tgt.x, -10); assert.equal(f.cameraState.tgt.z, 30);
    assert.equal(f.cameraState.tgt.y, 115);
});

test('wardrobe and wall selections retain their actions instead of returning to the overview', t => {
    const f = fixture(t, 375);
    f.hit(); f.tap('touch');
    assert.equal(f.overviewCalls, 0); assert.equal(f.selectionState.focusOn, true);
    f.wall(); f.tap('touch');
    assert.equal(f.overviewCalls, 0); assert.deepEqual(f.selectionState.room, { kind: 'wall', id: 'w1' });
});

test('orbit drags and pinch releases on empty space do not trigger the overview', t => {
    const f = fixture(t, 375);
    // Pointerup only dispatches selection for a tap, never after an orbit or pinch.
    f.interactionState.moved = 20;
    f.interactionState.ptrs.set(1, {});
    const ports = { interactions: { pick: () => assert.fail('drag must not select'), hover() {} },
        interactionState: f.interactionState, resources: { cv: { hasPointerCapture: () => false } }, lifetime: { listen: (_target, _event, fn) => fn({ pointerId: 1 }) } };
    bindCanvasPointerup(ports);
    f.interactionState.moved = 99; f.interactionState.ptrs.set(1, {}); f.interactionState.ptrs.set(2, {});
    bindCanvasPointerup(ports);
    assert.equal(f.overviewCalls, 0);
});
