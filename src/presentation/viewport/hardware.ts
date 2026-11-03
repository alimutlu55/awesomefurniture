import * as THREE from 'three';
import { RUNNER_ENTRY } from '../../domain/hardware/hardware-registry';
import type { resolveHandle } from '../../domain/wardrobe/handles';
import type { Fitting } from '../../domain/make/make-joints';
import type { MakePiece } from '../../domain/make/make-parts';

/** A bar pull as fitted to wardrobe fronts: a round bar on two short posts that stand it off the front.
 * Centred on the origin with the posts' feet at z = 0, so it is placed on the front's face. Horizontal for
 * drawers, vertical for doors. Centimetres. */
export function barPull(length: number, material: THREE.Material, vertical = false) {
  const group = new THREE.Group(), stand = 2.4, inset = Math.min(1.6, length / 4);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, length, 14), material);
  if (!vertical) bar.rotation.z = Math.PI / 2;
  bar.position.z = stand;
  group.add(bar);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, stand, 8), material), along = side * (length / 2 - inset);
    post.rotation.x = Math.PI / 2;
    post.position.set(vertical ? 0 : along, vertical ? along : 0, stand / 2);
    group.add(post);
  }
  group.traverse(o => { o.castShadow = true; });
  return group;
}

/** The design's handle as the 3D view draws it, centred on the origin on a front's face (z = 0 is the face), upright for
 * a door and level for a drawer: a bar on posts its centre-to-centre apart, a knob, an edge pull or profile standing
 * on the front's edge (placed on the edge, not in from it), or a recessed pull's metal pocket. `run` is the length of
 * the front along the handle. Null when the front takes no handle (push-to-open). Centimetres. */
export function handleMesh(handle: ReturnType<typeof resolveHandle>, run: number, material: THREE.Material, vertical: boolean): THREE.Group | null {
  if (handle.none) return null;
  const { kind, size } = handle, span = size === 'full' ? Math.max(4, run - 10) : size === undefined ? 0 : size / 10;
  const box = (w: number, h: number, d: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.z = z; return m; };
  let group: THREE.Group;
  if (kind.key === 'bar' || kind.key === 'full') group = barPull(span + 3.2, material, true);
  else {
    group = new THREE.Group();
    if (kind.key === 'knob') {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 2, 10), material), head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 10), material);
      post.rotation.x = Math.PI / 2; post.position.z = 1; head.position.z = 2.4; head.scale.z = .7;
      group.add(post, head);
    } else if (kind.key === 'recessed') group.add(box(2.4, span + 2, .1, .05));
    else { const proud = Math.max(.2, kind.projectionMm / 10); group.add(box(.4, kind.key === 'profile' ? run : span + 2, proud, proud / 2)); }
  }
  if (!vertical) group.rotation.z = Math.PI / 2;
  group.traverse(o => { o.castShadow = true; });
  return group;
}

/**
 * Three nested telescopic runner channels, ball bearing tracks, and the removable drawer member's release lever,
 * driven from `RUNNER_ENTRY.motion.members` in the domain hardware registry.
 */
export function telescopicRunnerChannelMeshes(
  piece: MakePiece,
  fitting: Fitting,
  geometry: THREE.BufferGeometry,
  metal: THREE.Material,
) {
  if (!fitting.runner) return [];
  const members = RUNNER_ENTRY.motion?.kind === 'telescope' ? RUNNER_ENTRY.motion.members : [];
  const outerSpec = members[0] ?? { ratio: 0, heightMm: 45, lengthRatio: 1, xOffsetMm: 1.6 };
  const middleSpec = members[1] ?? { ratio: .5, heightMm: 34, lengthRatio: .96, xOffsetMm: 5.8 };
  const innerSpec = members[2] ?? { ratio: 1, heightMm: 24, lengthRatio: .94, xOffsetMm: 10.5 };
  const length = Number(fitting.size) / 10;
  const result: { mesh: THREE.Group; board: number; moving?: number; ratio?: number }[] = [];
  const frame = (x: number, y: number, z: number) => new THREE.Vector3(x - piece.size.w / 2, y, z - piece.size.d / 2);
  for (let k = 0; k < fitting.runner.moving.length; k++) {
    const moving = fitting.runner.moving[k]!, fixed = fitting.runner.fixed[k]!, side = piece.boards[moving]!, post = piece.boards[fixed];
    if (!post) continue;
    const leftSide = post.x1 <= piece.size.w / 2 + 1;
    const sign = leftSide ? 1 : -1, face = leftSide ? post.x1 : post.x0, y = side.y0 + 3.2, z = post.z1 - length / 2;
    const channel = (x: number, height: number, len: number) => {
      const group = new THREE.Group();
      group.position.copy(frame(x, y, z));
      const bar = (dx: number, dy: number, sx: number, sy: number, sz: number, dz = 0) => {
        const mesh = new THREE.Mesh(geometry, metal);
        mesh.position.set(dx, dy, dz);
        mesh.scale.set(sx, sy, sz);
        group.add(mesh);
      };
      bar(0, 0, .12, height, len);
      for (const s of [-1, 1]) bar(sign * .14, s * (height / 2 - .08), .4, .16, len);
      return { group, bar };
    };
    const outer = channel(face + sign * ((outerSpec.xOffsetMm ?? 1.6) / 10), (outerSpec.heightMm ?? 45) / 10, length * (outerSpec.lengthRatio ?? 1));
    const middle = channel(face + sign * ((middleSpec.xOffsetMm ?? 5.8) / 10), (middleSpec.heightMm ?? 34) / 10, length * (middleSpec.lengthRatio ?? .96));
    const inner = channel(face + sign * ((innerSpec.xOffsetMm ?? 10.5) / 10), (innerSpec.heightMm ?? 24) / 10, length * (innerSpec.lengthRatio ?? .94));
    for (const row of [-1, 1]) for (const pos of [-.35, -.15, .05, .25])
      middle.bar(sign * .22, row * 1.1, .26, .26, .5, pos * length);
    inner.bar(sign * .15, 0, .25, .6, 3.5, length * .36);
    if (side.name === 'Cargo front') {
      result.push(
        { mesh: outer.group, board: fixed },
        { mesh: middle.group, board: fixed, moving, ratio: middleSpec.ratio },
        { mesh: inner.group, board: fixed, moving, ratio: innerSpec.ratio },
      );
    } else {
      result.push(
        { mesh: outer.group, board: fixed },
        { mesh: middle.group, board: fixed, moving, ratio: middleSpec.ratio },
        { mesh: inner.group, board: moving },
      );
    }
  }
  return result;
}
