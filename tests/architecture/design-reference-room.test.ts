import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { CEILING_SHAPES, addCeiling } from '../../src/domain/studio/studio-ceiling';
import { STUDIO_LIMITS, type Studio } from '../../src/domain/studio/studio';
import { designReferenceCameras, referenceSubjectCorners } from '../../src/presentation/viewport/design-reference-camera';
import { referenceRoomFeatures } from '../../src/presentation/viewport/design-reference-room';
import { neutralReferenceMaterials } from '../../src/presentation/viewport/design-reference-materials';

function furniture() {
  const subject = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(380, 90, 60), new THREE.MeshBasicMaterial());
  mesh.position.set(0, 45, 30); subject.add(mesh);
  return { subject, dispose: () => { mesh.geometry.dispose(); mesh.material.dispose(); } };
}

function verify(studio: Studio, angle = 0) {
  const { subject, dispose } = furniture();
  try {
    const points = referenceSubjectCorners(subject), room = referenceRoomFeatures(studio, points);
    const cameras = designReferenceCameras(subject, [{ angle }], studio);
    assert.ok(room.features.length > 0);
    assert.equal(new Set(cameras.map(shot => shot.camera.position.toArray().join(','))).size, 3, 'three distinct views');
    for (const { camera } of cameras) {
      assert.ok(Math.abs(camera.getWorldDirection(new THREE.Vector3()).y) < 1e-10, 'verticals stay level');
      for (const feature of room.features) {
        assert.ok(feature.free || camera.position.clone().sub(feature.mid).dot(feature.normal) >= -1, 'owning wall remains standing');
        assert.ok(feature.points.every(p => camera.position.y <= p.y - 19.999), 'lens stays below the entire local underside');
      }
      for (const point of [...points, ...room.features.flatMap(feature => feature.points)]) {
        const projected = point.clone().project(camera);
        assert.ok(Math.abs(projected.x) <= .840001 && Math.abs(projected.y) <= .840001, 'furniture and ceiling fit with an edge margin');
        assert.ok(projected.z > -1 && projected.z < 1, 'all geometry is inside clipping planes');
      }
    }
    return cameras;
  } finally { dispose(); }
}

test('under-stairs references lower the lens below the 105 cm soffit and include the landing', () => {
  const cameras = verify(createStudio('under-stairs'));
  assert.ok(cameras.every(({ camera, target }) => camera.position.y === 85 && target[1] === 85));
});

for (const shape of CEILING_SHAPES) test(`reference framing understands ${shape.name}, including its local underside`, () => {
  const studio = addCeiling(createStudio('bedroom'), 'w1', shape.id)!, lowest = Math.min(...studio.ceilings![0]!.profile.map(p => p.y));
  // A shape standing on the floor (a pillar) is furniture-like context, not a ceiling to frame under.
  if (lowest < STUDIO_LIMITS.minCeilingHeight) {
    const { subject, dispose } = furniture();
    try { const room = referenceRoomFeatures(studio, referenceSubjectCorners(subject)); assert.deepEqual(room.features, []); assert.ok(room.eyeHeight > 100); }
    finally { dispose(); }
    return;
  }
  verify(studio);
});

test('side views turn together to avoid lowering a ceiling wall at the corner', () => {
  const studio = addCeiling(createStudio('bedroom'), 'w1', 'landing')!;
  const cameras = verify(studio, 80);
  assert.ok(cameras[0]!.camera.position.x > 0, 'views remain toward the furniture front');
});

test('ceilings on both walls of a corner stay solid in all three references', () => {
  const studio = addCeiling(addCeiling(createStudio('bedroom'), 'w1', 'stairs')!, 'w4', 'slope')!;
  verify(studio);
});

test('rotating a studio and furniture rotates the ceiling-aware camera rig with them', () => {
  const base = createStudio('under-stairs'), { subject, dispose } = furniture();
  try {
    const angle = 137 * Math.PI / 180;
    const studio: Studio = { ...base, corners: base.corners.map(p => ({ ...p,
      x: p.x * Math.cos(angle) + p.z * Math.sin(angle) + 700,
      z: -p.x * Math.sin(angle) + p.z * Math.cos(angle) - 900 })) };
    const before = designReferenceCameras(subject, [{ angle: 0 }], base);
    subject.rotation.y = angle; subject.position.set(700, 0, -900);
    const after = designReferenceCameras(subject, [{ angle: 137 }], studio);
    for (let i = 0; i < before.length; i++) {
      const expected = before[i]!.camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(new THREE.Vector3(700, 0, -900));
      assert.ok(expected.distanceTo(after[i]!.camera.position) < .00001);
    }
  } finally { dispose(); }
});

test('a distant ceiling does not lower the lens or shrink the furniture portrait', () => {
  const { subject, dispose } = furniture();
  try {
    const base = createStudio('bedroom'), studio = addCeiling(base, 'w3', 'stairs')!;
    const points = referenceSubjectCorners(subject);
    assert.equal(referenceRoomFeatures(studio, points).features.length, 0);
    const before = designReferenceCameras(subject, [], base), after = designReferenceCameras(subject, [], studio);
    assert.deepEqual(after.map(s => s.camera.position.toArray()), before.map(s => s.camera.position.toArray()));
  } finally { dispose(); }
});

test('local framing ignores the remote low end of a long slope', () => {
  const { subject, dispose } = furniture();
  try {
    subject.scale.x = .1; subject.position.x = -40;
    const studio = createStudio('under-stairs');
    const room = referenceRoomFeatures(studio, referenceSubjectCorners(subject));
    assert.equal(room.features.length, 1, 'the nearby landing and upper slope are included');
    assert.ok(room.features[0]!.points.every(point => point.y > 190), 'the remote 105 cm end stays outside this portrait');
    assert.equal(designReferenceCameras(subject, [], studio)[0]!.camera.position.y, 135);
  } finally { dispose(); }
});

test('low flat rooms and minimum-height boxings keep the lens safely below the ceiling', () => {
  const base = createStudio('bedroom');
  const low: Studio = { ...base, walls: base.walls.map(w => ({ ...w, height: 100 })) };
  const { subject, dispose } = furniture();
  try {
    assert.equal(designReferenceCameras(subject, [], low)[0]!.camera.position.y, 80);
    const box = addCeiling(low, 'w1', 'box')!;
    const minimum: Studio = { ...box, ceilings: box.ceilings!.map(c => ({ ...c, profile: c.profile.map(p => ({ ...p, y: 40 })) })) };
    assert.ok(verify(minimum).every(({ camera }) => camera.position.y === 20));
  } finally { dispose(); }
});

test('ceiling boundaries remain legible in unlit AI references', () => {
  const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 50, 80), material);
  mesh.userData.studioCeiling = 'k1'; scene.add(mesh);
  const neutral = neutralReferenceMaterials(scene);
  try { assert.ok(mesh.children.some(child => child.userData.referenceEdge), 'physical ceiling edges survive removal of shadows'); }
  finally { neutral.dispose(); material.dispose(); mesh.geometry.dispose(); }
});
