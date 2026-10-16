import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createShapeInspector } from '../../src/presentation/editor/shape-inspector';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { ceilingClearance } from '../../src/domain/studio/studio-clearance';
import { ceilingPieces, ceilingMin, setPoint, splitPanel, removePoint, shapeProblems, resolveShape } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { renderCabinetFrame } from '../../src/presentation/viewport/frame-geometry';
import { loftGeometry } from '../../src/presentation/viewport/loft-geometry';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import type { PrismBuilder } from '../../src/presentation/viewport/frame-geometry';

function fixture(room = true) {
  const studio = room ? { ...rectangleStudio(400, 150), ceilings: [{ id: 'k1', wall: 'w1', run: 'across' as const, depth: 150,
    profile: [{ t: 0, y: 100 }, { t: 150, y: 260 }] }] } : undefined;
  const model = createEditorModel({ wardrobes: [{ id: 1, name: 'Wardrobe', x: -120, y: 0, z: 30, angle: 0,
    state: { ...createEditorState(), w: 160, h: room ? 100 : 220, n: 2 } }], activeWardrobe: 1, nextWardrobeId: 2, studio });
  const checkpoints: string[] = [], messages: string[] = [];
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => checkpoints.push(model.snapshot()), report: m => messages.push(m) });
  commands.followCeilings();
  let point = { x: -80, y: model.activeCabinet().state.h };
  const inspector = createShapeInspector({ dom: {} as never, model, sceneCommands: commands,
    picking: { frontPoint: () => point }, selectionState: { focusOn: true }, callbacks: { rebuild() {}, refresh() {}, histUI() {} } });
  const target = { setPointerCapture() {}, hasPointerCapture: () => false } as unknown as HTMLElement;
  const event = (pointerType: string) => ({ pointerId: 1, pointerType, preventDefault() {}, stopPropagation() {} }) as PointerEvent;
  return { model, commands, inspector, target, event, checkpoints, messages, move: (y: number) => { point = { ...point, y }; }, state: () => model.activeCabinet().state };
}

for (const pointerType of ['mouse', 'touch']) test(`${pointerType}: the existing black front handle rises while hidden rear ceiling contact stays fixed`, () => {
  const f = fixture(), before = f.model.snapshot(), e = f.event(pointerType);
  f.inspector.beginHandleDrag(e, 0, f.target);
  f.move(140); f.inspector.moveHandleDrag(e);
  assert.equal(f.state().shape!.top[0]!.y, 140, 'the pointed-to front corner rises');
  assert.equal(f.state().shape!.top[1]!.y, 100, 'the other front corner stays where it was');
  assert.deepEqual(f.state().shape!.back, [100, 100], 'rear top remains under the ceiling at the wall');
  assert.equal(f.model.activeCabinet().x, -120); assert.equal(f.model.activeCabinet().z, 30);
  assert.deepEqual(f.checkpoints, [], 'previews do not add undo entries');
  f.move(200); f.inspector.moveHandleDrag(e);
  assert.ok(f.state().shape!.top[0]!.y > 163 && f.state().shape!.top[0]!.y <= 164.5, 'the front stops at its own ceiling contact');
  f.move(135); f.inspector.moveHandleDrag(e);
  assert.equal(f.state().shape!.top[0]!.y, 135, 'reversal releases contact');
  f.inspector.endHandleDrag();
  assert.deepEqual(f.checkpoints, [before]); assert.deepEqual(f.messages, []);
  assert.equal(f.commands.settleCabinet(1), null);
  assert.equal(f.state().shape!.top[0]!.y, 135, 'settling preserves the front edit');
  const committed = f.model.snapshot();
  f.inspector.beginHandleDrag(e, 0, f.target); f.move(110); f.inspector.moveHandleDrag(e); f.inspector.endHandleDrag(true);
  assert.equal(f.model.snapshot(), committed, 'cancel restores both profiles');
  f.model.restore(before); assert.equal(f.model.snapshot(), before, 'undo restores both profiles and pose');
});

test('free-standing front growth raises the corresponding rear edge', () => {
  const f = fixture(false), e = f.event('mouse');
  f.inspector.beginHandleDrag(e, 0, f.target); f.move(240); f.inspector.moveHandleDrag(e); f.inspector.endHandleDrag();
  assert.equal(f.state().shape!.top[0]!.y, 240);
  assert.deepEqual(f.state().shape!.back, [240, 220]);
  assert.equal(f.state().shape!.top[1]!.y, 220);
});

test('front and rear geometry are rendered separately, and fittings use the lower depth clearance', () => {
  const f = fixture(), next = f.commands.frontShape(setPoint(resolveShape(f.state()), 0, { y: 140 }));
  assert.equal(f.commands.setShape(next), true);
  const shape = resolveShape(f.state()), pieces = ceilingPieces(shape);
  assert.ok(ceilingMin(pieces, 2, 158) < 100, 'fittings cannot occupy the raised front space through the low rear');
  const geometries: ReturnType<typeof loftGeometry>[] = [];
  const prism: PrismBuilder = (points, depth, z, _m, _g, rear) => { geometries.push(loftGeometry(points, depth, z, rear)); return {} as never; };
  renderCabinetFrame(f.state(), () => ({} as never), prism, { panel: {} as never, back: {} as never, plinth: {} as never });
  const top = geometries[0]!, positions = top.attributes.position!;
  let rearHeight = 0, frontHeight = 0;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getZ(i) < 0) rearHeight = Math.max(rearHeight, positions.getY(i));
    else frontHeight = Math.max(frontHeight, positions.getY(i));
  }
  assert.equal(rearHeight, 100); assert.equal(frontHeight, 140);
  const blocked = ceilingClearance(f.model.scene.studio, { ...f.model.activeCabinet(), w: 160, d: 60 });
  assert.equal(blocked(shape), false);
  assert.equal(blocked({ ...shape, back: [110, 100] }), true, 'the rear cannot penetrate the ceiling');
  assert.equal(blocked({ ...shape, top: [{ x: 0, y: 165 }, { x: 160, y: 100 }] }), true, 'the front cannot penetrate either');
  geometries.forEach(g => g.dispose());
});

test('the independent rear survives topology edits and saving', () => {
  const f = fixture(); assert.equal(f.commands.setShape(f.commands.frontShape(setPoint(resolveShape(f.state()), 0, { y: 140 }))), true);
  const split = splitPanel(f.state().shape!, 0);
  assert.deepEqual(split.back, [100, 100, 100]); assert.deepEqual(shapeProblems(split, 160), []);
  assert.deepEqual(removePoint(split, 1).back, [100, 100]);
  const document = sceneToProject(createProject('front-shape', 'Front shape'), f.model.scene);
  const restored = projectToScene(deserializeProject(serializeProject(document)))!;
  assert.deepEqual(restored.wardrobes[0]!.state.shape, f.state().shape);
});


test('rear handles lower independently, stop at the rear ceiling and reverse without leaving the session', () => {
  const f = fixture(), before = f.model.snapshot(), e = f.event('touch');
  f.inspector.beginHandleDrag(e, 0, f.target, 'rear');
  f.move(80); f.inspector.moveHandleDrag(e);
  assert.equal(f.state().shape!.top[0]!.y, 100);
  assert.equal(f.state().shape!.back![0], 80);
  f.move(130); f.inspector.moveHandleDrag(e);
  assert.ok(f.state().shape!.back![0]! <= 100.5, 'rear cannot enter the ceiling at the wall');
  f.move(85); f.inspector.moveHandleDrag(e);
  assert.equal(f.state().shape!.back![0], 85);
  f.inspector.endHandleDrag();
  assert.deepEqual(f.checkpoints, [before]);
  assert.deepEqual(f.messages, []);
});

for (const type of ['mouse', 'touch']) test(`${type}: front growth uses rear headroom up to the physical ceiling and reverses without drift`, () => {
  const f = fixture(), room = f.model.scene.studio!;
  f.model.scene.studio = { ...room, ceilings: room.ceilings!.map(c => ({ ...c, profile: [{ t: 0, y: 140 }, { t: 150, y: 260 }] })) };
  const before = f.model.snapshot(), e = f.event(type);
  f.inspector.beginHandleDrag(e, 0, f.target);
  f.move(130); f.inspector.moveHandleDrag(e);
  assert.equal(f.state().shape!.top[0]!.y, 130); assert.deepEqual(f.state().shape!.back, [130, 100]);
  f.move(160); f.inspector.moveHandleDrag(e);
  assert.equal(f.state().shape!.top[0]!.y, 160); assert.deepEqual(f.state().shape!.back, [140, 100]);
  const blocked = ceilingClearance(f.model.scene.studio, { ...f.model.activeCabinet(), w: 160, d: 60 }, 0);
  assert.equal(blocked(f.state().shape!), false, 'The entire top remains below the ceiling');
  f.move(120); f.inspector.moveHandleDrag(e); assert.deepEqual(f.state().shape!.back, [120, 100]);
  f.move(160); f.inspector.moveHandleDrag(e); f.inspector.endHandleDrag();
  assert.deepEqual(f.checkpoints, [before]); assert.deepEqual(f.state().shape!.back, [140, 100]);
  const saved = f.model.snapshot();
  f.inspector.beginHandleDrag(e, 0, f.target); f.move(175); f.inspector.moveHandleDrag(e); f.inspector.endHandleDrag(true);
  assert.equal(f.model.snapshot(), saved);
});
test('overall height edits also consume rear headroom before separating the front from the rear ceiling contact', () => {
  const f = fixture(), room = f.model.scene.studio!;
  f.model.scene.studio = { ...room, ceilings: room.ceilings!.map(c => ({ ...c, profile: [{ t: 0, y: 140 }, { t: 150, y: 260 }] })) };
  assert.equal(f.commands.setCabinetSize('h', 160), true);
  assert.deepEqual(f.state().shape!.top.map(p => p.y), [160, 160]);
  assert.deepEqual(f.state().shape!.back, [140, 140]);
});

test('several adjoining front points can raise a flat rear together to its ceiling', () => {
  const f = fixture(), room = f.model.scene.studio!;
  f.model.scene.studio = { ...room, ceilings: room.ceilings!.map(c => ({ ...c, profile: [{ t: 0, y: 140 }, { t: 150, y: 260 }] })) };
  const original = { template: 'custom' as const, top: [0, 70, 80, 160].map(x => ({ x, y: 100 })), back: [100, 100, 100, 100] };
  const requested = { ...original, top: original.top.map(p => ({ ...p, y: 160 })) };
  assert.deepEqual(f.commands.growFrontShape(requested, original).back, [140, 140, 140, 140]);
});

test('the rear does not fall back down when the front reaches its own ceiling contact', () => {
  const f = fixture(), room = f.model.scene.studio!;
  f.model.scene.studio = { ...room, ceilings: room.ceilings!.map(c => ({ ...c, profile: [{ t: 0, y: 140 }, { t: 150, y: 260 }] })) };
  const e = f.event('touch'); f.inspector.beginHandleDrag(e, 0, f.target);
  f.move(300); f.inspector.moveHandleDrag(e);
  assert.ok(f.state().shape!.top[0]!.y > 187); assert.deepEqual(f.state().shape!.back, [140, 100]);
  f.inspector.endHandleDrag(); assert.deepEqual(f.state().shape!.back, [140, 100]);
});
