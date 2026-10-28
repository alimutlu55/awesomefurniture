import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { millimetreTranslation } from '../../src/domain/geometry/millimetres';
import { createTactileEdits } from '../../src/application/commands/tactile-edits';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { createCabinetDrag } from '../../src/presentation/editor/cabinet-drag.js';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';

const mm = (cm: number) => Math.round(cm * 10);
function fixture(kitchen = false) {
  const state = { ...createEditorState(), w: 100, h: kitchen ? 86 : 200, d: 60, n: 1,
    ...(kitchen ? { product: 'kitchen' as const, unit: 'base' as const } : {}) };
  const model = createEditorModel({ wardrobes: [
    { id: 1, name: 'A', x: 0, y: 0, z: 0, angle: 0, state },
    { id: 2, name: 'B', x: 101, y: 0, z: 0, angle: 0, state: structuredClone(state) },
  ], activeWardrobe: 1, nextWardrobeId: 3 });
  const history = createSceneHistory(model.snapshot, model.restore);
  return { model, history, edits: createTactileEdits({ model, checkpoint: history.checkpoint }) };
}

for (const kitchen of [false, true]) test(`${kitchen ? 'kitchen' : 'wardrobe'} resize retains each 10..1 mm gap, contact, reversal and undo`, () => {
  const { model, history, edits } = fixture(kitchen), before = model.snapshot();
  edits.beginDimension('w');
  for (const gap of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 5, 10, 5]) {
    const desired = 100 + (10 - gap) / 5; // Centre growth closes half the width change on each side.
    assert.equal(edits.previewDimension(desired - 100), desired);
    const [a, b] = model.scene.wardrobes;
    assert.equal(mm(b!.x - b!.state.w / 2 - a!.x - a!.state.w / 2), gap);
  }
  edits.finish(); assert.equal(history.undoCount, 1);
  history.undo(); assert.equal(model.snapshot(), before);
});

test('pointer movement retains 10, 5 and 1 mm gaps without a modifier key', () => {
  const { model, history } = fixture(), commands = createSceneCommands(() => model.scene);
  const group = new THREE.Group(), interactionState = { wardrobeGesture: null };
  let forced = 0;
  const drag = createCabinetDrag({ model, history, interactionState, renderState: { Gr: group, hits: [] },
    dom: {}, inspector: { inside: () => false, hidePop() {}, update() {} }, camera: { camRelease() {} },
    cameraState: { el: 1 }, resources: { cv: { style: {} } },
    picking: { screenPoint: (p: THREE.Vector3) => ({ x: p.x * 100, y: p.z * 100 }),
      groundPoint: (e: { clientX: number }) => ({ x: e.clientX / 100, z: 0 }), cast: () => null },
    sceneCommands: { ...commands, alignSnap() { forced++; throw new Error('Unexpected magnetic move'); },
      wallSnap: () => null }, cabinetGeometry: createCabinetGeometry(() => model.scene.wardrobes),
    callbacks: { cancelMovement() {}, wallGuide() {}, assist() {} } } as never);
  const pointer = (x: number) => ({ clientX: x, clientY: 0, pointerType: 'mouse', shiftKey: false });
  drag.beginWardrobeDrag(pointer(0), 'floor');
  for (const gap of [5, 4, 3, 2, 1, 0, 1, 5, 10, 5]) {
    drag.moveWardrobeFromPointer(pointer((10 - gap) * 10));
    assert.equal(mm(1 - model.activeCabinet().x), gap);
  }
  assert.equal(forced, 0); drag.finishWardrobeDrag();
  assert.equal(history.undoCount, 1); history.undo(); assert.equal(model.activeCabinet().x, 0);
});

test('millimetre pointer increments preserve the exact direction of a rotated cabinet', () => {
  for (const angle of [0, 17, 37, 90, 180, 270]) {
    const a = angle * Math.PI / 180, delta = millimetreTranslation({ x: .14 * Math.cos(a), z: -.14 * Math.sin(a) }, angle);
    assert.ok(Math.abs(delta.x - .1 * Math.cos(a)) < 1e-9);
    assert.ok(Math.abs(delta.z + .1 * Math.sin(a)) < 1e-9);
  }
});


test('free fitting movement retains 5..1 mm gaps instead of using the old 5 mm placement grid', () => {
  const state = { ...createEditorState(), w: 104, h: 200, d: 60, n: 1 };
  state.secs[0] = [{ k: 'drawer', h: 20, w: 30, x: 0, y: 20 }, { k: 'sdrawer', h: 20, w: 20, x: 31, y: 20 }];
  const geometry = createWardrobeGeometry(() => state), before = JSON.stringify(state);
  for (const gap of [5, 4, 3, 2, 1]) {
    const plan = geometry.planFreeMove({ i: 0, j: 0 }, 0, { x: 1 - gap / 10, y: 20 }, { free: true });
    assert.equal(plan.valid, true);
    assert.ok('layouts' in plan && 'index' in plan);
    const layouts = plan.layouts as Record<number, { x1: number }[]>;
    assert.equal(mm(31 - layouts[0]![plan.index]!.x1), gap);
  }
  assert.equal(JSON.stringify(state), before, 'preview leaves the saved fitting positions untouched');
});
