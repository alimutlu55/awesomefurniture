const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
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
    const picking = { cast: (_e, objects) => objects === roomObjects ? roomHit : undefined, hitAt: () => -1, pieceAt: () => undefined,
        groundPoint: e => ({ x: e.clientX, z: e.clientY }), screenPoint: p => ({ x: p.x + p.z * .4, y: -p.y + p.z * .3 }) };
    const inspector = { inside: () => false, layoutPop() {}, hidePop() {}, histUI() {}, update() {},
        clearFocus() { selectionState.focusOn = selectionState.deep = selectionState.pillOn = false; } };
    const camera = createCameraController({ dom, inspector, picking, cameraState, interactionState, renderState, resources, model,
        geometry: createWardrobeGeometry(() => model.activeCabinet().state), cabinetGeometry: createCabinetGeometry(() => model.scene.wardrobes),
        viewport: { resize() {} }, clock: { now: () => 0 } });
    let frames = 0;
    const frameScene = camera.frameScene;
    camera.frameScene = () => { frames++; return frameScene(); };
    const roomKeys = [];
    const wiring = createRoomWiring({ dom, model, sceneCommands: commands, history: { checkpoint() {} }, picking, selectionState,
        listen: (_target, event, handler) => { if (event === 'keydown') roomKeys.push(handler); },
        late: { rendering: () => ({ studioPickables: () => roomObjects, redrawStudio() {}, build() {} }), inspector: () => inspector,
            report() {}, camera: () => camera } });
    const interactions = { ...createSceneSelection({ dom, inspector, picking, camera, selectionState, renderState, model, resources, room: wiring.room }),
        cancelMovement() {} };
    const handlers = {}, ports = { dom, inspector, picking, camera, selectionState, renderState, model, resources, interactions, interactionState, touch: { pinch() {}, release() {}, followEdge() {}, stopFollowing() {} },
        room: wiring.surface, lifetime: { listen: (_target, event, fn) => { handlers[event] = fn; } } };
    bindCanvasPointerdown(ports); bindCanvasPointerup(ports);
    const event = (pointerType = width === 375 ? 'touch' : 'mouse', x = 0, y = 0) => ({ button: 0, pointerId: 1, pointerType,
        clientX: x, clientY: y, target: cv, shiftKey: true, preventDefault() {}, stopPropagation() {} });
    const tap = () => { const e = event(); handlers.pointerdown(e); handlers.pointerup(e); };
    return { model, camera, cameraState, wiring, selectionState, interactionState, cv, event, tap,
        pointer: (type, e) => handlers[type](e),
        escape: () => roomKeys.forEach(handler => handler({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} })),
        get frames() { return frames; },
        background: () => { roomHit = undefined; }, wall: (id = 'w1') => {
            roomHit = { object: { userData: { studioWall: id } }, point: { x: 0, y: 150, z: 0 }, distance: 5 };
        } };
}

for (const width of [375, 1280]) {
    for (const shape of ['landing', 'stairs', 'slope', 'box']) {
        test(`${width}px: selecting and repeatedly tapping a ${shape} ceiling preserves the chosen camera pose`, t => {
            const f = fixture(t, width, shape), snapshot = f.model.snapshot();
            f.camera.camRelease(); f.cameraState.az = 1.4; f.cameraState.dist = 180; f.cameraState.el = .02;
            f.cameraState.tgt.set(100, 90, 20); const pose = f.camera.camNow();
            f.tap();
            assert.deepEqual(f.selectionState.room, { kind: 'ceiling', id: 'k1' });
            assert.equal(f.selectionState.focusOn, false); assert.equal(f.frames, 0);
            samePose(f.camera.camNow(), pose); assert.equal(f.cameraState.camGoal, null);
            f.tap(); f.tap(); f.camera.cameraTick(2000, 1 / 60);
            samePose(f.camera.camNow(), pose); assert.equal(f.frames, 0); assert.equal(f.model.snapshot(), snapshot);
        });
    }
    for (const wall of ['w1', 'w2', 'w3', 'w4']) {
        test(`${width}px: selecting ${wall} preserves zoom and orbit, including with rotated furniture`, t => {
            const f = fixture(t, width); f.model.activeCabinet().angle = 90;
            f.camera.camRelease(); f.cameraState.az = 2; f.cameraState.dist = 210;
            const pose = f.camera.camNow(), snapshot = f.model.snapshot(); f.wall(wall); f.tap(); f.tap();
            assert.deepEqual(f.selectionState.room, { kind: 'wall', id: wall });
            assert.equal(f.frames, 0); assert.equal(f.cameraState.camGoal, null);
            samePose(f.camera.camNow(), pose); assert.equal(f.model.snapshot(), snapshot);
        });
    }
    test(`${width}px: ceiling point dragging reshapes the wardrobe while the camera remains stationary`, t => {
        const f = fixture(t, width); f.tap();
        const pose = f.camera.camNow(), shape = structuredClone(f.model.activeCabinet().state.shape);
        f.wiring.editor.begin(f.event(), f.wiring.editor.handles()[1], f.cv);
        for (const y of [20, 40, 60]) f.wiring.editor.move(f.event(undefined, 0, y));
        assert.notDeepEqual(f.model.activeCabinet().state.shape, shape); f.wiring.editor.end();
        assert.equal(f.frames, 0); samePose(f.camera.camNow(), pose);
    });
    test(`${width}px: a second finger still hands a selected room surface to manual camera control`, t => {
        const f = fixture(t, width); f.tap(); const before = f.model.snapshot();
        const a = f.event('touch'), b = { ...f.event('touch', 100, 0), pointerId: 2 };
        f.pointer('pointerdown', a); assert.equal(f.wiring.surface.dragging(), true);
        f.pointer('pointerdown', b); assert.equal(f.wiring.surface.dragging(), false);
        f.pointer('pointerup', b); f.pointer('pointerup', a);
        assert.equal(f.interactionState.ptrs.size, 0); assert.equal(f.model.snapshot(), before);
    });
    for (const action of ['door', 'window', 'archway', 'ceiling:slope']) {
        test(`${width}px: ${action} waits for its chosen wall without changing room selection behavior`, t => {
            const f = fixture(t, width), snapshot = f.model.snapshot();
            f.selectionState.viewMode = 'studio'; f.selectionState.focusOn = false;
            f.wiring.actOnWall(action); assert.equal(f.model.snapshot(), snapshot);
            assert.equal(f.selectionState.pendingStudioAction, action); f.wall('w3'); f.tap();
            assert.equal(f.selectionState.pendingStudioAction, null);
            assert.equal(f.selectionState.room.kind, action.startsWith('ceiling:') ? 'ceiling' : 'opening');
        });
    }
    test(`${width}px: Escape cancels a pending wall tool`, t => {
        const f = fixture(t, width), snapshot = f.model.snapshot();
        f.selectionState.focusOn = false; f.wiring.actOnWall('door'); f.escape();
        f.wall('w3'); f.tap(); assert.equal(f.model.snapshot(), snapshot);
    });
    test(`${width}px: the explicit room framing command still fits the entire studio`, t => {
        const f = fixture(t, width); f.model.activeCabinet().state.h = 280;
        f.wiring.frameRoom(); const goal = f.cameraState.camGoal;
        const camera = new THREE.PerspectiveCamera(35, width / 812, 1, 15000), area = f.camera.availableRoom();
        camera.position.set(goal.x + goal.dist * Math.cos(goal.el) * Math.sin(goal.az),
            goal.y + goal.dist * Math.sin(goal.el), goal.z + goal.dist * Math.cos(goal.el) * Math.cos(goal.az));
        camera.lookAt(goal.x, goal.y, goal.z); camera.updateMatrixWorld();
        for (const x of [-212, 212]) for (const y of [0, 280]) for (const z of [-12, 172]) {
            const p = new THREE.Vector3(x, y, z).project(camera);
            assert.ok(Math.abs(p.x) <= area.w / width && Math.abs(p.y) <= area.h / 812);
        }
    });
}
