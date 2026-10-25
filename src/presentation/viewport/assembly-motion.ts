import * as THREE from 'three';

/** Where a part sits in its wardrobe, as shares of the carcass: x and z from -1 (left, back) to 1 (right, front),
 * y from 0 (floor) to 1 (top); and its size as shares of the carcass's width, height and depth. */
export interface PartPlace { readonly x: number; readonly y: number; readonly z: number; readonly w: number; readonly h: number; readonly d: number }

/** The order parts go in, as a cabinetmaker builds: base, sides, back, top, then what goes inside, doors last. */
export type AssemblyPhase = 'base' | 'side' | 'back' | 'top' | 'fitting' | 'door';

/** Which step of the build a part belongs to, from where it sits and how big it is. Pure. */
export function assemblyPhase(p: PartPlace, door = false): AssemblyPhase {
  if (door) return 'door';
  if (p.h > .55 && Math.abs(p.x) > .85 && p.w < .2) return 'side';
  if (p.h > .55 && p.z < -.8 && p.d < .2) return 'back';
  if (p.y < .12 && p.w > .6) return 'base';
  if (p.y > .9 && p.w > .6 && p.h < .2) return 'top';
  return 'fitting';
}

/** Where a part comes from before it lands, in centimetres from where it rests, wardrobe-local. Sides swing in
 * from their side, the back from behind, the top drops from above; shelves, rails and drawers slide in from the
 * front, as they are fitted; doors come last, from the front. Pure. */
export function assemblyApproach(phase: AssemblyPhase, p: PartPlace): [number, number, number] {
  switch (phase) {
    case 'side': return [Math.sign(p.x || 1) * 95, 30, 20];
    case 'back': return [0, 20, -110];
    case 'top': return [0, 120, 0];
    case 'base': return [0, -6, 70];
    case 'door': return [0, 6, 90];
    default: return [0, 14 + p.y * 10, 85 + p.y * 25];
  }
}

/** How far a part moves out when the wardrobe is taken apart (amount 0 to 1), like an exploded drawing: sides
 * apart, higher parts higher, front parts forward. The base and back stay where they are, so nothing goes into
 * the floor or the wall the wardrobe stands against. Pure. */
export function explodedOffset(p: PartPlace, amount: number, size: { w: number; h: number; d: number }): [number, number, number] {
  const spread = Math.max(size.w, size.h) * .3 * amount;
  return [p.x * spread * .85, Math.max(0, p.y) * spread * .7, Math.max(0, p.z + 1) * spread * .6];
}

const PHASES: readonly AssemblyPhase[] = ['base', 'side', 'back', 'top', 'fitting', 'door'];
interface Part { object: THREE.Object3D; rest: THREE.Vector3; place: PartPlace; phase: AssemblyPhase; size: { w: number; h: number; d: number } }
interface Flight { part: Part; from: THREE.Vector3; start: number; duration: number; landed: boolean }

const easeOutBack = (t: number) => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const box = new THREE.Box3(), centre = new THREE.Vector3(), extent = new THREE.Vector3();

/** Parts of one wardrobe group that move: every visible top-level child but its pick targets, floor shadow and
 * painted overlays. Where each sits is measured against the carcass boards, so a wide overlay (a contact shadow)
 * never stretches the wardrobe the parts are measured in. */
function partsOf(group: THREE.Object3D, isDoor: (o: THREE.Object3D) => boolean): Part[] {
  const keepPosition = group.position.clone(), keepRotation = group.rotation.y;
  group.position.set(0, 0, 0); group.rotation.y = 0; group.updateMatrixWorld(true);
  const candidates = group.children.filter(o => o.visible && !o.userData.floorShadow && !isPickTarget(o) && !isOverlay(o));
  const boxes = candidates.map(o => box.setFromObject(o).clone()), boards = new THREE.Box3(), all = new THREE.Box3();
  boxes.forEach((b, k) => { if (b.isEmpty()) return; all.union(b); if (isBoard(candidates[k]!)) boards.union(b); });
  group.position.copy(keepPosition); group.rotation.y = keepRotation; group.updateMatrixWorld(true);
  const frame = boards.isEmpty() ? all : boards;
  if (frame.isEmpty()) return [];
  frame.getSize(extent);
  const size = { w: Math.max(1, extent.x), h: Math.max(1, extent.y), d: Math.max(1, extent.z) }, floor = frame.min.y;
  const midX = (frame.min.x + frame.max.x) / 2, midZ = (frame.min.z + frame.max.z) / 2;
  return candidates.flatMap((object, k) => {
    const b = boxes[k]!;
    if (b.isEmpty()) return [];
    b.getCenter(centre);
    const s = b.getSize(new THREE.Vector3());
    const place = { x: (centre.x - midX) / (size.w / 2), y: (centre.y - floor) / size.h, z: (centre.z - midZ) / (size.d / 2), w: s.x / size.w, h: s.y / size.h, d: s.z / size.d };
    return [{ object, rest: object.position.clone(), place, phase: assemblyPhase(place, isDoor(object)), size }];
  });
}
const materialsOf = (o: THREE.Object3D) => { const m = (o as THREE.Mesh).material; return (Array.isArray(m) ? m : m ? [m] : []) as THREE.Material[]; };
/** A wood board of the carcass or a fitting. */
const isBoard = (o: THREE.Object3D) => materialsOf(o).some(m => m.userData.board);
/** Painted shading laid over the boards (contact shadows, highlights): it waits until the parts are in place. */
const isOverlay = (o: THREE.Object3D) => { const m = materialsOf(o); return m.length > 0 && m.every(x => x.transparent && !(x as THREE.MeshStandardMaterial).isMeshStandardMaterial); };
/** Invisible boxes that catch the pointer: they never move, so clicks keep landing where the parts rest. */
function isPickTarget(o: THREE.Object3D) {
  const m = (o as THREE.Mesh).material as THREE.Material | undefined;
  return !!m && !Array.isArray(m) && m.transparent && m.opacity === 0;
}

/**
 * Wardrobes building themselves: each part flies in along the way it is fitted and lands with a small settle, in
 * a cabinetmaker's order. The same parts can also be taken apart into an exploded view. Positions are restored
 * exactly when a flight ends or the view is put back together; a rebuild of the scene simply ends the show.
 */
export function createAssemblyMotion({ clock = performance, isDoor = () => false }: { clock?: Pick<Performance, 'now'>; isDoor?: (o: THREE.Object3D) => boolean } = {}) {
  let flights: Flight[] = [], landing: ((phase: AssemblyPhase) => void) | null = null, done: (() => void) | null = null;
  let exploded: Part[] = [], explodedBy = 0, veiled: THREE.Object3D[] = [];
  /** Hides the painted overlays of the groups while parts move, or shows them again. */
  function veil(groups: readonly THREE.Object3D[] | null) {
    for (const o of veiled) o.visible = true;
    veiled = groups ? groups.flatMap(g => g.children.filter(o => o.visible && isOverlay(o))) : [];
    for (const o of veiled) o.visible = false;
  }

  /** Builds the groups' parts in (only those of the given steps, when named), over about `seconds`. Resolves when
   * the last part has landed. */
  function play(groups: readonly THREE.Object3D[], { seconds = 2.8, onLand, phases }: {
    seconds?: number; onLand?: (phase: AssemblyPhase) => void; phases?: readonly AssemblyPhase[];
  } = {}) {
    finish();
    assemble();
    const parts = groups.flatMap(g => partsOf(g, isDoor).filter(p => !phases || phases.includes(p.phase)).map(p => ({ p, g })));
    const order = (x: Part) => PHASES.indexOf(x.phase) * 10 + x.place.y * 4 + Math.abs(x.place.x) * .2;
    parts.sort((a, b) => order(a.p) - order(b.p));
    const now = clock.now(), count = Math.max(1, parts.length), step = Math.min(110, (seconds * 1000 - 600) / count);
    let phaseStart = 0, last: AssemblyPhase | null = null;
    flights = parts.map(({ p }, k) => {
      // A short breath between steps, so each stage of the build reads.
      if (p.phase !== last) { phaseStart += last ? 140 : 0; last = p.phase; }
      // Parts are children of their wardrobe's group, so the approach is in the wardrobe's own frame.
      const from = new THREE.Vector3(...assemblyApproach(p.phase, p.place));
      const flight = { part: p, from, start: now + phaseStart + k * step, duration: p.phase === 'fitting' ? 520 : 640, landed: false };
      p.object.visible = false;
      return flight;
    });
    landing = onLand ?? null;
    veil(groups);
    return new Promise<void>(resolve => { done = resolve; if (!flights.length) finish(); });
  }
  /** Moves each part in flight; call once a frame. Returns whether anything moved (the shadows need redrawing). */
  function frame() {
    if (!flights.length) return false;
    const now = clock.now();
    for (const f of flights) {
      if (f.landed) continue;
      if (!f.part.object.parent) { f.landed = true; continue; }
      const t = (now - f.start) / f.duration;
      if (t < 0) continue;
      f.part.object.visible = true;
      if (t >= 1) {
        f.part.object.position.copy(f.part.rest);
        f.landed = true;
        landing?.(f.part.phase);
        continue;
      }
      const k = 1 - easeOutBack(t);
      f.part.object.position.copy(f.part.rest).addScaledVector(f.from, k);
    }
    if (flights.every(f => f.landed)) finish();
    return true;
  }
  /** Ends any flight at once, every part where it rests. */
  function finish() {
    for (const f of flights) { if (f.part.object.parent) { f.part.object.position.copy(f.part.rest); f.part.object.visible = true; } }
    flights = [];
    landing = null;
    if (!explodedBy) veil(null);
    const resolve = done;
    done = null;
    resolve?.();
  }
  /** Takes the groups apart by `amount` (0 to 1), or puts them back together at 0. */
  function explode(groups: readonly THREE.Object3D[], amount: number) {
    if (flights.length) finish();
    if (amount <= 0) { assemble(); veil(null); return; }
    // Rest positions are read with the parts together, then kept while the amount changes.
    if (!exploded.length || exploded.some(p => !p.object.parent) || !groups.every(g => exploded.some(p => p.object.parent === g))) {
      assemble();
      veil(null);
      exploded = groups.flatMap(g => partsOf(g, isDoor));
      veil(groups);
    }
    explodedBy = amount;
    for (const p of exploded) {
      const [x, y, z] = explodedOffset(p.place, amount, p.size);
      p.object.position.set(p.rest.x + x, p.rest.y + y, p.rest.z + z);
    }
  }
  function assemble() {
    for (const p of exploded) if (p.object.parent) p.object.position.copy(p.rest);
    exploded = [];
    explodedBy = 0;
  }
  return { play, frame, finish, explode, busy: () => flights.length > 0, explodedBy: () => explodedBy };
}
