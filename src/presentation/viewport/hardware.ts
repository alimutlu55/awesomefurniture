import * as THREE from 'three';
import {
  HANDLE_ENTRY,
  HINGE_ENTRY,
  PLATE_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  SHELF_PIN_ENTRY,
} from '../../domain/hardware/hardware-registry';
import type { HardwareEntry } from '../../domain/hardware/hardware-types';
import { HANDLES, handleKind, type HandleSize, type resolveHandle } from '../../domain/wardrobe/handles';
import type { Fitting } from '../../domain/make/make-joints';
import type { MakePiece } from '../../domain/make/make-parts';
import {
  buildEntryPrimitivesGroup,
  cabinetLegMesh,
  camBoltMesh,
  camHousingMesh,
  cargoFrontBracketMesh,
  dowelMesh,
  expandingDowelMesh,
  liftStayMesh,
  orientedSolid,
  screwFastenerMesh,
  slidingTrackMesh,
  wallBracketOrHangerMesh,
  type HardwareModelLod,
} from './hardware-models';

export {
  cabinetLegMesh,
  camBoltMesh,
  camHousingMesh,
  cargoFrontBracketMesh,
  dowelMesh,
  expandingDowelMesh,
  liftStayMesh,
  screwFastenerMesh,
  slidingTrackMesh,
  wallBracketOrHangerMesh,
};

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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
 * Builds the 3D representation for any `HardwareEntry` in `HARDWARE` at the requested level of detail
 * (`'editor'`, `'make'`, or `'studio'`).
 */
export function hardwareModel3d(
  entry: HardwareEntry,
  lod: HardwareModelLod = 'editor',
  material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: .65, roughness: .35 }),
): THREE.Group {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const rod = new THREE.CylinderGeometry(1, 1, 1, 16);
  const cone = new THREE.ConeGeometry(1, 1, 12);
  const ring = new THREE.TorusGeometry(1, .32, 10, 20);
  const { family } = entry.display.model3d;
  if (family === 'hinge-cup') {
    const f: Fitting = { kind: 'hinge', boards: [0], at: [0, 0, 0], axis: 2 };
    return hingeCupAndArmMesh(f, null, new THREE.Vector3(0, 0, -1), rod, box, material);
  }
  if (family === 'mounting-plate') {
    const g = new THREE.Group();
    g.add(mountingPlateMesh(box, material));
    return g;
  }
  if (family === 'handle') {
    if (entry.key === 'handle') return barPull((entry.sizesMm[1] ?? 128) / 10 + 3.2, material, true);
    return buildEntryPrimitivesGroup(entry, lod, box, rod, cone, material);
  }
  if (family === 'rail-tube') {
    const g = new THREE.Group();
    g.add(railTubeMesh(new THREE.Vector3(), (entry.sizesMm[0] ?? 600) / 10, rod, material));
    return g;
  }
  if (family === 'rail-support') {
    const g = new THREE.Group();
    g.add(railEndSupportMesh(new THREE.Vector3(), rod, material));
    return g;
  }
  if (family === 'shelf-pin') {
    const g = new THREE.Group();
    g.add(shelfPinMesh(rod, material));
    return g;
  }
  if (family === 'fastener') {
    if (entry.key === 'bolt') return camBoltMesh(rod, box, material);
    if (entry.key === 'cam') return camHousingMesh(rod, box, cone, material, material);
    if (entry.key === 'dowel') {
      const g = new THREE.Group();
      g.add(dowelMesh(rod, material));
      return g;
    }
    if (entry.key === 'confirmat' || entry.key === 'screw' || entry.key === 'nail') {
      return screwFastenerMesh(entry.key, entry.display.listLine.defaultSpec, rod, cone, material);
    }
    return buildEntryPrimitivesGroup(entry, lod, box, rod, cone, material);
  }
  if (family === 'cabinet-leg') {
    const g = new THREE.Group();
    g.add(cabinetLegMesh(new THREE.Vector3(), (entry.sizesMm[0] ?? 100) / 10, rod, material));
    return g;
  }
  if (family === 'wall-bracket') {
    const g = new THREE.Group();
    g.add(wallBracketOrHangerMesh(entry.key === 'hanger' ? 'hanger' : 'bracket', new THREE.Vector3(), box, material));
    return g;
  }
  if (family === 'cargo-pullout') return cargoFrontBracketMesh(new THREE.Vector3(), box, ring, rod, material);
  if (family === 'sliding-track') return slidingTrackMesh((entry.sizesMm[0] ?? 1800) / 10, box, material);
  if (family === 'lift-stay') return liftStayMesh(box, rod, material);
  return buildEntryPrimitivesGroup(entry, lod, box, rod, cone, material);
}
