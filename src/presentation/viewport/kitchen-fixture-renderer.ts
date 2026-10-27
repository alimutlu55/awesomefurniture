import { installationSlab } from '../../domain/kitchen/installation-parts';
import * as THREE from 'three';
import { hob, sinkWithTap } from './furniture-parts';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';

interface Ports {
  /** The cabinet's group: the fixture is drawn in it, cabinet-centred, its underside at y = 0. */
  group: THREE.Group;
  interactive?: boolean;
  design: Pick<EditorDesign, 'w' | 'h' | 'd' | 'unit' | 'product' | 'materials' | 'fin' | 'frontThickness' | 'plinthHeight' | 'shape'>;
  /** The hit-box material, the unit's own board material (a shelf is made of it) and the shared material factory. */
  hitMaterial: THREE.Material;
  panel: THREE.Material | undefined;
  front: THREE.Material | undefined;
  M: (color: string, options?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  /** Materials this fixture made, so the cabinet disposes them with its own. */
  owned: THREE.Material[];
  hits: THREE.Object3D[];
  /** Measurement label and fine stroke helpers of the cabinet renderer; null when nothing is focused. */
  measure: { format(cm: number): string; label(p: THREE.Vector3, text: string, cls: string): HTMLElement;
    bindRuler(el: HTMLElement, a: THREE.Vector3, b: THREE.Vector3, axis: string): void } | null;
}

/** A sink or hob that stands on its own on a worktop, or a shelf on the wall (a `fixture` unit): drawn as the fitting alone, as wide and deep as the
 * unit says, with a hit box so it is picked, moved and sized like any cabinet. Returns true when it drew one. */
export function drawKitchenFixture({ group, design, hitMaterial, panel, front, M, owned, hits, measure, interactive = true }: Ports): boolean {
  const kind = kitchenUnit(design.unit).fixture, slab = installationSlab(design);
  if (!kind && !slab) return false;
  const { w, d } = design;
  if (slab) {
    const material = slab.stock === 'front' ? front : panel;
    const geometry = new THREE.BoxGeometry(slab.x1, slab.y1 - slab.y0, slab.z1 - slab.z0);
    if (design.shape && kind !== 'shelf') {
      const frontHeight = design.shape.top[0]!.y, backHeight = design.shape.back?.[0] ?? frontHeight;
      const position = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < position.count; i++) if (position.getY(i) > 0) {
        const t = (position.getZ(i) + d / 2) / d;
        position.setY(i, backHeight + (frontHeight - backHeight) * t - (slab.y0 + slab.y1) / 2);
      }
      geometry.computeVertexNormals();
    }
    const board = new THREE.Mesh(geometry, material ?? hitMaterial);
    board.position.set(0, (slab.y0 + slab.y1) / 2, (slab.z0 + slab.z1) / 2 - d / 2);
    board.castShadow = board.receiveShadow = true; board.userData.installationPart = true; group.add(board);
  } else if (kind === 'shelf') {
    // An open board on the wall: its thickness is the unit's height, its underside the unit's elevation.
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, design.h, d), panel ?? hitMaterial);
    board.position.set(0, design.h / 2, 0);
    board.castShadow = board.receiveShadow = true;
    group.add(board);
  } else {
    const steel = M('#c4c8cc', { metalness: .85, roughness: .28 }), basin = M('#7d8389', { metalness: .8, roughness: .4 });
    const glass = M('#141619', { metalness: .25, roughness: .1 }), ring = M('#5d636a', { metalness: .4, roughness: .5 });
    owned.push(steel, basin, glass, ring);
    if (kind === 'sink') sinkWithTap(group, 0, 0, w, d, 0, { steel, basin, drain: glass });
    else hob(group, 0, 0, w, d, 0, { glass, ring });
  }
  if (!interactive && slab) return true;
  const height = Math.max(6, design.h), hit = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), hitMaterial);
  hit.position.set(0, height / 2, 0);
  hit.userData.i = 0;
  group.add(hit);
  hits.push(hit);
  if (measure) {
    const V = THREE.Vector3;
    const ruler = (a: THREE.Vector3, b: THREE.Vector3, axis: string, key: string, size: number) => {
      const el = measure.label(a.clone().add(b).multiplyScalar(.5), key.toUpperCase() + ' ' + measure.format(size),
        'lbl dim dimension-scrubber scrub-' + key);
      measure.bindRuler(el, a, b, axis);
    };
    if (slab) ruler(new V(-w / 2, 0, d / 2), new V(-w / 2, design.h, d / 2), 'height-left', 'h', design.h);
    ruler(new V(-w / 2, 0, d / 2), new V(w / 2, 0, d / 2), 'under', 'w', w);
    ruler(new V(w / 2, 0, -d / 2), new V(w / 2, 0, d / 2), 'depth', 'd', d);
  }
  return true;
}
