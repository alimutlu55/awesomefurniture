import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES } from '../../src/domain/drawings/manufacturing-rules/index';
import { swing } from '../../src/domain/drawings/manufacturing-rules/swing';
import { pieceOperations } from '../../src/domain/drawings/plan-operations';
import { placePieces, type DrawingInput } from '../../src/domain/drawings/room-pieces';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { alone, wardrobe } from './rule-fixtures';

/** Door swing (P1-13): each leaf swings as far as its hinge opens, on the plan and in the check; a wall, a piece or a room
 * door in the way is a warning, with a filler or a fold-back hinge as the fix. */

const swings = (input: DrawingInput) => validateForManufacture(input).findings.filter(f => f.id.startsWith('swing:'));
/** One wardrobe against the back wall of a room `room` cm wide, `from` its left end, with hinged doors. */
function inRoom(room: number, width: number, from?: number): DrawingInput {
  const built = buildFromSpec(parseDesignSpec({ specVersion: 1, room: { width: room, depth: 300 }, wardrobes: [{ against: 1, width, ...(from === undefined ? {} : { from }), doors: 'hinged' }] }), 'p');
  assert.ok(built.ok, JSON.stringify(!built.ok && built.problems));
  const scene = projectToScene(built.project)!;
  return { studio: scene.studio, pieces: scene.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y, z: c.z, angle: c.angle, design: c.state })) };
}

test('a door hinged against a wall meets it swinging open: a warning, add a filler', () => {
  const found = swings(inRoom(60, 60));
  assert.equal(found.length, 1, JSON.stringify(found));
  const f = found[0]!;
  assert.equal(f.severity, 'warning');
  assert.equal(f.fix, 'Add a filler');
  assert.equal(f.measured, 0, 'no room beside it');
  assert.ok(f.limit! > 0, 'the room its swing needs');
  assert.match(f.message, /door swung to \d+° meets wall/);
});

test('with a filler wide enough beside the hinge, it opens clear', () => {
  // A 30 cm leaf on a 110° hinge swings 10.2 cm past its hinge side; 12 cm of filler gives it that room.
  assert.deepEqual(swings(inRoom(72, 30, 12)), []);
  assert.equal(swings(inRoom(65, 30, 5)).length, 1, 'too narrow a filler still meets the wall');
});

test('a wardrobe in open floor opens clear', () => {
  assert.deepEqual(swings(alone(wardrobe({ w: 200, n: 2, wt: [1, 1, 1, 1, 1, 1], doors: 'hinged' }))), []);
});

test('the plan draws each leaf\'s arc to its hinge\'s angle', () => {
  const pieces = placePieces(alone(wardrobe({ w: 60, n: 1, doors: 'hinged' })));
  const [door] = pieceOperations(pieces[0]!), pivot = door!.points[0]!, first = door!.points[1]!, last = door!.points.at(-1)!;
  const angle = (q: { x: number; y: number }) => Math.atan2(q.y - pivot.y, q.x - pivot.x);
  const swept = Math.abs(angle(last) - angle(first)) * 180 / Math.PI;
  assert.ok(Math.abs(Math.min(swept, 360 - swept) - 110) < .5, `a 110° hinge sweeps 110°, not ${swept}`);
});

test('the rule is in the list the manufacturing check runs', () => assert.ok(RULES.includes(swing)));
