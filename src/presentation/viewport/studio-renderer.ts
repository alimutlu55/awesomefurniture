import * as THREE from 'three';
import { cornerDegree, studioBounds, wallExtent, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioOpening, StudioWall } from '../../domain/studio/studio';
import { contactShade, roomOutline, planks } from './studio-surfaces';

/** Colours of the room (sRGB). Plain, light finishes so the wardrobe stays the subject. */
const LOOK = Object.freeze({
  wall: '#ece6dc', cut: '#857a6b', skirting: '#f6f3ee', frame: '#eee9e1', door: '#f3efe7', handle: '#9d978e', glass: '#bcd5df',
  ceiling: '#f4f1ec', select: '#2f2a22',
});
/** Height of a wall lowered because it stands between the camera and the room: low enough to see over,
 * tall enough to still read as the room's outline. A camera near eye level would see a stub as a band
 * across the floor, so there it lowers to a line on the floor. */
const STUB = 14;
/** Stub height for how steeply the camera looks down: a line on the floor near eye level, the full stub from above. */
const stubFor = (downward: number) => Math.max(1, Math.min(STUB, STUB * (downward - .1) / .3));
const SKIRTING = { height: 8, depth: 1.5 }, CASING = { width: 7, depth: 2 }, LEAF = 4;
const linear = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();

/** Where a wardrobe stands: its centre, turn (degrees) and size. Centimetres. */
export interface Footprint { x: number; z: number; angle: number; w: number; d: number }

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
    // Matte plaster and paint: they take the light but barely reflect the environment.
    if (!m) { m = new THREE.MeshStandardMaterial({ color: linear(color), roughness: .92, metalness: 0, envMapIntensity: .35, ...options }); materials.set(id, m); }
    return m;
  };
  // Oiled oak boards: a soft reflection of the room, not a mirror.
  const floorMaterial = new THREE.MeshStandardMaterial({ map: texture, color: linear('#efe6da'), roughness: .5, envMapIntensity: .45, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const shade = contactShade();
  const shadeMaterial = new THREE.MeshBasicMaterial({ map: shade, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  /** A shading quad: dark along its first edge (a0 to a1), fading out towards the opposite edge. */
  const shadeQuad = (a0: number[], a1: number[], b1: number[], b0: number[]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a0, ...a1, ...b1, ...b0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new THREE.Mesh(geometry, shadeMaterial);
    mesh.renderOrder = 1;
    return mesh;
  };
  // A downlight: a white trim ring around a warm, glowing lens, facing down.
  const downlight = {
    trim: new THREE.RingGeometry(4.2, 6, 24).rotateX(Math.PI / 2), lamp: new THREE.CircleGeometry(4.2, 24).rotateX(Math.PI / 2),
    trimMaterial: material('#fbfaf7', { side: THREE.DoubleSide }), lampMaterial: new THREE.MeshBasicMaterial({ color: linear('#fff3dc'), side: THREE.DoubleSide, toneMapped: false }),
  };
  const lineMaterial = new THREE.LineBasicMaterial({ color: linear(LOOK.select), toneMapped: false, transparent: true, opacity: .85, depthTest: false });

  function clear() {
    root.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose(); });
    root.clear();
    walls = []; hits = []; ceiling = null; selected = null;
  }

  let builds = 0;
  let standing: readonly Footprint[] = [];
  function sync(studio: Studio | undefined, footprints: readonly Footprint[] = []) {
    const next = studio ? JSON.stringify([studio, footprints]) : '';
    if (next === key) return;
    key = next;
    builds++;
    room = studio;
    standing = footprints;
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
    const k = 1 - Math.exp(-dt * 12), to = new THREE.Vector3(), stub = stubFor(-camera.getWorldDirection(new THREE.Vector3()).y);
    for (const view of walls) {
      to.copy(camera.position).sub(view.mid);
      const target = to.dot(view.normal) < -1 ? Math.min(1, stub / view.height) : 1;
      if (view.lift !== target) setLift(view, Math.abs(view.lift - target) < .003 ? target : view.lift + (target - view.lift) * k);
    }
    // The ceiling closes the room whenever you look from below it, as in a photograph of the room.
    if (ceiling) ceiling.visible = camera.position.y < ceiling.position.y - 5;
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
    // Walls take the sun's shadows and cast them: light falls through a window onto the floor.
    solid.receiveShadow = solid.castShadow = true;
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
    // Contact shading: on the floor along the wall's foot, up the foot of the wall, and into joined corners.
    const inside = wallFace(studio, w), fs = inside?.start ?? start, fe = inside?.end ?? end, z = face + .25;
    group.add(shadeQuad([fs, .2, face], [fe, .2, face], [fe, .2, face + 30], [fs, .2, face + 30]));
    body.add(shadeQuad([fs, 0, z], [fe, 0, z], [fe, 28, z], [fs, 28, z]));
    // Where the wall meets the ceiling: a faint shade, seen only while the wall stands.
    details.add(shadeQuad([fs, w.height, z], [fe, w.height, z], [fe, w.height - 22, z], [fs, w.height - 22, z]));
    if (cornerDegree(studio, w.a) > 1) body.add(shadeQuad([fs, 0, z], [fs, w.height, z], [fs + 28, w.height, z], [fs + 28, 0, z]));
    if (cornerDegree(studio, w.b) > 1) body.add(shadeQuad([fe, 0, z], [fe, w.height, z], [fe - 28, w.height, z], [fe - 28, 0, z]));
    const frameM = material(LOOK.frame);
    for (const o of openings) {
      const left = o.offset - o.width / 2, right = o.offset + o.width / 2, top = o.sill + o.height, tall = top - o.sill + (o.sill > 0 ? CASING.width : 0);
      // A wardrobe standing against the wall in front of it hides its room-side trim, which would poke through its back.
      const covered = standing.some(f => covers(f, line, left - CASING.width, right + CASING.width, face + 8));
      // Casings on both faces: sides and head; windows also have a bottom rail.
      for (const side of covered ? [-1] : [1, -1]) {
        const z = side * (face + CASING.depth / 2);
        box(CASING.width, tall, CASING.depth, left - CASING.width / 2, (o.sill + top) / 2, z, frameM, details, o.id);
        box(CASING.width, tall, CASING.depth, right + CASING.width / 2, (o.sill + top) / 2, z, frameM, details, o.id);
        box(o.width + 2 * CASING.width, CASING.width, CASING.depth, o.offset, top + CASING.width / 2, z, frameM, details, o.id);
        if (o.sill > 0) box(o.width + 2 * CASING.width, CASING.width, CASING.depth, o.offset, o.sill - CASING.width / 2, z, frameM, details, o.id);
      }
      if (o.kind === 'door') {
        box(o.width - 1, o.height - 1, LEAF, o.offset, o.height / 2, 0, material(LOOK.door), details, o.id);
        // Two raised panels on each face and a lever handle on a round rose.
        const handle = material(LOOK.handle, { metalness: .7, roughness: .3 }), pw = o.width - 26, upper = (o.height - 40) * .58, lower = o.height - 40 - upper;
        for (const side of [1, -1]) {
          const z = side * (LEAF / 2 + .3);
          if (pw > 10) for (const [ph, py] of [[lower, 12 + lower / 2], [upper, 28 + lower + upper / 2]] as const) box(pw, ph, .6, o.offset, py, z, material('#e6e0d5', { roughness: .8 }), details, o.id);
          box(4.4, 4.4, 1, right - 9, 100, side * (LEAF / 2 + .5), handle, details, o.id);
          box(13, 1.6, 1.6, right - 14, 100, side * (LEAF / 2 + 2), handle, details, o.id);
        }
      } else if (o.kind === 'window') {
        // Daylight: the glass glows like a bright sky, as a window does in a photograph of a room.
        box(o.width, o.height, 1, o.offset, o.sill + o.height / 2, 0, material(LOOK.glass, { opacity: .9, transparent: true, roughness: .05, depthWrite: false, emissive: linear('#f2f7f9'), emissiveIntensity: 1 }), details, o.id);
        // A sash frame around the glass, with a transom and a mullion.
        const sash = 5, cy = o.sill + o.height / 2;
        box(o.width, sash, 4, o.offset, o.sill + sash / 2, 0, frameM, details, o.id);
        box(o.width, sash, 4, o.offset, o.sill + o.height - sash / 2, 0, frameM, details, o.id);
        box(sash, o.height, 4, left + sash / 2, cy, 0, frameM, details, o.id);
        box(sash, o.height, 4, right - sash / 2, cy, 0, frameM, details, o.id);
        box(o.width, 3, 3, o.offset, cy, 0, frameM, details, o.id);
        if (o.width > 90) box(3, o.height, 3, o.offset, cy, 0, frameM, details, o.id);
        if (!covered) box(o.width + 16, 2.5, 6, o.offset, o.sill - 1.25, face + 3, material(LOOK.skirting), details, o.id);
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
    const mesh = new THREE.Mesh(geometry, material(LOOK.ceiling, { side: THREE.BackSide, emissive: linear(LOOK.ceiling), emissiveIntensity: .3 }));
    mesh.position.y = Math.min(...studio.walls.map(w => w.height));
    mesh.visible = false;
    // Recessed downlights on a grid about 1.3 m apart, kept clear of the walls.
    const xs = outline.map(p => p.x), zs = outline.map(p => p.z), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const across = Math.max(1, Math.round((x1 - x0 - 120) / 130) + 1), deep = Math.max(1, Math.round((z1 - z0 - 120) / 130) + 1);
    for (let i = 0; i < across; i++) for (let j = 0; j < deep; j++) {
      const x = across > 1 ? x0 + 60 + i * (x1 - x0 - 120) / (across - 1) : (x0 + x1) / 2, z = deep > 1 ? z0 + 60 + j * (z1 - z0 - 120) / (deep - 1) : (z0 + z1) / 2;
      if (!inside(x, z)) continue;
      const trim = new THREE.Mesh(downlight.trim, downlight.trimMaterial), lamp = new THREE.Mesh(downlight.lamp, downlight.lampMaterial);
      trim.position.set(x, -.15, z);
      lamp.position.set(x, -.3, z);
      mesh.add(trim, lamp);
    }
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
    /** Changes whenever the room's shadows would: a rebuild, or a wall lowering or rising. */
    shadowKey: () => builds + ':' + walls.map(v => v.lift.toFixed(3)).join(','),
    /** Walls and openings, for picking with a ray. */
    pickables: () => hits,
    dispose: () => {
      clear();
      scene.remove(guideStrip, root);
      guideStrip.geometry.dispose();
      for (const g of [downlight.trim, downlight.lamp]) g.dispose();
      for (const m of [downlight.lampMaterial, guideStrip.material as THREE.Material, texture, shade, shadeMaterial, floorMaterial, lineMaterial, ...materials.values()]) m.dispose();
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

/** Whether a wardrobe's footprint reaches within `reach` of the wall's centre line, on the room side, over
 * the stretch [from, to] along the wall. */
function covers(f: Footprint, line: NonNullable<ReturnType<typeof wallLine>>, from: number, to: number, reach: number) {
  const a = f.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), fx = Math.sin(a), fz = Math.cos(a);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
    const x = f.x + i! * f.w / 2 * ux + j! * f.d / 2 * fx - line.a.x, z = f.z + i! * f.w / 2 * uz + j! * f.d / 2 * fz - line.a.z;
    return { along: x * line.ux + z * line.uz, out: x * line.nx + z * line.nz };
  });
  const along = corners.map(c => c.along), out = corners.map(c => c.out);
  return Math.max(...along) > from && Math.min(...along) < to && Math.min(...out) < reach && Math.max(...out) > 0;
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
