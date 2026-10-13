import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { moveCorner, translateStudio } from '../../src/domain/studio/studio-edit';
import { alignments, gapsAround, type PlacedBox } from '../../src/domain/studio/scene-gaps';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorState } from '../../src/application/projects/editor-state';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import { cornerAngle, snapCorner, wardrobeGap } from '../../src/presentation/editor/studio-drag';

/** The measuring assistant: what a carpenter reads around a wardrobe or a wall while moving or resizing it. */

const bedroom = () => translateStudio(createStudio('bedroom'), 0, -30);
const box = (o: Partial<PlacedBox> = {}): PlacedBox => ({ id: 1, x: -80, z: 0, angle: 0, w: 200, d: 60, h: 230, ...o });
const read = (gaps: ReturnType<typeof gapsAround>) => Object.fromEntries(gaps.map(g => [g.side, g.distance]));

test('gaps to the side wall, the next wardrobe, the wall behind, the room in front and the ceiling', () => {
  const a = box(), b = box({ id: 2, x: 130, w: 120 });
  const gaps = gapsAround(a, [a, b], bedroom(), ['left', 'right', 'back', 'front', 'top']);
  assert.deepEqual(read(gaps), { left: 20, right: 50, back: 0, front: 290, top: 30 });
  assert.equal(gaps.find(g => g.side === 'right')!.target, 'wardrobe');
  assert.equal(gaps.find(g => g.side === 'top')!.target, 'ceiling');
  assert.deepEqual(read(gapsAround(a, [a], undefined, ['left', 'right', 'top'])), {}, 'on an open floor, nothing to measure to');
});

test('a gap is the smallest of three readings, as a tape at the top, middle and bottom of an opening', () => {
  // The left wall leans in at the front: the gap is smaller there than at the back.
  const room = moveCorner(bedroom(), 'c4', -186, 320)!, a = box();
  const left = gapsAround(a, [a], room, ['left'])[0]!;
  assert.ok(left.distance < 20, 'smaller than at the back wall: ' + left.distance);
});

test('what it lines up with: centred, flush, fronts in line, tops level', () => {
  const room = bedroom(), mid = box({ x: 0 });
  assert.deepEqual(alignments(mid, gapsAround(mid, [mid], room, ['left', 'right']), [mid]).map(a => a.kind), ['centred']);
  const a = box({ x: -90 }), b = box({ id: 2, x: 110 });
  const kinds = alignments(a, gapsAround(a, [a, b], room, ['left', 'right', 'back']), [a, b]).map(x => x.kind);
  assert.deepEqual(kinds.sort(), ['flush', 'fronts', 'tops'], 'touching its neighbour, fronts in line, tops level');
});

function makeScene(): { scene: EditorScene; commands: ReturnType<typeof createSceneCommands> } {
  const scene: EditorScene = { activeWardrobe: 1, nextWardrobeId: 3, studio: bedroom(), wardrobes: [
    { id: 1, name: 'W1', x: -80, y: 0, z: 0, angle: 0, state: createEditorState() },
    { id: 2, name: 'W2', x: 130, y: 0, z: 0, angle: 0, state: { ...createEditorState(), w: 120, n: 1 } }] };
  return { scene, commands: createSceneCommands(() => scene) };
}

test('dragged close to lining up, a wardrobe snaps: touching its neighbour, or its front in line', () => {
  const { scene, commands } = makeScene();
  const w = scene.wardrobes[0]!;
  Object.assign(w, { x: -34 });
  assert.deepEqual(commands.alignSnap(w, 6), { x: -30, z: 0 }, 'touching the next wardrobe');
  Object.assign(w, { x: -110 });
  assert.deepEqual(commands.alignSnap(w, 6), { x: -110, z: 0 }, 'nothing within reach: stays');
  Object.assign(w, { x: -80, z: 4 });
  assert.deepEqual(commands.alignSnap(w, 6), { x: -80, z: 0 }, 'front in line with its neighbour');
});

test('pressed against the wall behind it, a dragged wardrobe still slides along it', () => {
  const { scene, commands } = makeScene();
  commands.previewTranslation(1, { x: -60, y: 0, z: -8 });
  assert.equal(scene.wardrobes[0]!.x, -60, 'moved along the wall');
  assert.equal(scene.wardrobes[0]!.z, 0, 'not into it');
});

test('a dragged corner shows its angle and snaps straight or parallel to another wall', () => {
  const room = bedroom();
  assert.equal(cornerAngle(room, 'c2')!.label, '90°');
  assert.equal(cornerAngle(room, 'c2')!.info, false, 'square: shown green');
  const leaning = moveCorner(room, 'c2', 230, -30)!;
  assert.match(cornerAngle(leaning, 'c2')!.label, /^\d+(\.5)?°$/, 'a plain reading when not square');
  assert.equal(cornerAngle(leaning, 'c2')!.info, true);
  // Two walls along a diagonal meet at c9: dragged near their line, it snaps straight (one straight run).
  const run = { template: 'custom' as const, openings: [], corners: [{ id: 'c1', x: 0, z: 0 }, { id: 'c9', x: 50, z: 50 }, { id: 'c2', x: 100, z: 100 }],
    walls: [{ id: 'w1', a: 'c1', b: 'c9', thickness: 12, height: 260 }, { id: 'w2', a: 'c9', b: 'c2', thickness: 12, height: 260 }] };
  const straight = snapCorner(run, 'c9', { x: 52, z: 49 }, { x: null, z: null, ray: null, join: null }, 4);
  assert.ok(Math.abs(straight.at.x - 50.5) < 1e-9 && Math.abs(straight.at.z - 50.5) < 1e-9, 'on the line: ' + JSON.stringify(straight.at));
  assert.equal(straight.guides[0]!.label, 'Straight');
  assert.equal(cornerAngle({ ...run, corners: run.corners.map(c => c.id === 'c9' ? { ...c, ...straight.at } : c) }, 'c9')!.label, '180°');
  // A free wall drawn near the direction of a wall at 30° snaps parallel to it.
  const free = { template: 'custom' as const, openings: [], corners: [{ id: 'c1', x: 0, z: 0 }, { id: 'c2', x: 173.2, z: 100 }, { id: 'c5', x: 0, z: 300 }, { id: 'c6', x: 100, z: 300 }],
    walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 12, height: 260 }, { id: 'w5', a: 'c5', b: 'c6', thickness: 12, height: 260 }] };
  const parallel = snapCorner(free, 'c6', { x: 130, z: 377.5 }, { x: null, z: null, ray: null, join: null }, 4);
  assert.equal(parallel.guides[0]?.label, 'Parallel');
  const dx = parallel.at.x, dz = parallel.at.z - 300;
  assert.ok(Math.abs(Math.atan2(dz, dx) * 180 / Math.PI - 30) < .01, 'at 30°, parallel to the other wall');
});

test('a wall pushed towards a wardrobe shows the gap to it', () => {
  const room = bedroom(), w = room.walls[0]!;
  const gap = wardrobeGap(room, w, [{ id: 1, x: -80, z: 60, angle: 0, w: 200, d: 60 }], new Set())!;
  assert.equal(gap.text, '60 cm');
  assert.equal(wardrobeGap(room, w, [{ id: 1, x: -80, z: 0, angle: 0, w: 200, d: 60 }], new Set()), null, 'touching: nothing to read');
  assert.equal(wardrobeGap(room, w, [{ id: 1, x: -80, z: 0, angle: 0, w: 200, d: 60 }], new Set([1])), null, 'one going with the wall is left out');
});
