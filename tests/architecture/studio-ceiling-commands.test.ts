import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
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
