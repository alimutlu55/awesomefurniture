import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultMaterials } from '../../src/domain/materials/configured-materials';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createCabinetMaterials } from '../../src/presentation/viewport/cabinet-materials';
import { renderCabinetDoors } from '../../src/presentation/viewport/door-renderer';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { FRONT_STYLES, type FrontStyle } from '../../src/domain/wardrobe/front-styles';

// Door styles in 3D: each draws a leaf as one mesh with one line, as a slab does (no draw call more per door), in a decor
// the style is made in; a handle-rail door has no handle; a style in a decor it is not made in is drawn as a slab.
const M = (color: string, options?: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), ...options });
const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent?: THREE.Object3D) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); parent?.add(mesh); return mesh;
};
function doors(style: FrontStyle, frontDecorId = 'egger-u702-st9') {
  const design = { ...createEditorState(), doors: 'hinged' as const, fronts: { style } };
  design.materials = { ...defaultMaterials(), frontDecorId, linkedDecors: false };
  const materials = createCabinetMaterials({ M }, design), geometry = createWardrobeGeometry(() => design);
  return renderCabinetDoors(design, geometry.widths(), new THREE.Group(), box, () => new THREE.Group(), { M }, materials.front, materials.hardware) as THREE.Object3D[];
}
const kinds = (pivot: THREE.Object3D) => pivot.children.map(c => c instanceof THREE.LineSegments ? 'line' : c instanceof THREE.Mesh ? 'mesh' : 'group');

test('every door style draws a leaf as one mesh and one line, as a slab does; a handle rail has no handle', () => {
  const slab = doors('slab').map(kinds);
  assert.ok(slab.length && slab.every(k => k.filter(x => x === 'mesh').length === 1 && k.filter(x => x === 'line').length === 1));
  for (const { key } of FRONT_STYLES) {
    const pivots = doors(key);
    pivots.forEach((p, i) => {
      const k = kinds(p);
      assert.equal(k.filter(x => x === 'mesh').length, 1, `${key}: one mesh`);
      assert.equal(k.filter(x => x === 'line').length, 1, `${key}: one line`);
      assert.equal(k.filter(x => x === 'group').length, key === 'rail' ? 0 : slab[i]!.filter(x => x === 'group').length, `${key}: its handle`);
    });
  }
});

test('a styled leaf keeps its size and thickness; its detail is in its one line', () => {
  for (const { key } of FRONT_STYLES.filter(s => s.key !== 'slab')) for (const pivot of doors(key)) {
    const mesh = pivot.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh, line = pivot.children.find(c => c instanceof THREE.LineSegments) as THREE.LineSegments;
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.z - 1.8) < .01, `${key}: 18 mm thick (${size.z})`);
    assert.ok(line.geometry.getAttribute('position').count > 8, `${key}: more than its outline`);
  }
});

test('a style drawn in a decor it is not made in is a slab', () => {
  for (const pivot of doors('shaker', 'egger-h1318-st10')) {
    const line = pivot.children.find(c => c instanceof THREE.LineSegments) as THREE.LineSegments;
    assert.equal(line.geometry.getAttribute('position').count, 8, 'its outline only');
  }
});

test('a handle-rail door has no handle on the hardware list, in Make or in its details: its profile is listed by length', async () => {
  const { hardwareList } = await import('../../src/domain/drawings/hardware-list');
  const { placePieces } = await import('../../src/domain/drawings/room-pieces');
  const { makePiece } = await import('../../src/domain/make/make-parts');
  const { doorFacts } = await import('../../src/presentation/editor/door-facts');
  const design = { ...createEditorState(), w: 100, doors: 'hinged' as const, fronts: { style: 'rail' as const } };
  design.materials = { ...defaultMaterials(), frontDecorId: 'egger-u702-st9', linkedDecors: false };
  const input = { pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] }, rows = hardwareList(placePieces(input)).flatMap(t => t.rows);
  assert.ok(!rows.some(r => r[0] === 'Handle'), 'no handle');
  const profile = rows.find(r => r[0] === 'Handle rail profile')!;
  assert.ok(profile && Number(profile[2]) === 2 && /mm long$/.test(profile[1]!), 'a profile for each of the two doors');
  assert.ok(!makePiece(input, 1)!.fittings.some(f => f.kind === 'handle'), 'none drilled');
  const facts = doorFacts(input, 1, '0.0.0')!;
  assert.equal(facts.handle, null); assert.equal(facts.grip, 'Handle rail');
  // The same doors as slabs keep their handles.
  const slab = { ...design, fronts: undefined };
  assert.ok(hardwareList(placePieces({ pieces: [{ ...input.pieces[0]!, design: slab }] })).flatMap(t => t.rows).some(r => r[0] === 'Handle'));
});
