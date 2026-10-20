import * as THREE from 'three';

/** A wardrobe as the scene stores it: centre x/z, floor height y, angle in degrees, size in centimetres. */
interface Placed { readonly id: number; readonly x: number; readonly y?: number; readonly z: number; readonly angle: number; readonly state: { readonly w: number; readonly d: number; readonly h: number } }

/** How long a hidden wardrobe stays hidden after it stops blocking the view, so orbiting past the edge
 * of one does not make it flicker. Seconds. */
const LINGER = .2;

/** Two wardrobes facing each other, or one in front of another: while a wardrobe is selected, any other
 * that stands between the camera and it steps aside. It is hidden, and a dashed outline on the floor
 * keeps its place, so the selected wardrobe is never seen through the back of another. It reappears as
 * soon as the view is clear. Hidden wardrobes take no clicks and show no labels (see scene picking and
 * label placement, which skip invisible groups). */
export function createWardrobeOcclusion(scene: THREE.Scene) {
  const outlines = new THREE.Group();
  outlines.name = 'hidden-wardrobes';
  scene.add(outlines);
  const material = new THREE.LineDashedMaterial({ color: new THREE.Color('#8d7d65').convertSRGBToLinear(), toneMapped: false, dashSize: 5, gapSize: 4, transparent: true, opacity: .8, depthTest: false });
  /** Wardrobe id → seconds it has been clear while still hidden. */
  const hidden = new Map<number, number>();
  let drawn = '';

  /** `active` is the selected wardrobe's id, or null when none is selected (then nothing hides). */
  function frame(camera: THREE.Camera, wardrobes: readonly Placed[], groups: readonly THREE.Object3D[], active: number | null, dt: number) {
    const subject = active === null ? undefined : wardrobes.find(w => w.id === active);
    const eye = camera.position, targets = subject ? samples(subject) : [];
    wardrobes.forEach(w => {
      if (!subject || w === subject) { hidden.delete(w.id); return; }
      const blocking = inside(w, eye, 0) || targets.some(t => crosses(w, eye, t));
      if (blocking) hidden.set(w.id, 0);
      else if (hidden.has(w.id)) {
        const clear = hidden.get(w.id)! + dt;
        if (clear >= LINGER) hidden.delete(w.id); else hidden.set(w.id, clear);
      }
    });
    wardrobes.forEach((w, i) => { const g = groups[i]; if (g) g.visible = !hidden.has(w.id); });
    const key = [...hidden.keys()].map(id => { const w = wardrobes.find(x => x.id === id); return w ? [id, w.x, w.z, w.angle, w.state.w, w.state.d].join() : ''; }).join('|');
    if (key !== drawn) { drawn = key; drawOutlines(wardrobes.filter(w => hidden.has(w.id))); }
  }

  /** Footprints of the hidden wardrobes, dashed, on the floor. */
  function drawOutlines(list: readonly Placed[]) {
    outlines.children.forEach(o => (o as THREE.Line).geometry.dispose());
    outlines.clear();
    for (const w of list) {
      const a = w.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), vx = Math.sin(a), vz = Math.cos(a);
      const corner = (sx: number, sz: number) => new THREE.Vector3(w.x + ux * sx * w.state.w / 2 + vx * sz * w.state.d / 2, .7, w.z + uz * sx * w.state.w / 2 + vz * sz * w.state.d / 2);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)]), material);
      line.computeLineDistances();
      line.renderOrder = 15;
      outlines.add(line);
    }
  }

  return {
    /** Ids of the wardrobes currently stepped aside. */
    hiddenIds: () => [...hidden.keys()].sort((a, b) => a - b),
    frame,
    /** Whether a wardrobe is hidden because it blocks the view. */
    isHidden: (id: number) => hidden.has(id),
    dispose() { drawOutlines([]); material.dispose(); scene.remove(outlines); },
  };
}

const GHOST_OPACITY = 0.22;

/**
 * When a wall or wall item/opening is selected in Studio, furniture (wardrobes, cabinets, worktops, plinths)
 * becomes semi-transparent (`opacity = 0.22`, `depthWrite = false`) so the wall and its items stay crisp ("net")
 * and visible right through the furniture. Restores original materials when leaving wall/opening selection.
 */
export function syncFurnitureTransparency(
  groups: readonly THREE.Object3D[],
  transparent: boolean,
  scene?: THREE.Scene,
) {
  const targets = [...groups];
  const runs = scene?.getObjectByName('kitchen-runs');
  if (runs) targets.push(runs);
  for (const root of targets) {
    root.userData.furnitureTransparent = transparent;
    root.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh && !(obj as THREE.Line).isLine) return;
      if (mesh.userData.floorShadow) return;
      const mat = mesh.material as THREE.Material & { opacity?: number } | undefined;
      if (!mat || Array.isArray(mat) || mat.visible === false) return;
      if (transparent) {
        if (mesh.userData.ghostMaterial) return;
        const orig = mat;
        const ghost = orig.clone() as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
        ghost.transparent = true;
        ghost.opacity = Math.min(orig.opacity ?? 1, GHOST_OPACITY);
        ghost.depthWrite = false;
        mesh.userData.origMaterial = orig;
        mesh.userData.ghostMaterial = ghost;
        mesh.material = ghost;
      } else if (mesh.userData.origMaterial) {
        const ghost = mesh.userData.ghostMaterial as THREE.Material | undefined;
        mesh.material = mesh.userData.origMaterial;
        delete mesh.userData.origMaterial;
        delete mesh.userData.ghostMaterial;
        ghost?.dispose();
      }
    });
  }
}

/** Points the camera must see: the middle of the wardrobe and four points around it, inset from its
 * edges so a neighbour that only grazes a corner does not count as blocking. */
function samples(w: Placed) {
  const a = w.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), y = (w.y ?? 0) + w.state.h / 2;
  return [[0, 0], [-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]].map(([sx, sy]) => new THREE.Vector3(w.x + ux * sx! * w.state.w, y + sy! * w.state.h, w.z + uz * sx! * w.state.w));
}

/** A point in the wardrobe's own axes: x along its width, y up from its base, z along its depth. */
function local(w: Placed, p: THREE.Vector3) {
  const a = w.angle * Math.PI / 180, dx = p.x - w.x, dz = p.z - w.z;
  return { x: dx * Math.cos(a) - dz * Math.sin(a), y: p.y - (w.y ?? 0), z: dx * Math.sin(a) + dz * Math.cos(a) };
}
function inside(w: Placed, p: THREE.Vector3, margin: number) {
  const q = local(w, p);
  return Math.abs(q.x) <= w.state.w / 2 + margin && Math.abs(q.z) <= w.state.d / 2 + margin && q.y >= -margin && q.y <= w.state.h + margin;
}
/** Whether the segment from a to b passes through the wardrobe's box (shrunk by 2 cm), by slabs. */
function crosses(w: Placed, a: THREE.Vector3, b: THREE.Vector3) {
  const p = local(w, a), q = local(w, b), shrink = 2;
  const lo = { x: -w.state.w / 2 + shrink, y: shrink, z: -w.state.d / 2 + shrink }, hi = { x: w.state.w / 2 - shrink, y: w.state.h - shrink, z: w.state.d / 2 - shrink };
  let t0 = 0, t1 = 1;
  for (const k of ['x', 'y', 'z'] as const) {
    const d = q[k] - p[k];
    if (Math.abs(d) < 1e-9) { if (p[k] < lo[k] || p[k] > hi[k]) return false; continue; }
    let s = (lo[k] - p[k]) / d, e = (hi[k] - p[k]) / d;
    if (s > e) [s, e] = [e, s];
    t0 = Math.max(t0, s); t1 = Math.min(t1, e);
    if (t0 > t1) return false;
  }
  return true;
}
