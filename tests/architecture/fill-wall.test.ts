import test from 'node:test';
import assert from 'node:assert/strict';
import { startingScene } from '../../src/application/projects/editor-mapper';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { furnitureModule } from '../../src/domain/furniture/furniture';
import type { EditorCabinet } from '../../src/application/projects/editor-scene';

const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < .15, `${what}: ${a} ≠ ${b}`);
const piece = (id: number, x: number, w: number, h = 230, d = 60): EditorCabinet =>
  ({ id, name: 'Piece ' + id, x, y: 0, z: 0, angle: 0, state: Object.assign(createEditorState(), { w, h, d }) });
function scene(...pieces: EditorCabinet[]) {
  const s = startingScene();
  s.wardrobes = pieces; s.activeWardrobe = pieces[0]!.id; s.nextWardrobeId = pieces.length + 1; s.studio = undefined;
  return s;
}

test('a piece between two neighbours fills the whole stretch between them, in one undo step', () => {
  // A chest 20 cm from the wardrobe on its left and 30 cm from the one on its right: far beyond a kitchen's 15 cm reach.
  const s = scene(piece(1, 110, 80, 90, 45), piece(2, 0, 100), piece(3, 230, 100));
  let checkpoints = 0;
  const commands = createSceneCommands(() => s, { checkpoint: () => checkpoints++ });
  near(commands.fillableSpace(), 50, 'the stretch beside it');
  assert.equal(commands.fillSpace(), true);
  near(s.wardrobes[0]!.state.w, 130, 'as wide as the stretch');
  near(s.wardrobes[0]!.x, 115, 'standing in the middle of it');
  assert.equal(checkpoints, 1);
  assert.equal(commands.fillableSpace(), 0, 'nothing left to fill');
});

test('with open floor on one side there is no wall to fill to', () => {
  const s = scene(piece(1, 110, 80, 90, 45), piece(2, 0, 100));
  assert.equal(createSceneCommands(() => s).fillableSpace(), 0);
});

test('a piece never grows past the widest its kind is made', () => {
  const s = scene(piece(1, 300, 200), piece(2, 0, 100), piece(3, 900, 100)), max = furnitureModule(s.wardrobes[0]!.state).sizes(s.wardrobes[0]!.state).w[1];
  const commands = createSceneCommands(() => s);
  near(commands.fillableSpace(), max - 200, 'up to its widest');
  assert.equal(commands.fillSpace(), true);
  near(s.wardrobes[0]!.state.w, max, 'at its widest');
});

test('a gap a hair under a whole millimetre is filled to the millimetre below, never into the neighbour', () => {
  // 26.99 cm to one side and 3.005 to the other: rounded up to 30 the chest would overlap and be refused.
  const s = scene(piece(1, -132.995, 80, 90, 45), piece(2, -206 - 50 + .005, 100), piece(3, 0, 180, 75, 45));
  const commands = createSceneCommands(() => s);
  const space = commands.fillableSpace();
  assert.ok(Math.abs(space * 10 - Math.round(space * 10)) < 1e-9, `whole millimetres: ${space}`);
  assert.equal(commands.fillSpace(), true, 'filled, not refused for overlapping');
  const chest = s.wardrobes[0]!;
  assert.ok(chest.x + chest.state.w / 2 <= -90 + 1e-9, 'short of the sideboard');
});
