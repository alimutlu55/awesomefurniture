import * as THREE from 'three';
import type { StudioOpening, StudioWall } from '../../domain/studio/studio';

type MaterialFactory = (color: string, options?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;

/**
 * Builds the 3D representation of a wall-mounted utility (`water`, `socket`, `duct`, `gas`, `radiator`, `switch`)
 * in the wall's local coordinates (`x` along the wall from corner `a`, `y` above the floor, `z` out from the wall's
 * centreline where `z = w.thickness / 2` is the room face), and registers its meshes in `hits` for picking.
 */
export function addWallUtilityView(
  details: THREE.Group,
  hits: THREE.Object3D[],
  w: StudioWall,
  o: StudioOpening,
  material: MaterialFactory,
) {
  const face = w.thickness / 2, cy = o.sill + o.height / 2;
  const plate = material('#f6f3ec', { roughness: 0.42, metalness: 0.04 });
  const border = material('#d8d2c7', { roughness: 0.5, metalness: 0.05 });
  const chrome = material('#cbd5e0', { roughness: 0.25, metalness: 0.65 });
  const dark = material('#3b4252', { roughness: 0.6, metalness: 0.1 });
  const red = material('#d63939', { roughness: 0.35, metalness: 0.1 });
  const blue = material('#2b6cb0', { roughness: 0.35, metalness: 0.1 });
  const brass = material('#b7791f', { roughness: 0.35, metalness: 0.55 });
  const yellow = material('#eab308', { roughness: 0.35, metalness: 0.1 });

  const addMesh = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z);
    mesh.userData.studioOpening = o.id;
    mesh.userData.studioWall = w.id;
    hits.push(mesh);
    details.add(mesh);
  };
  const addBox = (sx: number, sy: number, sz: number, x: number, y: number, z: number, mat: THREE.Material) =>
    addMesh(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat), x, y, z);
  const addCyl = (r: number, len: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const g = new THREE.CylinderGeometry(r, r, len, 18);
    g.rotateX(Math.PI / 2);
    addMesh(new THREE.Mesh(g, mat), x, y, z);
  };

  if (o.kind === 'water') {
    // Mounting plate, hot (left, red) & cold (right, blue) angle valves, and lower waste pipe stub.
    addBox(o.width, o.height, 0.8, o.offset, cy, face + 0.4, plate);
    const dx = Math.min(o.width * 0.28, 8), vy = o.sill + o.height * 0.68, dy = o.sill + o.height * 0.28;
    const rValve = Math.max(1.2, Math.min(2.2, o.width * 0.08));
    addCyl(rValve * 1.35, 0.8, o.offset - dx, vy, face + 1.0, chrome);
    addCyl(rValve, 3.6, o.offset - dx, vy, face + 2.6, chrome);
    addCyl(rValve * 0.9, 1.2, o.offset - dx, vy, face + 4.6, red);
    addCyl(rValve * 1.35, 0.8, o.offset + dx, vy, face + 1.0, chrome);
    addCyl(rValve, 3.6, o.offset + dx, vy, face + 2.6, chrome);
    addCyl(rValve * 0.9, 1.2, o.offset + dx, vy, face + 4.6, blue);
    const rDrain = Math.max(1.8, Math.min(3.0, Math.min(o.width, o.height) * 0.14));
    addCyl(rDrain * 1.2, 1.0, o.offset, dy, face + 1.1, dark);
    addCyl(rDrain, 4.2, o.offset, dy, face + 2.9, dark);
    return;
  }

  if (o.kind === 'socket') {
    // Bevelled faceplate with twin recessed power outlets and pin holes.
    addBox(o.width, o.height, 1.2, o.offset, cy, face + 0.6, plate);
    const count = o.width >= 13 ? 2 : 1, span = o.width / count;
    const rWell = Math.max(1.4, Math.min(span * 0.32, o.height * 0.32));
    for (let i = 0; i < count; i++) {
      const tx = o.offset + (i - (count - 1) / 2) * (span * 0.82);
      addCyl(rWell, 0.5, tx, cy, face + 1.15, border);
      const pinOff = rWell * 0.42, pinR = Math.max(0.32, rWell * 0.14);
      addCyl(pinR, 0.6, tx - pinOff, cy, face + 1.25, dark);
      addCyl(pinR, 0.6, tx + pinOff, cy, face + 1.25, dark);
    }
    return;
  }

  if (o.kind === 'duct') {
    // Extractor vent grille with outer flange, circular collar and horizontal louvre slats.
    addBox(o.width, o.height, 1.4, o.offset, cy, face + 0.7, plate);
    const rDuct = Math.max(2, Math.min(o.width, o.height) * 0.38);
    addCyl(rDuct, 1.8, o.offset, cy, face + 1.3, chrome);
    addCyl(rDuct * 0.84, 1.9, o.offset, cy, face + 1.35, dark);
    const slats = 4, innerW = rDuct * 1.45;
    for (let i = 0; i < slats; i++) {
      const sy = cy + ((i / (slats - 1)) - 0.5) * rDuct * 1.1;
      addBox(innerW, 0.6, 0.6, o.offset, sy, face + 2.2, chrome);
    }
    return;
  }

  if (o.kind === 'gas') {
    // Wall flange, brass gas pipe stub and yellow shut-off lever.
    addBox(o.width, o.height, 0.8, o.offset, cy, face + 0.4, plate);
    const rPipe = Math.max(1.2, Math.min(o.width, o.height) * 0.14);
    addCyl(rPipe * 1.4, 0.9, o.offset, cy, face + 1.0, chrome);
    addCyl(rPipe, 3.6, o.offset, cy, face + 2.6, brass);
    addBox(Math.min(o.width * 0.45, 5.5), rPipe * 0.9, 1.1, o.offset + rPipe * 0.8, cy + rPipe * 0.6, face + 3.8, yellow);
    return;
  }

  if (o.kind === 'radiator') {
    // Ribbed white heating panel standing off the wall with top grille and side thermostatic valve.
    const depth = 7, panelW = Math.max(4, o.width - 3);
    addBox(panelW, o.height, depth, o.offset, cy, face + 2 + depth / 2, plate);
    const ribs = Math.max(3, Math.min(24, Math.floor(panelW / 4.5)));
    for (let i = 0; i < ribs; i++) {
      const rx = o.offset - panelW / 2 + (i + 0.5) * (panelW / ribs);
      addBox(1.1, Math.max(2, o.height - 4), 0.6, rx, cy, face + 2 + depth + 0.2, border);
    }
    addCyl(1.4, 3.2, o.offset + o.width / 2 - 1, o.sill + o.height - 4, face + 4.5, chrome);
    return;
  }

  // 'switch': bevelled wall switch plate with twin rocker paddles.
  addBox(o.width, o.height, 1.1, o.offset, cy, face + 0.55, plate);
  const rw = Math.max(2, o.width * 0.64), rh = Math.max(2, o.height * 0.64);
  addBox(rw, rh, 0.6, o.offset, cy, face + 1.15, border);
  addBox(0.35, rh, 0.7, o.offset, cy, face + 1.2, dark);
}
