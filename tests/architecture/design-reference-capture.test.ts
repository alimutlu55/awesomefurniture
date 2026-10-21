import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { designReferenceCameras, referenceSubjectCorners } from '../../src/presentation/viewport/design-reference-camera';
import { neutralReferenceMaterials } from '../../src/presentation/viewport/design-reference-materials';

interface Piece { x: number; z: number; y?: number; angle?: number; w: number; h: number; d: number }
const straight: Piece[] = [{ x: 0, z: 0, w: 600, h: 240, d: 65 }];
const l: Piece[] = [
  { x: 0, z: 0, w: 420, h: 90, d: 60 },
  { x: 0, z: 0, y: 215, w: 420, h: 70, d: 35 },
  { x: -180, z: 160, angle: 90, w: 240, h: 220, d: 60 },
];
const u = [...l, { x: 180, z: 160, angle: 270, w: 240, h: 90, d: 60 }];
const rotate = (pieces: Piece[], degrees: number) => pieces.map(piece => {
  const angle = degrees * Math.PI / 180;
  return { ...piece, x: piece.x * Math.cos(angle) + piece.z * Math.sin(angle),
    z: -piece.x * Math.sin(angle) + piece.z * Math.cos(angle), angle: (piece.angle ?? 0) + degrees };
});

const layouts: Record<string, Piece[]> = { straight, l, u, rotated: rotate(l, 37), opposing: [l[2]!, u[3]!],
  tall: [{ x: 400, z: -300, y: 80, w: 90, h: 340, d: 50 }] };
for (const [name, pieces] of Object.entries(layouts)) {
  test(`all three ${name} reference cameras preserve every furniture corner with an edge margin and level verticals`, () => {
    const subject = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    for (const piece of pieces) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(piece.w, piece.h, piece.d), material);
      mesh.position.set(piece.x, (piece.y ?? 0) + piece.h / 2, piece.z);
      mesh.rotation.y = (piece.angle ?? 0) * Math.PI / 180;
      subject.add(mesh);
    }
    const cameras = designReferenceCameras(subject, pieces), points = referenceSubjectCorners(subject);
    assert.deepEqual(cameras.map(shot => shot.view), ['front', 'left', 'right']);
    assert.equal(new Set(cameras.map(shot => shot.camera.position.toArray().join(','))).size, 3);
    for (const { camera, target } of cameras) {
      assert.equal(camera.position.y, 135);
      assert.ok(Math.abs(camera.getWorldDirection(new THREE.Vector3()).y) < 1e-10);
      assert.deepEqual(target, cameras[0]!.target, 'supporting views target the complete assembly');
      for (const point of points) {
        const projected = point.clone().project(camera);
        assert.ok(Math.abs(projected.x) <= .840001 && Math.abs(projected.y) <= .840001, `${name}: corner stays within 8% image margins`);
        assert.ok(projected.z > -1 && projected.z < 1, 'geometry is inside the clipping planes');
      }
      const a = new THREE.Vector3(0, 0, 0).project(camera), b = new THREE.Vector3(0, 200, 0).project(camera);
      assert.ok(Math.abs(a.x - b.x) < 1e-10, 'vertical lines stay parallel');
    }
    subject.children.forEach(mesh => (mesh as THREE.Mesh).geometry.dispose()); material.dispose();
  });
}

test('neutral captures remove light, reflections, AO and painted shadows while preserving finish colors and textures', () => {
  const scene = new THREE.Scene(), texture = new THREE.Texture(), environment = new THREE.Texture();
  scene.environment = environment;
  const color = new THREE.Color('#b99a75').convertSRGBToLinear();
  const source = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(.72), map: texture, roughness: .2, metalness: .7 });
  source.userData.referenceColor = color.clone();
  source.userData.board = true;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source); mesh.castShadow = mesh.receiveShadow = true;
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ transparent: true, opacity: .5 }));
  const light = new THREE.DirectionalLight('#ff8800', 3); light.castShadow = true;
  scene.add(mesh, ao, glass, light);
  const capture = neutralReferenceMaterials(scene), neutral = mesh.material as unknown as THREE.MeshBasicMaterial;
  assert.ok(neutral instanceof THREE.MeshBasicMaterial);
  assert.ok(neutral.color.equals(color)); assert.equal(neutral.map, texture); assert.equal(neutral.toneMapped, false);
  assert.equal(mesh.castShadow, false); assert.equal(mesh.receiveShadow, false);
  assert.equal(scene.environment, null); assert.equal(light.visible, false); assert.equal(ao.visible, false);
  assert.equal(glass.visible, true); assert.equal(glass.material.opacity, .5);
  assert.ok(source.color.equals(color.clone().multiplyScalar(.72)), 'source material stays unchanged');
  assert.equal(source.map, texture);
  assert.equal(mesh.children.length, 1, 'panel boundaries stay legible without light or shadows');
  assert.ok(mesh.children[0] instanceof THREE.LineSegments);
  assert.equal(mesh.children[0]!.visible, true);
  let disposed = 0, textureDisposed = false;
  neutral.addEventListener('dispose', () => { disposed++; }); texture.addEventListener('dispose', () => { textureDisposed = true; });
  capture.dispose();
  assert.equal(mesh.children.length, 0, 'temporary geometry edges are removed on disposal');
  assert.equal(disposed, 1); assert.equal(textureDisposed, false, 'capture never disposes borrowed textures');
  for (const object of [mesh, ao, glass]) object.geometry.dispose();
  source.dispose(); texture.dispose(); environment.dispose();
});
