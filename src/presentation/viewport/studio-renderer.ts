import * as THREE from 'three';
import { studioBounds, wallExtent, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioOpening, StudioWall } from '../../domain/studio/studio';
import { roomOutline, planks } from './studio-surfaces';

/** Colours of the room (sRGB). Plain, light finishes so the wardrobe stays the subject. */
const LOOK = Object.freeze({
  wall: '#ece6dc', cut: '#857a6b', skirting: '#f6f3ee', frame: '#eee9e1', door: '#f3efe7', handle: '#9d978e', glass: '#bcd5df',
  ceiling: '#f4f1ec', select: '#2f2a22',
});
/** Height of a wall lowered because it stands between the camera and the room: low enough to see over,
 * tall enough to still read as the room's outline. */
const STUB = 14;
const SKIRTING = { height: 8, depth: 1.5 }, CASING = { width: 7, depth: 2 }, LEAF = 4;
const linear = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();

/** What is selected in the room: drawn with its outline at full height, even while its wall is lowered. */
export type RoomSelection = { readonly kind: 'wall' | 'opening'; readonly id: string } | null;
interface WallView { id: string; group: THREE.Group; body: THREE.Group; details: THREE.Group; cap: THREE.Mesh; normal: THREE.Vector3; mid: THREE.Vector3; height: number; lift: number }

/** Draws the studio around the wardrobes. Walls between the camera and the room lower to a short cut
 * stub, so nothing ghosts over the wardrobes; the ceiling shows only from inside the room. `sync`
 * rebuilds when the room changes (keeping how far each wall is lowered); `frame` runs every frame.
 * Centimetres, scene axes. */
export function createStudioRenderer(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'studio';
  scene.add(root);
  let key = '', walls: WallView[] = [], hits: THREE.Object3D[] = [], ceiling: THREE.Mesh | null = null, outline: { x: number; z: number }[] = [];
  let selection: RoomSelection = null, selected: THREE.Object3D | null = null, room: Studio | undefined;
  const texture = planks(), materials = new Map<string, THREE.MeshStandardMaterial>();
  /** Shared materials: rebuilding during a drag reuses them. */
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const id = color + JSON.stringify(options);
    let m = materials.get(id);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: linear(color), roughness: .9, metalness: 0, ...options }); materials.set(id, m); }
    return m;
  };
  const floorMaterial = new THREE.MeshStandardMaterial({ map: texture, color: linear('#efe6da'), roughness: .72, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const lineMaterial = new THREE.LineBasicMaterial({ color: linear(LOOK.select), toneMapped: false, transparent: true, opacity: .85, depthTest: false });

  function clear() {
    root.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose(); });
    root.clear();
    walls = []; hits = []; ceiling = null; selected = null;
  }

  function sync(studio: Studio | undefined) {
    const next = studio ? JSON.stringify(studio) : '';
    if (next === key) return;
    key = next;
    room = studio;
    const lifts = new Map(walls.map(v => [v.id, v.lift]));
    clear();
    if (!studio) return;
    outline = roomOutline(studio) ?? [];
    root.add(floor(studio));
    if (outline.length) root.add(ceiling = roof(studio));
    for (const w of studio.walls) {
      const view = wallView(studio, w);
      if (!view) continue;
      root.add(view.group);
      walls.push(view);
      setLift(view, lifts.get(w.id) ?? 1);
    }
    drawSelection();
  }

  /** Lowers the walls whose room side faces away from the camera, smoothly so orbiting never flickers. */
  function frame(camera: THREE.Camera, dt: number) {
    const k = 1 - Math.exp(-dt * 12), to = new THREE.Vector3();
    for (const view of walls) {
      to.copy(camera.position).sub(view.mid);
      const target = to.dot(view.normal) < -1 ? Math.min(1, STUB / view.height) : 1;
      if (view.lift !== target) setLift(view, Math.abs(view.lift - target) < .003 ? target : view.lift + (target - view.lift) * k);
    }
    // The ceiling closes the room only when you look from inside it, below it.
    if (ceiling) ceiling.visible = camera.position.y < ceiling.position.y - 5 && inside(camera.position.x, camera.position.z);
  }
  function setLift(view: WallView, lift: number) {
    view.lift = lift;
    view.body.scale.y = lift;
    // Doors and windows belong to a standing wall; a lowered one shows its cut top instead.
    view.details.visible = lift > .6;
    view.cap.visible = lift < .999;
    view.cap.position.y = view.height * lift + .35;
  }
  const inside = (x: number, z: number) => {
    let hit = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[i]!, b = outline[j]!;
      if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) hit = !hit;
    }
    return hit;
  };

  function wallView(studio: Studio, w: StudioWall): WallView | null {
    const line = wallLine(studio, w);
    if (!line) return null;
    const group = new THREE.Group(), body = new THREE.Group(), details = new THREE.Group();
    group.add(body);
    body.add(details);
    const { start, end } = wallExtent(studio, w, line.length), openings = studio.openings.filter(o => o.wall === w.id);
    const geometry = new THREE.ExtrudeGeometry(faceOutline(start, end, w.height, openings), { depth: w.thickness, bevelEnabled: false });
    geometry.translate(0, 0, -w.thickness / 2);
    const solid = new THREE.Mesh(geometry, material(LOOK.wall));
    solid.userData.studioWall = w.id;
    solid.receiveShadow = true;
    body.add(solid);
    hits.push(solid);
    // The cut top of a lowered wall: a darker band, as in a section drawing.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(end - start, .6, w.thickness + .2), material(LOOK.cut));
    cap.position.set((start + end) / 2, w.height, 0);
    cap.userData.studioWall = w.id;
    group.add(cap);
    const face = w.thickness / 2;
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Group, opening?: string) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      mesh.position.set(x, y, z);
      if (opening) { mesh.userData.studioOpening = opening; hits.push(mesh); }
      parent.add(mesh);
    };
    // Skirting on the room side, interrupted by doors and archways. It stays on a lowered wall.
    for (const [s, e] of gaps(start, end, openings.filter(o => o.sill < 1))) if (e - s > 1) box(e - s, SKIRTING.height, SKIRTING.depth, (s + e) / 2, SKIRTING.height / 2, face + SKIRTING.depth / 2, material(LOOK.skirting), group);
    const frameM = material(LOOK.frame);
    for (const o of openings) {
      const left = o.offset - o.width / 2, right = o.offset + o.width / 2, top = o.sill + o.height, tall = top - o.sill + (o.sill > 0 ? CASING.width : 0);
      // Casings on both faces: sides and head; windows also have a bottom rail.
      for (const side of [1, -1]) {
        const z = side * (face + CASING.depth / 2);
        box(CASING.width, tall, CASING.depth, left - CASING.width / 2, (o.sill + top) / 2, z, frameM, details, o.id);
        box(CASING.width, tall, CASING.depth, right + CASING.width / 2, (o.sill + top) / 2, z, frameM, details, o.id);
        box(o.width + 2 * CASING.width, CASING.width, CASING.depth, o.offset, top + CASING.width / 2, z, frameM, details, o.id);
        if (o.sill > 0) box(o.width + 2 * CASING.width, CASING.width, CASING.depth, o.offset, o.sill - CASING.width / 2, z, frameM, details, o.id);
      }
      if (o.kind === 'door') {
        box(o.width - 1, o.height - 1, LEAF, o.offset, o.height / 2, 0, material(LOOK.door), details, o.id);
        const handle = material(LOOK.handle, { metalness: .6, roughness: .35 });
        for (const side of [1, -1]) box(12, 2, 3, right - 10, 100, side * (LEAF / 2 + 1.5), handle, details, o.id);
      } else if (o.kind === 'window') {
        box(o.width, o.height, 1, o.offset, o.sill + o.height / 2, 0, material(LOOK.glass, { opacity: .3, transparent: true, roughness: .08, depthWrite: false }), details, o.id);
        box(o.width, 3, 3, o.offset, o.sill + o.height / 2, 0, frameM, details, o.id);
        box(o.width + 16, 2.5, 6, o.offset, o.sill - 1.25, face + 3, material(LOOK.skirting), details, o.id);
      }
    }
    group.rotation.y = line.angle * Math.PI / 180;
    group.position.set(line.a.x, 0, line.a.z);
    const mid = new THREE.Vector3(line.a.x + line.ux * line.length / 2, w.height / 2, line.a.z + line.uz * line.length / 2);
    return { id: w.id, group, body, details, cap, normal: new THREE.Vector3(line.nx, 0, line.nz), mid, height: w.height, lift: 1 };
  }

  /** The selected wall or opening keeps a full-height outline, so it reads even while its wall is low. */
  function select(next: RoomSelection) {
    if (JSON.stringify(next) === JSON.stringify(selection)) return;
    selection = next;
    drawSelection();
  }
  function drawSelection() {
    if (selected) { selected.parent?.remove(selected); (selected as THREE.LineSegments).geometry.dispose(); selected = null; }
    if (!selection || !room) return;
    const o = selection.kind === 'opening' ? room.openings.find(x => x.id === selection!.id) : undefined;
    const w = room.walls.find(x => x.id === (o ? o.wall : selection!.id)), view = walls.find(v => v.id === w?.id), line = w && wallLine(room, w);
    if (!w || !view || !line) return;
    let geometry: THREE.BufferGeometry;
    if (o) {
      const l = o.offset - o.width / 2 - CASING.width, r = o.offset + o.width / 2 + CASING.width, b = Math.max(0, o.sill - CASING.width), t = o.sill + o.height + CASING.width, z = w.thickness / 2 + CASING.depth + .3;
      geometry = new THREE.BufferGeometry().setFromPoints([[l, b, r, b], [r, b, r, t], [r, t, l, t], [l, t, l, b]].flatMap(([x0, y0, x1, y1]) => [new THREE.Vector3(x0, y0, z), new THREE.Vector3(x1, y1, z)]));
    } else {
      const { start, end } = wallExtent(room, w, line.length);
      geometry = new THREE.EdgesGeometry(new THREE.ExtrudeGeometry(faceOutline(start, end, w.height, room.openings.filter(x => x.wall === w.id)), { depth: w.thickness, bevelEnabled: false }).translate(0, 0, -w.thickness / 2), 20);
    }
    selected = new THREE.LineSegments(geometry, lineMaterial);
    selected.renderOrder = 12;
    view.group.add(selected);
  }

  function floor(studio: Studio) {
    const shape = new THREE.Shape(), b = studioBounds(studio)!;
    const points = outline.length ? outline : [{ x: b.x0 - 80, z: b.z0 }, { x: b.x1 + 80, z: b.z0 }, { x: b.x1 + 80, z: b.z1 + 260 }, { x: b.x0 - 80, z: b.z1 + 260 }];
    points.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, floorMaterial);
    mesh.position.y = -.05;
    mesh.receiveShadow = true;
    return mesh;
  }
  function roof(studio: Studio) {
    const shape = new THREE.Shape();
    outline.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    // Seen from below only: its face points down.
    const mesh = new THREE.Mesh(geometry, material(LOOK.ceiling, { side: THREE.BackSide }));
    mesh.position.y = Math.min(...studio.walls.map(w => w.height));
    mesh.visible = false;
    return mesh;
  }

  /** A green strip on the floor where a dragged wardrobe sits flush against a wall: it snapped there. */
  const guideStrip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: linear('#5f9f78'), toneMapped: false, depthTest: false, transparent: true, opacity: .9 }));
  guideStrip.renderOrder = 16;
  guideStrip.visible = false;
  scene.add(guideStrip);
  function guide(segment: { a: { x: number; z: number }; b: { x: number; z: number } } | null) {
    guideStrip.visible = !!segment;
    if (!segment) return;
    const dx = segment.b.x - segment.a.x, dz = segment.b.z - segment.a.z;
    guideStrip.position.set((segment.a.x + segment.b.x) / 2, .8, (segment.a.z + segment.b.z) / 2);
    guideStrip.rotation.y = Math.atan2(-dz, dx);
    guideStrip.scale.set(Math.hypot(dx, dz) + 8, 1, 3);
  }

  return {
    sync, frame, select, guide,
    /** Walls and openings, for picking with a ray. */
    pickables: () => hits,
    dispose: () => {
      clear();
      scene.remove(guideStrip, root);
      guideStrip.geometry.dispose();
      for (const m of [guideStrip.material as THREE.Material, texture, floorMaterial, lineMaterial, ...materials.values()]) m.dispose();
    },
  };
}

/** A wall's face outline from `start` to `end` along it, `height` tall: doors and archways are notches
 * from the floor, windows are holes. */
function faceOutline(start: number, end: number, height: number, openings: readonly StudioOpening[]) {
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
