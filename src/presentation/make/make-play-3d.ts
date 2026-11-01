import * as THREE from 'three';
import type { Fitting, Hole } from '../../domain/make/make-joints';
import type { MakePiece } from '../../domain/make/make-parts';

/** The film of the assembly at one moment: where each board is, which holes and fittings show, what is moving. */
export interface MakeFilm {
  /** A board: null hidden, 0 away, 1 in place. */
  arrive(board: number): number | null;
  /** Whether a board is one the step is putting in now (drawn picked out). */
  now(board: number): boolean;
  /** Whether a hole is drilled by now. */
  hole(index: number): boolean;
  /** Whether bought hardware drawn on the piece (a handle, a rail, a leg) is on by now. */
  item(index: number): boolean;
  /** A hole being drilled: the drill's way down and back out (0 to 1), or null. */
  bit(hole: number): number | null;
  /** A fastener: null not yet, 0 at the hole, 1 home. */
  fit(item: number): number | null;
}

const STEEL = 0x555b62, BRASS = 0x9a7434, BIT = 0x2b2e33;
/** Hardware is drawn this much larger than life while it moves, so a 4 mm screw reads on a phone; it lands at its size. */
const VIS = 1.6;
const Y = new THREE.Vector3(0, 1, 0), AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const ease = (t: number) => 1 - (1 - t) ** 3;

interface Fastener { readonly group: THREE.Object3D; readonly item: number; readonly home: THREE.Vector3; readonly dir: THREE.Vector3; readonly travel: number; readonly spin: number; readonly grow: boolean }
interface Bit { readonly mesh: THREE.Object3D; readonly hole: number; readonly mouth: THREE.Vector3; readonly dir: THREE.Vector3; readonly depth: number }

/**
 * The moving parts of the assembly film: a drill bit going into each hole and out again, and every fastener going home:
 * screws turning in along their hole, a cam turned to lock, dowels and shelf pins pushed in, nails driven, hinges and
 * plates set on. Drill bits ride on their board, so a board is drilled where it waits before it comes in.
 */
export function createMakePlay(layer: number) {
  const rod = new THREE.CylinderGeometry(1, 1, 1, 12), cone = new THREE.ConeGeometry(1, 1, 12), box = new THREE.BoxGeometry(1, 1, 1);
  const steel = new THREE.MeshLambertMaterial({ color: STEEL, emissive: 0x2c2f33, emissiveIntensity: .5 });
  const brass = new THREE.MeshLambertMaterial({ color: BRASS, emissive: 0x3a2c14, emissiveIntensity: .5 });
  const drill = new THREE.MeshLambertMaterial({ color: BIT, emissive: 0x15171a, emissiveIntensity: .5 });
  let fasteners: Fastener[] = [], bits: Bit[] = [];

  const tag = <T extends THREE.Object3D>(o: T) => { o.traverse(c => { c.layers.set(layer); c.userData.make = true; c.raycast = () => undefined; }); return o; };
  /** A solid of unit `geometry` scaled to `size`, its y along `axis`, centred at `at` in its parent. */
  function solid(geometry: THREE.BufferGeometry, material: THREE.Material, at: THREE.Vector3, size: THREE.Vector3, axis = Y) {
    const m = new THREE.Mesh(geometry, material);
    m.scale.copy(size); m.quaternion.setFromUnitVectors(Y, axis); m.position.copy(at);
    return m;
  }
  /** A screw lying along +y from its head at the origin: head, shank and thread, `length` long. */
  function screw(length: number, r: number, material: THREE.Material) {
    const g = new THREE.Group();
    g.add(solid(rod, material, new THREE.Vector3(0, -.08, 0), new THREE.Vector3(r * 2.2, .16, r * 2.2)),
      solid(rod, material, new THREE.Vector3(0, length / 2, 0), new THREE.Vector3(r, length, r)),
      solid(cone, material, new THREE.Vector3(0, length + r, 0), new THREE.Vector3(r, r * 2, r)));
    return g;
  }

  function fastenerOf(piece: MakePiece, f: Fitting, item: number): Fastener | null {
    const frame = (p: readonly number[]) => new THREE.Vector3(p[0]! - piece.size.w / 2, p[1]!, p[2]! - piece.size.d / 2);
    const mine = piece.holes.filter(h => h.of === item), along = (h: Hole) => AXES[h.axis]!.clone().multiplyScalar(h.sign);
    const make = (group: THREE.Object3D, home: THREE.Vector3, dir: THREE.Vector3, travel: number, spin = 0, grow = false) => {
      group.quaternion.setFromUnitVectors(Y, dir);
      return { group: tag(group), item, home, dir, travel, spin, grow };
    };
    if (f.kind === 'confirmat' || f.kind === 'screw') {
      // Turned in through the face board's hole: its head ends flush with the face.
      const h = mine.find(x => x.kind === 'connector' || x.kind === 'screw');
      if (!h) return null;
      const length = f.kind === 'screw' ? 4 : 5;
      return make(screw(length, f.kind === 'screw' ? .2 : .32, steel), frame(h.at), along(h), length + 3, 8 * Math.PI);
    }
    if (f.kind === 'cam') {
      // The bolt turned into the face board, then the cam set in its hole and turned half round to draw it tight.
      const h = mine.find(x => x.kind === 'cam'), bolt = mine.find(x => x.kind === 'bolt');
      if (!h || !bolt) return null;
      const g = new THREE.Group(), dir = along(h);
      g.add(solid(rod, brass, new THREE.Vector3(0, .62, 0), new THREE.Vector3(.72, 1.2, .72)), solid(box, steel, new THREE.Vector3(0, .02, 0), new THREE.Vector3(1.1, .08, .18)));
      return make(g, frame(h.at), dir, 3, Math.PI);
    }
    if (f.kind === 'dowel') {
      const h = mine.find(x => x.depth === 25) ?? mine[0];
      if (!h) return null;
      return make(solid(rod, brass, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.4, 3.5, .4)), frame(f.at), along(h), 0, 0, true);
    }
    if (f.kind === 'nail') return make(screw(2, .08, steel), frame(f.at), AXES[2]!.clone(), 3);
    if (f.kind === 'pin') {
      const h = mine[2] ?? mine[0];
      if (!h) return null;
      return make(solid(rod, brass, new THREE.Vector3(0, -.25, 0), new THREE.Vector3(.25, 1.6, .25)), frame(f.at), along(h), 2);
    }
    if (f.kind === 'hinge') {
      // The hinge's cup pressed into the door, its arm reaching back to the plate.
      const g = new THREE.Group();
      g.add(solid(rod, steel, new THREE.Vector3(0, .6, 0), new THREE.Vector3(1.75, 1.2, 1.75)), solid(box, steel, new THREE.Vector3(0, -.7, 0), new THREE.Vector3(1.6, 1.6, 4)));
      return make(g, frame(f.at), AXES[2]!.clone(), 3);
    }
    if (f.kind === 'plate') return make(solid(box, steel, new THREE.Vector3(0, -.25, 0), new THREE.Vector3(1.2, .5, 4.8)), frame(f.at), AXES[0]!.clone().multiplyScalar(mine[0]?.sign ?? 1), 2);
    return null;
  }

  return {
    build(piece: MakePiece, meshOf: (board: number) => THREE.Object3D | undefined, rest: (board: number) => THREE.Vector3, root: THREE.Object3D) {
      this.clear();
      const frame = (p: readonly number[]) => new THREE.Vector3(p[0]! - piece.size.w / 2, p[1]!, p[2]! - piece.size.d / 2);
      piece.holes.forEach((h, hole) => {
        const host = meshOf(h.board);
        if (!host) return;
        // A bit as wide as the hole: a fluted body and a point, riding on the board it drills.
        const r = h.d / 20, mesh = tag(new THREE.Group()), dir = AXES[h.axis]!.clone().multiplyScalar(h.sign);
        mesh.add(solid(rod, drill, new THREE.Vector3(0, -3, 0), new THREE.Vector3(r, 6, r)), solid(cone, drill, new THREE.Vector3(0, r * .5, 0), new THREE.Vector3(r, r, r)));
        mesh.quaternion.setFromUnitVectors(Y, dir);
        mesh.visible = false;
        host.add(mesh);
        const board = piece.boards[h.board]!, through = Math.min(board.x1 - board.x0, board.y1 - board.y0, board.z1 - board.z0);
        bits.push({ mesh, hole, mouth: frame(h.at).sub(rest(h.board)), dir, depth: h.depth ? h.depth / 10 : through });
      });
      piece.fittings.forEach((f, item) => {
        const fastener = fastenerOf(piece, f, item);
        if (!fastener) return;
        fastener.group.visible = false;
        root.add(fastener.group);
        fasteners.push(fastener);
      });
    },
    /** Puts every bit and fastener where the film has it (null: none shows). */
    show(film: MakeFilm | null) {
      for (const b of bits) {
        const p = film?.bit(b.hole) ?? null;
        b.mesh.visible = p !== null;
        if (p === null) continue;
        // Down from 2 cm above, to the hole's depth, and back out.
        const down = p < .5 ? ease(p * 2) : ease((1 - p) * 2);
        b.mesh.position.copy(b.mouth).addScaledVector(b.dir, -2 + down * (b.depth + 2));
        b.mesh.scale.setScalar(VIS);
        b.mesh.rotation.set(0, 0, 0);
        b.mesh.quaternion.setFromUnitVectors(Y, b.dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, p * 24));
      }
      for (const f of fasteners) {
        const p = film?.fit(f.item) ?? null;
        f.group.visible = p !== null;
        if (p === null) continue;
        const e = ease(p);
        f.group.position.copy(f.home).addScaledVector(f.dir, -(1 - e) * f.travel);
        f.group.quaternion.setFromUnitVectors(Y, f.dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, e * f.spin));
        f.group.scale.setScalar((f.grow ? Math.max(.01, e) : 1) * (1 + (VIS - 1) * (1 - e)));
      }
    },
    clear() {
      for (const o of [...bits.map(b => b.mesh), ...fasteners.map(f => f.group)]) o.parent?.remove(o);
      bits = []; fasteners = [];
    },
    dispose() {
      this.clear();
      for (const g of [rod, cone, box]) g.dispose();
      steel.dispose(); brass.dispose(); drill.dispose();
    },
  };
}
