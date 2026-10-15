import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { cornerDegree, wallFace, wallLine } from '../../src/domain/studio/studio';
import { extendFromCorner, mergeCorners, moveWall, setInsideLength, suggestWall, removeWall } from '../../src/domain/studio/studio-edit';
import { studioProblems } from '../../src/domain/studio/studio-validation';

/** Building a room by hand: inside lengths, adding walls and openings, joining wall ends. */

function scene() {
  const model = createEditorModel({ wardrobes: [{ id: 1, name: 'W1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() }], activeWardrobe: 1, nextWardrobeId: 2 }, () => crypto.randomUUID());
  const messages: string[] = [];
  let checkpoints = 0;
  const commands = createSceneCommands(() => model.scene, { report: m => messages.push(m), checkpoint: () => { checkpoints++; } });
  return { model, commands, messages, checkpoints: () => checkpoints, room: () => model.scene.studio! };
}
const valid = (room: Parameters<typeof studioProblems>[0]) => studioProblems(room).length === 0;

test('a wall measures its inside face: the length a tape measure reads in the room', () => {
  const room = createStudio('bedroom');
  const lengths = room.walls.map(w => Math.round(wallFace(room, w)!.length * 10) / 10);
  assert.deepEqual(lengths, [400, 350, 400, 350], 'the bedroom is 4 × 3.5 m inside');
  const longer = setInsideLength(room, 'w1', 420)!;
  assert.equal(Math.round(wallFace(longer, longer.walls[0]!)!.length * 10) / 10, 420);
  assert.equal(Math.round(wallFace(longer, longer.walls[1]!)!.length * 10) / 10, 350, 'the side wall moved out, its length unchanged');
  const free = createStudio('wall');
  assert.equal(wallFace(free, free.walls[0]!)!.length, 400, 'a free wall measures end to end');
});

test('dropping a free wall end on another joins them and closes the room', () => {
  // A U of three walls; the fourth runs from one free end towards the other and is joined there.
  const u = extendFromCorner(createStudio('corner'), 'c3', 230, 260)!;
  const free = u.corners.filter(c => cornerDegree(u, c.id) === 1).map(c => c.id);
  assert.equal(free.length, 2);
  const almost = extendFromCorner(u, free[1]!, -176, 262)!;
  const end = almost.corners.at(-1)!.id;
  const closed = mergeCorners(almost, end, free[0]!)!;
  assert.ok(valid(closed));
  assert.ok(closed.corners.every(c => cornerDegree(closed, c.id) === 2), 'every corner has two walls');
  assert.equal(closed.walls.length, 4);
  assert.equal(mergeCorners(closed, 'c1', 'c1'), null, 'a corner cannot join itself');
});

test('a suggested wall turns into the room from a free end, then stands free in a closed room', () => {
  const wall = createStudio('wall');
  const first = suggestWall(wall, valid)!;
  const added = first.studio.walls.find(w => w.id === first.wall)!, line = wallLine(first.studio, added)!;
  assert.ok(Math.abs(line.length - 150) < .01);
  assert.ok(Math.abs(Math.abs(line.uz) - 1) < 1e-9, 'a right angle to the first wall');
  assert.ok(line.b.z > 0 || line.a.z > 0, 'into the room, in front of the wall');
  const preferred = suggestWall(wall, valid, 'w1')!;
  assert.ok(valid(preferred.studio));
  const bedroom = createStudio('bedroom');
  const inside = suggestWall(bedroom, valid)!;
  assert.ok(valid(inside.studio), 'free-standing, crossing no wall');
  assert.equal(inside.studio.walls.length, 5);
  assert.equal(suggestWall(bedroom, () => false), null, 'null when nothing fits');
});

test('Add wall and Add door, window or archway: one undo step each, refused with a reason', () => {
  const s = scene();
  const first = s.commands.addStudioWall();
  assert.equal(first, 'w1', 'with no room yet, a wall goes behind the wardrobe');
  assert.equal(s.checkpoints(), 1);
  const second = s.commands.addStudioWall(first!);
  assert.ok(second && second !== first);
  assert.equal(s.room().walls.length, 2);
  assert.equal(s.checkpoints(), 2);

  const inRoom = scene();
  inRoom.commands.placeStudio('bedroom');
  const free = inRoom.commands.addStudioWall()!, line = wallLine(inRoom.room(), inRoom.room().walls.find(w => w.id === free)!)!;
  assert.ok(Math.min(line.a.z, line.b.z) > 30 + 70, 'a free-standing wall keeps 70 cm clear of the wardrobe front');

  const t = scene();
  t.commands.placeStudio('bedroom');
  const door = t.commands.addStudioOpening('door');
  assert.ok(door);
  const o = t.room().openings.find(x => x.id === door)!;
  assert.notEqual(o.wall, 'w1', 'not behind the wardrobe on the back wall');
  const behind = t.commands.addStudioOpening('window', 'w1');
  assert.ok(behind, 'asked for that wall, it still goes there');
  assert.match(t.messages.at(-1)!, /wardrobe stands in front/);
  const before = t.checkpoints();
  t.commands.placeStudio('none');
  assert.equal(t.commands.addStudioOpening('door'), null);
  assert.match(t.messages.at(-1)!, /Add a room first/);
  assert.equal(t.checkpoints(), before + 1, 'only removing the room took a step');
});

test('studioProblem checks a room without changing anything, for drags that stop at the limit', () => {
  const s = scene();
  s.commands.placeStudio('bedroom');
  const before = JSON.stringify(s.room());
  assert.match(s.commands.studioProblem(moveWall(s.room(), 'w1', 40)!)!, /wardrobe is in the way/);
  assert.equal(s.commands.studioProblem(moveWall(s.room(), 'w3', 20)!), null);
  assert.equal(JSON.stringify(s.room()), before);
  const count = s.messages.length;
  assert.equal(s.commands.editStudio(room => moveWall(room, 'w1', 40), false, true), false);
  assert.equal(s.messages.length, count, 'a quiet preview reports nothing');
});

test('adding a wall after deleting the last one treats the empty Studio as a fresh start', () => {
  const s = scene(); s.model.scene.wardrobes = []; s.model.scene.activeWardrobe = 0;
  assert.equal(s.commands.addStudioWall(), 'w1');
  assert.ok(s.commands.editStudio(room => removeWall(room, 'w1')));
  assert.equal(s.room().walls.length, 0);
  const before = s.model.snapshot(), checkpoints = s.checkpoints(); s.messages.length = 0;
  assert.equal(s.commands.addStudioWall(), 'w1');
  assert.equal(s.room().walls.length, 1); assert.ok(valid(s.room()));
  assert.equal(s.checkpoints(), checkpoints + 1);
  assert.ok(s.messages.every(m => !m.includes('no free space')));
  s.model.restore(before); assert.equal(s.room().walls.length, 0, 'The original empty Studio is restorable');
});

test('a first wall in an empty saved Studio is placed safely behind existing wardrobes', () => {
  const s = scene();
  s.model.scene.studio = { ...createStudio('wall'), template: 'custom', corners: [], walls: [], openings: [], ceilings: [] };
  const cabinet = structuredClone(s.model.activeCabinet());
  assert.equal(s.commands.addStudioWall(), 'w1');
  assert.equal(s.commands.studioProblem(s.room()), null);
  assert.deepEqual(s.model.activeCabinet(), cabinet);
});
