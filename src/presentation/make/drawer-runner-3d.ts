import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Fitting } from '../../domain/make/make-joints';
import { RUNNER_ENTRY } from '../../domain/hardware/hardware-registry';
import { BOTTOM_GROOVE, BOTTOM_THICKNESS } from '../../domain/make/drawer-box';

/** Where the box takes the drawer rail, as drawer-box.ts drills it: the rear hook's hole this far up the back, the front
 * pin's hole through the bottom this far inside the box side and behind the front's inner face. Centimetres. */
const HOOK_UP = (RUNNER_ENTRY.drilling[2]?.lineMm ?? 8) / 10, PIN_IN = 1.5, PIN_BEHIND = (RUNNER_ENTRY.drilling[3]?.lineMm ?? 30) / 10;

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
    // The rails run from the box's front face to its back's rear face, as the fitting says.
    const z = fitting.at[2];
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
    // The drawer rail: under the box side, with the rear hook up behind the back and forward into its hole, and the front
    // pin on a tab under the bottom, up through its hole: both where drawer-box.ts drills them.
    const inner = new THREE.Group(), cx = (side.x0 + side.x1) / 2, up = (y: number) => y - (side.y0 - rail / 2);
    inner.position.copy(frame(cx, side.y0 - rail / 2, z));
    bar(inner, 0, 0, side.x1 - side.x0, rail * .8, length * (drawer.lengthRatio ?? .97));
    const rear = -length / 2, hook = up(side.y0 + HOOK_UP);
    bar(inner, 0, (rail * .4 + hook) / 2, .5, hook - rail * .4, .3, rear - .25);
    bar(inner, 0, hook, .5, .4, 1.05, rear + .3);
    const pinX = sign * ((side.x1 - side.x0) / 2 + PIN_IN), pinZ = side.z1 - PIN_BEHIND - z, top = up(side.y0 + BOTTOM_GROOVE.fromEdge + BOTTOM_THICKNESS) + .2;
    bar(inner, pinX / 2, 0, Math.abs(pinX) + .5, .2, 1.2, pinZ);
    bar(inner, pinX, (rail * .4 + top) / 2, .6, top - rail * .4, .6, pinZ);
    result.push({ mesh: outer, board: fixed }, { mesh: inner, board: moving });
  }
  return result;
}
