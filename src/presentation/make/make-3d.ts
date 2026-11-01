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
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/** The camera layer Make draws on: while Make is open the camera sees only this layer, so the piece stands alone. */
export const MAKE_LAYER = 3;
export type MakeLook = 'lines' | 'material' | 'xray';
type Resources = Pick<ReturnType<typeof createViewportResources>, 'M' | 'decorTexture'>;

const OPEN_ANGLE = 100 * Math.PI / 180, IDENTITY = new THREE.Quaternion(), INK = 0x1a1a1a, PAPER = 0xfbfbf8, SELECTED = 0xe3eaf5, XRAY = 0x3e6fc2, FADE = .14;
/** Outlines as an assembly manual draws them: a steady width on screen however near the camera is (pixels). */
const PEN = 1.5, PEN_PICKED = 2.4;
const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const isFront = (p: MakePart) => p.stock === 'door' || p.stock === 'front';

interface BoardMesh {
  part: MakePart; board: Board; index: number; face: THREE.Mesh; edges: LineSegments2; rest: THREE.Vector3; apart: Vec3; motion: Motion | null;
  pivot: THREE.Vector3 | null;
  /** The board's middle, in the group's frame (a sloped board's mesh sits at the origin with its shape around this). */
  centre: THREE.Vector3;
}
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), LIFT = 22;
const smooth = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
/** How a board lies flat where it waits: a quarter turn onto its face, then round so its length runs across. */
function lying(lie: 'x' | 'z' | null, spin: boolean) {
  const q = new THREE.Quaternion();
  if (lie) q.setFromAxisAngle(lie === 'x' ? X : Z, Math.PI / 2);
  if (spin) q.premultiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI / 2));
  return q;
}

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
 * Looks: Lines (a drawing: paper boards, ink outlines), Material (the piece's own decors), X-ray (see-through, blue edges).
 */
export function createMake3d(resources: Resources, scene: THREE.Scene) {
  const group = new THREE.Group();
  group.userData.make = true;
  scene.add(group);
  const decorMaterials = new Map<string, THREE.Material>(), faded = new Map<THREE.Material, THREE.Material>();
  const lines = {
    // A drawing, as an assembly manual is drawn: boards the colour of the paper, unshaded, so only their ink outlines
    // give their form; set back a hair so the outlines are never half hidden in them.
    face: new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    selected: new THREE.MeshBasicMaterial({ color: SELECTED, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    xray: new THREE.MeshBasicMaterial({ color: XRAY, transparent: true, opacity: .05, depthWrite: false }),
    hidden: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    edge: new LineMaterial({ color: INK, linewidth: PEN }),
    edgeSelected: new LineMaterial({ color: XRAY, linewidth: PEN_PICKED }),
    edgeXray: new LineMaterial({ color: XRAY, linewidth: PEN, transparent: true, opacity: .8 }),
    edgeFaded: new LineMaterial({ color: INK, linewidth: 1, transparent: true, opacity: FADE }),
    phantom: new LineMaterial({ color: INK, linewidth: 1, dashed: true, dashSize: 3, gapSize: 2, transparent: true, opacity: .55 }),
  };
  const pens = [lines.edge, lines.edgeSelected, lines.edgeXray, lines.edgeFaded, lines.phantom];
  // Paper and ink are the page's own colours: the editor's tone mapping (made for lit wood) leaves them as they are.
  for (const m of [lines.face, lines.selected, ...pens]) m.toneMapped = false;
  let size: MakePiece['size'] = { w: 0, h: 0, d: 0 };
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
    if (film) { carry(film); return; }
    for (const b of boards) {
      const at = b.face.position.set(b.rest.x + b.apart[0] * amount, b.rest.y + b.apart[1] * amount, b.rest.z + b.apart[2] * amount);
      let turn = 0;
      if (b.motion?.kind === 'slide') at.z += b.motion.by * open;
      else if (b.motion?.kind === 'swing' && b.pivot) {
        turn = -b.motion.dir * open * OPEN_ANGLE;
        const vx = b.rest.x - b.pivot.x, vz = b.rest.z - b.pivot.z, c = Math.cos(turn), s = Math.sin(turn);
        at.x += b.pivot.x + vx * c + vz * s - b.rest.x;
        at.z += b.pivot.z - vx * s + vz * c - b.rest.z;
      }
      b.face.quaternion.setFromAxisAngle(Y, turn);
      b.edges.position.copy(at);
      b.edges.quaternion.copy(b.face.quaternion);
    }
  }
  /** The film: each board lies flat where it waits until its step, then is lifted, stood up and carried into place
   * along an arc, turning as it goes, and set down. */
  function carry(f: MakeFilm) {
    const turned = new THREE.Quaternion(), start = new THREE.Vector3(), centre = new THREE.Vector3(), off = new THREE.Vector3();
    for (const b of boards) {
      const st = f.stage(b.index), e = easeInOut(f.arrive(b.index));
      start.set(st.at[0] - size.w / 2, st.at[1], st.at[2] - size.d / 2);
      centre.lerpVectors(start, b.centre, e).y += LIFT * Math.sin(Math.PI * e);
      turned.copy(lying(st.lie, st.spin)).slerp(IDENTITY, smooth(.08, .7, e));
      off.subVectors(b.centre, b.rest).applyQuaternion(turned);
      b.face.position.subVectors(centre, off);
      b.face.quaternion.copy(turned);
      b.edges.position.copy(b.face.position);
      b.edges.quaternion.copy(turned);
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
      selected = null; amount = 0; open = 0; film = null; size = piece.size;
      const top = Math.max(...piece.boards.map(b => b.y1));
      for (const part of piece.parts) part.boards.forEach((board, k) => {
        const { geometry, centre } = boardGeometry(board, piece.size);
        boardUVs(geometry, boardSeed(centre.x, centre.y, centre.z), getDecorDirection(part.decorId));
        // The outline of the board as cut, a plain box (the shaded board's eased edges would draw every facet).
        const plain = board.outline ? geometry : new THREE.BoxGeometry(board.x1 - board.x0, board.y1 - board.y0, board.z1 - board.z0);
        const outline = new THREE.EdgesGeometry(plain, 25);
        if (plain !== geometry) plain.dispose();
        const face = new THREE.Mesh(geometry, lines.face), edges = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(outline), lines.edge);
        outline.dispose();
        edges.computeLineDistances();
        for (const o of [face, edges]) { o.layers.set(MAKE_LAYER); o.userData.make = true; o.userData.n = part.n; }
        group.add(face, edges);
        const motion = piece.motions[part.ids[k]!] ?? null;
        const pivot = motion?.kind === 'swing' ? new THREE.Vector3(motion.pivot[0] - piece.size.w / 2, 0, motion.pivot[1] - piece.size.d / 2) : null;
        const middle = new THREE.Vector3((board.x0 + board.x1) / 2 - piece.size.w / 2, (board.y0 + board.y1) / 2, (board.z0 + board.z1) / 2 - piece.size.d / 2);
        boards.push({ part, board, index: part.ids[k]!, face, edges, rest: centre, apart: apartOffset(board, piece.size, top), motion, pivot, centre: middle });
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
    /** The paper and ink of the drawing, from the editor's theme (light paper and dark ink, or the other way round). */
    setPaper(paper: string, ink: string) {
      lines.face.color.set(paper);
      for (const pen of [lines.edge, lines.edgeFaded, lines.phantom]) pen.color.set(ink);
    },
    /** The view's size in pixels: outlines keep their width on screen. */
    setResolution(width: number, height: number) { for (const pen of pens) pen.resolution.set(width, height); },
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
      // In the film a board is wherever it is being carried: its offset from where it ends up.
      if (film) return [b.face.position.x - b.rest.x, b.face.position.y - b.rest.y, b.face.position.z - b.rest.z];
      return [b.apart[0] * amount, b.apart[1] * amount, b.apart[2] * amount];
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
