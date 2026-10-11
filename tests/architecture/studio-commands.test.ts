import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudioCommands } from '../../src/application/commands/studio-commands';
import { createSceneHistory } from '../../src/application/history/scene-history';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { wallLine, type Studio } from '../../src/domain/studio/studio';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import {
  addOpening, addWall, extendFromCorner, moveCorner, moveOpening, moveWall, removeOpening, removeWall,
  setOpeningSize, setWallLength, setWallSize, splitWall,
} from '../../src/domain/studio/studio-edit';

function editor(template: 'wall' | 'bedroom' = 'wall') {
  let scene: EditorScene = { wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio: createStudio(template) };
  const messages: string[] = [];
  const snapshot = () => JSON.stringify(scene);
  const history = createSceneHistory(snapshot, saved => { scene = JSON.parse(saved); });
  const commands = createStudioCommands(() => scene, { checkpoint: () => history.checkpoint(), discardCheckpoint: () => history.discardCheckpoint(), report: m => messages.push(m) });
  return { commands, history, snapshot, messages, room: () => scene.studio! };
}

const openingPosition = (studio: Studio, id: string) => {
  const o = studio.openings.find(o => o.id === id)!;
  const line = wallLine(studio, studio.walls.find(w => w.id === o.wall)!)!;
  return [line.a.x + line.ux * o.offset, line.a.z + line.uz * o.offset];
};

test('wall length changes preserve openings on connected collinear walls', () => {
  const base = addOpening(createStudio('wall'), 'w1', 'door')!;
  const split = splitWall(base, 'w1', 100)!;
  const resized = setWallLength(split, 'w1', 150)!;
  assert.deepEqual(studioProblems(resized), []);
  assert.deepEqual(openingPosition(resized, 'o1'), openingPosition(split, 'o1'));
  const fromEnd = setWallLength(base, 'w1', 450, true)!;
  assert.deepEqual(openingPosition(fromEnd, 'o1'), openingPosition(base, 'o1'));
  assert.deepEqual(openingPosition(base, 'o1'), [0, -6], 'the input is unchanged');
});

test('shortening a wall slides an opening only enough to keep its end margin', () => {
  const base = moveOpening(addOpening(createStudio('wall'), 'w1', 'door')!, 'o1', 350)!;
  const shortened = setWallLength(base, 'w1', 300)!;
  assert.deepEqual(studioProblems(shortened), []);
  assert.equal(shortened.openings[0]!.offset, 255);
});

test('wall and corner commands each make a reversible, valid edit', () => {
  const cases: Array<[string, (room: Studio) => Studio | null]> = [
    ['move wall', room => moveWall(room, 'w1', 20)],
    ['move corner', room => moveCorner(room, 'c2', 230, 20)],
    ['length', room => setWallLength(room, 'w1', 450)],
    ['size', room => setWallSize(room, 'w1', { height: 280, thickness: 16 })],
    ['split', room => splitWall(room, 'w1')],
    ['extend end', room => extendFromCorner(room, 'c2', 200, 200)],
    ['extend start', room => extendFromCorner(room, 'c1', -200, 200)],
    ['add', room => addWall(room, -100, 200, 100, 200)],
    ['remove', room => removeWall(room, 'w1')],
  ];
  for (const [name, edit] of cases) {
    const e = editor(), before = e.snapshot();
    assert.equal(e.commands.editStudio(edit), true, name);
    assert.deepEqual(studioProblems(e.room()), [], name);
    assert.equal(e.history.undoCount, 1, name);
    const after = e.snapshot();
    assert.equal(e.history.undo(), true);
    assert.equal(e.snapshot(), before, name + ' undo');
    assert.equal(e.history.redo(), true);
    assert.equal(e.snapshot(), after, name + ' redo');
  }
});

test('door, window and archway add, move, resize and delete go through the command boundary', () => {
  for (const kind of ['door', 'window', 'archway'] as const) {
    const e = editor();
    assert.equal(e.commands.editStudio(room => addOpening(room, 'w1', kind)), true);
    assert.equal(e.commands.editStudio(room => moveOpening(room, 'o1', 100)), true);
    assert.equal(e.commands.editStudio(room => setOpeningSize(room, 'o1', { width: 90, height: 150, sill: kind === 'window' ? 70 : 0 })), true);
    assert.deepEqual(studioProblems(e.room()), []);
    assert.equal(e.room().openings[0]!.offset, 100);
    assert.equal(e.room().openings[0]!.width, 90);
    assert.equal(e.commands.editStudio(room => removeOpening(room, 'o1')), true);
    assert.equal(e.room().openings.length, 0);
    assert.equal(e.history.undoCount, 4);
    e.history.undo();
    assert.equal(e.room().openings[0]!.kind, kind);
  }
});

test('invalid edits preserve the room and history and report their reason', () => {
  const e = editor('bedroom'), before = e.snapshot();
  const cases: Array<[(room: Studio) => Studio | null, RegExp]> = [
    [room => setWallLength(room, 'w1', 10), /at least 30/],
    [room => setWallSize(room, 'w1', { height: 90 }), /height must/],
    [room => setOpeningSize(room, 'o1', { width: 500 }), /wider than its wall/],
    [room => setOpeningSize(room, 'o1', { height: 400 }), /below the top/],
    [room => splitWall(room, 'w2', 250), /must stay on its wall/],
    [room => moveCorner(room, 'c2', NaN, 0), /finite numbers/],
    [room => setWallSize(room, 'w1', { thickness: NaN }), /finite numbers/],
    [room => setOpeningSize(room, 'o1', { width: Infinity }), /finite numbers/],
  ];
  for (const [edit, reason] of cases) {
    assert.equal(e.commands.editStudio(edit), false);
    assert.match(e.messages.at(-1)!, reason);
    assert.equal(e.snapshot(), before);
    assert.equal(e.history.undoCount, 0);
  }
});

test('overlapping openings are refused without losing the last valid position', () => {
  const e = editor();
  e.commands.editStudio(room => addOpening(room, 'w1', 'door'));
  e.commands.editStudio(room => addOpening(room, 'w1', 'window'));
  const before = e.snapshot(), count = e.history.undoCount;
  assert.equal(e.commands.editStudio(room => moveOpening(room, 'o2', 200)), false);
  assert.match(e.messages.at(-1)!, /cannot overlap/);
  assert.equal(e.snapshot(), before);
  assert.equal(e.history.undoCount, count);
});

test('a room drag previews many edits with one undo checkpoint and restores the full gesture', () => {
  const e = editor(), before = e.snapshot();
  e.history.checkpoint();
  for (let step = 0; step < 20; step++) assert.equal(e.commands.editStudio(room => moveWall(room, 'w1', 1), false), true);
  assert.equal(e.history.undoCount, 1);
  const after = e.snapshot();
  assert.equal(e.commands.editStudio(room => setWallLength(room, 'w1', 5), false), false);
  assert.equal(e.snapshot(), after, 'a refused preview keeps the last valid frame');
  e.history.undo();
  assert.equal(e.snapshot(), before);
  e.history.redo();
  assert.equal(e.snapshot(), after);
});

test('missing targets and identical results do not create history', () => {
  const e = editor();
  assert.equal(e.commands.editStudio(room => moveWall(room, 'missing', 1)), false);
  assert.equal(e.commands.editStudio(room => room), false);
  assert.equal(e.history.undoCount, 0);
  e.commands.placeStudio('none');
  const count = e.history.undoCount;
  assert.equal(e.commands.editStudio(room => moveWall(room, 'w1', 1)), false);
  assert.equal(e.history.undoCount, count);
});

test('live validation explains invalid candidates without changing state, history or messages', () => {
  const e = editor(), before = e.snapshot();
  assert.equal(e.commands.studioEditProblem(moveWall(e.room(), 'w1', 20)), null);
  assert.match(e.commands.studioEditProblem(setWallLength(e.room(), 'w1', 5))!, /at least 30/);
  assert.match(e.commands.studioEditProblem(null)!, /does not fit/);
  assert.equal(e.snapshot(), before);
  assert.equal(e.history.undoCount, 0);
  assert.deepEqual(e.messages, []);
});

test('drawn and extended walls reuse snapped corners to close a custom room', () => {
  const wall = createStudio('wall');
  const right = extendFromCorner(wall, 'c2', 200, 200)!;
  const front = extendFromCorner(right, 'c3', -200, 200)!;
  const closed = extendFromCorner(front, 'c4', -200, -6)!;
  assert.equal(closed.corners.length, 4);
  assert.equal(closed.walls.at(-1)!.b, 'c1');
  assert.deepEqual(studioProblems(closed), []);
  const drawn = addWall(front, -200.01, 200.01, -200, -6);
  assert.equal(drawn.corners.length, 4);
  assert.equal(drawn.walls.at(-1)!.a, 'c4');
  assert.equal(drawn.walls.at(-1)!.b, 'c1');
  assert.deepEqual(studioProblems(drawn), []);
  assert.equal(front.corners.length, 4);
});
