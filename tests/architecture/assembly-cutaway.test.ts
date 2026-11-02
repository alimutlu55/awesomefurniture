import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makePiece } from '../../src/domain/make/make-parts';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createMakePlayer } from '../../src/presentation/make/make-player';
import { createMake3d } from '../../src/presentation/make/make-3d';

const fixture = () => makePiece({ pieces: [{ id: 1, name: 'Drawer review', x: 0, y: 0, z: 0, angle: 0, design: {
  ...createInitialDesign(), w: 80, h: 220, d: 60, n: 1, wt: [1], doors: 'none',
  secs: [[{ k: 'drawer', h: 30 }, { k: 'drawer', h: 30 }, { k: 'drawer', h: 30 }, { k: 'shelf', h: 70 }]],
} }] }, 1)!;

test('the active screw group supplies visibility targets, without forcing chapter-wide transparency', () => {
  const piece = fixture(), player = createMakePlayer(); player.load(piece);
  const k = piece.steps.findIndex(s => s.stage === 'drawer-runners'), phase = player.timeline!.steps[k]!;
  for (const fix of phase.fixes) {
    player.seek((fix.at[0] + fix.at[1]) / 2); const film = player.film()!;
    assert.ok(film.targets!.length > 0);
    assert.ok(film.targets!.every(target => target.board === fix.board), 'only the screws currently being shown need revealing');
  }
  player.seek(player.duration); assert.deepEqual(player.film()!.targets, []);
});

test('door hanging still supplies hinge targets for camera-based visibility', () => {
  const piece = makePiece({ pieces: [{ id: 1, name: 'Hinge review', x: 0, y: 0, z: 0, angle: 0,
    design: { ...createInitialDesign(), doors: 'hinged' } }] }, 1)!;
  const player = createMakePlayer(); player.load(piece);
  const phase = player.timeline!.steps[piece.steps.findIndex(s => s.stage === 'doors')]!;
  player.seek((phase.hang[0] + phase.hang[1]) / 2);
  const hinges = piece.fittings.filter(f => f.kind === 'hinge');
  assert.ok(hinges.length > 0);
  assert.equal(player.film()!.targets!.length, hinges.length);
  player.seek(player.duration); assert.deepEqual(player.film()!.targets, []);
});

test('actual panel materials become translucent only when they block the current view, then restore on orbit', () => {
  const piece = fixture(), player = createMakePlayer(); player.load(piece); player.seek(player.duration);
  const id = piece.boards.findIndex(b => b.name === 'Side' && b.x0 < .5), b = piece.boards[id]!;
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  const resources = { contact } as unknown as Parameters<typeof createMake3d>[0];
  const scene = new THREE.Scene(), renderer = createMake3d(resources, scene), camera = new THREE.PerspectiveCamera();
  renderer.show(piece, { x: 0, y: 0, z: 0, angle: 0 });
  renderer.setFilm({ ...player.film()!, targets: [{ board: id, at: [b.x1 + .2, 180, 30] }] });
  const leftPart = piece.parts.find(p => p.ids.includes(id))!;
  const panel = renderer.group.children.find(o => o instanceof THREE.Mesh && o.type === 'Mesh' && o.userData.n === leftPart.n) as THREE.Mesh;
  const material = () => panel.material as THREE.Material;
  camera.position.set(-80, 180, 0); camera.updateMatrixWorld(); renderer.updateVisibility(camera);
  assert.ok(material().transparent && material().opacity > 0 && material().opacity <= .15);
  assert.equal(material().depthWrite, false);
  const faded = renderer.group.children.filter(o => o instanceof THREE.Mesh && o.type === 'Mesh'
    && !Array.isArray(o.material) && o.material.opacity < 1);
  assert.equal(faded.length, 1, 'unrelated cabinet panels and drawers remain solid');
  let hardware = 0;
  renderer.group.traverse(o => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) {
      hardware++; assert.equal(o.material.opacity, 1); assert.equal(o.material.transparent, false);
    }
  });
  assert.ok(hardware > 6);
  camera.position.set(0, 180, 0); camera.updateMatrixWorld(); renderer.updateVisibility(camera);
  assert.equal(material().opacity, 1, 'orbiting to the visible side restores solid wood without advancing the timeline');
  renderer.dispose(); contact.geometry.dispose(); contact.material.dispose();
});
