import * as THREE from 'three';
import { studioBounds, wallExtent, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioOpening, StudioWall } from '../../domain/studio/studio';

/** Colours of the room. Plain, light finishes so the wardrobe stays the subject. */
const LOOK = Object.freeze({
  wall: '#efe9df', skirting: '#f7f4ee', frame: '#ece6dc', door: '#f4f0e8', handle: '#a9a39a', glass: '#cfe2ea',
  floorA: '#d6c3a2', floorB: '#cdb894', floorLine: '#b9a37f',
});
/** Opacity a wall fades to when the camera looks at the room through it. */
const CUTAWAY = .12;
const SKIRTING = { height: 8, depth: 1.5 }, CASING = { width: 7, depth: 2 }, LEAF = 4;

interface WallView { group: THREE.Group; materials: THREE.MeshStandardMaterial[]; mid: THREE.Vector3; normal: THREE.Vector3; opacity: number }

/** Draws the studio around the wardrobes and fades the walls between the camera and the room.
 * `sync` rebuilds only when the room changed; `frame` runs every frame. Centimetres, scene axes. */
export function createStudioRenderer(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'studio';
  scene.add(root);
  let key = '', walls: WallView[] = [], floorTexture: THREE.Texture | null = null;

  function clear() {
    root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    root.clear();
    floorTexture?.dispose();
    floorTexture = null;
    walls = [];
  }

  function sync(studio: Studio | undefined) {
    const next = studio ? JSON.stringify(studio) : '';
    if (next === key) return;
    key = next;
    clear();
    if (!studio) return;
    root.add(floor(studio));
    for (const w of studio.walls) {
      const view = wallView(studio, w);
      if (view) { root.add(view.group); walls.push(view); }
    }
  }

  /** Walls whose room side faces away from the camera stand between it and the room: they fade, so
   * the wardrobes are never hidden. Smooth, so orbiting does not flicker. */
  function frame(camera: THREE.Camera, dt: number) {
    const k = 1 - Math.exp(-dt * 10), to = new THREE.Vector3();
    for (const view of walls) {
      to.copy(camera.position).sub(view.mid);
      const behind = to.dot(view.normal) < -1;
      const target = behind ? CUTAWAY : 1;
      if (Math.abs(view.opacity - target) < .005) { if (view.opacity !== target) apply(view, target); continue; }
      apply(view, view.opacity + (target - view.opacity) * k);
    }
  }
  function apply(view: WallView, opacity: number) {
    view.opacity = opacity;
    for (const m of view.materials) {
      m.opacity = opacity * (m.userData.base as number);
      m.transparent = opacity < .999 || (m.userData.base as number) < 1;
      m.depthWrite = opacity >= .999 && (m.userData.base as number) >= 1;
    }
  }

  function wallView(studio: Studio, w: StudioWall): WallView | null {
    const line = wallLine(studio, w);
    if (!line) return null;
    const group = new THREE.Group(), materials: THREE.MeshStandardMaterial[] = [];
    const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: .92, metalness: 0, ...options });
      m.userData.base = options.opacity ?? 1;
      materials.push(m);
      return m;
    };
    const { start, end } = wallExtent(studio, w, line.length), openings = studio.openings.filter(o => o.wall === w.id);
    const body = new THREE.ExtrudeGeometry(outline(start, end, w.height, openings), { depth: w.thickness, bevelEnabled: false });
    body.translate(0, 0, -w.thickness / 2);
    group.add(new THREE.Mesh(body, material(LOOK.wall)));
    const face = w.thickness / 2;
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      mesh.position.set(x, y, z);
      group.add(mesh);
    };
    // Skirting on the room side, interrupted by doors and archways.
    const skirting = material(LOOK.skirting);
    for (const [s, e] of gaps(start, end, openings.filter(o => o.sill < 1))) if (e - s > 1) box(e - s, SKIRTING.height, SKIRTING.depth, (s + e) / 2, SKIRTING.height / 2, face + SKIRTING.depth / 2, skirting);
    const frameM = material(LOOK.frame);
    for (const o of openings) {
      const left = o.offset - o.width / 2, right = o.offset + o.width / 2, top = o.sill + o.height;
      // Casings on both faces: sides and head; windows also have a bottom rail.
      for (const side of [1, -1]) {
        const z = side * (face + CASING.depth / 2);
        box(CASING.width, top - o.sill + (o.sill > 0 ? CASING.width : 0), CASING.depth, left - CASING.width / 2, (o.sill + top) / 2, z, frameM);
        box(CASING.width, top - o.sill + (o.sill > 0 ? CASING.width : 0), CASING.depth, right + CASING.width / 2, (o.sill + top) / 2, z, frameM);
        box(o.width + 2 * CASING.width, CASING.width, CASING.depth, o.offset, top + CASING.width / 2, z, frameM);
        if (o.sill > 0) box(o.width + 2 * CASING.width, CASING.width, CASING.depth, o.offset, o.sill - CASING.width / 2, z, frameM);
      }
      if (o.kind === 'door') {
        box(o.width - 1, o.height - 1, LEAF, o.offset, o.height / 2, 0, material(LOOK.door));
        box(12, 2, 3, right - 10, 100, LEAF / 2 + 1.5, material(LOOK.handle, { metalness: .6, roughness: .35 }));
        box(12, 2, 3, right - 10, 100, -LEAF / 2 - 1.5, material(LOOK.handle, { metalness: .6, roughness: .35 }));
      } else if (o.kind === 'window') {
        box(o.width, o.height, 1, o.offset, o.sill + o.height / 2, 0, material(LOOK.glass, { opacity: .32, transparent: true, roughness: .1 }));
        box(o.width, 3, 3, o.offset, o.sill + o.height / 2, 0, frameM);
        box(o.width + 16, 2.5, 6, o.offset, o.sill - 1.25, face + 3, material(LOOK.skirting));
      }
    }
    group.rotation.y = line.angle * Math.PI / 180;
    group.position.set(line.a.x, 0, line.a.z);
    const mid = new THREE.Vector3(line.a.x + line.ux * line.length / 2, w.height / 2, line.a.z + line.uz * line.length / 2);
    return { group, materials, mid, normal: new THREE.Vector3(line.nx, 0, line.nz), opacity: 1 };
  }

  function floor(studio: Studio) {
    const b = studioBounds(studio)!, closed = studio.walls.every(w => studio.walls.some(o => o !== w && (o.a === w.b || o.b === w.b)));
    const shape = new THREE.Shape();
    if (closed) {
      // The room's own outline, walked along its walls.
      const order = [studio.walls[0]!];
      while (order.length < studio.walls.length) { const next = studio.walls.find(w => w.a === order.at(-1)!.b); if (!next || order.includes(next)) break; order.push(next); }
      order.forEach((w, i) => { const c = studio.corners.find(x => x.id === w.a)!; if (i) shape.lineTo(c.x, -c.z); else shape.moveTo(c.x, -c.z); });
    } else {
      // Open layouts: floor in front of the walls, as far as a person would stand.
      shape.moveTo(b.x0 - 80, -b.z0); shape.lineTo(b.x1 + 80, -b.z0); shape.lineTo(b.x1 + 80, -(b.z1 + 260)); shape.lineTo(b.x0 - 80, -(b.z1 + 260));
    }
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    floorTexture = planks();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: floorTexture, roughness: .85, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    mesh.position.y = -.05;
    mesh.receiveShadow = true;
    return mesh;
  }

  return { sync, frame, dispose: () => { clear(); scene.remove(root); } };
}

/** A wall's face outline from `start` to `end` along it, `height` tall: doors and archways are notches
 * from the floor, windows are holes. */
function outline(start: number, end: number, height: number, openings: readonly StudioOpening[]) {
  const shape = new THREE.Shape();
  shape.moveTo(start, 0);
  for (const o of [...openings].filter(o => o.sill < 1).sort((p, q) => p.offset - q.offset)) {
    const l = o.offset - o.width / 2, r = o.offset + o.width / 2, top = Math.min(height - 1, o.height);
    shape.lineTo(l, 0); shape.lineTo(l, top); shape.lineTo(r, top); shape.lineTo(r, 0);
  }
  shape.lineTo(end, 0); shape.lineTo(end, height); shape.lineTo(start, height); shape.lineTo(start, 0);
  for (const o of openings.filter(o => o.sill >= 1)) {
    const hole = new THREE.Path(), l = o.offset - o.width / 2, r = o.offset + o.width / 2;
    hole.moveTo(l, o.sill); hole.lineTo(l, o.sill + o.height); hole.lineTo(r, o.sill + o.height); hole.lineTo(r, o.sill); hole.lineTo(l, o.sill);
    shape.holes.push(hole);
  }
  return shape;
}

/** The parts of [start, end] not covered by the openings. */
function gaps(start: number, end: number, openings: readonly StudioOpening[]): [number, number][] {
  const out: [number, number][] = [];
  let at = start;
  for (const o of [...openings].sort((p, q) => p.offset - q.offset)) {
    const l = o.offset - o.width / 2 - CASING.width, r = o.offset + o.width / 2 + CASING.width;
    if (l > at) out.push([at, l]);
    at = Math.max(at, r);
  }
  if (end > at) out.push([at, end]);
  return out;
}

/** Light oak floor boards, 14 cm wide, drawn once into a repeating texture. */
function planks() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? LOOK.floorA : LOOK.floorB;
    g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = LOOK.floorLine;
    g.fillRect(0, i * 64, 512, 2);
    g.fillRect(((i * 197) % 512), i * 64, 2, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 112, 1 / 112);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}
