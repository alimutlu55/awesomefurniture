import * as THREE from 'three';
import { hob, sinkWithTap } from './furniture-parts';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';

interface Ports {
  /** The cabinet's group: the fixture is drawn in it, cabinet-centred, its underside at y = 0. */
  group: THREE.Group;
  design: Pick<EditorDesign, 'w' | 'h' | 'd' | 'unit'>;
  /** The hit-box material and the shared material factory. */
  hitMaterial: THREE.Material;
  M: (color: string, options?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  /** Materials this fixture made, so the cabinet disposes them with its own. */
  owned: THREE.Material[];
  hits: THREE.Object3D[];
  /** Measurement label and fine stroke helpers of the cabinet renderer; null when nothing is focused. */
  measure: { format(cm: number): string; label(p: THREE.Vector3, text: string, cls: string): unknown; stroke(points: THREE.Vector3[], parent: THREE.Object3D, order: number): unknown } | null;
}

/** A sink or hob that stands on its own on a worktop (a `fixture` unit): drawn as the fitting alone, as wide and deep as the
 * unit says, with a hit box so it is picked, moved and sized like any cabinet. Returns true when it drew one. */
export function drawKitchenFixture({ group, design, hitMaterial, M, owned, hits, measure }: Ports): boolean {
  const kind = kitchenUnit(design.unit).fixture;
  if (!kind) return false;
  const { w, d } = design, steel = M('#c4c8cc', { metalness: .85, roughness: .28 }), basin = M('#7d8389', { metalness: .8, roughness: .4 });
  const glass = M('#141619', { metalness: .25, roughness: .1 }), ring = M('#5d636a', { metalness: .4, roughness: .5 });
  owned.push(steel, basin, glass, ring);
  if (kind === 'sink') sinkWithTap(group, 0, 0, w, d, 0, { steel, basin, drain: glass });
  else hob(group, 0, 0, w, d, 0, { glass, ring });
  const height = Math.max(4, design.h), hit = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), hitMaterial);
  hit.position.set(0, height / 2, 0);
  hit.userData.i = 0;
  group.add(hit);
  hits.push(hit);
  if (measure) {
    const front = d / 2 + 4, side = w / 2 + 6, V = THREE.Vector3;
    const lines = [new V(-w / 2, 0, front), new V(w / 2, 0, front), new V(side, 0, -d / 2), new V(side, 0, d / 2)];
    measure.stroke(lines, group, 11);
    measure.label(new V(0, 0, front), 'W ' + measure.format(w), 'lbl dim dimension-scrubber scrub-w');
    measure.label(new V(side, 0, 0), 'D ' + measure.format(d), 'lbl dim dimension-scrubber scrub-d');
  }
  return true;
}
