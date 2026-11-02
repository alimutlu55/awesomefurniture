import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KITCHEN_PRESETS, createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { FRONT_GAP, KITCHEN_REVEAL_MM, hingedLeaves, kitchenReveal } from '../../src/domain/kitchen/kitchen-fronts';
import { createEditorState } from '../../src/application/projects/editor-state';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { makePiece } from '../../src/domain/make/make-parts';
import { FRONT_REVEALS_MM, frontsProblems, resolveFronts } from '../../src/domain/wardrobe/front-styles';
import { DOOR_LIMITS } from '../../src/domain/wardrobe/door-layout';
import { hinge } from '../../src/domain/wardrobe/hinges';
import { createCabinetMaterials } from '../../src/presentation/viewport/cabinet-materials';
import * as THREE from 'three';
import type { EditorState } from '../../src/application/projects/editor-scene';

/** Kitchen fronts read the front registries (P1-17): the one leaf rule, the reveal, the hinges and handles, and styles. */

const kitchen = (unit: string, preset?: string) => Object.assign(createEditorState(), createKitchenDesign(unit as never, preset)) as EditorState;
const input = (design: EditorState) => ({ pieces: [{ id: 1, name: 'K', x: 0, y: 0, z: 0, angle: 0, design }] });

test('kitchen doors split by the one leaf rule (D1/D8)', () => {
  assert.equal(hingedLeaves(0, DOOR_LIMITS.width).length, 1, 'a 60 cm front is one leaf, as before');
  assert.equal(hingedLeaves(0, 80).length, 2, 'an 80 cm front is a pair, as before');
  assert.deepEqual(hingedLeaves(0, 80).map(l => l.hinge), ['left', 'right'], 'hinged outward');
  assert.equal(hingedLeaves(0, 61).length, 2, 'wider than the hinged leaf limit: a pair (was one up to 62 cm)');
});

test('the kitchen reveal is the registry\'s 3 mm, and the fronts can set another', () => {
  assert.ok((FRONT_REVEALS_MM as readonly number[]).includes(KITCHEN_REVEAL_MM));
  assert.equal(FRONT_GAP, .3);
  const plain = kitchen('base'), wide = kitchen('base');
  wide.fronts = { reveal: 4 };
  assert.equal(kitchenReveal(plain), .3);
  const width = (s: EditorState) => { const pieces = placePieces(input(s)); const b = pieceBoards(pieces[0]!, pieces).find(x => x.stock === 'front')!; return b.x1 - b.x0; };
  assert.ok(Math.abs(width(plain) - width(wide) - .1) < 1e-9, 'a 4 mm reveal cuts the front 1 mm narrower');
});

test('a corner pull-out door hangs on blind-corner hinges; other kitchen doors as before', () => {
  for (const p of KITCHEN_PRESETS) {
    const design = kitchen(p.unit, p.key), rows = hardwareList(placePieces(input(design))).flatMap(t => t.rows).filter(r => /hinge/i.test(r[0]!));
    const corner = design.secs.flat().some(it => it.k === 'corner');
    for (const r of rows) assert.equal(r[0], corner ? hinge('corner').name : hinge('standard').name, `${p.key}: ${r[0]}`);
    const bought = makePiece(input(design), 1)?.buy.filter(b => b.kind === 'hinge') ?? [];
    for (const b of bought) assert.equal(b.size, corner ? hinge('corner').size : hinge('standard').size, `${p.key}: Make buys ${b.size}`);
  }
});

test('a kitchen unit can take Shaker fronts', () => {
  const unit = kitchen('base', 'base');
  unit.fronts = { style: 'shaker' };
  assert.deepEqual(frontsProblems(unit.fronts, unit.n), []);
  assert.equal(resolveFronts(unit).style, 'shaker');
  const materials = createCabinetMaterials({ M: (color: string) => new THREE.MeshStandardMaterial({ color }) } as never, unit);
  assert.equal(materials.door.userData.frontProfile, 'micro_shaker', 'the 3D fronts take the Shaker frame');
  assert.equal(createCabinetMaterials({ M: (color: string) => new THREE.MeshStandardMaterial({ color }) } as never, kitchen('base', 'base')).door.userData.frontProfile, 'slab');
});
