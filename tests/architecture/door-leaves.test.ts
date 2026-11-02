import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoLeafCount, cabinetDoorLeaves } from '../../src/domain/wardrobe/door-layout';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createEditorState } from '../../src/application/projects/editor-state';
import { piecefronts } from '../../src/domain/drawings/fronts';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { makePiece } from '../../src/domain/make/make-parts';
import type { EditorState } from '../../src/application/projects/editor-scene';

/** Automatic door leaves (D8): an opening wider than the D1 limit gets the fewest equal leaves, at most a pair, hinged
 * outward and meeting in the middle; a person can set the count and hinge per opening. */

function wardrobe(change: Partial<EditorState>) {
  const state = createEditorState();
  Object.assign(state, { n: 1, wt: [1, 1, 1, 1, 1, 1], dividers: [], doors: 'hinged', secs: [[], [], [], [], [], []] }, change);
  return state;
}
const leaves = (s: EditorState) => cabinetDoorLeaves(s, createWardrobeGeometry(() => s).widths());
const input = (s: EditorState) => ({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: s }] });

test('a 100 cm bay gets two leaves of about 49 cm, hinged left and right, meeting in the middle', () => {
  const s = wardrobe({ w: 100 }), [a, b, extra] = leaves(s);
  assert.equal(extra, undefined);
  assert.ok(Math.abs(a!.x1 - a!.x0 - 49.8) < .01 && Math.abs(b!.x1 - b!.x0 - 49.8) < .01, `${a!.x1 - a!.x0} and ${b!.x1 - b!.x0}`);
  assert.deepEqual([a!.hinge, b!.hinge], ['left', 'right']);
  assert.ok(Math.abs(b!.x0 - a!.x1 - .2) < 1e-9, 'one reveal between them');
  assert.ok(Math.abs((a!.x1 + b!.x0) / 2 - 50) < 1e-9, 'they meet in the middle');
  assert.deepEqual(piecefronts(s).fronts.map(f => f.hinge), ['left', 'right'], 'the drawings hinge them the same way');
  // Handles on the free edges: both beside the middle.
  const handles = makePiece(input(s), 1)!.fittings.filter(f => f.kind === 'handle').map(f => f.at[0]);
  assert.equal(handles.length, 2);
  for (const x of handles) assert.ok(Math.abs(x - 50) < 5, `handle at ${x} cm, not by the middle`);
});

test('the fewest equal leaves within 600 mm, at most a pair', () => {
  assert.equal(autoLeafCount(60, .2), 1);
  assert.equal(autoLeafCount(60.3, .2), 2);
  assert.equal(autoLeafCount(120.2, .2), 2);
  assert.equal(autoLeafCount(300, .2), 2, 'a wider opening keeps a pair (and the leaf-size rule asks for a partition)');
  const single = leaves(wardrobe({ w: 60 }));
  assert.equal(single.length, 1);
  assert.equal(single[0]!.hinge, 'left', 'a single leaf hinges nearer the wardrobe\'s end, as before');
  assert.equal(leaves(wardrobe({ w: 60, doorHang: 'right' }))[0]!.hinge, 'right', 'and follows the cabinet\'s hang');
});

test('the leaf count and hinge can be set per opening and per leaf', () => {
  const one = leaves(wardrobe({ w: 100, fronts: { leaves: { '0.0': { leaves: 1, hinge: 'right' } } } }));
  assert.deepEqual(one.map(l => [l.of, l.hinge]), [[1, 'right']]);
  const turned = leaves(wardrobe({ w: 100, fronts: { leaves: { '0.0.1': { hinge: 'left' } } } }));
  assert.deepEqual(turned.map(l => l.hinge), ['left', 'left']);
  const two = leaves(wardrobe({ w: 50, fronts: { leaves: { '0.0': { leaves: 2 } } } }));
  assert.equal(two.length, 2, 'a narrow opening can be set to a pair');
});

test('hinges are bought and drilled per leaf, alike in the hardware list and Make', () => {
  const s = wardrobe({ w: 200, n: 2 }), pieces = placePieces(input(s));
  assert.equal(leaves(s).length, 4);
  const count = hardwareList(pieces).flatMap(t => t.rows).filter(r => /hinge/i.test(r[0]!)).reduce((n, r) => n + Number(r[2]), 0);
  const made = makePiece(input(s), 1)!.fittings.filter(f => f.kind === 'hinge').length;
  assert.ok(count > 0);
  assert.equal(made, count, 'Make hangs as many hinges as the list buys');
  assert.deepEqual(makePiece(input(s), 1)!.findings, [], 'pairs hinged on both faces of the partition: their plates do not meet inside it');
});
