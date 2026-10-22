import * as THREE from 'three';
import { dividerRoofPatches } from '../../domain/wardrobe/shape/roof-divider';
import { resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { boardSeed, boardUVs } from './board-geometry';

/** A vertical board cut to the actual underside, including slopes along depth. */
export function roofDividerMesh(design: EditorDesign, x0: number, x1: number, base: number, material: THREE.Material) {
  const positions: number[] = [], triangle = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c);
  for (const patch of dividerRoofPatches(resolveShape(design), design.d, x0, x1)) {
    const top = patch.map(p => [p.x - design.w / 2, p.y, p.z]), bottom = patch.map(p => [p.x - design.w / 2, base, p.z]);
    for (let k = 1; k < patch.length - 1; k++) {
      triangle(top[0]!, top[k + 1]!, top[k]!); triangle(bottom[0]!, bottom[k]!, bottom[k + 1]!);
    }
    for (let k = 0; k < patch.length; k++) {
      const j = (k + 1) % patch.length;
      triangle(top[k]!, top[j]!, bottom[k]!); triangle(top[j]!, bottom[j]!, bottom[k]!);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); boardUVs(geometry, boardSeed(x0, base, 0), material.userData.grainDirection);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
