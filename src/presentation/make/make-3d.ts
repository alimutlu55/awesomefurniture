import * as THREE from 'three';
import type { Board } from '../../domain/drawings/cabinet-boards';
import { getDecor } from '../../domain/materials/decor-catalog';
import { apartOffset, type Vec3 } from '../../domain/make/make-measures';
import type { MakePart, MakePiece } from '../../domain/make/make-parts';
import type { Motion } from '../../domain/make/make-hardware';
import { boardBox, boardSeed, boardUVs } from '../viewport/board-geometry';
import { createDecorMaterial } from '../viewport/cabinet-materials';
import type { createViewportResources } from '../viewport/viewport-resources.js';
import { createMakeFittings } from './make-fittings-3d';
import { createMakePlay, type MakeFilm } from './make-play-3d';

/** The camera layer Make draws on: while Make is open the camera sees only this layer, so the piece stands alone. */
export const MAKE_LAYER = 3;
export type MakeLook = 'lines' | 'material' | 'xray';
type Resources = Pick<ReturnType<typeof createViewportResources>, 'M' | 'decorTexture'>;

const OPEN_ANGLE = 100 * Math.PI / 180, FLY = 1.3, INK = 0x2b2a26, PAPER = 0xf3f0e9, SELECTED = 0xdfe7f5, XRAY = 0x3e6fc2, FADE = .14;
const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const isFront = (p: MakePart) => p.stock === 'door' || p.stock === 'front';

interface BoardMesh { part: MakePart; board: Board; index: number; face: THREE.Mesh; edges: THREE.LineSegments; rest: THREE.Vector3; apart: Vec3; motion: Motion | null; pivot: THREE.Vector3 | null }

/** A board's solid in the piece group's frame (centred across and through the piece, up from the floor). */
function boardGeometry(b: Board, size: MakePiece['size']) {
  if (b.outline) {
    const shape = new THREE.Shape(b.outline.map(p => new THREE.Vector2(p.x - size.w / 2, p.y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.z1 - b.z0, bevelEnabled: false });
    g.translate(0, 0, b.z0 - size.d / 2);
    return { geometry: g, centre: new THREE.Vector3() };
  }
  const g = boardBox(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
  return { geometry: g, centre: new THREE.Vector3((b.x0 + b.x1) / 2 - size.w / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2 - size.d / 2) };
}

/**
 * The piece built from its parts in the editor's own 3D scene, at the piece's own place, so the editor's camera,
 * gestures and light show it exactly as they show everything else. Every board is one mesh, so a tap is one part.
 * Looks: Lines (paper boards with ink edges), Material (the piece's own decors), X-ray (see-through, blue edges).
 */
export function createMake3d(resources: Resources, scene: THREE.Scene) {
  const group = new THREE.Group();
  group.userData.make = true;
  scene.add(group);
  const decorMaterials = new Map<string, THREE.Material>(), faded = new Map<THREE.Material, THREE.Material>();
  const lines = {
    // Paper boards take the editor's light for their form, without its warm floor bounce or reflections.
    face: new THREE.MeshLambertMaterial({ color: PAPER, emissive: 0x8d8a83, emissiveIntensity: .55 }),
    selected: new THREE.MeshLambertMaterial({ color: SELECTED, emissive: 0x7d8597, emissiveIntensity: .5 }),
    xray: new THREE.MeshBasicMaterial({ color: XRAY, transparent: true, opacity: .05, depthWrite: false }),
    hidden: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    edge: new THREE.LineBasicMaterial({ color: INK }),
    edgeSelected: new THREE.LineBasicMaterial({ color: XRAY }),
    edgeXray: new THREE.LineBasicMaterial({ color: XRAY, transparent: true, opacity: .8 }),
    edgeFaded: new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: FADE }),
    phantom: new THREE.LineDashedMaterial({ color: INK, dashSize: 4, gapSize: 2, transparent: true, opacity: .6 }),
  };
  let boards: BoardMesh[] = [], look: MakeLook = 'lines', selected: number | null = null, solidFronts = false, amount = 0, open = 0;
  // The film of the assembly at one moment, or null when it is not playing.
  let film: MakeFilm | null = null;
  const fittings = createMakeFittings(MAKE_LAYER), play = createMakePlay(MAKE_LAYER);

  const decor = (id: string) => {
    let m = decorMaterials.get(id);
    if (!m) {
      try { m = createDecorMaterial(resources, getDecor(id)); } catch { m = lines.face; }
      decorMaterials.set(id, m);
    }
    return m;
  };
  const fade = (m: THREE.Material) => {
    let f = faded.get(m);
    if (!f) { f = m.clone(); f.transparent = true; f.opacity = FADE; f.depthWrite = false; faded.set(m, f); }
    return f;
  };
  /** Gives every board the materials for the look, the part picked and whether fronts are solid. */
  function paint() {
    for (const b of boards) {
      // In the film fronts go on solid, as they are fitted; otherwise they are solid or dashed as chosen.
      const phantom = isFront(b.part) && !solidFronts && !film, mine = film ? film.now(b.index) : selected === b.part.n, dim = !film && selected !== null && !mine;
      b.face.visible = b.edges.visible = !film || film.arrive(b.index) !== null;
      let face: THREE.Material = look === 'material' ? decor(b.part.decorId) : look === 'xray' ? lines.xray : mine ? lines.selected : lines.face;
      if (phantom) face = lines.hidden;
      else if (dim) face = fade(face);
      b.face.material = face;
      b.face.renderOrder = phantom || dim || look === 'xray' ? 1 : 0;
      b.edges.material = phantom ? lines.phantom : dim ? lines.edgeFaded : mine ? lines.edgeSelected : look === 'xray' ? lines.edgeXray : lines.edge;
    }
  }
  /** Puts every board where it is at the current amounts apart and open: a door turns about its hinge edge (up to
   * 100°), a drawer slides out on its runners. */
  function place() {
    for (const b of boards) {
      // Coming in during the film: from further out than taken apart, easing into place.
      const a = film?.arrive(b.index) ?? 1, away = amount + FLY * (1 - easeInOut(a));
      const at = b.face.position.set(b.rest.x + b.apart[0] * away, b.rest.y + b.apart[1] * away, b.rest.z + b.apart[2] * away);
      let turn = 0;
      if (b.motion?.kind === 'slide') at.z += b.motion.by * open;
      else if (b.motion?.kind === 'swing' && b.pivot) {
        turn = -b.motion.dir * open * OPEN_ANGLE;
        const vx = b.rest.x - b.pivot.x, vz = b.rest.z - b.pivot.z, c = Math.cos(turn), s = Math.sin(turn);
        at.x += b.pivot.x + vx * c + vz * s - b.rest.x;
        at.z += b.pivot.z - vx * s + vz * c - b.rest.z;
      }
      b.face.rotation.y = turn;
      b.edges.position.copy(at);
      b.edges.rotation.y = turn;
    }
  }
  function clear() {
    fittings.clear(); play.clear();
    for (const b of boards) { b.face.geometry.dispose(); b.edges.geometry.dispose(); }
    group.clear();
    boards = [];
  }

  return {
    group,
    /** Builds the piece at its place in the room: `pose` is where the editor stands it. */
    show(piece: MakePiece, pose: { x: number; y: number; z: number; angle: number }) {
      clear();
      selected = null; amount = 0; open = 0; film = null;
      const top = Math.max(...piece.boards.map(b => b.y1));
      for (const part of piece.parts) part.boards.forEach((board, k) => {
        const { geometry, centre } = boardGeometry(board, piece.size);
        boardUVs(geometry, boardSeed(centre.x, centre.y, centre.z), getDecorDirection(part.decorId));
        const face = new THREE.Mesh(geometry, lines.face), edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), lines.edge);
        edges.computeLineDistances();
        for (const o of [face, edges]) { o.layers.set(MAKE_LAYER); o.userData.make = true; o.userData.n = part.n; }
        group.add(face, edges);
        const motion = piece.motions[part.ids[k]!] ?? null;
        const pivot = motion?.kind === 'swing' ? new THREE.Vector3(motion.pivot[0] - piece.size.w / 2, 0, motion.pivot[1] - piece.size.d / 2) : null;
        boards.push({ part, board, index: part.ids[k]!, face, edges, rest: centre, apart: apartOffset(board, piece.size, top), motion, pivot });
      });
      const byIndex = new Map(boards.map(b => [b.index, b]));
      fittings.build(piece, i => byIndex.get(i)?.face, i => byIndex.get(i)?.rest ?? new THREE.Vector3(), group);
      play.build(piece, i => byIndex.get(i)?.face, i => byIndex.get(i)?.rest ?? new THREE.Vector3(), group);
      group.position.set(pose.x, pose.y, pose.z);
      group.rotation.y = pose.angle * Math.PI / 180;
      group.updateMatrixWorld(true);
      place(); paint();
    },
    setLook(next: MakeLook) { look = next; paint(); },
    setSelected(n: number | null) {
      selected = n;
      fittings.focus(n === null ? null : new Set(boards.filter(b => b.part.n === n).map(b => b.index)));
      paint();
    },
    /** Shows the film of the assembly at one moment (null: the piece as it is). */
    setFilm(next: MakeFilm | null) {
      film = next;
      fittings.only(next?.hole ?? null, next?.item ?? null);
      play.show(next);
      place(); paint();
    },
    setSolidFronts(on: boolean) { solidFronts = on; paint(); },
    /** How far apart (0 assembled, 1 apart). */
    setApart(t: number) { amount = t; place(); },
    /** How far open the doors and drawers are (0 shut, 1 open). */
    setOpen(t: number) { open = t; place(); },
    /** The box every board fills at `t` apart (0 assembled, 1 apart), in world space: what the camera frames. */
    extent(t: number) {
      const box = new THREE.Box3(), one = new THREE.Box3();
      for (const b of boards) {
        b.face.geometry.computeBoundingBox();
        const at = new THREE.Vector3(b.rest.x + b.apart[0] * t, b.rest.y + b.apart[1] * t, b.rest.z + b.apart[2] * t);
        one.copy(b.face.geometry.boundingBox!).translate(b.board.outline ? new THREE.Vector3(b.apart[0] * t, b.apart[1] * t, b.apart[2] * t) : at);
        box.union(one);
      }
      return box.applyMatrix4(group.matrixWorld);
    },
    /** Where a board is moved to at the current amount apart, in the piece's frame (centimetres). */
    offsetOf(board: Board): Vec3 {
      const b = boards.find(m => m.board === board);
      if (!b) return [0, 0, 0];
      const away = amount + FLY * (1 - easeInOut(film?.arrive(b.index) ?? 1));
      return [b.apart[0] * away, b.apart[1] * away, b.apart[2] * away];
    },
    /** The part under a ray, nearest first, ignoring fronts drawn as outlines. */
    pick(raycaster: THREE.Raycaster): number | null {
      raycaster.layers.set(MAKE_LAYER);
      const targets = boards.filter(b => b.face.visible && !(isFront(b.part) && !solidFronts)).map(b => b.face);
      const hit = raycaster.intersectObjects(targets, false)[0];
      return hit ? hit.object.userData.n as number : null;
    },
    hide() { clear(); },
    dispose() {
      clear();
      scene.remove(group);
      fittings.dispose(); play.dispose();
      for (const m of new Set<THREE.Material>([...Object.values(lines), ...decorMaterials.values(), ...faded.values()])) m.dispose();
    },
  };
}

function getDecorDirection(id: string): 'vertical' | 'horizontal' | 'none' | undefined {
  try { return getDecor(id).grainDirection; } catch { return undefined; }
}
