const { test } = require('node:test');
const assert = require('node:assert/strict');
const { STUDIO_TEMPLATES, createStudio, rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { moveCorner, extendFromCorner, addWall } = require('../src/domain/studio/studio-edit.ts');
const { wallClashes, newWallClash, sharedFloor } = require('../src/domain/studio/wall-solids.ts');
const { studioBounds } = require('../src/domain/studio/studio.ts');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createSceneCommands } = require('../src/application/commands/scene-commands.ts');

const scene = studio => {
  const model = createEditorModel({ studio, wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1 }), messages = [];
  return { model, messages, commands: createSceneCommands(() => model.scene, { checkpoint() {}, report: m => messages.push(m) }) };
};

for (const t of STUDIO_TEMPLATES) test(`${t.name}: built in, and after adding walls one by one, no wall runs into another`, () => {
  const f = scene(createStudio(t.id)), room = studioBounds(f.model.scene.studio), closed = f.model.scene.studio.corners.every(c => f.model.scene.studio.walls.filter(w => w.a === c.id || w.b === c.id).length > 1);
  assert.equal(wallClashes(f.model.scene.studio).size, 0, 'the built-in room itself');
  for (let k = 0; k < 8; k++) {
    if (!f.commands.addStudioWall()) break;
    assert.deepEqual([...wallClashes(f.model.scene.studio)], [], `after wall ${k + 1}`);
    // A closed room's new walls stand inside it.
    if (closed) for (const c of f.model.scene.studio.corners) assert.ok(c.x >= room.x0 && c.x <= room.x1 && c.z >= room.z0 && c.z <= room.z1, `wall ${k + 1} inside the room`);
  }
});

test('the under-stairs room is too shallow for a free-standing wall 120 cm in: it goes where it fits', () => {
  const f = scene(createStudio('under-stairs')), before = f.model.scene.studio.walls.length;
  const id = f.commands.addStudioWall();
  if (id) assert.equal(wallClashes(f.model.scene.studio).size, 0);
  else assert.equal(f.model.scene.studio.walls.length, before);
});

test('a corner pushed into another wall is refused with the reason; stopping at its face is fine', () => {
  // Inside faces at z = 0 and z = 300. A wall standing out into the room, its free end then dragged forward.
  const room = rectangleStudio(400, 300), stub = addWall(room, 0, 100, 0, 200), free = stub.corners.at(-1).id, f = scene(stub);
  assert.equal(f.commands.studioProblem(moveCorner(stub, free, 0, 305)), 'Walls cannot run into each other. Stop it at the other wall’s face, or join them at a corner.');
  assert.equal(f.commands.studioProblem(moveCorner(stub, free, 0, 300)), null, 'a free end may stop at the face');
});

test('walls joined at a corner may not fold onto each other', () => {
  const room = rectangleStudio(400, 300), open = { ...room, walls: room.walls.filter(w => w.id !== 'w4') };
  // From the back wall's free left end, nearly back along the back wall (5°).
  const c1 = open.corners.find(c => c.id === 'c1'), sharp = extendFromCorner(open, 'c1', c1.x + 300, c1.z + 26);
  assert.match(newWallClash(open, sharp) ?? '', /20°/);
  const square = extendFromCorner(open, 'c1', c1.x, c1.z + 200);
  assert.equal(newWallClash(open, square), null);
});

test('a room saved with walls running into each other can still be edited, just not made worse', () => {
  const room = rectangleStudio(400, 300), clashing = addWall(room, -100, 297, 100, 297), added = clashing.walls.at(-1);
  assert.ok(sharedFloor(clashing, clashing.walls.find(w => w.id === 'w3'), added) > 100);
  assert.equal(newWallClash(clashing, moveCorner(clashing, 'c1', -216, -6)), null, 'an unrelated edit');
  assert.ok(newWallClash(clashing, moveCorner(clashing, added.b, 100, 302)), 'running in further is refused');
  assert.equal(newWallClash(clashing, moveCorner(clashing, added.b, 100, 280)), null, 'pulling it out is fine');
});
