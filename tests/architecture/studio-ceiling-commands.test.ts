import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { risesAbove } from '../../src/application/commands/ceiling-commands';
import { createShapeInspector } from '../../src/presentation/editor/shape-inspector';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { addCeiling, moveCeilingPoint } from '../../src/domain/studio/studio-ceiling';
import { moveWall } from '../../src/domain/studio/studio-edit';
import { maxHeight, shapeProblems } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import type { EditorCabinet } from '../../src/application/projects/editor-scene';

/** Wardrobes follow the room's ceilings, fill walls, and go with the wall they stand against. */

function scene(wardrobes: Partial<EditorCabinet>[] = [{}]) {
  const model = createEditorModel({ wardrobes: wardrobes.map((w, i) => ({ id: i + 1, name: 'W' + (i + 1), x: 0, y: 0, z: 0, angle: 0, state: createEditorState(), ...w })), activeWardrobe: 1, nextWardrobeId: wardrobes.length + 1 }, () => crypto.randomUUID());
  const messages: string[] = [];
  let checkpoints = 0;
  const commands = createSceneCommands(() => model.scene, { report: m => messages.push(m), checkpoint: () => { checkpoints++; } });
  const overlapping = () => {
    const c = createCabinetGeometry(() => model.scene.wardrobes, () => studioObstacles(model.scene.studio));
    return model.scene.wardrobes.filter(w => c.cabinetCollides(w)).map(w => w.id);
  };
  return { model, commands, messages, overlapping, checkpoints: () => checkpoints, w: (id = 1) => model.scene.wardrobes.find(x => x.id === id)! };
}

test('a wardrobe in the under-stairs room takes the stairs\' shape as the room is placed', () => {
  const s = scene();
  assert.equal(s.commands.placeStudio('under-stairs'), true);
  const state = s.w().state;
  assert.equal(state.shape?.template, 'room');
  assert.deepEqual(shapeProblems(state.shape!, state.w), []);
  assert.equal(state.h, maxHeight(state.shape!), 'its height is its tallest point');
  assert.ok(state.h <= 205, 'under the landing, not through it');
  assert.deepEqual(s.overlapping(), []);
});

test('shaping the stairs reshapes the wardrobe under them; a shape that would rise into them is refused', () => {
  const s = scene();
  s.commands.placeStudio('under-stairs');
  const before = JSON.stringify(s.w().state.shape), checkpoints = s.checkpoints();
  assert.equal(s.commands.editStudio(room => moveCeilingPoint(room, 'k1', 2, room.ceilings![0]!.profile[2]!.t, 150)), true);
  assert.notEqual(JSON.stringify(s.w().state.shape), before, 'it followed');
  assert.equal(s.checkpoints(), checkpoints + 1, 'one undo step for both');
  assert.equal(s.commands.applyShapeTemplate('regular'), false);
  assert.match(s.messages.at(-1)!, /ceiling above is lower/);
});

test('room-fitted shape edits cannot rise into the stairs, including live previews at unchanged maximum height', () => {
  const s = scene();
  s.commands.placeStudio('under-stairs');
  s.model.scene.wardrobes = [];
  const cabinet = s.commands.addCabinet(false, undefined, 'w1');
  const original = structuredClone(cabinet.state), checkpoints = s.checkpoints();
  const shape = structuredClone(original.shape!);
  const low = shape.top.find(p => p.y < original.h - 10)!;
  assert.ok(low, 'the fitted top has a lower section');
  low.y += 5;
  assert.equal(maxHeight(shape), original.h, 'the bounding box height does not change');
  assert.deepEqual(shapeProblems(shape, original.w), [], 'the edited skeleton itself is buildable');
  assert.match(s.commands.shapeEditProblem(shape)!, /ceiling above is lower/);
  for (const recordHistory of [false, true]) {
    assert.equal(s.commands.setShape(shape, recordHistory, recordHistory), false);
    assert.deepEqual(cabinet.state, original, 'shape, fittings and height are preserved');
    assert.equal(s.checkpoints(), checkpoints, 'rejected edits do not enter undo history');
  }
});

test('lowering a room-fitted top is allowed and stays a manual shape after settling', () => {
  const s = scene();
  s.commands.placeStudio('under-stairs');
  s.model.scene.wardrobes = [];
  const cabinet = s.commands.addCabinet(false, undefined, 'w1');
  const shape = structuredClone(cabinet.state.shape!);
  assert.equal(s.commands.shapeEditProblem(shape), null, 'matching steps can touch the ceiling');
  shape.top.forEach(p => { p.y -= 5; });
  assert.equal(s.commands.setShape(shape, false, false), true, 'live preview fits');
  assert.equal(cabinet.state.shape!.template, 'custom');
  assert.equal(s.commands.settleCabinet(cabinet.id), null);
  assert.deepEqual(cabinet.state.shape!.top, shape.top, 'settling preserves the lowered top');
});

test('ceiling comparison checks both sides of steps and bends between centimetre samples', () => {
  const stepped = [{ x: 0, y: 230 }, { x: 50.3, y: 230 }, { x: 50.3, y: 150 }, { x: 200, y: 150 }];
  assert.equal(risesAbove(stepped, stepped, 200), false, 'a flush step does not intersect');
  const shifted = stepped.map(p => ({ ...p, x: p.x === 50.3 ? 50.6 : p.x }));
  assert.equal(risesAbove(shifted, stepped, 200), true, 'a narrow overlap beside the step is blocked');
  const peak = [{ x: 0, y: 140 }, { x: 50.4, y: 151 }, { x: 200, y: 140 }];
  const ceiling = [{ x: 0, y: 150 }, { x: 200, y: 150 }];
  assert.equal(risesAbove(peak, ceiling, 200), true, 'the peak itself is checked');
});

test('a handle stops at the ceiling, can move back down, and commits one undo step', () => {
  const s = scene();
  s.commands.placeStudio('under-stairs');
  s.model.scene.wardrobes = [];
  const cabinet = s.commands.addCabinet(false, undefined, 'w1');
  const shape = structuredClone(cabinet.state.shape!);
  const index = shape.top.length - 1, point = shape.top[index]!;
  const state = () => s.w(cabinet.id).state;
  const checkpoints = s.checkpoints();
  let pointer = { x: point.x, y: point.y };
  const inspector = createShapeInspector({
    dom: {} as never, model: s.model, sceneCommands: s.commands,
    picking: { frontPoint: () => pointer }, selectionState: { focusOn: true },
    callbacks: { refresh() {}, rebuild() {}, histUI() {} },
  });
  const event = { pointerId: 1, preventDefault() {}, stopPropagation() {} } as PointerEvent;
  const target = { setPointerCapture() {}, hasPointerCapture: () => false } as unknown as HTMLElement;
  inspector.beginHandleDrag(event, index, target);
  pointer = { ...pointer, y: point.y + 20 };
  inspector.moveHandleDrag(event);
  assert.ok(state().shape!.top[index]!.y <= point.y + .5, 'stops at the ceiling tolerance');
  assert.match(inspector.dragReason()!.text, /ceiling above is lower/);
  assert.equal(s.checkpoints(), checkpoints, 'preview has no undo entry');
  pointer = { ...pointer, y: point.y - 5 };
  inspector.moveHandleDrag(event);
  assert.equal(state().shape!.top[index]!.y, point.y - 5, 'reversing the pointer releases the boundary');
  inspector.endHandleDrag();
  assert.equal(state().shape!.top[index]!.y, point.y - 5);
  assert.equal(s.checkpoints(), checkpoints + 1);
  inspector.beginHandleDrag(event, index, target);
  pointer = { ...pointer, y: point.y - 10 };
  inspector.moveHandleDrag(event);
  inspector.endHandleDrag(true);
  assert.equal(state().shape!.top[index]!.y, point.y - 5, 'cancel restores the committed shape');
  assert.equal(s.checkpoints(), checkpoints + 1);
});

test('shape clearance refreshes after the room or wardrobe position changes', () => {
  const s = scene();
  s.commands.placeStudio('under-stairs');
  const shape = structuredClone(s.w().state.shape!);
  shape.top.forEach(p => { p.y -= 5; });
  assert.equal(s.commands.shapeEditProblem(shape), null);
  s.w().y = 20;
  assert.match(s.commands.shapeEditProblem(shape)!, /ceiling above is lower/);
  s.w().y = 0;
  assert.equal(s.commands.shapeEditProblem(shape), null);
  s.model.scene.studio = undefined;
  shape.top.forEach(p => { p.y += 10; });
  assert.equal(s.commands.shapeEditProblem(shape), null, 'removed room no longer limits the shape');
});

test('a wardrobe moved out from under a box stands regular again; moved back, it fits under it', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  s.commands.editStudio(room => addCeiling(room, 'w1', 'box'));
  assert.equal(s.w().state.shape?.template, 'room', 'under the box');
  assert.equal(s.commands.setCabinetPose('z', 200), true);
  assert.equal(s.w().state.shape, undefined, 'out in the room: regular');
  assert.equal(s.w().state.h, 260, 'at its tallest point');
  assert.equal(s.commands.setCabinetPose('z', 30), true);
  assert.equal(s.w().state.shape?.template, 'room', 'back under it');
});

test('a wardrobe someone shapes lower than the ceiling keeps that shape', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  s.commands.editStudio(room => addCeiling(room, 'w1', 'box'));
  assert.equal(s.commands.setCabinetSize('h', 200), true, 'a height of their own');
  assert.equal(s.w().state.shape?.template, 'custom');
  s.commands.setCabinetPose('x', 2);
  assert.equal(s.w().state.shape?.template, 'custom', 'still theirs after a move');
});

test('Wardrobe on a wall fills its free stretch, fitted under the ceiling and divided at its steps', () => {
  const s = scene();
  s.commands.placeStudio('under-stairs');
  s.model.scene.wardrobes = [];
  const added = s.commands.addCabinet(false, undefined, 'w1');
  assert.equal(added.state.w, 380, 'the whole wall');
  assert.equal(added.angle, 0);
  assert.equal(added.state.shape?.template, 'room');
  assert.equal(added.state.n, 4);
  assert.deepEqual(s.overlapping(), []);
  const second = s.commands.addCabinet(false, undefined, 'w1');
  assert.match(s.messages.at(-1)!, /no free stretch/, 'no room left on that wall: says so and puts it where there is room');
  assert.deepEqual(s.overlapping(), [], 'and nothing overlaps');
  assert.ok(second);
});

test('wardrobes against a wall go with it when it moves, and stop it when they would run into something', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  const carried = s.commands.standingAgainst('w1');
  assert.deepEqual(carried.list.map(c => c.id), [1], 'the wardrobe against the back wall');
  const out = moveWall(s.model.scene.studio!, 'w1', -40)!;
  assert.equal(s.commands.studioProblem(out, carried), null);
  s.model.scene.studio = out;
  s.commands.carryWardrobes(carried, out);
  assert.equal(s.w().z, -40, 'went back with it');
  assert.deepEqual(s.overlapping(), []);
  assert.equal(s.commands.standingAgainst('w3').list.length, 0, 'nothing stands against the front wall');
  const small = scene();
  small.commands.placeStudio('walk-in');
  const held = small.commands.standingAgainst('w1');
  assert.match(small.commands.studioProblem(moveWall(held.from, 'w1', 200)!, held)!, /in the way/, 'pushed into the opposite wall: refused');
});

test('ceilings and fitted wardrobes save with the project; a broken ceiling is refused', async () => {
  const { sceneToProject, projectToScene } = await import('../../src/application/projects/editor-mapper');
  const { createProject } = await import('../../src/domain/project/project');
  const { deserializeProject, serializeProject } = await import('../../src/infrastructure/serialization/project-codec');
  const s = scene();
  s.commands.placeStudio('under-stairs');
  const json = serializeProject(sceneToProject(createProject('p', 'P'), s.model.scene as never));
  const back = projectToScene(deserializeProject(json))!;
  assert.deepEqual(back.studio, s.model.scene.studio);
  assert.deepEqual(back.wardrobes[0]!.state.shape, s.w().state.shape);
  const broken = JSON.parse(json);
  broken.studio.ceilings[0].profile[0].y = 10;
  assert.throws(() => deserializeProject(JSON.stringify(broken)), /at least 40 cm/);
});
