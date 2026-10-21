import * as THREE from 'three';
import { DESIGN_REFERENCE_WIDTH, DESIGN_REFERENCE_HEIGHT, IMAGE_VIEWS } from '../../application/projects/design-image';

const EYE_HEIGHT = 135, FIELD_OF_VIEW = 45, FRAME_LIMIT = .84;

/** World-space corners of visible physical meshes, including elevated units and rotated returns. */
export function referenceSubjectCorners(subject: THREE.Object3D): THREE.Vector3[] {
  subject.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  subject.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || box.isEmpty()) return;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      points.push(new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld));
    }
  });
  return points;
}

/** Distinct facing directions contribute equally, so a long run cannot hide a short return. */
function heroAzimuth(pieces: readonly { angle?: number }[]): number {
  const directions: number[] = [];
  for (const piece of pieces) {
    const angle = (piece.angle ?? 0) * Math.PI / 180;
    if (!directions.some(other => Math.abs(Math.atan2(Math.sin(angle - other), Math.cos(angle - other))) < .35)) directions.push(angle);
  }
  const x = directions.reduce((sum, angle) => sum + Math.sin(angle), 0);
  const z = directions.reduce((sum, angle) => sum + Math.cos(angle), 0);
  // Opposing runs are photographed along the aisle, rather than from behind one of them.
  return Math.hypot(x, z) > .01 ? Math.atan2(x, z) : (directions[0] ?? 0) + Math.PI / 2;
}

/** A level 32 mm-equivalent architectural lens: every view frames the complete assembly with an 8% edge margin. */
export function designReferenceCameras(subject: THREE.Object3D, pieces: readonly { angle?: number }[]) {
  const points = referenceSubjectCorners(subject);
  if (!points.length) throw new Error('No physical furniture to photograph');
  const box = new THREE.Box3().setFromPoints(points), centre = box.getCenter(new THREE.Vector3());
  const azimuth = heroAzimuth(pieces), aspect = DESIGN_REFERENCE_WIDTH / DESIGN_REFERENCE_HEIGHT;
  const tanV = Math.tan(FIELD_OF_VIEW * Math.PI / 360) * FRAME_LIMIT, tanH = tanV * aspect;
  return IMAGE_VIEWS.map((view, index) => {
    const az = azimuth + [0, -.35, .35][index]!;
    const forward = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const target = new THREE.Vector3(centre.x, EYE_HEIGHT, centre.z);
    let distance = 120;
    for (const point of points) {
      const relative = point.clone().sub(target), depth = relative.dot(forward);
      distance = Math.max(distance, depth + Math.abs(relative.dot(right)) / tanH, depth + Math.abs(relative.y) / tanV);
    }
    const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, aspect, Math.max(1, distance * .001), distance + box.getSize(new THREE.Vector3()).length() + 1000);
    camera.position.copy(target).addScaledVector(forward, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    return { view, camera, target: target.toArray() };
  });
}
