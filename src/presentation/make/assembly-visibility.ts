import * as THREE from 'three';
import type { Vec3 } from '../../domain/make/make-measures';

/** A point on the hardware being demonstrated, before its host board's assembly transform. A drawer box's front is
 * one of the box's parts while the box is built, so it is seen through then (`throughFronts`). */
export interface AssemblyTarget { readonly board: number; readonly at: Vec3; readonly throughFronts?: boolean }
export interface VisibilityBoard { readonly index: number; readonly face: THREE.Mesh; readonly rest: THREE.Vector3; readonly stock?: string }

/** Test the opaque geometry, regardless of its current cutaway material. Otherwise each frame would
 * alternate between seeing a blocker and seeing through the blocker it just made transparent. */
export function createAssemblyVisibility() {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const ray = new THREE.Raycaster(), eye = new THREE.Vector3(), point = new THREE.Vector3(), direction = new THREE.Vector3();
  let boards: readonly VisibilityBoard[] = [], proxies: THREE.Mesh[] = [];
  return {
    build(next: readonly VisibilityBoard[]) {
      boards = next;
      proxies = next.map(b => {
        const mesh = new THREE.Mesh(b.face.geometry, material);
        mesh.matrixAutoUpdate = false; mesh.userData.board = b.index;
        return mesh;
      });
    },
    blocked(camera: THREE.Camera, targets: readonly AssemblyTarget[], size: { w: number; d: number }): Set<number> {
      const blocked = new Set<number>(), byId = new Map(boards.map(b => [b.index, b]));
      camera.getWorldPosition(eye);
      boards.forEach((b, i) => proxies[i]!.matrixWorld.copy(b.face.matrixWorld));
      for (const target of targets) {
        const host = byId.get(target.board);
        if (!host) continue;
        point.set(target.at[0] - size.w / 2, target.at[1], target.at[2] - size.d / 2).sub(host.rest);
        host.face.localToWorld(point);
        const distance = direction.subVectors(point, eye).length();
        if (distance < .1) continue;
        ray.set(eye, direction.normalize()); ray.near = 0; ray.far = distance - .08;
        // Every panel before the target must be revealed, but panels behind it stay solid. Fronts stay solid, except
        // round a drawer box being built.
        for (const hit of ray.intersectObjects(proxies, false)) {
          const bIdx = hit.object.userData.board as number;
          if (byId.get(bIdx)?.stock === 'front' && !target.throughFronts) continue;
          blocked.add(bIdx);
        }
      }
      return blocked;
    },
    clear() { boards = []; proxies = []; },
    dispose() { this.clear(); material.dispose(); },
  };
}
