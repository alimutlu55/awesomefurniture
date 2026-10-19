import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createShapeInspector } from '../../src/presentation/editor/shape-inspector';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry';
import { createScenePicking } from '../../src/presentation/editor/scene-picking';
import { resolveShape, shapeProblems } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { moveShapeHandle, type ShapeSide } from '../../src/domain/wardrobe/shape/shape-handle-edit';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';

function fixture(angle = 0) {
  const model = createEditorModel(), cabinet = model.activeCabinet();
  cabinet.angle = angle; cabinet.x = 20; cabinet.z = 10;
  const checkpoints: string[] = [], reports: string[] = [], planes: ShapeSide[] = [];
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => checkpoints.push(model.snapshot()), report: s => reports.push(s) });
  let pointer = { x: 0, y: 230 };
  const inspector = createShapeInspector({ model, sceneCommands: commands, dom: {} as never,
    picking: { frontPoint: (_e, side = 'front') => { planes.push(side); return pointer; } },
    selectionState: { shapeEditing: true, focusOn: true }, callbacks: { refresh() {}, rebuild() {}, histUI() {} } });
  const target = { setPointerCapture() {}, hasPointerCapture: () => false } as unknown as HTMLElement;
  const e = { pointerId: 1, preventDefault() {}, stopPropagation() {} } as PointerEvent;
  return { model, commands, inspector, target, e, checkpoints, reports, planes,
    point: (x: number, y: number) => { pointer = { x, y }; }, state: () => model.activeCabinet().state };
}

for (const side of ['front', 'rear'] as const) test(`${side} edge has its own editable heights and keyboard access`, () => {
  const f = fixture();
  const handles = f.inspector.handles();
  assert.equal(handles.filter(h => h.side === side).length, 2);
  assert.ok(handles.filter(h => h.side === side).every(h => side === 'rear' ? h.z < 0 : h.z > 0));
  f.inspector.beginHandleDrag(f.e, 0, f.target, side);
  f.point(0, 210); f.inspector.moveHandleDrag(f.e);
  assert.equal(f.checkpoints.length, 0);
  assert.equal(f.state().shape![side === 'front' ? 'top' : 'back']?.length, 2);
  f.inspector.endHandleDrag();
  assert.equal(f.state().shape!.top[0]!.y, side === 'front' ? 210 : 230);
  assert.equal(f.state().shape!.back![0], 210);
  assert.equal(f.checkpoints.length, 1);
  assert.ok(f.planes.every(p => p === side));
  f.inspector.nudge(0, 0, -1, side);
  assert.equal(f.state().shape!.top[0]!.y, side === 'front' ? 209 : 230);
  assert.equal(f.state().shape!.back![0], 209);
  assert.deepEqual(f.reports, []);
});

for (const side of ['front', 'rear'] as const) for (const angle of [0, 37, 90]) for (const index of [0, 1])
  test(`${side} corner ${index} at ${angle}° changes width and keeps the opposite side anchored`, () => {
    const f = fixture(angle), before = f.model.snapshot(), w = f.state().w, dx = index === 0 ? -20 : 20;
    const initial = structuredClone(f.model.activeCabinet()), a = angle * Math.PI / 180;
    f.inspector.beginHandleDrag(f.e, index, f.target, side);
    f.point(dx, 220); f.inspector.moveHandleDrag(f.e);
    assert.equal(f.state().w, w + 20);
    const preview = f.model.snapshot();
    // The pointer is now expressed in the recentered group's local coordinates.
    f.point(dx / 2, 220); f.inspector.moveHandleDrag(f.e);
    assert.equal(f.model.snapshot(), preview, 'a stationary finger does not accumulate width drift');
    f.inspector.endHandleDrag();
    const c = structuredClone(f.model.activeCabinet()), sign = index === 0 ? 1 : -1;
    assert.ok(Math.abs(c.x + sign * c.state.w / 2 * Math.cos(a) - initial.x - sign * w / 2 * Math.cos(a)) < 1e-6);
    assert.ok(Math.abs(c.z - sign * c.state.w / 2 * Math.sin(a) - initial.z + sign * w / 2 * Math.sin(a)) < 1e-6);
    assert.deepEqual(f.checkpoints, [before]);
    const saved = f.model.snapshot();
    f.inspector.beginHandleDrag(f.e, index, f.target, side);
    f.point(dx, 200); f.inspector.moveHandleDrag(f.e); f.inspector.endHandleDrag(true);
    assert.equal(f.model.snapshot(), saved, 'cancel restores width, both profiles, fittings and pose');
    const project = sceneToProject(createProject('shape-edit', 'Shape'), f.model.scene);
    const restored = projectToScene(deserializeProject(serializeProject(project)))!;
    assert.deepEqual(restored.wardrobes[0]!.state.shape, c.state.shape);
    assert.equal(restored.wardrobes[0]!.state.w, c.state.w);
    assert.equal(restored.wardrobes[0]!.x, c.x);
  });

test('interior joins move horizontally on either edge without changing width, and cannot cross neighbours', () => {
  for (const side of ['front', 'rear'] as const) {
    const f = fixture(); f.inspector.split(0); f.checkpoints.length = 0;
    f.inspector.beginHandleDrag(f.e, 1, f.target, side); f.point(30, 220); f.inspector.moveHandleDrag(f.e); f.inspector.endHandleDrag();
    assert.equal(f.state().w, 200); assert.equal(f.state().shape!.top[1]!.x, 130);
    assert.equal(f.state().shape!.top[1]!.y, side === 'front' ? 220 : 230);
    assert.equal(f.state().shape!.back![1], 220);
    f.inspector.beginHandleDrag(f.e, 1, f.target, side); f.point(200, 220); f.inspector.moveHandleDrag(f.e); f.inspector.endHandleDrag();
    assert.ok(f.state().shape!.top[1]!.x <= 195);
    assert.deepEqual(shapeProblems(resolveShape(f.state()), f.state().w), []);
  }
});

test('width drags stop at a neighbour and can reverse away without another gesture', () => {
  const f = fixture(), other = structuredClone(f.model.activeCabinet());
  other.id = 2; other.x = 240; f.model.scene.wardrobes.push(other);
  f.inspector.beginHandleDrag(f.e, 1, f.target, 'rear');
  f.point(80, 230); f.inspector.moveHandleDrag(f.e);
  assert.ok(f.state().w >= 219.9 && f.state().w <= 220);
  const c = f.model.activeCabinet();
  f.point(-(c.x - 20), 230); f.inspector.moveHandleDrag(f.e);
  assert.equal(f.state().w, 200);
  f.inspector.endHandleDrag();
  assert.deepEqual(f.reports, []);
});

test('side edits keep interior joins in world space and preserve the opposite profile', () => {
  const shape = { template: 'custom' as const, top: [{ x: 0, y: 200 }, { x: 60, y: 210 }, { x: 200, y: 230 }], back: [190, 195, 200] };
  const edit = moveShapeHandle(shape, 'rear', 0, -20, 5, 200);
  assert.equal(edit.w, 220); assert.equal(edit.offset, -10);
  assert.deepEqual(edit.shape.top.map(p => p.x), [0, 80, 220]);
  assert.deepEqual(edit.shape.top.map(p => p.y), [200, 210, 230]);
  assert.deepEqual(edit.shape.back, [195, 195, 200]);
  assert.deepEqual(shapeProblems(edit.shape, edit.w), []);
});

test('front and rear picking intersect the correct plane on a translated, rotated wardrobe', () => {
  const model = createEditorModel(), group = new THREE.Group();
  group.position.set(20, 15, -30); group.rotation.y = .7; group.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(45, 1, 1, 2000);
  cam.position.set(400, 300, 600); cam.lookAt(20, 130, -30); cam.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), rect = { left: 5, top: 10, width: 600, height: 600 };
  const picking = createScenePicking({ model, dom: {} as never, interactionState: { ray }, renderState: { Gr: group, hits: [] } as never,
    resources: { cam, cv: { getBoundingClientRect: () => rect } as HTMLCanvasElement, scene: new THREE.Scene() } });
  for (const side of ['front', 'rear'] as const) {
    const local = new THREE.Vector3(-50, 180, (side === 'rear' ? -1 : 1) * model.activeCabinet().state.d / 2);
    const p = group.localToWorld(local.clone()).project(cam);
    const got = picking.frontPoint({ clientX: rect.left + (p.x + 1) * 300, clientY: rect.top + (1 - p.y) * 300 }, side)!;
    assert.ok(got.distanceTo(local) < 1e-6);
  }
});


test('corner width changes respect size limits and reject invalid placement atomically', () => {
  const f = fixture(), before = f.model.snapshot();
  const shape = resolveShape(f.state());
  assert.equal(f.commands.setShape(shape, true, true, { w: 200, x: NaN, z: 10 }), false);
  assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
  f.inspector.beginHandleDrag(f.e, 1, f.target, 'rear');
  f.point(900, 230); f.inspector.moveHandleDrag(f.e);
  assert.ok(f.state().w <= 600 && f.state().w >= 599.9);
  f.inspector.endHandleDrag(true); assert.equal(f.model.snapshot(), before);
  f.inspector.beginHandleDrag(f.e, 1, f.target, 'front');
  f.point(-900, 230); f.inspector.moveHandleDrag(f.e);
  assert.ok(f.state().w >= 80 && f.state().w <= 80.1);
  f.inspector.endHandleDrag();
  assert.deepEqual(shapeProblems(resolveShape(f.state()), f.state().w), []);
});


test('narrowing refits custom fitting widths at commit and cancellation retains the original fittings', () => {
  const f = fixture();
  f.state().secs[0] = [{ k: 'short', h: 106, w: 95 }];
  const before = f.model.snapshot();
  f.inspector.beginHandleDrag(f.e, 1, f.target, 'rear');
  f.point(-30, 230); f.inspector.moveHandleDrag(f.e);
  assert.equal(f.state().secs[0]![0]!.w, 95, 'live previews leave fittings alone');
  f.inspector.endHandleDrag(true);
  assert.equal(f.model.snapshot(), before);
  f.inspector.beginHandleDrag(f.e, 1, f.target, 'rear');
  f.point(-60, 230); f.inspector.moveHandleDrag(f.e); f.inspector.endHandleDrag();
  const geometry = createWardrobeGeometry(() => f.state());
  assert.ok(f.state().secs[0]![0]!.w! <= geometry.widths()[0]! + .01);
  assert.equal(f.state().secs[0]!.length, 1);
  assert.equal(geometry.sectionLayoutValid(0), true);
  assert.equal(f.checkpoints.length, 1);
});
