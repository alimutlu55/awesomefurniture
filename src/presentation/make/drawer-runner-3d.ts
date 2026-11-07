import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Fitting } from '../../domain/make/make-joints';
import { RUNNER_ENTRY } from '../../domain/hardware/hardware-registry';

/**
 * A bottom-mounted runner pair (drawer-hardware.ts), drawn from the shared hardware entry: on each side a cabinet rail,
 * an L whose web is screwed to the upright and whose foot runs under the box side, and a drawer rail under the box side
 * that travels with the box, with its rear hook and front pin. The cabinet rails belong to the uprights; the drawer rails
 * to the box sides, so they move with the drawer.
 */
const gap = (b: { x0: number; x1: number }, x: number) => Math.min(Math.abs(b.x0 - x), Math.abs(b.x1 - x));

export function drawerRunnerMeshes(piece: MakePiece, fitting: Fitting, geometry: THREE.BufferGeometry, metal: THREE.Material) {
  if (!fitting.runner) return [];
  const members = RUNNER_ENTRY.motion?.kind === 'telescope' ? RUNNER_ENTRY.motion.members : [];
  const cabinet = members[0] ?? { heightMm: 30, lengthRatio: 1 }, drawer = members.at(-1) ?? { heightMm: 12, lengthRatio: .97 };
  const length = Number(fitting.size) / 10, web = (cabinet.heightMm ?? 30) / 10, rail = (drawer.heightMm ?? 12) / 10;
  const frame = (x: number, y: number, z: number) => new THREE.Vector3(x - piece.size.w / 2, y, z - piece.size.d / 2);
  const result: { mesh: THREE.Group; board: number; moving?: number; ratio?: number }[] = [];
  for (let k = 0; k < fitting.runner.moving.length; k++) {
    // Each box side rides on the rail of the upright beside it: the nearest, whatever order the uprights are listed in.
    const moving = fitting.runner.moving[k]!, side = piece.boards[moving]!, mid = (side.x0 + side.x1) / 2;
    const fixed = [...fitting.runner.fixed].sort((p, q) => gap(piece.boards[p]!, mid) - gap(piece.boards[q]!, mid))[0], post = fixed === undefined ? undefined : piece.boards[fixed];
    if (!post || fixed === undefined) continue;
    const left = post.x1 <= side.x0 + .01, sign = left ? 1 : -1, face = left ? post.x1 : post.x0;
    const z = side.z1 - length / 2 + (side.z1 - side.z0 < length ? (length - (side.z1 - side.z0)) / 2 : 0);
    const bar = (group: THREE.Group, dx: number, dy: number, sx: number, sy: number, sz: number, dz = 0) => {
      const mesh = new THREE.Mesh(geometry, metal);
      mesh.position.set(dx, dy, dz);
      mesh.scale.set(sx, sy, sz);
      group.add(mesh);
    };
    // The cabinet rail: the web up the upright, its foot under the box side, the front bracket over the two screws.
    const outer = new THREE.Group(), reach = Math.abs((left ? side.x1 : side.x0) - face);
    outer.position.copy(frame(face, side.y0 - rail, z));
    bar(outer, sign * .06, -web / 2 + .1, .12, web, length * (cabinet.lengthRatio ?? 1));
    bar(outer, sign * reach / 2, -.08, reach, .16, length * (cabinet.lengthRatio ?? 1));
    bar(outer, sign * .12, -web / 2, .12, web * .9, 4.5, length / 2 - 2.6);
    // The drawer rail: under the box side, with the rear hook up into the back and the front pin up through the bottom.
    const inner = new THREE.Group(), cx = (side.x0 + side.x1) / 2;
    inner.position.copy(frame(cx, side.y0 - rail / 2, z));
    bar(inner, 0, 0, side.x1 - side.x0, rail * .8, length * (drawer.lengthRatio ?? .97));
    bar(inner, 0, rail * .6, .5, rail * .8, .4, -length / 2 + 1);
    bar(inner, sign * 1.5, rail * .6, .5, rail, .5, length / 2 - 3);
    result.push({ mesh: outer, board: fixed }, { mesh: inner, board: moving });
  }
  return result;
}
