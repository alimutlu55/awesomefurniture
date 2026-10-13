const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { createSceneCommands } = require('../src/application/commands/scene-commands.ts');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { addCeiling } = require('../src/domain/studio/studio-ceiling.ts');
const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');
const { createCabinetGeometry } = require('../src/domain/geometry/cabinet-geometry.js');
const { createCameraController } = require('../src/presentation/viewport/camera-controller.js');
const { createCameraState } = require('../src/presentation/viewport/camera-state.ts');
const { createInteractionState } = require('../src/presentation/editor/interaction-state.js');
const { createRoomWiring } = require('../src/presentation/editor/room-wiring.ts');
const { createSceneSelection } = require('../src/presentation/editor/scene-selection.js');
const { bindCanvasPointerdown, bindCanvasPointerup } = require('../src/presentation/editor/bindings/canvas.js');

function samePose(actual, expected) {
    for (const key of ['az', 'el', 'dist', 'x', 'y', 'z']) assert.ok(Math.abs(actual[key] - expected[key]) < 1e-8, key);
}

/** Production pointer bindings, room selection wiring and camera, without a WebGL renderer. */
function fixture(t, width, shape = 'landing', wall = 'w1') {
    const previous = global.getComputedStyle;
    global.getComputedStyle = () => ({ getPropertyValue: () => '0' });
    t.after(() => { global.getComputedStyle = previous; });
    const model = createEditorModel({ studio: addCeiling(rectangleStudio(400, 160), wall, shape),
        wardrobes: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 30, angle: 0, state: { ...createEditorState(), w: 160 } }],
        activeWardrobe: 1, nextWardrobeId: 2 });
    const commands = createSceneCommands(() => model.scene); commands.followCeilings();
    const selectionState = { focusOn: true, deep: false, pillOn: false, room: null };
    const interactionState = createInteractionState(), cameraState = createCameraState();
    const element = () => ({ dataset: {}, classList: { contains: () => true }, querySelector: () => null,
        querySelectorAll: () => [], matches: () => false, getBoundingClientRect: () => ({ width, height: 812 }) });
    const nodes = {}, document = { createElement: element, documentElement: { hasAttribute: () => false }, querySelector: () => null };
    const dom = { width, document, window: {}, $: id => nodes[id] ??= element() };
    const cv = { ...element(), style: {}, focus() {}, setPointerCapture() {}, hasPointerCapture: () => false }, resources = { cv };
    const renderState = { allHits: [], allItemHits: [], ihits: [], outs: [], wardrobeGroups: [] }, roomObjects = [];
    let roomHit = { object: { userData: { studioCeiling: 'k1' } }, point: { x: 0, y: 150, z: 100 }, distance: 5 };
    const picking = { cast: (_e, objects) => objects === roomObjects ? roomHit : undefined, hitAt: () => -1,
        groundPoint: e => ({ x: e.clientX, z: e.clientY }), screenPoint: p => ({ x: p.x + p.z * .4, y: -p.y + p.z * .3 }) };
    const inspector = { inside: () => false, layoutPop() {}, hidePop() {}, histUI() {}, update() {},
        clearFocus() { selectionState.focusOn = selectionState.deep = selectionState.pillOn = false; } };
    const camera = createCameraController({ dom, inspector, picking, cameraState, interactionState, renderState, resources, model,
        geometry: createWardrobeGeometry(() => model.activeCabinet().state), cabinetGeometry: createCabinetGeometry(() => model.scene.wardrobes),
        viewport: { resize() {} }, clock: { now: () => 0 } });
    let frames = 0;
    const frameBox = camera.frameBox;
    camera.frameBox = (...args) => { frames++; return frameBox(...args); };
    const wiring = createRoomWiring({ dom, model, sceneCommands: commands, history: { checkpoint() {} }, picking, selectionState, listen() {},
        late: { rendering: () => ({ studioPickables: () => roomObjects, redrawStudio() {}, build() {} }), inspector: () => inspector,
            report() {}, camera: () => camera } });
    const interactions = { ...createSceneSelection({ dom, inspector, picking, camera, selectionState, renderState, model, resources, room: wiring.room }),
        cancelMovement() {} };
    const handlers = {}, ports = { dom, inspector, picking, camera, selectionState, renderState, model, resources, interactions, interactionState,
        room: wiring.surface, lifetime: { listen: (_target, event, fn) => { handlers[event] = fn; } } };
    bindCanvasPointerdown(ports); bindCanvasPointerup(ports);
    const event = (pointerType = width === 375 ? 'touch' : 'mouse', x = 0, y = 0) => ({ button: 0, pointerId: 1, pointerType,
        clientX: x, clientY: y, target: cv, shiftKey: true, preventDefault() {}, stopPropagation() {} });
    const tap = () => { const e = event(); handlers.pointerdown(e); handlers.pointerup(e); };
    return { model, camera, cameraState, wiring, selectionState, cv, event, tap, get frames() { return frames; },
        background: () => { roomHit = undefined; }, wall: () => { roomHit = { object: { userData: { studioWall: 'w1' } }, distance: 5 }; } };
}

for (const width of [375, 1280]) {
    for (const shape of ['landing', 'stairs', 'slope', 'box']) {
        test(`${width}px: tapping a ${shape} ceiling from a close view below it frames its editing controls`, t => {
            const f = fixture(t, width, shape), snapshot = f.model.snapshot();
            f.cameraState.dist = 180; f.cameraState.el = .02; f.cameraState.tgt.set(0, 90, 20);
            f.tap();
            assert.deepEqual(f.selectionState.room, { kind: 'ceiling', id: 'k1' }); assert.equal(f.selectionState.focusOn, false);
            assert.equal(f.frames, 1, 'ceiling selection always establishes framing, including from below');
            assert.ok(f.cameraState.camGoal.dist > 240, 'backs away enough to expose the whole profile and depth grip');
            assert.equal(f.cameraState.camGoal.az, .4); assert.equal(f.cameraState.camGoal.el, .02);
            f.camera.cameraTick(2000, 1 / 60);
            assert.equal(f.cameraState.tgt.y, 130); assert.equal(f.model.snapshot(), snapshot, 'selection does not change the design');
        });
    }

    test(`${width}px: tapping the same ceiling after orbit/zoom restores framing; repeated taps do not accumulate zoom`, t => {
        const f = fixture(t, width); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        const fitted = f.camera.camNow();
        f.camera.camRelease(); f.cameraState.az = 2; f.cameraState.dist = 180; f.cameraState.tgt.set(100, 80, 20);
        f.tap(); assert.equal(f.frames, 2); f.camera.cameraTick(2000, 1 / 60);
        samePose(f.camera.camNow(), fitted);
        f.tap(); f.camera.cameraTick(2000, 1 / 60); samePose(f.camera.camNow(), fitted);
    });

    test(`${width}px: ceiling dragging reshapes the wardrobe without triggering camera reframing`, t => {
        const f = fixture(t, width); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        const pose = f.camera.camNow(), shape = structuredClone(f.model.activeCabinet().state.shape);
        f.wiring.editor.begin(f.event(), f.wiring.editor.handles()[1], f.cv);
        for (const y of [20, 40, 60]) f.wiring.editor.move(f.event(undefined, 0, y));
        assert.notDeepEqual(f.model.activeCabinet().state.shape, shape);
        assert.equal(f.frames, 1); assert.deepEqual(f.camera.camNow(), pose); f.wiring.editor.end();
        assert.equal(f.frames, 1); assert.deepEqual(f.camera.camNow(), pose);
    });

    test(`${width}px: empty-space tap after ceiling editing still frames the entire studio`, t => {
        const f = fixture(t, width); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        f.background(); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        assert.equal(f.selectionState.room, null); assert.equal(f.cameraState.el, .5);
        assert.equal(f.cameraState.tgt.z, 80); assert.equal(f.cameraState.tgt.y, 130);
    });
}

test('a ceiling on the side wall is framed from its room-facing side', t => {
    const f = fixture(t, 375, 'slope', 'w2'); f.tap();
    assert.ok(Math.abs(f.cameraState.camGoal.az - (-Math.PI / 2 + .4)) < 1e-9);
    assert.equal(f.cameraState.camGoal.el, .02);
});

test('wall selection retains an already suitable editing view', t => {
    const f = fixture(t, 375); f.wall(); f.cameraState.el = .5; f.cameraState.tgt.set(0, 130, 80);
    f.tap(); assert.deepEqual(f.selectionState.room, { kind: 'wall', id: 'w1' }); assert.equal(f.frames, 0);
});
