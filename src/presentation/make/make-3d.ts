import * as THREE from 'three';
import type { Board } from '../../domain/drawings/cabinet-boards';
import { getDecor } from '../../domain/materials/decor-catalog';
import { apartOffset, type Vec3 } from '../../domain/make/make-measures';
import type { MakePart, MakePiece } from '../../domain/make/make-parts';
import { boardBox, boardSeed, boardUVs } from '../viewport/board-geometry';
import { createDecorMaterial } from '../viewport/cabinet-materials';
import type { createViewportResources } from '../viewport/viewport-resources.js';

/** The camera layer Make draws on: while Make is open the camera sees only this layer, so the piece stands alone. */
export const MAKE_LAYER = 3;
export type MakeLook = 'lines' | 'material' | 'xray';
type Resources = Pick<ReturnType<typeof createViewportResources>, 'M' | 'decorTexture'>;

const INK = 0x2b2a26, PAPER = 0xf3f0e9, SELECTED = 0xdfe7f5, XRAY = 0x3e6fc2, FADE = .14;
const isFront = (p: MakePart) => p.stock === 'door' || p.stock === 'front';

interface BoardMesh { part: MakePart; board: Board; face: THREE.Mesh; edges: THREE.LineSegments; rest: THREE.Vector3; apart: Vec3 }

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
  let boards: BoardMesh[] = [], look: MakeLook = 'lines', selected: number | null = null, solidFronts = false, amount = 0;

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
      const phantom = isFront(b.part) && !solidFronts, mine = selected === b.part.n, dim = selected !== null && !mine;
      let face: THREE.Material = look === 'material' ? decor(b.part.decorId) : look === 'xray' ? lines.xray : mine ? lines.selected : lines.face;
      if (phantom) face = lines.hidden;
      else if (dim) face = fade(face);
      b.face.material = face;
      b.face.renderOrder = phantom || dim || look === 'xray' ? 1 : 0;
      b.edges.material = phantom ? lines.phantom : dim ? lines.edgeFaded : mine ? lines.edgeSelected : look === 'xray' ? lines.edgeXray : lines.edge;
    }
  }
  function place() {
    for (const b of boards) {
      b.face.position.set(b.rest.x + b.apart[0] * amount, b.rest.y + b.apart[1] * amount, b.rest.z + b.apart[2] * amount);
      b.edges.position.copy(b.face.position);
    }
  }
  function clear() {
    for (const b of boards) { b.face.geometry.dispose(); b.edges.geometry.dispose(); }
    group.clear();
    boards = [];
  }

  return {
    group,
    /** Builds the piece at its place in the room: `pose` is where the editor stands it. */
    show(piece: MakePiece, pose: { x: number; y: number; z: number; angle: number }) {
      clear();
      selected = null; amount = 0;
      const all = piece.parts.flatMap(p => p.boards), top = Math.max(...all.map(b => b.y1));
      for (const part of piece.parts) for (const board of part.boards) {
        const { geometry, centre } = boardGeometry(board, piece.size);
        boardUVs(geometry, boardSeed(centre.x, centre.y, centre.z), getDecorDirection(part.decorId));
        const face = new THREE.Mesh(geometry, lines.face), edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), lines.edge);
        edges.computeLineDistances();
        for (const o of [face, edges]) { o.layers.set(MAKE_LAYER); o.userData.make = true; o.userData.n = part.n; }
        group.add(face, edges);
        boards.push({ part, board, face, edges, rest: centre, apart: apartOffset(board, piece.size, top) });
      }
      group.position.set(pose.x, pose.y, pose.z);
      group.rotation.y = pose.angle * Math.PI / 180;
      group.updateMatrixWorld(true);
      place(); paint();
    },
    setLook(next: MakeLook) { look = next; paint(); },
    setSelected(n: number | null) { selected = n; paint(); },
    setSolidFronts(on: boolean) { solidFronts = on; paint(); },
    /** How far apart (0 assembled, 1 apart). */
    setApart(t: number) { amount = t; place(); },
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
    offsetOf(board: Board): Vec3 { const b = boards.find(m => m.board === board); return b ? [b.apart[0] * amount, b.apart[1] * amount, b.apart[2] * amount] : [0, 0, 0]; },
    /** The part under a ray, nearest first, ignoring fronts drawn as outlines. */
    pick(raycaster: THREE.Raycaster): number | null {
      raycaster.layers.set(MAKE_LAYER);
      const targets = boards.filter(b => !(isFront(b.part) && !solidFronts)).map(b => b.face);
      const hit = raycaster.intersectObjects(targets, false)[0];
      return hit ? hit.object.userData.n as number : null;
    },
    hide() { clear(); },
    dispose() {
      clear();
      scene.remove(group);
      for (const m of new Set<THREE.Material>([...Object.values(lines), ...decorMaterials.values(), ...faded.values()])) m.dispose();
    },
  };
}

function getDecorDirection(id: string): 'vertical' | 'horizontal' | 'none' | undefined {
  try { return getDecor(id).grainDirection; } catch { return undefined; }
}
