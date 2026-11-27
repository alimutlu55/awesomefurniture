import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import { FURNISHINGS, furnishingFinish } from '../../domain/studio/furnishings/furnishing-kinds';
import type { FurnishingKey } from '../../domain/studio/furnishings/furnishing-kinds';
import { fabricTexture } from './fabric';
import { turnRing } from './turn-ring';
import { oakMaps, VENEER_TILE } from './wood-textures';
import type { OakMaps } from './wood-textures';

/** What a furnishing is made of: its upholstery, its wood, white bed linen and a little dark metal. */
export interface FurnishingMaterials { readonly fabric: THREE.Material; readonly wood: THREE.Material; readonly linen: THREE.Material; readonly metal: THREE.Material }
/** A part: its size, its material, where its middle is in the furnishing's frame (x across its middle, y up from the
 * floor, z from its middle towards its front), and how round its edges are. Centimetres. */
type Part = { readonly size: readonly [number, number, number]; readonly at: readonly [number, number, number]; readonly material: THREE.Material; readonly round?: number };
const part = (size: Part['size'], at: Part['at'], material: THREE.Material, round = .4): Part => ({ size, at, material, round });
/** Four legs under a footprint `w` × `d`, `h` tall, `t` thick, set in by `inset`. */
const legs = (w: number, d: number, h: number, t: number, inset: number, material: THREE.Material, z = 0) =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => part([t, h, t], [i! * (w / 2 - inset - t / 2), h / 2, z + j! * (d / 2 - inset - t / 2)], material, .2));

function bed(f: StudioFurnishing, m: FurnishingMaterials): Part[] {
  const { width: w, depth: d, height: h } = f, frameTop = 30, mattress = 22, top = frameTop + mattress, back = -d / 2;
  const bodyD = d - 8, bodyZ = back + 8 + bodyD / 2, pillowW = w > 110 ? (w - 22) / 2 : w - 24;
  const pillows = w > 110 ? [-1, 1].map(s => part([pillowW, 11, 42], [s * (pillowW / 2 + 3), top + 5, back + 32], m.linen, 4)) : [part([pillowW, 11, 42], [0, top + 5, back + 32], m.linen, 4)];
  const duvet = d * .62, duvetZ = d / 2 - duvet / 2 + 1;
  return [
    part([w, h - 4, 8], [0, 4 + (h - 4) / 2, back + 4], m.fabric, 3),
    part([w, frameTop - 8, bodyD], [0, 8 + (frameTop - 8) / 2, bodyZ], m.wood, .8),
    ...legs(w, bodyD, 8, 5, 3, m.wood, bodyZ),
    part([w - 6, mattress, bodyD - 6], [0, frameTop + mattress / 2, bodyZ], m.linen, 4),
    ...pillows,
    // The duvet over the lower part of the bed, falling over its foot and its sides.
    part([w - 1, 5, duvet], [0, top + 2, duvetZ], m.fabric, 2.2),
    part([w - 1, mattress + 2, 3], [0, frameTop + mattress / 2 - 1, d / 2 - .5], m.fabric, 1.4),
    ...[-1, 1].map(s => part([3, mattress + 2, duvet], [s * (w / 2 - 1.5), frameTop + mattress / 2 - 1, duvetZ], m.fabric, 1.4)),
  ];
}
function bedside(f: StudioFurnishing, m: FurnishingMaterials): Part[] {
  const { width: w, depth: d, height: h } = f, foot = 8;
  return [
    part([w, h - foot, d], [0, foot + (h - foot) / 2, 0], m.wood, .6), ...legs(w, d, foot, 3, 2, m.wood),
    part([w - 4, .4, .4], [0, h - 15, d / 2 + .1], m.metal, .1), part([8, 1.2, 1.2], [0, h - 9, d / 2 + .6], m.metal, .4),
  ];
}
function desk(f: StudioFurnishing, m: FurnishingMaterials): Part[] {
  const { width: w, depth: d, height: h } = f, seat = 46, chairZ = d / 2 - 12;
  return [
    part([w, 3, d], [0, h - 1.5, 0], m.wood, .5), ...legs(w, d, h - 3, 4, 2, m.wood),
    // The chair tucked under the desk, its back at the desk's front edge.
    part([44, 6, 42], [0, seat - 3, chairZ], m.fabric, 2.5), ...legs(40, 38, seat - 6, 2.5, 1, m.metal, chairZ),
    part([42, 34, 5], [0, seat + 17, chairZ + 22], m.fabric, 2.5),
  ];
}
function armchair(f: StudioFurnishing, m: FurnishingMaterials): Part[] {
  const { width: w, depth: d, height: h } = f, base = 16, arm = 13, armTop = Math.min(h - 8, 62);
  return [
    ...legs(w, d, base, 4, 3, m.wood),
    part([w, h - base, 18], [0, base + (h - base) / 2, -d / 2 + 9], m.fabric, 5),
    ...[-1, 1].map(s => part([arm, armTop - base, d], [s * (w / 2 - arm / 2), base + (armTop - base) / 2, 0], m.fabric, 5)),
    part([w - 2 * arm, 22, d - 18], [0, base + 11, 9], m.fabric, 5),
  ];
}
function rug(f: StudioFurnishing, m: FurnishingMaterials): Part[] {
  const { width: w, depth: d, height: h } = f;
  return [part([w, h, d], [0, h / 2, 0], m.fabric, Math.min(.4, h / 2 - .01)), part([w - 16, .15, d - 16], [0, h + .05, 0], m.linen, .05)];
}

/** Each kind's model, by its registry key: a new kind in furnishing-kinds.ts does not compile until it has one. */
const MODELS: { readonly [K in FurnishingKey]: (f: StudioFurnishing, m: FurnishingMaterials) => Part[] } = { bed, bedside, desk, armchair, rug };
export const furnishingModelOf = (kind: string) => (MODELS as Record<string, ((f: StudioFurnishing, m: FurnishingMaterials) => Part[]) | undefined>)[kind];

const linear = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
/** Wood shows the oak veneer's grain at its true scale: UVs in tiles of the photographed veneer. */
function veneerUv(g: THREE.BufferGeometry) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined, normal = g.getAttribute('normal'), pos = g.getAttribute('position');
  if (!uv) return g;
  for (let i = 0; i < uv.count; i++) {
    const n = Math.abs(normal.getZ(i)) > .5 ? [pos.getX(i), pos.getY(i)] : Math.abs(normal.getX(i)) > .5 ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getZ(i)];
    uv.setXY(i, n[0]! / VENEER_TILE, n[1]! / VENEER_TILE);
  }
  return g;
}

/** Beds, rugs and the room's other loose furniture, drawn in the room's realistic style: woven upholstery, oiled wood,
 * white linen. Each stands at its own place and turn. Centimetres, scene axes. */
export function createFurnishingViews(root: THREE.Object3D, select: THREE.LineBasicMaterial) {
  const group = new THREE.Group();
  group.name = 'studio-furnishings';
  root.add(group);
  let hits: THREE.Object3D[] = [], selected: string | null = null, outline: THREE.LineSegments | null = null, room: Studio | undefined;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  let veneer: OakMaps | null = null, cloth: THREE.Texture | null = null;

  /** One shared material per finish, kept across rebuilds while a furnishing is dragged. */
  function material(key: string, make: () => THREE.MeshStandardMaterial) {
    let m = materials.get(key);
    if (!m) { m = make(); materials.set(key, m); }
    return m;
  }
  const fabric = (id: string | undefined) => {
    const f = furnishingFinish('fabric', id);
    return material('fabric:' + f.id, () => {
      cloth ??= fabricTexture(document);
      return new THREE.MeshStandardMaterial({ color: linear(f.color), roughness: f.roughness, metalness: 0, map: cloth, envMapIntensity: .35 });
    });
  };
  const wood = (id: string | undefined) => {
    const f = furnishingFinish('wood', id), grain = f.id === 'oak' || f.id === 'walnut';
    return material('wood:' + f.id, () => {
      if (grain) veneer ??= oakMaps(document, 'veneer');
      return new THREE.MeshStandardMaterial({ color: grain ? linear(f.id === 'oak' ? '#ffffff' : '#7a5a44') : linear(f.color), roughness: f.roughness, metalness: 0, envMapIntensity: .5,
        ...(grain && veneer ? { map: veneer.map, roughnessMap: veneer.roughnessMap, normalMap: veneer.normalMap, normalScale: new THREE.Vector2(.4, .4) } : {}) });
    });
  };
  const linen = () => material('linen', () => { cloth ??= fabricTexture(document); return new THREE.MeshStandardMaterial({ color: linear('#f6f3ec'), roughness: .95, map: cloth, envMapIntensity: .3 }); });
  const metal = () => material('metal', () => new THREE.MeshStandardMaterial({ color: linear('#3a3a38'), roughness: .4, metalness: .8 }));

  function build(f: StudioFurnishing) {
    const model = furnishingModelOf(f.kind);
    if (!model) return;
    const m: FurnishingMaterials = { fabric: fabric(f.fabric), wood: wood(f.wood), linen: linen(), metal: metal() };
    const holder = new THREE.Group();
    holder.rotation.y = f.angle * Math.PI / 180;
    holder.position.set(f.x, 0, f.z);
    holder.userData.furnishing = f.id;
    for (const p of model(f, m)) {
      const [w, h, d] = p.size, r = Math.max(.02, Math.min(p.round ?? .4, w / 2 - .01, h / 2 - .01, d / 2 - .01));
      const geometry = new RoundedBoxGeometry(w, h, d, 2, r);
      const mesh = new THREE.Mesh(p.material === m.wood ? veneerUv(geometry) : geometry, p.material);
      mesh.position.set(...p.at);
      mesh.castShadow = h > 1;
      mesh.receiveShadow = true;
      mesh.userData.studioFurnishing = f.id;
      holder.add(mesh);
      hits.push(mesh);
    }
    group.add(holder);
  }

  function clear() {
    group.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose();
      if (o.userData.turnRing) ((o as THREE.Line).material as THREE.Material).dispose();
    });
    group.clear();
    hits = []; outline = null;
  }
  function sync(studio: Studio | undefined) {
    clear();
    room = studio;
    // Rugs first: everything else stands on them.
    const list = [...studio?.furnishings ?? []].sort((a, b) => Number(b.kind === 'rug') - Number(a.kind === 'rug'));
    for (const f of list) build(f);
    drawSelection();
  }

  /** The selected furnishing's box outlined, as a selected fixture is. */
  function drawSelection() {
    if (outline) {
      outline.parent?.remove(outline); outline.geometry.dispose();
      for (const c of outline.children) if (c instanceof THREE.Line) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
      outline = null;
    }
    const f = selected ? room?.furnishings?.find(x => x.id === selected) : undefined;
    const holder = f && group.children.find(c => c.userData.furnishing === f.id);
    if (!f || !holder) return;
    const pad = .8, h = Math.max(f.height, 2);
    const box = new THREE.BoxGeometry(f.width + 2 * pad, h + pad, f.depth + 2 * pad).translate(0, (h + pad) / 2, 0);
    outline = new THREE.LineSegments(new THREE.EdgesGeometry(box), select);
    box.dispose();
    outline.renderOrder = 12;
    holder.add(outline);
    // The turn ring every turnable piece shows while it is selected (turn-ring.ts), as a wardrobe's.
    const { ring } = turnRing(f.width, f.depth);
    ring.userData.turnRing = true;
    outline.add(ring);
  }

  return {
    sync,
    select(id: string | null) { if (id !== selected) { selected = id; drawSelection(); } },
    pickables: () => hits,
    /** Which kinds have a model, for the registry tests. */
    kinds: () => FURNISHINGS.filter(k => furnishingModelOf(k.key)).map(k => k.key),
    dispose() {
      clear();
      for (const m of materials.values()) m.dispose();
      cloth?.dispose();
      if (veneer) { veneer.map.dispose(); veneer.roughnessMap.dispose(); veneer.normalMap.dispose(); }
      root.remove(group);
    },
  };
}
