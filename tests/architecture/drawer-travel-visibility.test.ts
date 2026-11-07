import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { createMakePlayer } from '../../src/presentation/make/make-player';
import { createMake3d } from '../../src/presentation/make/make-3d';

function fixture() {
  const piece = makePiece({ pieces: [{ id: 1, name: 'Screenshot cabinet', x: 0, y: 0, z: 0, angle: 0,
    design: createKitchenDesign('base', 'drawers') }] }, 1)!;
  const player = createMakePlayer(); player.load(piece);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  const renderer = createMake3d({ contact } as unknown as Parameters<typeof createMake3d>[0], new THREE.Scene());
  renderer.show(piece, { x: 0, y: 0, z: 0, angle: 0 });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(-130, 120, 160); camera.updateMatrixWorld();
  const faded = () => {
    renderer.setFilm(player.film()); renderer.updateVisibility(camera);
    return renderer.group.children.filter(o => o instanceof THREE.Mesh && o.type === 'Mesh'
      && !Array.isArray(o.material) && o.material.opacity < 1);
  };
  const dispose = () => { renderer.dispose(); contact.geometry.dispose(); contact.material.dispose(); };
  return { piece, player, faded, dispose };
}

test('screenshot regression: the last travel chapter ends with a closed, fully solid cabinet', () => {
  const f = fixture();
  // Carcass, top, back, legs; the drawer box in three (front and bottom, sides, back); runners, on, locked; fronts; travel.
  assert.equal(f.piece.steps.length, 12);
  assert.equal(f.piece.steps.at(-1)!.stage, 'drawer-test', 'the end must still be in the travel chapter');
  f.player.seek(f.player.duration);
  assert.equal(f.faded().length, 0, 'finished drawers must not leave cabinet sides or fronts translucent');
  f.dispose();
});

test('each Close drawer endpoint restores solid panels after an open demonstration, including reverse seeking', () => {
  const f = fixture(), tl = f.player.timeline!;
  const phase = tl.steps[f.piece.steps.findIndex(s => s.stage === 'drawer-test')]!;
  const count = f.piece.fittings.filter(f => f.runner).length, span = (phase.place[1] - phase.place[0]) / count;
  for (const index of [0, 1, 2, 1, 0]) {
    const open = phase.place[0] + span * (index + .45), closed = phase.place[0] + span * (index + .97);
    f.player.seek(open); assert.ok(f.faded().length > 0, 'hidden runners remain visible during the open demonstration');
    f.player.animateTo(closed); f.player.advance(f.player.duration);
    assert.equal(f.player.playing, false);
    assert.equal(f.faded().length, 0, 'closing must clear the actual translucent renderer materials');
    f.player.seek(open); f.faded();
    f.player.seek(phase.place[0] + span * index);
    assert.equal(f.faded().length, 0, 'scrubbing back to the closed start also restores solid panels');
  }
  f.dispose();
});
