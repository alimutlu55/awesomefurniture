import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { addRoomBeside, mergeStudioRoom } from '../../src/domain/studio/studio-rooms';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { newWallClash } from '../../src/domain/studio/wall-solids';
import { studioBounds } from '../../src/domain/studio/studio';

test('added rooms have unique identities, remapped wall attachments and no wall clashes', () => {
  const first = createStudio('bedroom'), second = createStudio('under-stairs');
  const fixture = { id: 'f1', wall: 'w2', kind: 'toilet', type: '', offset: 60, width: 40, depth: 60, height: 40 };
  const merged = mergeStudioRoom(first, { ...second, fixtures: [fixture] });
  const ids = [...merged.corners, ...merged.walls, ...merged.openings, ...merged.ceilings!, ...merged.fixtures!].map(v => v.id);
  assert.equal(new Set(ids).size, ids.length);
  const newWalls = merged.walls.slice(first.walls.length);
  assert.ok(newWalls.every(w => merged.corners.slice(first.corners.length).some(c => c.id === w.a)));
  for (const item of [...merged.openings.slice(first.openings.length), ...merged.ceilings!, ...merged.fixtures!]) {
    assert.ok(newWalls.some(w => w.id === item.wall));
  }
  const result = addRoomBeside(first, createStudio('l-shaped'), s => studioProblems(s)[0] ?? newWallClash(first, s));
  assert.ok(result.studio);
  assert.equal(result.studio.template, 'custom');
  assert.equal(newWallClash(first, result.studio), null);
  assert.deepEqual(studioProblems(result.studio), []);
});

test('a blocked right position falls back to the front, and total refusal changes nothing', () => {
  const first = createStudio('bedroom'), next = createStudio('l-shaped'), before = JSON.stringify(first);
  const bounds = studioBounds(first)!;
  let calls = 0;
  const result = addRoomBeside(first, next, () => ++calls === 1 ? 'A wardrobe is in the way.' : null);
  assert.equal(calls, 2);
  assert.ok(result.studio);
  assert.ok(Math.min(...result.studio.corners.slice(first.corners.length).map(c => c.z)) > bounds.z1);
  const refused = addRoomBeside(first, next, () => 'Blocked');
  assert.equal(refused.studio, null); assert.equal(refused.reason, 'Blocked');
  assert.equal(JSON.stringify(first), before);
});

test('the application skips a right-hand room whose wall would cut through furniture', async () => {
  const { createStudioCommands } = await import('../../src/application/commands/studio-commands');
  const { createEditorState } = await import('../../src/application/projects/editor-state');
  const scene = { studio: createStudio('bedroom'), activeWardrobe: 1, nextWardrobeId: 2,
    wardrobes: [{ id: 1, name: 'Wardrobe', x: 650, y: 0, z: 0, angle: 0, state: createEditorState() }] };
  const first = studioBounds(scene.studio)!;
  let checkpoints = 0;
  const commands = createStudioCommands(() => scene, { checkpoint: () => { checkpoints++; }, discardCheckpoint() {}, report() {} });
  assert.equal(commands.addStudioRoom('l-shaped'), true);
  assert.equal(checkpoints, 1);
  assert.ok(Math.min(...scene.studio.corners.slice(4).map(c => c.z)) > first.z1);
  assert.equal(scene.wardrobes[0]!.x, 650);
});
