import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { cornerCabinetWidths } from '../../src/domain/kitchen/corner-widths';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { interiorFloorOf } from '../../src/domain/wardrobe/carcass';
import { PANEL } from '../../src/domain/wardrobe/catalog.js';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import { createKitchenFittingRenderer } from '../../src/presentation/viewport/kitchen-fitting-renderer';
import { piecefronts } from '../../src/domain/drawings/fronts';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { pieceOperations } from '../../src/domain/drawings/plan-operations';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';

const design = { ...createKitchenDesign('base'), w: 117.9 };
const subject = { id: 1, x: 0, y: 0, z: 0, angle: 0, state: design };
const right = { id: 2, x: 29.95, y: 0, z: 59, angle: 270, state: createKitchenDesign('base', 'base') };
const left = { ...right, x: -29.95, angle: 90 };
type Neighbours = Parameters<typeof cornerCabinetWidths>[1];

/** Render real front meshes and pulls. The supplied box builder only supplies their Three.js geometry. */
function render(d: EditorDesign, neighbours: Neighbours, handleless = false) {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const box = (w: number, h: number, depth: number, x: number, y: number, z: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), m);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  const widths = cornerCabinetWidths({ ...subject, state: d }, neighbours);
  const renderer = createKitchenFittingRenderer({ box, group, d: d.d, unit: d.unit, faceWidths: widths, cabinetWidth: d.w, handleless,
    materials: { front: material, inside: material, M: () => material } });
  const geometry = createWardrobeGeometry(() => ({ ...d, sel: 0, item: -1, divider: -1, space: null }));
  for (const [j, pos] of geometry.computeLayout(0).entries()) renderer.kitchenFitting(d.secs[0]![j]!, -d.w / 2 + PANEL + pos.off + pos.w / 2,
    pos.y0, pos.w, { bottom: interiorFloorOf(d), top: d.h - PANEL }, { left: -d.w / 2 + PANEL, right: d.w / 2 - PANEL });
  const handles = group.children.filter(o => o instanceof THREE.Group && o.children.length === 3
    && o.children.every(c => c instanceof THREE.Mesh && c.geometry.type === 'CylinderGeometry'));
  const result = { handles: handles.map(h => h.position.x + d.w / 2), fixed: group.children.filter(o => o.userData.fixedCornerReturn).length };
  group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  new Set([material, ...renderer.owned]).forEach(m => m.dispose());
  return result;
}

test('the covered cupboard leaf is a fixed corner panel with no handle; the accessible door keeps its handle', () => {
  const r = render(design, [right]);
  assert.equal(r.fixed, 1); assert.equal(r.handles.length, 1); assert.ok(r.handles[0]! < 59.9);
  const l = render(design, [left]);
  assert.equal(l.fixed, 1); assert.equal(l.handles.length, 1); assert.ok(l.handles[0]! > 58);
  assert.equal(render(design, [left, { ...right, id: 3 }]).handles.length, 0);
});

test('standalone and elevated unrelated cabinets retain their normal handles; handleless finish remains handleless', () => {
  assert.equal(render(design, []).handles.length, 2);
  assert.equal(render(design, [{ ...right, y: 142 }]).handles.length, 2);
  assert.equal(render(design, [right], true).handles.length, 0);
});

test('a dedicated corner pull-out keeps one accessible door handle and no handle on its blind panel', () => {
  const corner = { ...createKitchenDesign('base', 'corner'), w: 117.9 };
  assert.equal(render(corner, [right]).handles.length, 1);
  const mirrored = { ...corner, secs: corner.secs.map(items => items.map(it => ({ ...it, ax: 'r' as const }))) };
  assert.equal(render(mirrored, [left]).handles.length, 1);
});

test('installed drawings and hardware treat the return as fixed without changing front cutting extents', () => {
  const widths = cornerCabinetWidths(subject, [right]);
  const before = piecefronts(design).fronts, after = piecefronts(design, widths).fronts;
  assert.deepEqual(after.map(f => [f.x0, f.x1, f.y0, f.y1]), before.map(f => [f.x0, f.x1, f.y0, f.y1]));
  assert.deepEqual(after.map(f => f.opens), ['side', 'fixed']);
  const pieces = placePieces({ pieces: [subject, right].map(p => ({ ...p, name: 'Cabinet', design: p.state })) });
  const hardware = hardwareList(pieces).flatMap(t => t.rows);
  assert.equal(hardware.find(r => r[0] === 'Handle')![2], '1');
  assert.equal(hardware.find(r => r[0] === 'Concealed hinge, 110°')![2], '2');
  assert.equal(pieceOperations(pieces[0]!, pieces).length, 1, 'fixed panel has no opening envelope');
  assert.equal(pieceOperations(pieces[0]!).length, 2, 'standalone cabinet retains two doors');
  const shop = technicalDrawings({ pieces: pieces.map(p => ({ ...p })) }).find(s => s.title === 'K1  Base cabinet')!;
  const front = shop.views.find(v => v.title === 'Front')!;
  assert.equal(front.items.filter(i => i.kind === 'line' && i.stroke === 'swing').length, 1, 'fixed panel has no hinge triangle');
});
