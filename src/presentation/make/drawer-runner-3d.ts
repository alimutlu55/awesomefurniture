import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Fitting } from '../../domain/make/make-joints';

/** Three nested channels, ball tracks and the removable member's release lever.
 * A schematic of the modeled side-mount system, without claiming a branded runner's hole pattern. */
export function drawerRunnerMeshes(piece: MakePiece, fitting: Fitting, geometry: THREE.BufferGeometry, metal: THREE.Material) {
  if (!fitting.runner) return [];
  const length = Number(fitting.size) / 10, result: { mesh: THREE.Group; board: number; moving?: number; ratio?: number }[] = [];
  const frame = (x: number, y: number, z: number) => new THREE.Vector3(x - piece.size.w / 2, y, z - piece.size.d / 2);
  for (let k = 0; k < fitting.runner.moving.length; k++) {
    const moving = fitting.runner.moving[k]!, fixed = fitting.runner.fixed[k]!, side = piece.boards[moving]!, post = piece.boards[fixed];
    if (!post) continue;
    const sign = k === 0 ? 1 : -1, face = k === 0 ? post.x1 : post.x0, y = side.y0 + 3.2, z = side.z1 - length / 2;
    const channel = (x: number, height: number, len: number) => {
      const group = new THREE.Group(); group.position.copy(frame(x, y, z));
      const bar = (dx: number, dy: number, sx: number, sy: number, sz: number, dz = 0) => {
        const mesh = new THREE.Mesh(geometry, metal); mesh.position.set(dx, dy, dz); mesh.scale.set(sx, sy, sz); group.add(mesh);
      };
      bar(0, 0, .12, height, len);
      for (const s of [-1, 1]) bar(sign * .14, s * (height / 2 - .08), .4, .16, len);
      return { group, bar };
    };
    const outer = channel(face + sign * .16, 4.5, length);
    const middle = channel(face + sign * .58, 3.4, length * .96);
    const inner = channel(face + sign * 1.05, 2.4, length * .94);
    // Bearing cages are shown as small rollers on the middle member, between the channels.
    for (const row of [-1, 1]) for (const pos of [-.35, -.15, .05, .25])
      middle.bar(sign * .22, row * 1.1, .26, .26, .5, pos * length);
    // The visible release lever belongs to the removable drawer member.
    inner.bar(sign * .15, 0, .25, .6, 3.5, length * .36);
    result.push({ mesh: outer.group, board: fixed }, { mesh: middle.group, board: fixed, moving, ratio: .5 }, { mesh: inner.group, board: moving });
  }
  return result;
}
