import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssemblyVisibility, type VisibilityBoard } from '../../src/presentation/make/assembly-visibility';

function fixture() {
  const group = new THREE.Group(), material = new THREE.MeshBasicMaterial();
  const add = (index: number, x: number, z: number): VisibilityBoard => {
    const face = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 1), material); face.position.set(x, 0, z); group.add(face);
    return { index, face, rest: face.position.clone() };
  };
  const host = add(0, 0, 0), blocker = add(1, 0, 10), behind = add(2, 0, -10), unrelated = add(3, 30, 10);
  const boards = [host, blocker, behind, unrelated], visibility = createAssemblyVisibility(), camera = new THREE.PerspectiveCamera();
  visibility.build(boards);
  const blocked = (x: number, z: number) => {
    group.updateMatrixWorld(true); camera.position.set(x, 0, z); camera.updateMatrixWorld();
    return visibility.blocked(camera, [{ board: 0, at: [0, 0, .7] }], { w: 0, d: 0 });
  };
  const dispose = () => { visibility.dispose(); boards.forEach(b => b.face.geometry.dispose()); material.dispose(); };
  return { group, host, blocker, behind, unrelated, boards, visibility, camera, blocked, dispose };
}

test('only the intervening board fades; support panels, panels behind it and unrelated drawers stay solid', () => {
  const f = fixture(); assert.deepEqual([...f.blocked(0, 30)], [1]); f.dispose();
});

test('a clear oblique view needs no transparent panels, and orbiting updates the result', () => {
  const f = fixture(); assert.deepEqual([...f.blocked(30, 20)], []);
  assert.deepEqual([...f.blocked(0, 30)], [1]); assert.deepEqual([...f.blocked(30, 20)], []); f.dispose();
});

test('looking through the support panel reveals that panel too, including when the eye is inside it', () => {
  const f = fixture(); assert.deepEqual([...f.blocked(0, -.2)], [0]);
  f.behind.face.position.x = 30; assert.deepEqual([...f.blocked(0, -30)], [0]); f.dispose();
});

test('several genuine blockers are revealed without alternating frames from their transparent materials', () => {
  const f = fixture(); f.behind.face.position.z = 20;
  assert.deepEqual(new Set(f.blocked(0, 30)), new Set([1, 2]));
  const translucent = new THREE.MeshBasicMaterial({ transparent: true, opacity: .14, depthWrite: false });
  f.blocker.face.material = translucent; f.behind.face.material = translucent;
  for (let i = 0; i < 5; i++) assert.deepEqual(new Set(f.blocked(0, 30)), new Set([1, 2]));
  f.dispose(); translucent.dispose();
});

test('moving a drawer between the eye and the screws changes visibility even with a stationary camera', () => {
  const f = fixture(); f.blocker.face.position.x = 30; assert.deepEqual([...f.blocked(0, 30)], []);
  f.blocker.face.position.x = 0; assert.deepEqual([...f.blocked(0, 30)], [1]);
  f.blocker.face.position.x = 30; assert.deepEqual([...f.blocked(0, 30)], []); f.dispose();
});

test('an actual opening does not fade the surrounding board just because its bounds overlap', () => {
  const f = fixture(), outline = new THREE.Shape();
  outline.moveTo(-5, -5); outline.lineTo(5, -5); outline.lineTo(5, 5); outline.lineTo(-5, 5); outline.closePath();
  const hole = new THREE.Path(); hole.moveTo(-2, -2); hole.lineTo(-2, 2); hole.lineTo(2, 2); hole.lineTo(2, -2); hole.closePath();
  outline.holes.push(hole); f.blocker.face.geometry.dispose(); f.blocker.face.geometry = new THREE.ShapeGeometry(outline);
  f.visibility.build(f.boards); assert.deepEqual([...f.blocked(0, 30)], []); f.dispose();
});

test('no active demonstration leaves every board solid', () => {
  const f = fixture(); f.group.updateMatrixWorld(true);
  assert.deepEqual([...f.visibility.blocked(f.camera, [], { w: 0, d: 0 })], []); f.dispose();
});
