import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makePiece } from '../../src/domain/make/make-parts';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createMakePlayer } from '../../src/presentation/make/make-player';
import { createMake3d } from '../../src/presentation/make/make-3d';

function fixture() {
  return makePiece({ pieces: [{ id: 1, name: 'Drawer review', x: 0, y: 0, z: 0, angle: 0, design: {
    ...createInitialDesign(), w: 80, h: 220, d: 60, n: 1, wt: [1], doors: 'none',
    secs: [[{ k: 'drawer', h: 30 }, { k: 'drawer', h: 30 }, { k: 'drawer', h: 30 }, { k: 'shelf', h: 70 }]],
  } }] }, 1)!;
}

test('mounting internal runner screws makes blocking cabinet and drawer panels see-through', () => {
  const piece = fixture(), player = createMakePlayer(); player.load(piece);
  const k = piece.steps.findIndex(s => s.stage === 'drawer-runners'), phase = player.timeline!.steps[k]!;
  for (const time of [phase.start, ...phase.fixes.map(f => (f.at[0] + f.at[1]) / 2)]) {
    player.seek(time); const film = player.film()!;
    piece.boards.forEach((b, i) => assert.equal(film.seeThrough!(i), b.stock !== 'front' && b.stock !== 'door'));
  }
  player.seek(player.duration);
  piece.boards.forEach((_, i) => assert.equal(player.film()!.seeThrough!(i), false, 'solid appearance returns after assembly'));
});

test('actual 3D panel materials are translucent without depth occlusion while hardware stays opaque', () => {
  const piece = fixture(), player = createMakePlayer(); player.load(piece);
  const phase = player.timeline!.steps[piece.steps.findIndex(s => s.stage === 'drawer-runners')]!;
  player.seek((phase.fixes[0]!.at[0] + phase.fixes[0]!.at[1]) / 2);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  const resources = { contact } as unknown as Parameters<typeof createMake3d>[0];
  const scene = new THREE.Scene(), renderer = createMake3d(resources, scene);
  renderer.show(piece, { x: 0, y: 0, z: 0, angle: 0 }); renderer.setFilm(player.film());
  let panels = 0, metal = 0;
  renderer.group.traverse(o => {
    if (!(o instanceof THREE.Mesh) || o.type !== 'Mesh' || Array.isArray(o.material)) return;
    const part = piece.parts.find(p => p.n === o.userData.n);
    if (part && part.stock !== 'front' && part.stock !== 'door') {
      panels++;
      assert.equal(o.material.transparent, true);
      assert.ok(o.material.opacity > 0 && o.material.opacity <= .15, 'panel silhouette remains visible');
      assert.equal(o.material.depthWrite, false, 'wood cannot hide the screws behind it');
    } else if (!part && o.material instanceof THREE.MeshLambertMaterial) {
      metal++; assert.equal(o.material.opacity, 1); assert.equal(o.material.transparent, false);
    }
  });
  assert.ok(panels > 6); assert.ok(metal > 6);
  renderer.setFilm(null);
  renderer.group.children.forEach(o => {
    const part = piece.parts.find(p => p.n === o.userData.n);
    if (o instanceof THREE.Mesh && o.type === 'Mesh' && !Array.isArray(o.material) && part && part.stock !== 'front' && part.stock !== 'door')
      assert.equal(o.material.opacity, 1, 'normal Make view does not retain the assembly cutaway');
  });
  renderer.dispose(); contact.geometry.dispose(); contact.material.dispose();
});
