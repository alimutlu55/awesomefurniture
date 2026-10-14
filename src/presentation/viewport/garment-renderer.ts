import * as THREE from 'three';
import { createRenderAssetCache } from './render-asset-cache';
import {
  DRAPE,
  HOOK_CM,
  makeGarmentSpec,
  buildGarmentGeometry,
  yTop,
  type GarmentSpec,
  type GarmentKey,
} from './garment-shape';
import { createGarmentMaterials, createHangerMaterials } from './garment-materials';

export interface GarmentInstance {
  pivot: THREE.Group;
  sp: GarmentSpec;
  imp: number;
  t0: number;
}

/** Step damped pendulum and subtle idle sway for hanging garments. */
export function stepGarmentSway(
  garments: GarmentInstance[] | undefined,
  dt: number,
  t: number,
  reduceMotion = false,
) {
  if (!garments || !garments.length || !DRAPE.sway) return;
  const idle = reduceMotion ? 0 : 1;
  const k = DRAPE.swayStrength;
  for (let i = 0; i < garments.length; i++) {
    const g = garments[i]!;
    const sp = g.sp;
    g.imp *= Math.exp(-dt / 2.6);
    const a = k * (g.imp * Math.sin(sp.omega * (t - g.t0)) +
      idle * (0.004 * Math.sin(0.9 * sp.omega * t + sp.ph1) + 0.0025 * Math.sin(0.37 * t + sp.ph2)));
    const b = k * (0.35 * g.imp * Math.sin(1.13 * sp.omega * (t - g.t0) + 0.8) +
      idle * 0.003 * Math.sin(0.8 * sp.omega * t + sp.ph2));
    g.pivot.rotation.z = sp.tiltZ + a;
    g.pivot.rotation.x = b;
    g.pivot.rotation.y = sp.rotY + 0.3 * a;
  }
}

/** Gives garments an impulse so they swing naturally when nudged or interacted with. */
export function nudgeGarments(
  garments: GarmentInstance[] | undefined,
  x0 = 0,
  force = 0.14,
  spread = 0,
) {
  if (!garments || !garments.length) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  for (let i = 0; i < garments.length; i++) {
    const g = garments[i]!;
    const dx = g.pivot.position.x - x0;
    const kf = spread > 0 ? Math.exp(-(dx * dx) / (2 * spread * spread)) : 1;
    g.imp = Math.min(0.4, g.imp * 0.5 + force * kf * (0.75 + 0.5 * Math.sin(i * 1.7)));
    g.t0 = now;
  }
}

export interface GarmentRendererPorts {
  resources?: {
    M?: (color: string, opt?: object) => THREE.Material;
    cv?: HTMLCanvasElement;
  };
  renderState?: {
    Gr?: THREE.Group | null;
    garments?: GarmentInstance[];
  };
}

/** Creates realistic 3D garments with real cuts, hangers, details and physics. */
export function createGarmentRenderer({ resources, renderState }: GarmentRendererPorts = {}) {
  const cache = createRenderAssetCache();
  const { geometry, material, meshes } = cache;
  const L = HOOK_CM - 1.4;

  function garment(
    cx: number,
    top: number,
    z: number,
    height: number,
    depth: number,
    color: string,
    front = false,
    kind?: GarmentKey,
  ) {
    if (!renderState?.Gr) return;
    // fitting-renderer passes ry - 3 as top, so actual rail center is top + 3.
    const railY = top + 3;
    const seed = Math.abs(Math.round(cx * 73 + z * 37 + height * 11));
    const sp = makeGarmentSpec(seed, height, depth, color, front, kind);
    const shapeKey = JSON.stringify([sp.key, sp.sh, sp.chest, sp.neck, sp.neckF, sp.neckB,
      sp.drop, sp.len, sp.sleeve, sp.sr0, sp.sr1, sp.ph, sp.foldAmt, sp.hemAmp, sp.hp]);
    const geo = geometry('cloth:' + shapeKey, () => buildGarmentGeometry(sp));
    const doc = resources?.cv?.ownerDocument;
    const mats = material(JSON.stringify([sp.ty.fab, sp.color.r, sp.color.g, sp.color.b]),
      () => createGarmentMaterials(sp.ty.fab, sp.color, doc));

    const pivot = new THREE.Group();
    pivot.rotation.order = 'ZYX';
    pivot.position.set(cx, railY, z);
    pivot.rotation.set(0, sp.rotY, sp.tiltZ);

    const mesh = new THREE.Mesh(geo, mats);
    mesh.position.y = -HOOK_CM;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    meshes.add(mesh);

    if (DRAPE.hardware) {
      const [wood, steel] = material('hangers', () => {
        const hangers = createHangerMaterials(resources);
        return [hangers.wood, hangers.steel];
      });
      // Metal swivel neck from the hook down to the hanger arms.
      const neck = new THREE.Mesh(geometry('neck', () => new THREE.CylinderGeometry(0.16, 0.16, L, 6)), steel);
      neck.position.y = -(1.4 + L / 2);
      neck.castShadow = true;
      pivot.add(neck);
      meshes.add(neck);

      // Wooden hanger arms matching the garment shoulder slope.
      const tipX = sp.sh * 0.86, tipY = yTop(sp, tipX, 1) - 1.2;
      const armLen = Math.hypot(tipX, tipY + 1.2), ang = Math.atan2(tipY + 1.2, tipX);
      const armGeo = geometry('arm:' + armLen, () => new THREE.BoxGeometry(armLen, 1.0, 1.2));
      for (const sd of [1, -1]) {
        const arm = new THREE.Mesh(armGeo, wood);
        arm.position.set((sd * tipX) / 2, -HOOK_CM + (tipY - 1.2) / 2, 0);
        arm.rotation.z = sd > 0 ? ang : -ang;
        arm.castShadow = true;
        pivot.add(arm);
        meshes.add(arm);
      }

      // Open hook ring sitting squarely over the rail cylinder.
      const ring = new THREE.Mesh(geometry('ring', () => new THREE.TorusGeometry(1.4, 0.16, 6, 18, Math.PI * 1.85)), steel);
      ring.position.set(cx, railY, z);
      if (front) {
        ring.rotation.set(0, 0, 0);
      } else {
        ring.rotation.set(0, Math.PI / 2, 0);
      }
      ring.castShadow = true;
      renderState.Gr.add(ring);
      meshes.add(ring);
    }

    renderState.Gr.add(pivot);

    renderState.garments ??= [];
    renderState.garments.push({ pivot, sp, imp: 0, t0: 0 });
  }

  return { garment, ...cache };
}
