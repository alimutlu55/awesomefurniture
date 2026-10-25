import * as THREE from 'three';

/** How the scene is drawn: as photographed (living), as an architect's white card model (maquette), or as a
 * blueprint of lines (workshop). */
export type SceneLook = 'living' | 'maquette' | 'workshop';

/** What a look does to one surface. `tone` is the original colour's lightness (0 to 1); `board` is wood board. */
export interface SurfaceLook { readonly colour: number; readonly emissive: number; readonly lit: boolean; readonly edges: boolean }

const PAPER = 0xf1ece2, BALSA = 0xeadcc2, BLUEPRINT = 0x14365e, BLUEPRINT_BOARD = 0x1d4a7c;
/** The colour and light a look gives a surface. Living keeps the surface as it is (null). Pure. */
export function surfaceLook(look: SceneLook, surface: { tone: number; board: boolean }): SurfaceLook | null {
  if (look === 'living') return null;
  if (look === 'maquette') {
    // Card and balsa: every surface white, a whisper of its own lightness kept so things still read apart.
    const base = new THREE.Color(surface.board ? BALSA : PAPER), shade = .84 + .16 * Math.min(1, surface.tone * 1.6);
    return { colour: base.multiplyScalar(shade).getHex(), emissive: 0, lit: true, edges: true };
  }
  return { colour: 0, emissive: surface.board ? BLUEPRINT_BOARD : BLUEPRINT, lit: false, edges: true };
}

interface Original {
  color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number; envMapIntensity: number; roughness: number; metalness: number;
  map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap: THREE.Texture | null; bumpMap: THREE.Texture | null; toneMapped: boolean;
  /** A surface's own shader changes (catalogue boards keep their swatch tone): set aside while a look draws it. */
  shader: THREE.Material['onBeforeCompile']; cacheKey: THREE.Material['customProgramCacheKey'];
}
/** What this director last wrote to a surface; anything else found there later was changed by its owner. */
interface Written {
  color: number; emissive: number; roughness: number; metalness: number; toneMapped: boolean;
  map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap: THREE.Texture | null; bumpMap: THREE.Texture | null;
  shader: THREE.Material['onBeforeCompile']; cacheKey: THREE.Material['customProgramCacheKey'];
}
const MAPS = ['map', 'normalMap', 'roughnessMap', 'bumpMap'] as const;
const written = (m: THREE.MeshStandardMaterial): Written => ({
  color: m.color.getHex(), emissive: m.emissive.getHex(), roughness: m.roughness, metalness: m.metalness, toneMapped: m.toneMapped,
  map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, bumpMap: m.bumpMap, shader: m.onBeforeCompile, cacheKey: m.customProgramCacheKey,
});
const PLAIN_SHADER: THREE.Material['onBeforeCompile'] = () => {};
const plainKey = () => 'scene-look-plain';
type Standard = THREE.MeshStandardMaterial;
const EDGE_LIMIT = 900;
const isStandard = (m: unknown): m is Standard => !!(m as Standard)?.isMeshStandardMaterial;

/**
 * Directs every lit surface of the scene for a look and a time of day, changing materials in place and putting
 * each back exactly as it was. New surfaces (a rebuilt wardrobe) are picked up as they appear. Board and box
 * edges are drawn as lines in the maquette and the blueprint. Materials are shared, so this never clones one.
 */
export function createSceneLooks({ scene, skip = () => false, shading = () => false, version = () => NaN }: {
  scene: THREE.Scene; skip?: (o: THREE.Object3D) => boolean;
  /** Changes whenever surfaces may have been added (a rebuild): the scene is walked only then. */
  version?: () => number;
  /** Painted shading (contact shadows in corners): photographic, so it steps aside in the drawn looks. */
  shading?: (m: THREE.Material) => boolean;
}) {
  const originals = new Map<Standard, Original>(), edges = new Map<THREE.Mesh, THREE.LineSegments>(), shaded = new Set<THREE.Material>();
  const lines = { maquette: new THREE.LineBasicMaterial({ color: 0x4f4a41, transparent: true, opacity: .42 }),
    workshop: new THREE.LineBasicMaterial({ color: 0xd9ecff, transparent: true, opacity: .92, toneMapped: false }) };
  let look: SceneLook = 'living', light = { env: 1, emissive: 1 }, stamp = 1, frames = 0, seenVersion = NaN, idle = 0;

  function remember(m: Standard): Original {
    let o = originals.get(m);
    if (!o) {
      o = { color: m.color.clone(), emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity, envMapIntensity: m.envMapIntensity,
        roughness: m.roughness, metalness: m.metalness, map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, bumpMap: m.bumpMap, toneMapped: m.toneMapped,
        shader: m.onBeforeCompile, cacheKey: m.customProgramCacheKey };
      originals.set(m, o);
    }
    return o;
  }
  /** A surface's owner changed it since this director last wrote it (a decor scan arrived and became its map):
   * that is now the surface's own value, kept when the surface is put back. Without this, a texture that loads
   * after a surface was first directed would be taken off it again at the next change of look or light. */
  function adopt(m: Standard, o: Original) {
    const w = m.userData.lookWritten as Written | undefined;
    if (!w) return false;
    let changed = false;
    if (m.color.getHex() !== w.color) { o.color.copy(m.color); changed = true; }
    if (m.emissive.getHex() !== w.emissive) { o.emissive.copy(m.emissive); changed = true; }
    for (const key of MAPS) if (m[key] !== w[key]) { o[key] = m[key]; changed = true; }
    if (m.roughness !== w.roughness) { o.roughness = m.roughness; changed = true; }
    if (m.metalness !== w.metalness) { o.metalness = m.metalness; changed = true; }
    if (m.toneMapped !== w.toneMapped) { o.toneMapped = m.toneMapped; changed = true; }
    if (m.onBeforeCompile !== w.shader) { o.shader = m.onBeforeCompile; changed = true; }
    if (m.customProgramCacheKey !== w.cacheKey) { o.cacheKey = m.customProgramCacheKey; changed = true; }
    return changed;
  }
  function restore(m: Standard, o: Original) {
    adopt(m, o);
    const changedMaps = m.map !== o.map || m.normalMap !== o.normalMap || m.roughnessMap !== o.roughnessMap || m.bumpMap !== o.bumpMap
      || m.toneMapped !== o.toneMapped || m.onBeforeCompile !== o.shader;
    m.color.copy(o.color); m.emissive.copy(o.emissive); m.emissiveIntensity = o.emissiveIntensity * light.emissive; m.envMapIntensity = o.envMapIntensity * light.env;
    m.roughness = o.roughness; m.metalness = o.metalness; m.map = o.map; m.normalMap = o.normalMap; m.roughnessMap = o.roughnessMap; m.bumpMap = o.bumpMap; m.toneMapped = o.toneMapped;
    m.onBeforeCompile = o.shader; m.customProgramCacheKey = o.cacheKey;
    if (changedMaps) m.needsUpdate = true;
    m.userData.lookWritten = written(m);
  }
  function direct(m: Standard) {
    const known = originals.get(m);
    if (m.userData.lookStamp === stamp && (!known || !adopt(m, known))) return;
    m.userData.lookStamp = stamp;
    const o = remember(m);
    adopt(m, o);
    const surface = surfaceLook(look, { tone: (o.color.r + o.color.g + o.color.b) / 3, board: !!m.userData.board });
    if (!surface) { restore(m, o); return; }
    const linear = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
    m.color.copy(surface.lit ? linear(surface.colour) : new THREE.Color(0));
    m.emissive.copy(linear(surface.emissive)); m.emissiveIntensity = surface.lit ? 0 : 1;
    m.envMapIntensity = surface.lit ? .85 * light.env : 0;
    m.roughness = .96; m.metalness = 0;
    if (m.map || m.normalMap || m.roughnessMap || m.bumpMap || m.toneMapped !== surface.lit || m.onBeforeCompile !== PLAIN_SHADER) {
      m.map = m.normalMap = m.roughnessMap = m.bumpMap = null;
      m.toneMapped = surface.lit;
      m.onBeforeCompile = PLAIN_SHADER; m.customProgramCacheKey = plainKey;
      m.needsUpdate = true;
    }
    m.userData.lookWritten = written(m);
  }
  function outline(mesh: THREE.Mesh) {
    if (edges.has(mesh)) { edges.get(mesh)!.material = look === 'workshop' ? lines.workshop : lines.maquette; return; }
    const geometry = mesh.geometry as THREE.BufferGeometry, count = geometry?.attributes?.position?.count ?? 0;
    if (!count || count > EDGE_LIMIT) return;
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), look === 'workshop' ? lines.workshop : lines.maquette);
    line.raycast = () => {};
    line.userData.lookEdge = true;
    mesh.add(line);
    edges.set(mesh, line);
  }
  function dropEdges(all: boolean) {
    for (const [mesh, line] of edges) {
      if (!all && attached(mesh)) continue;
      line.parent?.remove(line); line.geometry.dispose(); edges.delete(mesh);
    }
  }
  const attached = (o: THREE.Object3D) => { let p: THREE.Object3D | null = o; while (p && p !== scene) p = p.parent; return p === scene; };

  /** Directs surfaces that are new since the last frame (a rebuilt wardrobe), before they are drawn. Costs nothing
   * while the scene is drawn as it is; otherwise one walk over the scene. */
  function frame(force = false) {
    const plain = look === 'living' && light.env === 1 && light.emissive === 1;
    if (plain && !force) return;
    // Nothing rebuilt since the last walk: the surfaces are directed already (a slow check runs regardless).
    const now = version();
    if (!force && now === seenVersion && ++idle % 30) return;
    seenVersion = now;
    const prune = !(++frames % 8), seen = prune ? new Set<Standard>() : null;
    scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || o.userData.lookEdge || skip(o)) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      let lit = false;
      for (const m of materials) {
        if (isStandard(m)) { direct(m); seen?.add(m); lit = true; }
        else if (look !== 'living' && m.visible && shading(m)) { m.visible = false; shaded.add(m); }
      }
      if (lit && look !== 'living' && mesh.visible && !(materials[0] as THREE.Material).transparent) outline(mesh);
    });
    if (look === 'living') { dropEdges(true); showShading(); }
    if (seen) {
      dropEdges(false);
      // Surfaces gone from the scene (a wardrobe rebuilt) are forgotten, so their materials can be freed.
      // A material put back first: should its surface come back into the scene, it is directed afresh.
      for (const [m, o] of originals) if (!seen.has(m)) { restoreFully(m, o); originals.delete(m); }
    }
    // Everything is as it was: nothing more to remember.
    if (plain) originals.clear();
  }
  /** Changes the look; the time of day's environment light (`env`) and glow (`emissive`) scale every surface. */
  function set(next: { look?: SceneLook; env?: number; emissive?: number }) {
    look = next.look ?? look;
    light = { env: next.env ?? light.env, emissive: next.emissive ?? light.emissive };
    stamp++;
    if (look !== 'living') for (const line of edges.values()) line.material = look === 'workshop' ? lines.workshop : lines.maquette;
    frame(true);
  }
  function showShading() {
    for (const m of shaded) m.visible = true;
    shaded.clear();
  }
  function restoreFully(m: Standard, o: Original) {
    restore(m, o);
    m.emissiveIntensity = o.emissiveIntensity; m.envMapIntensity = o.envMapIntensity; m.userData.lookStamp = 0;
  }
  /** Puts every surface back as it was, for a moment (a capture), then `resume` directs them again. */
  function suspend() {
    for (const [m, o] of originals) restoreFully(m, o);
    for (const line of edges.values()) line.visible = false;
    showShading();
  }
  function resume() {
    for (const line of edges.values()) line.visible = true;
    stamp++;
    frame(true);
  }
  function dispose() {
    look = 'living'; light = { env: 1, emissive: 1 };
    suspend();
    dropEdges(true);
    originals.clear();
    lines.maquette.dispose(); lines.workshop.dispose();
  }
  return { set, frame, suspend, resume, dispose, look: () => look };
}
