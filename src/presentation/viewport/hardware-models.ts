import * as THREE from 'three';
import {
  BOLT_ENTRY,
  CABINET_HANGER_ENTRY,
  CAM_ENTRY,
  CARGO_MECHANISM_ENTRY,
  CONFIRMAT_ENTRY,
  DOWEL_ENTRY,
  LEG_ENTRY,
  LIFT_FITTING_ENTRY,
  NAIL_ENTRY,
  SCREW_ENTRY,
  SLIDING_TRACK_ENTRY,
  WALL_BRACKET_ENTRY,
} from '../../domain/hardware/hardware-registry';
import type { HardwareEntry, Model3DPrimitive } from '../../domain/hardware/hardware-types';

export type HardwareModelLod = 'editor' | 'make' | 'studio' | 'all';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function orientedSolid(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  at: THREE.Vector3,
  size: THREE.Vector3,
  axis = Y_AXIS,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.scale.copy(size);
  m.quaternion.setFromUnitVectors(Y_AXIS, axis);
  m.position.copy(at);
  return m;
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
      orientedSolid(cone, steel, new THREE.Vector3((arrow.offsetMm?.[0] ?? 5) / 10, (arrow.offsetMm?.[1] ?? -.1) / 10, 0), new THREE.Vector3(arrow.sizeMm[0] / 20, arrow.sizeMm[1] / 10, arrow.sizeMm[2] / 10)),
    );
  }
  return g;
}

/** A wooden dowel's flutes (how many, how deep) and the chamfer at each end, mm. */
const FLUTES = 8, FLUTE_DEPTH = .5, CHAMFER = 1.2;
/**
 * Fluted hardwood dowel pin 3D mesh, driven by `DOWEL_ENTRY.display.model3d` in the domain hardware registry: a beech
 * pin with straight flutes along it (the glue's way out) and chamfered ends, as a dowel is bought. With no `box` and
 * `cone` (the editor's small pins), a plain cylinder.
 */
export function dowelMesh(rod: THREE.BufferGeometry, material: THREE.Material, box?: THREE.BufferGeometry, cone?: THREE.BufferGeometry): THREE.Group {
  const prim = DOWEL_ENTRY.display.model3d.primitives[0]!, r = prim.sizeMm[0] / 20, length = prim.sizeMm[1] / 10, g = new THREE.Group();
  if (!box || !cone) { g.add(orientedSolid(rod, material, new THREE.Vector3(), new THREE.Vector3(r, length, r))); return g; }
  const core = r - FLUTE_DEPTH / 20, body = length - 2 * CHAMFER / 10;
  g.add(orientedSolid(rod, material, new THREE.Vector3(), new THREE.Vector3(core, body, core)));
  // The lands between the flutes stand out to the full diameter.
  for (let k = 0; k < FLUTES; k++) {
    const a = 2 * Math.PI * k / FLUTES, land = orientedSolid(box, material, new THREE.Vector3(Math.cos(a) * (r - FLUTE_DEPTH / 40), 0, Math.sin(a) * (r - FLUTE_DEPTH / 40)),
      new THREE.Vector3(FLUTE_DEPTH / 10, body, 2 * Math.PI * r / FLUTES * .55));
    land.rotation.y = -a;
    g.add(land);
  }
  for (const end of [1, -1]) {
    const tip = orientedSolid(cone, material, new THREE.Vector3(0, end * (body / 2 + CHAMFER / 20), 0), new THREE.Vector3(r, CHAMFER / 10, r));
    if (end < 0) tip.rotation.x = Math.PI;
    g.add(tip);
  }
  return g;
}

/** The expanding dowel's mushroom head (diameter, thickness) and its ribs (diameter, thickness, spacing). Mm. */
const EXPANDING_HEAD = [14, 2.5] as const, EXPANDING_RIB = [9.2, 1.2, 3] as const;
/**
 * Expanding plastic dowel 3D mesh (DOWEL_ENTRY's expanding variant): a mushroom head left standing on the drawer back,
 * a Ø8 body as long as the variant, ribbed so it grips the side's end once hammered in. Into the hole along +y from its
 * mouth, as every fastener is drawn.
 */
export function expandingDowelMesh(rod: THREE.BufferGeometry, material: THREE.Material): THREE.Group {
  const variant = DOWEL_ENTRY.variants?.find(v => v.key === 'expanding'), length = (variant?.sizesMm?.[0] ?? 30) / 10, body = .8 / 2;
  const g = new THREE.Group(), [hd, ht] = EXPANDING_HEAD, [rd, rt, step] = EXPANDING_RIB;
  g.add(orientedSolid(rod, material, new THREE.Vector3(0, -ht / 20, 0), new THREE.Vector3(hd / 20, ht / 10, hd / 20)));
  g.add(orientedSolid(rod, material, new THREE.Vector3(0, length / 2, 0), new THREE.Vector3(body, length, body)));
  for (let y = step / 10; y < length - .2; y += step / 10) g.add(orientedSolid(rod, material, new THREE.Vector3(0, y, 0), new THREE.Vector3(rd / 20, rt / 10, rd / 20)));
  return g;
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

/**
 * 3D-adjustable cargo front fixing bracket mesh, driven by `CARGO_MECHANISM_ENTRY`.
 */
export function cargoFrontBracketMesh(
  at: THREE.Vector3,
  bar: THREE.BufferGeometry,
  ring: THREE.BufferGeometry,
  disc: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Group {
  const platePrim = CARGO_MECHANISM_ENTRY.display.model3d.primitives[0]!;
  const screwPitchCm = (CARGO_MECHANISM_ENTRY.drilling[1]?.pitchMm ?? 78) / 20;
  const g = new THREE.Group();
  g.position.copy(at);
  const basePlate = new THREE.Group();
  basePlate.add(
    orientedSolid(
      bar,
      material,
      new THREE.Vector3(0, 0, (platePrim.offsetMm?.[2] ?? -1.8) / 10),
      new THREE.Vector3(platePrim.sizeMm[0] / 10, platePrim.sizeMm[1] / 10, platePrim.sizeMm[2] / 10),
    ),
  );
  for (const sx of [-screwPitchCm, screwPitchCm]) {
    basePlate.add(orientedSolid(ring, material, new THREE.Vector3(sx, 0, -.36), new THREE.Vector3(.45, .12, .45), Z_AXIS));
  }
  g.add(basePlate);
  const receiver = new THREE.Group();
  receiver.position.z = -1.4;
  for (const side of [-1, 1]) {
    receiver.add(orientedSolid(bar, material, new THREE.Vector3(side * 2.65, 0, 0), new THREE.Vector3(.7, 2.8, 2.4)));
    receiver.add(orientedSolid(bar, material, new THREE.Vector3(0, side * 1.25, 0), new THREE.Vector3(4.6, .3, 2.4)));
  }
  receiver.add(orientedSolid(bar, material, new THREE.Vector3(0, 0, -.95), new THREE.Vector3(5.2, 3.1, .22)));
  g.add(receiver);
  g.add(orientedSolid(disc, material, new THREE.Vector3(1.5, 0, -1.4), new THREE.Vector3(.7, .3, .7), X_AXIS));
  g.add(orientedSolid(disc, material, new THREE.Vector3(0, 1.2, -1.4), new THREE.Vector3(.7, .3, .7), Y_AXIS));
  return g;
}

/**
 * Twin/triple-track sliding wardrobe door upper running track and lower guide channel 3D mesh,
 * driven by `SLIDING_TRACK_ENTRY.display.model3d`.
 */
export function slidingTrackMesh(lengthCm: number, box: THREE.BufferGeometry, material: THREE.Material): THREE.Group {
  const [topTrack, bottomGuide] = SLIDING_TRACK_ENTRY.display.model3d.primitives;
  const g = new THREE.Group();
  if (topTrack) {
    g.add(
      orientedSolid(
        box,
        material,
        new THREE.Vector3(0, (topTrack.offsetMm?.[1] ?? -22) / 10, 0),
        new THREE.Vector3(lengthCm, topTrack.sizeMm[1] / 10, topTrack.sizeMm[2] / 10),
      ),
    );
  }
  if (bottomGuide) {
    g.add(
      orientedSolid(
        box,
        material,
        new THREE.Vector3(0, (bottomGuide.offsetMm?.[1] ?? 6) / 10, 0),
        new THREE.Vector3(lengthCm, bottomGuide.sizeMm[1] / 10, bottomGuide.sizeMm[2] / 10),
      ),
    );
  }
  return g;
}

/**
 * Soft-close pneumatic/mechanical flap lift stay 3D mesh, driven by `LIFT_FITTING_ENTRY.display.model3d`.
 */
export function liftStayMesh(
  box: THREE.BufferGeometry,
  rod: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Group {
  const [housing, arm] = LIFT_FITTING_ENTRY.display.model3d.primitives;
  const g = new THREE.Group();
  if (housing) {
    g.add(
      orientedSolid(
        box,
        material,
        new THREE.Vector3((housing.offsetMm?.[0] ?? 10) / 10, 0, (housing.offsetMm?.[2] ?? -120) / 10),
        new THREE.Vector3(housing.sizeMm[0] / 10, housing.sizeMm[1] / 10, housing.sizeMm[2] / 10),
      ),
    );
  }
  if (arm) {
    g.add(
      orientedSolid(
        rod,
        material,
        new THREE.Vector3((arm.offsetMm?.[0] ?? 14) / 10, 0, (arm.offsetMm?.[2] ?? -140) / 10),
        new THREE.Vector3(arm.sizeMm[0] / 20, arm.sizeMm[1] / 10, arm.sizeMm[2] / 20),
        Z_AXIS,
      ),
    );
  }
  return g;
}

export function buildPrimitive3dMesh(
  prim: Model3DPrimitive,
  box: THREE.BufferGeometry,
  rod: THREE.BufferGeometry,
  cone: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Mesh {
  const off = prim.offsetMm ?? [0, 0, 0];
  const at = new THREE.Vector3(off[0] / 10, off[1] / 10, off[2] / 10);
  const axis = prim.axis === 'x' ? X_AXIS : prim.axis === 'z' ? Z_AXIS : Y_AXIS;
  if (prim.shape === 'cylinder' || prim.shape === 'disc') {
    return orientedSolid(rod, material, at, new THREE.Vector3(prim.sizeMm[0] / 20, prim.sizeMm[1] / 10, prim.sizeMm[2] / 20), axis);
  }
  if (prim.shape === 'ring') {
    return orientedSolid(cone, material, at, new THREE.Vector3(prim.sizeMm[0] / 20, prim.sizeMm[1] / 10, prim.sizeMm[2] / 20), axis);
  }
  return orientedSolid(box, material, at, new THREE.Vector3(prim.sizeMm[0] / 10, prim.sizeMm[1] / 10, prim.sizeMm[2] / 10));
}

export function filterPrimitivesByLod(
  primitives: readonly Model3DPrimitive[],
  lod: HardwareModelLod,
): readonly Model3DPrimitive[] {
  if (lod === 'all' || lod === 'studio' || lod === 'make') return primitives;
  const filtered = primitives.filter(p => !p.lod || p.lod === 'all');
  return filtered.length ? filtered : primitives.slice(0, 1);
}

export function buildEntryPrimitivesGroup(
  entry: HardwareEntry,
  lod: HardwareModelLod,
  box: THREE.BufferGeometry,
  rod: THREE.BufferGeometry,
  cone: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  for (const prim of filterPrimitivesByLod(entry.display.model3d.primitives, lod)) {
    g.add(buildPrimitive3dMesh(prim, box, rod, cone, material));
  }
  return g;
}
