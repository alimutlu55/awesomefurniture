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
    test(`${width}px: a second finger hands a selected room surface to the camera and releases both pointers`, t => {
        const f = fixture(t, width); f.tap();
        const before = f.model.snapshot(), a = f.event('touch'), b = { ...f.event('touch', 100, 0), pointerId: 2 };
        f.pointer('pointerdown', a); assert.equal(f.wiring.surface.dragging(), true);
        assert.equal(f.interactionState.ptrs.size, 1);
        f.pointer('pointerdown', b);
        assert.equal(f.wiring.surface.dragging(), false); assert.equal(f.interactionState.ptrs.size, 2);
        f.pointer('pointerup', b); f.pointer('pointerup', a);
        assert.equal(f.interactionState.ptrs.size, 0); assert.equal(f.model.snapshot(), before);
        f.background(); f.tap();
        assert.equal(f.selectionState.room, null, 'a later empty-canvas tap clears the room selection');
    });
    test(`${width}px: Escape cancels a pending opening before its wall is selected`, t => {
        const f = fixture(t, width);
        f.selectionState.viewMode = 'studio';
        f.selectionState.focusOn = false;
        const snapshot = f.model.snapshot();
        f.wiring.actOnWall('door');
        f.escape();
        assert.equal(f.selectionState.pendingStudioAction, null);
        f.wall('w3'); f.tap();
        assert.equal(f.selectionState.room.kind, 'wall');
        assert.equal(f.model.snapshot(), snapshot);
    });
    for (const action of ['door', 'window', 'archway', 'ceiling:slope']) {
        test(`${width}px: room-level ${action} waits for a chosen wall before changing the design`, t => {
            const f = fixture(t, width);
            f.selectionState.viewMode = 'studio';
            f.selectionState.focusOn = false;
            const snapshot = f.model.snapshot();
            f.wiring.actOnWall(action);
            assert.equal(f.model.snapshot(), snapshot);
            assert.equal(f.selectionState.pendingStudioAction, action);
            f.wall('w3'); f.tap();
            assert.equal(f.selectionState.pendingStudioAction, null);
            if (action.startsWith('ceiling:')) {
                assert.equal(f.selectionState.room.kind, 'ceiling');
                assert.ok(f.model.scene.studio.ceilings.some(c => c.wall === 'w3'));
            } else {
                assert.equal(f.selectionState.room.kind, 'opening');
                assert.ok(f.model.scene.studio.openings.some(o => o.wall === 'w3' && o.kind === action));
            }
        });
    }
    for (const shape of ['landing', 'stairs', 'slope', 'box']) {
        test(`${width}px: selecting and retapping a ${shape} ceiling preserves the current camera view`, t => {
            const f = fixture(t, width, shape), snapshot = f.model.snapshot();
            f.cameraState.dist = 180; f.cameraState.el = .02; f.cameraState.az = 1.3; f.cameraState.tgt.set(0, 90, 20);
            const pose = f.camera.camNow();
            f.tap();
            assert.deepEqual(f.selectionState.room, { kind: 'ceiling', id: 'k1' }); assert.equal(f.selectionState.focusOn, false);
            assert.equal(f.frames, 0); assert.equal(f.cameraState.camGoal, null);
            f.camera.cameraTick(2000, 1 / 60); samePose(f.camera.camNow(), pose);
            f.cameraState.az = 2; f.cameraState.dist = 125; f.cameraState.el = .8; f.cameraState.tgt.set(100, 80, 20);
            const zoomed = f.camera.camNow();
            f.tap(); f.camera.cameraTick(2000, 1 / 60); samePose(f.camera.camNow(), zoomed);
            assert.equal(f.frames, 0); assert.equal(f.cameraState.camGoal, null);
            assert.equal(f.model.snapshot(), snapshot, 'selection does not change the design');
        });
    }

    test(`${width}px: selecting a ceiling stops a pending camera flight at its current pose`, t => {
        const f = fixture(t, width);
        f.cameraState.dist = 180; f.cameraState.el = .2; f.cameraState.tgt.set(30, 100, 20);
        f.camera.frameScene(); assert.ok(f.cameraState.camGoal);
        const pose = f.camera.camNow();
        f.tap(); assert.equal(f.cameraState.camGoal, null);
        f.camera.cameraTick(2000, 1 / 60); samePose(f.camera.camNow(), pose);
        assert.equal(f.frames, 1, 'selection did not start another overview');
    });

    test(`${width}px: ceiling dragging reshapes the wardrobe without triggering camera reframing`, t => {
        const f = fixture(t, width); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        const pose = f.camera.camNow(), shape = structuredClone(f.model.activeCabinet().state.shape);
        f.wiring.editor.begin(f.event(), f.wiring.editor.handles()[1], f.cv);
        for (const y of [20, 40, 60]) f.wiring.editor.move(f.event(undefined, 0, y));
        assert.notDeepEqual(f.model.activeCabinet().state.shape, shape);
        assert.equal(f.frames, 0); assert.deepEqual(f.camera.camNow(), pose); f.wiring.editor.end();
        assert.equal(f.frames, 0); assert.deepEqual(f.camera.camNow(), pose);
    });

    test(`${width}px: the empty-space overview gesture still frames the studio after ceiling editing`, t => {
        const f = fixture(t, width); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        f.background(); f.tap(); if (width === 375) f.tap(); f.camera.cameraTick(2000, 1 / 60);
        assert.equal(f.selectionState.room, null); assert.equal(f.cameraState.el, .5);
        assert.equal(f.cameraState.tgt.z, 80); assert.equal(f.cameraState.tgt.y, 130);
    });

    for (const wall of ['w1', 'w2', 'w3', 'w4']) test(`${width}px: selecting and retapping ${wall} preserves the current zoom, angle and target`, t => {
        const f = fixture(t, width), snapshot = f.model.snapshot();
        f.wall(wall); f.cameraState.dist = 180; f.cameraState.el = .02; f.cameraState.az = 1.3; f.cameraState.tgt.set(70, 80, 20);
        const pose = f.camera.camNow();
        f.tap(); assert.deepEqual(f.selectionState.room, { kind: 'wall', id: wall });
        assert.equal(f.frames, 0); assert.equal(f.cameraState.camGoal, null);
        f.camera.cameraTick(2000, 1 / 60); samePose(f.camera.camNow(), pose);
        f.cameraState.dist = 125; f.cameraState.az = 2; f.cameraState.el = .8; f.cameraState.tgt.set(-80, 110, 65);
        const zoomed = f.camera.camNow();
        f.tap(); f.camera.cameraTick(2000, 1 / 60); samePose(f.camera.camNow(), zoomed);
        const nextWall = wall === 'w1' ? 'w2' : 'w1';
        f.wall(nextWall); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        assert.deepEqual(f.selectionState.room, { kind: 'wall', id: nextWall }); samePose(f.camera.camNow(), zoomed);
        assert.equal(f.frames, 0); assert.equal(f.model.snapshot(), snapshot);
    });

    test(`${width}px: selecting a wall stops a pending camera flight at the current pose`, t => {
        const f = fixture(t, width); f.wall();
        f.cameraState.dist = 180; f.cameraState.el = .2; f.cameraState.tgt.set(30, 100, 20);
        f.camera.frameScene(); assert.ok(f.cameraState.camGoal);
        const pose = f.camera.camNow();
        f.tap(); assert.equal(f.cameraState.camGoal, null);
        f.camera.cameraTick(2000, 1 / 60); samePose(f.camera.camNow(), pose);
        assert.equal(f.frames, 1, 'selection did not start another overview');
    });

    test(`${width}px: dragging a wall keeps the camera steady while carrying its wardrobes`, t => {
        const f = fixture(t, width); f.wall(); f.tap(); f.camera.cameraTick(2000, 1 / 60);
        const pose = f.camera.camNow(), before = f.model.activeCabinet().z;
        assert.equal(f.wiring.surface.grab(f.event(), undefined), true);
        f.wiring.surface.move(f.event(undefined, 8, 6));
        assert.equal(f.model.activeCabinet().z, before + 20);
        assert.equal(f.frames, 0); samePose(f.camera.camNow(), pose);
        f.wiring.surface.end(); assert.equal(f.frames, 0); samePose(f.camera.camNow(), pose);
    });

    test(`${width}px: framing includes tall wardrobes and other wardrobes outside the selected wall`, t => {
        const f = fixture(t, width), scene = f.model.scene;
        scene.wardrobes.push({ id: 2, name: 'Second', x: 450, y: 0, z: 250, angle: 0,
            state: { ...createEditorState(), w: 100, h: 280 } });
        f.wiring.frameRoom(); const goal = f.cameraState.camGoal;
        assert.equal(goal.y, 140, 'the top of the tall wardrobe is included');
        assert.equal(goal.x, 144); assert.equal(goal.z, 134);
        const camera = new THREE.PerspectiveCamera(35, width / 812, 1, 15000), area = f.camera.availableRoom();
        camera.position.set(goal.x + goal.dist * Math.cos(goal.el) * Math.sin(goal.az),
            goal.y + goal.dist * Math.sin(goal.el), goal.z + goal.dist * Math.cos(goal.el) * Math.cos(goal.az));
        camera.lookAt(goal.x, goal.y, goal.z); camera.updateMatrixWorld();
        for (const x of [-212, 500]) for (const y of [0, 280]) for (const z of [-12, 280]) {
            const p = new THREE.Vector3(x, y, z).project(camera);
            assert.ok(Math.abs(p.x) <= area.w / width && Math.abs(p.y) <= area.h / 812, 'every scene corner fits in the available viewport');
        }
    });
}

test('a ceiling on the side wall preserves the current camera view', t => {
    const f = fixture(t, 375, 'slope', 'w2');
    f.cameraState.az = 2; f.cameraState.dist = 180; f.cameraState.tgt.set(100, 80, 20);
    const pose = f.camera.camNow(); f.tap();
    assert.equal(f.cameraState.camGoal, null); samePose(f.camera.camNow(), pose);
});

test('wall selection preserves the camera pose even when the active wardrobe is rotated', t => {
    const f = fixture(t, 375); f.model.activeCabinet().angle = 90; f.wall('w1');
    const pose = f.camera.camNow(); f.tap();
    assert.equal(f.cameraState.camGoal, null); samePose(f.camera.camNow(), pose);
});
