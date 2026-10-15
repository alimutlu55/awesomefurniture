import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShapeSplitCursor } from '../../src/presentation/editor/shape-split-cursor';
import { shapeHandleVisible } from '../../src/presentation/viewport/shape-handle-visibility';
import { splitPanel, type WardrobeShape } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createShapeInspector } from '../../src/presentation/editor/shape-inspector';

test('the inspector converts its centred picking plane to profile coordinates before positioning the cursor', () => {
    const model = createEditorModel(); let checkpoints = 0;
    const inspector = createShapeInspector({ model, dom: {} as never,
        sceneCommands: createSceneCommands(() => model.scene, { checkpoint() { checkpoints++; } }),
        picking: { frontPoint: () => ({ x: 30, y: 230 }) }, selectionState: { shapeEditing: true, focusOn: true },
        callbacks: { refresh() {}, rebuild() {}, histUI() {} } });
    inspector.moveSplitCursor({} as PointerEvent, 'front');
    assert.equal(inspector.splitMarkers()[0]!.at, 130); assert.equal(checkpoints, 0);
    inspector.insertSplitPoint('front');
    assert.equal(model.activeCabinet().state.shape!.top[1]!.x, 130); assert.equal(checkpoints, 1);
});

test('one cursor per edge moves without editing; insertion uses its chosen position and preserves both slopes', () => {
    let shape: WardrobeShape = { template: 'custom', top: [{ x: 0, y: 200 }, { x: 80, y: 200 }, { x: 200, y: 260 }], back: [210, 210, 270] };
    let inserts = 0, id = 1, point = { x: 120, y: 220 };
    const cursor = createShapeSplitCursor({ current: () => ({ id, w: 200, d: 60, shape }), point: () => point,
        rebuild() {}, insert(index, x) { inserts++; shape = splitPanel(shape, index, x); } });
    assert.equal(cursor.splitMarkers().length, 2);
    assert.equal(cursor.splitMarkers()[0]!.at, 140, 'longest panel is chosen initially');
    const before = structuredClone(shape), original = cursor.splitPosition('front');
    cursor.moveSplitCursor({} as PointerEvent, 'front');
    assert.equal(cursor.splitMarkers()[0]!.at, 120);
    assert.deepEqual(shape, before); assert.equal(inserts, 0);
    cursor.restoreSplitCursor('front', original);
    assert.equal(cursor.splitMarkers()[0]!.at, 140);
    cursor.moveSplitCursor({} as PointerEvent, 'front'); cursor.insertSplitPoint('front');
    assert.equal(inserts, 1); assert.deepEqual(shape.top[2], { x: 120, y: 220 }); assert.equal(shape.back![2], 230);
    point = { x: 35, y: 200 }; cursor.moveSplitCursor({} as PointerEvent, 'rear');
    assert.equal(cursor.splitMarkers()[1]!.index, 0, 'cursor can cross onto another panel');
    id++; assert.equal(cursor.splitPosition('rear'), undefined, 'a different wardrobe starts with its own cursor');
});
test('narrow panels get no insertion controls and chosen positions retain minimum spans', () => {
    const shape: WardrobeShape = { template: 'custom', top: [{ x: 0, y: 200 }, { x: 8, y: 200 }] };
    const cursor = createShapeSplitCursor({ current: () => ({ id: 1, w: 8, d: 60, shape }), point: () => null, rebuild() {}, insert() { assert.fail(); } });
    assert.deepEqual(cursor.splitMarkers(), []); cursor.insertSplitPoint('front');
    const wide = { ...shape, top: [{ x: 0, y: 200 }, { x: 100, y: 250 }] };
    assert.deepEqual(splitPanel(wide, 0, 99).top[1], { x: 95, y: 247.5 });
});
test('camera exposes one edge, and only the captured handle remains during a drag', () => {
    const owner = new THREE.Group(), camera = new THREE.PerspectiveCamera();
    const element = (side: string, point = true, index = 0) => ({ matches: () => true,
        dataset: { side, index: String(index) }, classList: { contains: () => point } }) as unknown as HTMLElement;
    camera.position.set(0, 200, 500);
    assert.equal(shapeHandleVisible(element('front'), owner, camera, null), true);
    assert.equal(shapeHandleVisible(element('rear'), owner, camera, null), false);
    camera.position.z = -500;
    assert.equal(shapeHandleVisible(element('rear'), owner, camera, null), true);
    assert.equal(shapeHandleVisible(element('front'), owner, camera, null), false);
    const drag = { side: 'front' as const, index: 1 };
    assert.equal(shapeHandleVisible(element('front', true, 1), owner, camera, drag), true);
    assert.equal(shapeHandleVisible(element('front'), owner, camera, drag), false);
    assert.equal(shapeHandleVisible(element('front', false, 1), owner, camera, drag), false);
});
