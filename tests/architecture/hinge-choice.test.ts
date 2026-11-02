import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces, type DrawingInput } from '../../src/domain/drawings/room-pieces';
import { makePiece } from '../../src/domain/make/make-parts';
import { hinge, TIGHT_SIDE } from '../../src/domain/wardrobe/hinges';
import type { EditorState } from '../../src/application/projects/editor-scene';

/** The hinge chosen for each leaf by where it is (P1-07): zero-protrusion over pull-outs, 155° beside a wall or another
 * piece, else 110°; a leaf's own setting wins. */

const alone = (design: EditorState): DrawingInput => ({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] });
const hinges = (input: DrawingInput) => hardwareList(placePieces(input)).flatMap(t => t.rows).filter(r => /hinge/i.test(r[0]!)).map(r => [r[0], Number(r[2])]);
const bought = (input: DrawingInput) => makePiece(input, input.pieces[0]!.id)!.buy.filter(b => b.kind === 'hinge').map(b => [b.size, b.qty]);
function wardrobe(change: Partial<EditorState> = {}) {
  const s = createEditorState();
  Object.assign(s, { w: 60, n: 1, wt: [1, 1, 1, 1, 1, 1], doors: 'hinged', secs: [[], [], [], [], [], []] }, change);
  return s;
}

test('a bay with a basket hangs its door on zero-protrusion hinges', () => {
  const input = alone(wardrobe({ secs: [[{ k: 'basket', h: 32 }], [], [], [], [], []] as never }));
  assert.deepEqual(hinges(input), [[hinge('zero').name, 5]]);
  assert.deepEqual(bought(input), [[hinge('zero').size, 5]], 'Make buys the same');
  assert.deepEqual(hinges(alone(wardrobe())), [[hinge('standard').name, 5]], 'an empty bay keeps 110°');
});

test('a door hinged against a wall opens on 155° hinges; one in open floor on 110°', () => {
  const built = buildFromSpec(parseDesignSpec({ specVersion: 1, room: { width: 60, depth: 300 }, wardrobes: [{ against: 1, fill: true }] }), 'p');
  assert.ok(built.ok, JSON.stringify(!built.ok && built.problems));
  const scene = projectToScene(built.project)!, c = scene.wardrobes[0]!;
  c.state.doors = 'hinged';
  const input: DrawingInput = { studio: scene.studio, pieces: [{ id: c.id, name: c.name, x: c.x, y: c.y, z: c.z, angle: c.angle, design: c.state }] };
  const placed = placePieces(input)[0]!;
  assert.ok(placed.sides.left < TIGHT_SIDE && placed.sides.right < TIGHT_SIDE, JSON.stringify(placed.sides));
  assert.deepEqual(hinges(input), [[hinge('wide').name, 5]]);
  assert.deepEqual(bought(input), [[hinge('wide').size, 5]]);
});

test('beside another wardrobe the hinge side opens wide; a pair\'s middle edges are not at an end', () => {
  const a = wardrobe({ w: 100 }), b = wardrobe({ w: 100 });
  const input: DrawingInput = { pieces: [{ id: 1, name: 'A', x: 0, y: 0, z: 0, angle: 0, design: a }, { id: 2, name: 'B', x: 100, y: 0, z: 0, angle: 0, design: b }] };
  // A's pair: left leaf hinges on A's free left end (110°), right leaf on its right end against B (155°).
  assert.deepEqual(bought(input).sort(), [['110°', 5], ['155°', 5]]);
});

test('a leaf\'s own hinge setting wins over the choice', () => {
  const input = alone(wardrobe({ secs: [[{ k: 'basket', h: 32 }], [], [], [], [], []] as never, fronts: { leaves: { '0.0': { hingeKind: 'widest' } } } }));
  assert.deepEqual(hinges(input), [[hinge('widest').name, 5]]);
});
