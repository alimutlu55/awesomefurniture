import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AssemblyPart } from './assembly-model';

export function assemblyMaterials() {
  const line = new THREE.LineBasicMaterial({ color: new THREE.Color('#43544b').convertSRGBToLinear(), toneMapped: false });
  const paper = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fbfcf8').convertSRGBToLinear(),
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, toneMapped: false });
  const ink = new THREE.MeshBasicMaterial({ color: new THREE.Color('#59685e').convertSRGBToLinear(), toneMapped: false });
  return { line, paper, ink, dispose() { line.dispose(); paper.dispose(); ink.dispose(); } };
}

/** Metre-scaled grain follows the long axis of each board, including its thin finished edges. */
export function panelGeometry(part: AssemblyPart): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  if (part.outline) {
    const shape = new THREE.Shape(part.outline.map(([x, y]) => new THREE.Vector2(x, y)));
    geometry = new THREE.ExtrudeGeometry(shape, { depth: part.size[2], bevelEnabled: true,
      bevelSize: .001, bevelThickness: .001, bevelSegments: 1, steps: 1 });
    geometry.translate(0, 0, -part.size[2] / 2);
  } else geometry = new RoundedBoxGeometry(...part.size, 1, .0015);
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  const vertical = part.size[1] > part.size[0];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const side = Math.abs(normals.getX(i)) > .8, top = Math.abs(normals.getY(i)) > .8;
    const u = vertical ? y : x, v = top ? z : side ? z : vertical ? x : y;
    const offset = (part.position[0] * .31 + part.position[1] * .17) % 1;
    uv.setXY(i, u / 2.311 + .37 + offset, v / 1.3 + .28 + offset * .4);
  }
  return geometry;
}
