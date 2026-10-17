import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { moveWall, moveCorner } from '../../src/domain/studio/studio-edit';
import { studioBounds } from '../../src/domain/studio/studio';
import type { EditorCabinet } from '../../src/application/projects/editor-scene';

/** Walls are solid: wardrobes are moved, turned, resized and placed as if the room were real. */

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

test('a built-in studio goes behind the wardrobes, with their back against its wall', () => {
  const s = scene();
  assert.equal(s.model.scene.studio, undefined, 'a new scene has no room');
  assert.equal(s.commands.placeStudio('bedroom'), true);
  const b = studioBounds(s.model.scene.studio!)!;
  assert.equal(b.z0 + 12, -30, 'the wall surface touches the back of the wardrobe (depth 60, centre at z = 0)');
  assert.equal((b.x0 + b.x1) / 2, 0, 'centred on the wardrobe');
  assert.deepEqual(s.overlapping(), []);
  assert.equal(s.checkpoints(), 1, 'one undo step');
  assert.match(s.messages.at(-1)!, /Bedroom/);
});

test('dragging a wardrobe stops flush at a wall, in every direction', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  s.commands.previewTranslation(1, { x: 0, y: 0, z: -100 });
  assert.ok(Math.abs(s.w().z) < .01, 'cannot go through the back wall');
  s.commands.previewTranslation(1, { x: 1000, y: 0, z: 0 });
  assert.ok(Math.abs(s.w().x - 100) < .01, `stops with its side on the right wall (x = ${s.w().x})`);
  s.commands.previewTranslation(1, { x: 100, y: 0, z: 1000 });
  assert.ok(Math.abs(s.w().z - 290) < .01, `stops at the front wall: the room is 350 cm deep from the wardrobe's back at z = -30 (z = ${s.w().z})`);
  assert.deepEqual(s.overlapping(), []);
});

test('turning a wardrobe against a wall is stopped by the wall', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  s.commands.previewRotation(1, 30);
  assert.ok(s.w().angle < 1 || s.w().angle > 359, `its corner cannot swing through the wall (angle ${s.w().angle})`);
  assert.deepEqual(s.overlapping(), []);
});

test('turning by the handle slides a wardrobe out from the wall it stands against, and back when turned back', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  const from = { x: s.w().x, z: s.w().z };
  s.commands.previewRotation(1, 30, from);
  assert.equal(s.w().angle, 30, 'it turns as far as asked');
  assert.ok(s.w().z > from.z + 1, `it steps out from the back wall to make room (z ${s.w().z})`);
  assert.deepEqual(s.overlapping(), [], 'and never cuts into the wall');
  s.commands.previewRotation(1, 0, from);
  assert.equal(s.w().angle, 0);
  assert.deepEqual({ x: s.w().x, z: s.w().z }, from, 'turned back, it stands where it started, flush against the wall');
});

test('resizing into a wall is refused and says it is the wall', () => {
  const s = scene();
  s.commands.placeStudio('walk-in');
  assert.equal(s.commands.setCabinetSize('w', 250), false, 'the walk-in is 220 cm wide');
  assert.match(s.messages.at(-1)!, /through a wall/);
  assert.equal(s.w().state.w, 200);
});

test('a room too small for the wardrobes is refused; a bigger one moves them out of its walls', () => {
  const sideBySide = scene([{}, { x: 250 }]);
  assert.equal(sideBySide.commands.placeStudio('walk-in'), false, 'the walk-in is 220 cm wide; side by side they need 450');
  assert.match(sideBySide.messages.at(-1)!, /do not fit/);
  assert.equal(sideBySide.model.scene.studio, undefined, 'nothing changed');
  const two = scene([{}, { x: 250, z: 100 }]);
  assert.equal(two.commands.placeStudio('bedroom'), true);
  assert.deepEqual(two.overlapping(), [], 'no wardrobe is left inside a wall');
  assert.match(two.messages.at(-1)!, /moved out of the wall/);
});

test('a wall edit that would cut through a wardrobe is refused with the reason', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  const before = JSON.stringify(s.model.scene.studio);
  assert.equal(s.commands.editStudio(room => moveWall(room, 'w1', 40)), false, 'the back wall into the wardrobe');
  assert.match(s.messages.at(-1)!, /wardrobe is in the way/);
  assert.equal(JSON.stringify(s.model.scene.studio), before);
  assert.equal(s.commands.editStudio(room => moveCorner(room, 'c2', -300, 100)), false, 'the right wall would cross the left wall');
  assert.match(s.messages.at(-1)!, /cannot cross/);
  assert.equal(s.commands.editStudio(room => moveWall(room, 'w2', -50)), true, 'moving a free wall works');
  assert.equal(s.model.scene.studio!.template, 'custom');
});

test('a new wardrobe goes flush against a free wall inside the room', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  const added = s.commands.addCabinet();
  assert.ok(added);
  assert.deepEqual(s.overlapping(), []);
  const b = studioBounds(s.model.scene.studio!)!;
  assert.ok(added.x > b.x0 && added.x < b.x1 && added.z > b.z0 && added.z < b.z1, 'inside the room');
  const c = createCabinetGeometry(() => [], () => studioObstacles(s.model.scene.studio));
  const nearest = Math.min(...studioObstacles(s.model.scene.studio).map(o => c.cabinetGap(added, o)));
  assert.ok(nearest < .01, 'touching a wall');
});

test('a dragged wardrobe near a wall snaps flush and square to it', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  const snapped = s.commands.wallSnap(s.w(), { x: 40, z: 6, angle: 8 });
  assert.deepEqual(snapped, { x: 40, z: 0, angle: 0 });
  assert.equal(s.commands.wallSnap(s.w(), { x: 40, z: 60, angle: 0 }), null, 'too far from the wall');
  assert.equal(s.commands.wallSnap(s.w(), { x: 40, z: 6, angle: 45 }), null, 'turned too far');
});

test('the room saves with the project; projects without one still open', async () => {
  const { sceneToProject, projectToScene } = await import('../../src/application/projects/editor-mapper');
  const { createProject } = await import('../../src/domain/project/project');
  const { deserializeProject, serializeProject } = await import('../../src/infrastructure/serialization/project-codec');
  const s = scene();
  s.commands.placeStudio('bedroom');
  s.commands.editStudio(room => moveWall(room, 'w2', -50));
  const json = serializeProject(sceneToProject(createProject('p', 'P'), s.model.scene as never));
  const back = projectToScene(deserializeProject(json))!;
  assert.deepEqual(back.studio, s.model.scene.studio);
  const plain = scene();
  const old = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('p', 'P'), plain.model.scene as never))))!;
  assert.equal(old.studio, undefined);
  assert.equal('studio' in JSON.parse(serializeProject(sceneToProject(createProject('p', 'P'), plain.model.scene as never))), false, 'no room, no field');
  const broken = JSON.parse(json);
  const doc = broken.document ?? broken;
  doc.studio.corners[1].x = doc.studio.corners[0].x;
  assert.throws(() => deserializeProject(JSON.stringify(broken)), /Studio/, 'a broken room is rejected with the reason');
});
