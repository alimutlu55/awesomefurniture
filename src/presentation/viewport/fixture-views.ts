import * as THREE from 'three';
import type { Studio, StudioFixture } from '../../domain/studio/studio';
import { FIXTURES, finish } from '../../domain/studio/fixtures/fixture-kinds';
import type { FinishGroup, FixtureKey } from '../../domain/studio/fixtures/fixture-kinds';
import { boxingBehind, fixturePlace } from '../../domain/studio/fixtures/fixture-place';
import { oakMaps, VENEER_TILE } from './wood-textures';
import type { OakMaps } from './wood-textures';
import { basinParts } from './fixture-basin';
import { flushPlate, toiletParts } from './fixture-toilet';
import type { FixtureMaterials, Part } from './fixture-toilet';

/** Each kind's model, by its registry key: a new kind in fixture-kinds.ts does not compile until it has one. */
const MODELS: { readonly [K in FixtureKey]: (f: StudioFixture, m: FixtureMaterials) => Part[] } = { toilet: toiletParts, basin: basinParts };
export const modelOf = (kind: string) => (MODELS as Record<string, ((f: StudioFixture, m: FixtureMaterials) => Part[]) | undefined>)[kind];

const linear = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
/** Wood fronts show the oak veneer's grain at its true scale: UVs in tiles of the photographed veneer. */
function veneerUv(g: THREE.BufferGeometry) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined, normal = g.getAttribute('normal'), pos = g.getAttribute('position');
  if (!uv) return g;
  for (let i = 0; i < uv.count; i++) {
    const n = Math.abs(normal.getZ(i)) > .5 ? [pos.getX(i), pos.getY(i)] : Math.abs(normal.getX(i)) > .5 ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getZ(i)];
    uv.setXY(i, n[0]! / VENEER_TILE, n[1]! / VENEER_TILE);
  }
  return g;
}

/** Toilets, basins and the other fixtures of the room, drawn in the room's realistic style: glazed ceramic that takes
 * the room's reflections, polished or brushed metal, wood or lacquered fronts. The flush plate of a concealed cistern
 * goes on the face behind the toilet (a boxing or the wall), or on top of a low boxing. Centimetres, scene axes. */
export function createFixtureViews(root: THREE.Object3D, select: THREE.LineBasicMaterial) {
  const group = new THREE.Group();
  group.name = 'studio-fixtures';
  root.add(group);
  let hits: THREE.Object3D[] = [], selected: string | null = null, outline: THREE.LineSegments | null = null, room: Studio | undefined;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  let veneer: OakMaps | null = null;

  /** One shared material per finish, kept across rebuilds while a fixture is dragged. */
  function material(group: FinishGroup, id: string | undefined) {
    const f = finish(group, id), key = group + ':' + f.id;
    let m = materials.get(key);
    if (m) return m;
    const wood = group === 'front' && (f.id === 'oak' || f.id === 'walnut');
    if (wood) veneer ??= oakMaps(document, 'veneer');
    m = new THREE.MeshStandardMaterial({
      color: wood ? linear(f.id === 'oak' ? '#ffffff' : '#7a5a44') : linear(f.color), roughness: f.roughness, metalness: f.metalness,
      // Glazed ceramic and polished metal mirror the room; matt surfaces barely do.
      envMapIntensity: group === 'metal' ? 1.25 : f.roughness < .3 ? 1 : .55,
      ...(wood && veneer ? { map: veneer.map, roughnessMap: veneer.roughnessMap, normalMap: veneer.normalMap, normalScale: new THREE.Vector2(.4, .4) } : {}),
    });
    materials.set(key, m);
    return m;
  }

  function build(studio: Studio, f: StudioFixture) {
    const place = fixturePlace(studio, f), model = modelOf(f.kind);
    if (!place || !model) return;
    const m: FixtureMaterials = { ceramic: material('ceramic', f.ceramic), metal: material('metal', f.metal), front: material('front', f.front) };
    const holder = new THREE.Group();
    holder.rotation.y = place.line.angle * Math.PI / 180;
    const at = place.at(f.offset, place.back);
    holder.position.set(at.x, 0, at.z);
    holder.userData.fixture = f.id;
    for (const part of model(f, m)) {
      const geometry = part.material === m.front ? veneerUv(part.geometry) : part.geometry;
      const mesh = new THREE.Mesh(geometry, part.material);
      if (part.at) mesh.position.set(...part.at);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.studioFixture = f.id;
      holder.add(mesh);
      hits.push(mesh);
    }
    if (f.kind === 'toilet' && f.type !== 'close-coupled') holder.add(...plateFor(studio, f, place.back, m));
    group.add(holder);
  }
  /** The flush plate: on the boxing's top when the boxing is too low for it on its face, else on the face behind. */
  function plateFor(studio: Studio, f: StudioFixture, back: number, m: FixtureMaterials) {
    const box = boxingBehind(studio, f), top = box?.outline ? Math.max(...box.outline.map(p => p.y)) : null;
    const plate = flushPlate(m);
    if (top !== null && top < 100) { plate.rotation.x = -Math.PI / 2; plate.position.set(0, top + .5, -back / 2); }
    else plate.position.set(0, Math.min(102, (top ?? 200) - 12), .5);
    plate.traverse(o => { o.userData.studioFixture = f.id; if (o instanceof THREE.Mesh) { o.castShadow = true; hits.push(o); } });
    return [plate];
  }

  function clear() {
    group.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose(); });
    group.clear();
    hits = []; outline = null;
  }
  function sync(studio: Studio | undefined) {
    clear();
    room = studio;
    for (const f of studio?.fixtures ?? []) build(studio!, f);
    drawSelection();
  }

  /** The selected fixture's solid outlined, as a selected wall or opening is. */
  function drawSelection() {
    if (outline) { outline.parent?.remove(outline); outline.geometry.dispose(); outline = null; }
    const f = selected && room?.fixtures?.find(x => x.id === selected), place = f && room && fixturePlace(room, f);
    if (!f || !place) return;
    const holder = group.children.find(c => c.userData.fixture === f.id);
    if (!holder) return;
    const pad = .6, { bottom, top } = place.extent;
    const box = new THREE.BoxGeometry(f.width + 2 * pad, top - bottom + 2 * pad, f.depth + pad).translate(0, (bottom + top) / 2, (f.depth + pad) / 2);
    outline = new THREE.LineSegments(new THREE.EdgesGeometry(box), select);
    box.dispose();
    outline.renderOrder = 12;
    holder.add(outline);
  }

  return {
    sync,
    select(id: string | null) { if (id !== selected) { selected = id; drawSelection(); } },
    pickables: () => hits,
    /** Which kinds have a model, for the registry tests. */
    kinds: () => FIXTURES.filter(k => modelOf(k.key)).map(k => k.key),
    dispose() {
      clear();
      for (const m of materials.values()) m.dispose();
      if (veneer) { veneer.map.dispose(); veneer.roughnessMap.dispose(); veneer.normalMap.dispose(); }
      root.remove(group);
    },
  };
}
