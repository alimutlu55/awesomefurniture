import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { makePiece } from '../../src/domain/make/make-parts';
import { HANDLE_HEIGHT, HANDLE_KINDS, handleKind, handlePlacement, resolveHandle, type HandleSize } from '../../src/domain/wardrobe/handles';
import { renderCabinetDoors } from '../../src/presentation/viewport/door-renderer';
import type { EditorState } from '../../src/application/projects/editor-scene';

/** Handle positions (P1-09): one function places every handle; the doors of a piece share a handle line, and Make drills
 * where the 3D view draws. */

function wardrobe(change: Partial<EditorState> = {}) {
  const s = createEditorState();
  Object.assign(s, { w: 200, n: 2, wt: [1, 1, 1, 1, 1, 1], doors: 'hinged', dividers: [], secs: [[], [], [], [], [], []] }, change);
  return s;
}
const made = (s: EditorState) => makePiece({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: s }] }, 1)!;

test('the doors of a piece share one handle height', () => {
  const s = wardrobe(), handles = made(s).fittings.filter(f => f.kind === 'handle');
  assert.equal(handles.length, 4);
  assert.deepEqual([...new Set(handles.map(h => h.at[1]))], [HANDLE_HEIGHT]);
  // Doors split by a shelf board: the tall lower leaves keep the line, the short upper ones sit near their bottom.
  const split = wardrobe({ n: 1, w: 100, h: 240, dividers: [{ i: 0, orientation: 'horizontal', x0: 0, x1: 96.4, y: 180 }] });
  const ys = made(split).fittings.filter(f => f.kind === 'handle').map(f => f.at[1]).sort((a, b) => a - b);
  assert.equal(ys[0], ys[1], 'the lower pair shares a height');
  assert.equal(ys[2], ys[3], 'the upper pair shares a height');
});

/** Every handle the 3D view draws on the doors, in piece coordinates (x from the left outer face, y from the floor). */
function drawn(s: EditorState) {
  const group = new THREE.Group(), mat = new THREE.MeshStandardMaterial();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const pivots = renderCabinetDoors(s, createWardrobeGeometry(() => s).widths(), group, box as never, (() => new THREE.Mesh()) as never, { M: () => mat } as never, mat, mat);
  return pivots.flatMap(p => p.children.filter(c => c instanceof THREE.Group).map(pull => [p.position.x + pull.position.x + s.w / 2, pull.position.y]));
}

test('Make drills the handles where the 3D view draws them, for every kind', () => {
  for (const kind of HANDLE_KINDS) {
    const size = (handleKind(kind).sizes as readonly HandleSize[])[0];
    const s = wardrobe();
    s.materials = { ...s.materials!, handleKind: kind, ...(size === undefined ? {} : { handleSize: size }) };
    const three = drawn(s).sort((a, b) => a[0]! - b[0]!), make = made(s).fittings.filter(f => f.kind === 'handle').map(f => [f.at[0], f.at[1]]).sort((a, b) => a[0]! - b[0]!);
    assert.equal(three.length, make.length, `${kind}: a handle on every leaf`);
    three.forEach(([x, y], k) => {
      assert.ok(Math.abs(x! - make[k]![0]!) < .05 && Math.abs(y! - make[k]![1]!) < .05, `${kind}: drawn at ${x}, ${y}; drilled at ${make[k]}`);
    });
  }
});

test('drawer handles are level, centred across the front, and drilled where they are placed', () => {
  const s = wardrobe({ doors: 'none', n: 1, w: 80, secs: [[{ k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'sdrawer', h: 14 }], [], [], [], [], []] as never });
  const piece = made(s), handle = resolveHandle(s.materials);
  const fronts = piece.boards.map((b, i) => ({ b, i })).filter(({ b }) => b.name === 'Drawer front');
  assert.equal(fronts.length, 3);
  for (const { b, i } of fronts) {
    const at = handlePlacement({ ...b, door: false }, handle), holes = piece.holes.filter(h => h.kind === 'handle' && h.board === i);
    assert.ok(Math.abs(at.x - (b.x0 + b.x1) / 2) < 1e-9, 'centred across the front');
    assert.deepEqual(holes.map(h => [h.at[0], h.at[1]]), at.screws.map(([x, y]) => [x, y]), 'drilled at its screws');
    assert.ok(holes.every(h => h.at[1] === holes[0]!.at[1]), 'level');
  }
  assert.equal(new Set(fronts.map(({ b }) => handlePlacement({ ...b, door: false }, handle).x)).size, 1, 'one column of handles');
});
