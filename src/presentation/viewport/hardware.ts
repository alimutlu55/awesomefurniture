import * as THREE from 'three';
import {
  BOLT_ENTRY,
  CABINET_HANGER_ENTRY,
  CAM_ENTRY,
  CONFIRMAT_ENTRY,
  DOWEL_ENTRY,
  HANDLE_ENTRY,
  HINGE_ENTRY,
  LEG_ENTRY,
  NAIL_ENTRY,
  PLATE_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  RUNNER_ENTRY,
  SCREW_ENTRY,
  SHELF_PIN_ENTRY,
  WALL_BRACKET_ENTRY,
} from '../../domain/hardware/hardware-registry';
import { HANDLES, handleKind, type HandleSize, type resolveHandle } from '../../domain/wardrobe/handles';
import type { Fitting } from '../../domain/make/make-joints';
import type { MakePiece } from '../../domain/make/make-parts';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function orientedSolid(geometry: THREE.BufferGeometry, material: THREE.Material, at: THREE.Vector3, size: THREE.Vector3, axis = Y_AXIS) {
  const m = new THREE.Mesh(geometry, material);
  m.scale.copy(size);
  m.quaternion.setFromUnitVectors(Y_AXIS, axis);
  m.position.copy(at);
  return m;
}

/**
 * Concealed hinge 3D mesh (35 mm cup pressed into the door leaf + arm reaching to the mounting plate),
 * driven by `HINGE_ENTRY.display.model3d` in the domain hardware registry.
 */
export function hingeCupAndArmMesh(
  f: Fitting,
  plate: Fitting | null,
  dir: THREE.Vector3,
  rod: THREE.BufferGeometry,
  box: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Group {
  const cupPrim = HINGE_ENTRY.display.model3d.primitives[0]!;
  const armPrim = HINGE_ENTRY.display.model3d.primitives[1]!;
  const cupRadiusCm = cupPrim.sizeMm[0] / 20;
  const cupDepthCm = cupPrim.sizeMm[1] / 10;
  const g = new THREE.Group();
  g.add(orientedSolid(rod, material, new THREE.Vector3(0, cupDepthCm / 2, 0), new THREE.Vector3(cupRadiusCm, cupDepthCm, cupRadiusCm)));
  const arm = plate
    ? new THREE.Vector3(plate.at[0] - f.at[0], plate.at[1] - f.at[1], plate.at[2] - f.at[2]).applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir).invert(),
      )
    : new THREE.Vector3(0, -armPrim.sizeMm[1] / 10, 0);
  g.add(orientedSolid(box, material, arm.clone().multiplyScalar(.5), new THREE.Vector3(armPrim.sizeMm[0] / 10, arm.length(), armPrim.sizeMm[2] / 10), arm.clone().normalize()));
  return g;
}

/**
 * System 32 cruciform mounting plate 3D mesh, driven by `PLATE_ENTRY.display.model3d` in the domain hardware registry.
 */
export function mountingPlateMesh(box: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const prim = PLATE_ENTRY.display.model3d.primitives[0]!;
  const off = prim.offsetMm ?? [0, -3, 0];
  return orientedSolid(
    box,
    material,
    new THREE.Vector3(off[0] / 10, off[1] / 10, off[2] / 10),
    new THREE.Vector3(prim.sizeMm[0] / 10, prim.sizeMm[1] / 10, prim.sizeMm[2] / 10),
  );
}

/**
 * Hanging rail 3D tube mesh, driven by `RAIL_ENTRY.display.model3d` in the domain hardware registry.
 */
export function railTubeMesh(at: THREE.Vector3, lengthCm: number, rod: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const prim = RAIL_ENTRY.display.model3d.primitives[0]!;
  const radiusCm = prim.sizeMm[0] / 20;
  return orientedSolid(rod, material, at, new THREE.Vector3(radiusCm, lengthCm, radiusCm), X_AXIS);
}

/**
 * Rail end support flange 3D mesh, driven by `RAIL_SUPPORT_ENTRY.display.model3d` in the domain hardware registry.
 */
export function railEndSupportMesh(at: THREE.Vector3, disc: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const prim = RAIL_SUPPORT_ENTRY.display.model3d.primitives[0]!;
  return orientedSolid(
    disc,
    material,
    at,
    new THREE.Vector3(prim.sizeMm[0] / 20, prim.sizeMm[1] / 10, prim.sizeMm[2] / 20),
    X_AXIS,
  );
}

/**
 * System 32 Ø5 × 16 mm plug-in shelf support pin 3D mesh, driven by `SHELF_PIN_ENTRY.display.model3d`.
 */
export function shelfPinMesh(rod: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const prim = SHELF_PIN_ENTRY.display.model3d.primitives[0]!;
  const off = prim.offsetMm ?? [0, -2.5, 0];
  return orientedSolid(
    rod,
    material,
    new THREE.Vector3(off[0] / 10, off[1] / 10, off[2] / 10),
    new THREE.Vector3(prim.sizeMm[0] / 20, prim.sizeMm[1] / 10, prim.sizeMm[2] / 20),
  );
}

/**
 * Screw, confirmat connector, or back pin nail 3D mesh lying along +y from its head at the origin,
 * driven by `CONFIRMAT_ENTRY`, `SCREW_ENTRY`, or `NAIL_ENTRY` in the domain hardware registry.
 */
export function screwFastenerMesh(
  kind: 'confirmat' | 'screw' | 'nail',
  sizeLabel: string | undefined,
  rod: THREE.BufferGeometry,
  cone: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Group {
  const entry = kind === 'confirmat' ? CONFIRMAT_ENTRY : kind === 'nail' ? NAIL_ENTRY : SCREW_ENTRY;
  const shankPrim = entry.display.model3d.primitives[0]!;
  const r = shankPrim.sizeMm[0] / 20;
  const defaultLenCm = shankPrim.sizeMm[1] / 10;
  const length = kind === 'screw' ? Number(sizeLabel?.split('×')[1]?.trim()) / 10 || defaultLenCm : defaultLenCm;
  const g = new THREE.Group();
  g.add(
    orientedSolid(rod, material, new THREE.Vector3(0, -.08, 0), new THREE.Vector3(r * 2.2, .16, r * 2.2)),
    orientedSolid(rod, material, new THREE.Vector3(0, length / 2, 0), new THREE.Vector3(r, length, r)),
    orientedSolid(cone, material, new THREE.Vector3(0, length + r, 0), new THREE.Vector3(r, r * 2, r)),
  );
  return g;
}

/**
 * 34 mm cam dowel bolt 3D mesh, driven by `BOLT_ENTRY.display.model3d` in the domain hardware registry.
 */
export function camBoltMesh(rod: THREE.BufferGeometry, box: THREE.BufferGeometry, material: THREE.Material): THREE.Group {
  const [thread, neck, head, slot] = BOLT_ENTRY.display.model3d.primitives;
  const g = new THREE.Group();
  if (thread && neck && head && slot) {
    g.add(
      orientedSolid(rod, material, new THREE.Vector3(0, (thread.offsetMm?.[1] ?? 5.5) / 10, 0), new THREE.Vector3(thread.sizeMm[0] / 20, thread.sizeMm[1] / 10, thread.sizeMm[2] / 20)),
      orientedSolid(rod, material, new THREE.Vector3(0, (neck.offsetMm?.[1] ?? -16) / 10, 0), new THREE.Vector3(neck.sizeMm[0] / 20, neck.sizeMm[1] / 10, neck.sizeMm[2] / 20)),
      orientedSolid(rod, material, new THREE.Vector3(0, (head.offsetMm?.[1] ?? -33) / 10, 0), new THREE.Vector3(head.sizeMm[0] / 20, head.sizeMm[1] / 10, head.sizeMm[2] / 20)),
      orientedSolid(box, material, new THREE.Vector3(0, (slot.offsetMm?.[1] ?? .2) / 10, 0), new THREE.Vector3(slot.sizeMm[0] / 10, slot.sizeMm[1] / 10, slot.sizeMm[2] / 10)),
    );
  }
  return g;
}

/**
 * Ø15 mm eccentric cam lock housing 3D mesh, driven by `CAM_ENTRY.display.model3d` in the domain hardware registry.
 */
export function camHousingMesh(
  rod: THREE.BufferGeometry,
  box: THREE.BufferGeometry,
  cone: THREE.BufferGeometry,
  brass: THREE.Material,
  steel: THREE.Material,
): THREE.Group {
  const [body, slot, arrow] = CAM_ENTRY.display.model3d.primitives;
  const g = new THREE.Group();
  if (body && slot && arrow) {
    g.add(
      orientedSolid(rod, brass, new THREE.Vector3(0, (body.offsetMm?.[1] ?? 6.2) / 10, 0), new THREE.Vector3(body.sizeMm[0] / 20, body.sizeMm[1] / 10, body.sizeMm[2] / 20)),
      orientedSolid(box, steel, new THREE.Vector3(0, (slot.offsetMm?.[1] ?? -.1) / 10, 0), new THREE.Vector3(slot.sizeMm[0] / 10, slot.sizeMm[1] / 10, slot.sizeMm[2] / 10)),
      orientedSolid(cone, steel, new THREE.Vector3((arrow.offsetMm?.[0] ?? 5) / 10, (arrow.offsetMm?.[1] ?? -.1) / 10, 0), new THREE.Vector3(arrow.sizeMm[0] / 20, arrow.sizeMm[1] / 10, arrow.sizeMm[2] / 20)),
    );
  }
  return g;
}

/**
 * Fluted hardwood dowel pin 3D mesh, driven by `DOWEL_ENTRY.display.model3d` in the domain hardware registry.
 */
export function dowelMesh(rod: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const prim = DOWEL_ENTRY.display.model3d.primitives[0]!;
  return orientedSolid(rod, material, new THREE.Vector3(0, 0, 0), new THREE.Vector3(prim.sizeMm[0] / 20, prim.sizeMm[1] / 10, prim.sizeMm[2] / 20));
}

/**
 * Adjustable kitchen/cabinet plinth leg 3D mesh, driven by `LEG_ENTRY.display.model3d` in the domain hardware registry.
 */
export function cabinetLegMesh(at: THREE.Vector3, heightCm: number, rod: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const prim = LEG_ENTRY.display.model3d.primitives[0]!;
  const r = prim.sizeMm[0] / 20;
  return orientedSolid(rod, material, at.clone().setY(at.y + heightCm / 2), new THREE.Vector3(r, heightCm, r));
}

/**
 * Adjustable wall cabinet hanger or anti-tip wall fixing bracket 3D mesh,
 * driven by `CABINET_HANGER_ENTRY` or `WALL_BRACKET_ENTRY` in the domain hardware registry.
 */
export function wallBracketOrHangerMesh(
  kind: 'hanger' | 'bracket',
  at: THREE.Vector3,
  bar: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Mesh {
  const entry = kind === 'hanger' ? CABINET_HANGER_ENTRY : WALL_BRACKET_ENTRY;
  const prim = entry.display.model3d.primitives[0]!;
  const offZ = (prim.offsetMm?.[2] ?? -5) / 10;
  return orientedSolid(
    bar,
    material,
    at.clone().setZ(at.z + offZ),
    new THREE.Vector3(prim.sizeMm[0] / 10, prim.sizeMm[1] / 10, prim.sizeMm[2] / 10),
  );
}

/** A bar pull as fitted to wardrobe fronts: a round bar on two short posts that stand it off the front.
 * Centred on the origin with the posts' feet at z = 0, so it is placed on the front's face. Horizontal for
 * drawers, vertical for doors. Centimetres. */
export function barPull(length: number, material: THREE.Material, vertical = false) {
  const barPrim = HANDLE_ENTRY.display.model3d.primitives[0]!;
  const postPrim = HANDLE_ENTRY.display.model3d.primitives[1]!;
  const group = new THREE.Group(), stand = (barPrim.offsetMm?.[2] ?? 24) / 10, inset = Math.min(1.6, length / 4);
  const barR = barPrim.sizeMm[0] / 20, postR = postPrim.sizeMm[0] / 20;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, length, 14), material);
  if (!vertical) bar.rotation.z = Math.PI / 2;
  bar.position.z = stand;
  group.add(bar);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, stand, 8), material), along = side * (length / 2 - inset);
    post.rotation.x = Math.PI / 2;
    post.position.set(vertical ? 0 : along, vertical ? along : 0, stand / 2);
    group.add(post);
  }
  group.traverse(o => { o.castShadow = true; });
  return group;
}

/**
 * Builds the 3D handle mesh for a Make fitting `f` (`f.kind === 'handle'`) using the shared `handleMesh` builder,
 * so Editor 3D and Make 3D render the exact same handle geometry for every handle kind and size.
 */
export function makeFittingHandleMesh(piece: MakePiece, f: Fitting, at: THREE.Vector3, material: THREE.Material): THREE.Group {
  const board = f.boards[0] !== undefined ? piece.boards[f.boards[0]] : undefined;
  const door = board ? board.stock === 'door' : piece.holes.some(h => h.kind === 'handle' && Math.abs(h.at[0] - f.at[0]) < .01 && Math.abs(h.at[1] - f.at[1]) > 1);
  const run = board ? (door ? board.y1 - board.y0 : board.x1 - board.x0) : 60;
  const raw = f.size ?? '128';
  const matched = HANDLES.find(h => raw.startsWith(h.name));
  const kind = matched ?? handleKind('bar');
  const numMatch = /(\d+)$/.exec(raw);
  const size: HandleSize | undefined = raw.includes('full height') ? 'full' : numMatch ? Number(numMatch[1]) : (kind.sizes[0] as HandleSize | undefined);
  const mesh = handleMesh({ kind, size, finish: 'brushed_brass', none: false }, run, material, door) ?? new THREE.Group();
  mesh.position.copy(at);
  return mesh;
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
