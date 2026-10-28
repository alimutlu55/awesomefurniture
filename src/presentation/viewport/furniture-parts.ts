import * as THREE from 'three';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { barPull } from './hardware';
import { hingedLeaves, shelfHeights } from '../../domain/kitchen/kitchen-fronts';
import type { BoxBuilder } from './frame-geometry';
import { boardBox, boardUVs } from './board-geometry';
import { decorateFront } from './front-surface';

/**
 * Parts any furniture is assembled from: front panels, hinged doors, drawer boxes, shelves inside a cupboard,
 * pulls, continuous spans along a run (worktops, plinths), and fixtures that sit in a worktop (a sink with its
 * tap, a hob). Each takes its place and materials and adds itself to a group; nothing here knows which kind of
 * furniture it is building. Centimetres; x along the width, y up, z towards the front.
 */

/** A mesh placed at a point, casting and receiving shadows. */
export function partMesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Overlay fronts on a carcass whose front face is at `face`: panels, hinged doors, drawer boxes, shelves, pulls. */
export function createFrontParts({ box, group, face, depth, front, inside, metal, door = front, drawer = inside, handleless = false, shelfThickness = 1.6, fixedFront = () => false }: {
  handleless?: boolean; shelfThickness?: number;
  box: BoxBuilder; group: THREE.Object3D; face: number; depth: number; front: THREE.Material; inside: THREE.Material; metal: THREE.Material;
  door?: THREE.Material; drawer?: THREE.Material;
  fixedFront?(x0: number, x1: number): boolean;
}) {
  const gap = handleless ? .2 : .3;
  /** A bar pull standing off the front, across (drawers, flaps) or upright (doors). */
  const pull = (length: number, x: number, y: number, vertical = false) => {
    if (handleless) return;
    const bar = barPull(length, metal, vertical);
    bar.position.set(x, y, face + (front.userData.panelThickness ?? PANEL) / 2);
    group.add(bar);
  };
  /** One front panel from y0 to y1 across x0..x1, a hairline gap all round. */
  const panel = (x0: number, x1: number, y0: number, y1: number, material = front) => {
    const thickness = material.userData.panelThickness ?? PANEL;
    const mesh = box(Math.max(1, x1 - x0 - gap), Math.max(1, y1 - y0 - gap), thickness, (x0 + x1) / 2, (y0 + y1) / 2, face, material);
    decorateFront([{ x: x0 + gap / 2, y: y0 + gap / 2 }, { x: x1 - gap / 2, y: y0 + gap / 2 },
      { x: x1 - gap / 2, y: y1 - gap / 2 }, { x: x0 + gap / 2, y: y1 - gap / 2 }], thickness, face, material, group);
    return mesh;
  };
  /** Hinged leaves across a span: one up to 62 cm, two above it, each with an upright pull by its free edge. */
  const doors = (x0: number, x1: number, y0: number, y1: number, pullAtTop: boolean, hinge: 'left' | 'right' = 'left', explicit = false) => {
    const py = pullAtTop ? y1 - Math.min(12, (y1 - y0) / 4) : y0 + Math.min(12, (y1 - y0) / 4);
    for (const leaf of hingedLeaves(x0, x1, hinge, explicit)) {
      const mesh = panel(leaf.x0, leaf.x1, y0, y1, door);
      if (fixedFront(leaf.x0, leaf.x1)) { mesh.userData.fixedCornerReturn = true; continue; }
      pull(Math.min(18, (y1 - y0) * .5), leaf.hinge === 'left' ? leaf.x1 - 4 : leaf.x0 + 4, py, true);
    }
  };
  /** Adjustable shelves inside a cupboard, about one every 34 cm. */
  const shelves = (x0: number, x1: number, y0: number, y1: number) => {
    for (const y of shelfHeights(y0, y1)) box(x1 - x0 - 1, shelfThickness, depth - 6, (x0 + x1) / 2, y, -1, inside);
  };
  /** The box of a drawer behind its front. */
  const drawerBox = (cx: number, y: number, w: number, h: number) => box(Math.max(4, w - 4), Math.max(4, h - 4), depth - 6, cx, y + h / 2, -1, drawer);
  return { panel, doors, shelves, drawerBox, pull };
}

/** A slab along a run: `length` along its direction, `depth` from its footprint's back. A plinth is a board set
 * back under the fronts, so it stands at the front of its footprint. */
export function spanSlab(span: { kind: string; x: number; z: number; y: number; angle: number; length: number; depth: number; height: number }, material: THREE.Material, parent: THREE.Object3D) {
  const board = span.kind === 'plinth', depth = board ? PANEL : span.depth;
  const geometry = material.userData.board
    ? boardUVs(boardBox(span.length, span.height, depth), 0, 'horizontal', material.userData.boardMapping) : new THREE.BoxGeometry(span.length, span.height, depth);
  const m = partMesh(geometry, material, parent, span.x, span.y + span.height / 2, span.z);
  m.rotation.y = span.angle * Math.PI / 180;
  if (board) {
    const a = span.angle * Math.PI / 180, shift = span.depth / 2 - PANEL / 2;
    m.position.x += Math.sin(a) * shift;
    m.position.z += Math.cos(a) * shift;
  }
  m.userData.kitchenSpan = span.kind;
  return m;
}

/** A sink set in a worktop whose top is at `top`, centred on x over a space `w` wide, with its tap behind it. */
export function sinkWithTap(parent: THREE.Object3D, x: number, top: number, w: number, depth: number, z: number, m: { steel: THREE.Material; basin: THREE.Material; drain: THREE.Material }) {
  // The bowl fills the fitting, leaving a rim; the tap stands behind it in the worktop's back strip.
  const bw = Math.max(20, w - 8), bd = Math.max(24, Math.min(depth - 18, 46));
  partMesh(new THREE.BoxGeometry(bw, .3, bd), m.steel, parent, x, top + .15, z);
  partMesh(new THREE.BoxGeometry(bw - 4, .32, bd - 5), m.basin, parent, x, top + .16, z + .5);
  partMesh(new THREE.CylinderGeometry(1.8, 1.8, .34, 20), m.drain, parent, x, top + .17, z + .5);
  // The tap: a column behind the basin and a spout reaching over it.
  const tapZ = z - bd / 2 - 3;
  partMesh(new THREE.CylinderGeometry(1.3, 1.6, 26, 18), m.steel, parent, x, top + 13, tapZ);
  const spout = partMesh(new THREE.CylinderGeometry(1, 1, 16, 14), m.steel, parent, x, top + 25.5, tapZ + 8);
  spout.rotation.x = Math.PI / 2;
  partMesh(new THREE.CylinderGeometry(1, 1, 4, 14), m.steel, parent, x, top + 23.5, tapZ + 15.5);
  const lever = partMesh(new THREE.BoxGeometry(1.2, 1.2, 8), m.steel, parent, x + 3, top + 21, tapZ - 1);
  lever.rotation.x = -.5;
}

/** A glass hob set in a worktop whose top is at `top`, centred on x over a space `w` wide, with four rings. */
export function hob(parent: THREE.Object3D, x: number, top: number, w: number, depth: number, z: number, m: { glass: THREE.Material; ring: THREE.Material }) {
  const hw = Math.max(20, w - 4), hd = Math.max(30, Math.min(depth - 8, 52));
  partMesh(new THREE.BoxGeometry(hw, .6, hd), m.glass, parent, x, top + .3, z);
  for (const [dx, dz, r] of [[-.25, -.22, 9], [.25, -.22, 7], [-.25, .22, 7], [.25, .22, 9]] as const) {
    const burner = partMesh(new THREE.RingGeometry(r - .6, r, 40), m.ring, parent, x + dx * hw, top + .62, z + dz * hd);
    burner.rotation.x = -Math.PI / 2;
  }
}
