import * as THREE from 'three';
import type { Fitting } from '../../domain/make/make-joints';
import { entryOf, WAIT } from '../../domain/make/make-fixing';
import type { MakePiece } from '../../domain/make/make-parts';
import { hingeCupAndArmMesh, mountingPlateMesh } from '../viewport/hardware';

/** The film of the assembly at one moment: where each board is, which holes and fittings show, what is moving. */
export interface MakeFilm {
  /** A board: 0 lying where it waits, 1 in place. */
  arrive(board: number): number;
  /** Where a board waits, lying flat on the floor in front of the piece. */
  stage(board: number): import('../../domain/make/make-staging').Staged;
  /** Whether a board is one the step is putting in now (drawn picked out). */
  now(board: number): boolean;
  /** Whether a hole is drilled by now. */
  hole(index: number): boolean;
  /** Bought hardware drawn on the piece (a handle, a rail, a leg): null not yet, 0 coming into view, 1 on. */
  item(index: number): number | null;
  /** A hole being drilled: the drill's way down and back out (0 to 1), or null. */
  bit(hole: number): number | null;
  /** A fastener: null not yet, 0 waiting at the end of its line, 1 home. */
  fit(item: number): number | null;
  /** How far a fastener has come into view where it waits (0 to 1). */
  seen(item: number): number;
  /** How far a door hangs out of true now, before it is adjusted (side, height, depth; cm). */
  nudge?(board: number): import('../../domain/make/make-measures').Vec3;
  /** Hardware points the actual camera should see; only intervening boards become translucent. */
  readonly targets?: readonly import('./assembly-visibility').AssemblyTarget[];
}

const STEEL = 0x555b62, BRASS = 0x9a7434, BIT = 0x2b2e33;
/** Hardware is drawn this much larger than life while it moves, so a 4 mm screw reads on a phone; it lands at its size. */
const VIS = 1.6;
const Y = new THREE.Vector3(0, 1, 0), AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const ease = (t: number) => 1 - (1 - t) ** 3;

interface Fastener {
  readonly group: THREE.Object3D; readonly item: number; readonly home: THREE.Vector3; readonly dir: THREE.Vector3; readonly spin: number; readonly board: number | null;
  /** Pushed home first, then turned (a cam), rather than turned as it goes in (a screw). */
  readonly turnLast?: boolean;
}
interface Bit { readonly mesh: THREE.Object3D; readonly hole: number; readonly mouth: THREE.Vector3; readonly dir: THREE.Vector3; readonly depth: number }

/**
 * The moving parts of the assembly film: a drill bit going into each hole and out again, and every fastener going home:
 * screws turning in along their hole, a cam turned to lock, dowels and shelf pins pushed in, nails driven, hinges and
 * plates set on. Bits and fasteners ride on their board, so a board is drilled where it waits before it comes in, and a
 * door has its hinges pressed in lying there.
 */
export function createMakePlay(layer: number) {
  const rod = new THREE.CylinderGeometry(1, 1, 1, 12), cone = new THREE.ConeGeometry(1, 1, 12), box = new THREE.BoxGeometry(1, 1, 1);
  const steel = new THREE.MeshLambertMaterial({ color: STEEL, emissive: 0x2c2f33, emissiveIntensity: .5 });
  const brass = new THREE.MeshLambertMaterial({ color: BRASS, emissive: 0x3a2c14, emissiveIntensity: .5 });
  const drill = new THREE.MeshLambertMaterial({ color: BIT, emissive: 0x15171a, emissiveIntensity: .5 });
  let fasteners: Fastener[] = [], bits: Bit[] = [];
  let links: readonly (readonly number[])[] = [];
  const highlight = new THREE.MeshLambertMaterial({ color: 0x4976ad, emissive: 0x243b56, emissiveIntensity: .5 });
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

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
    const e = entryOf(piece, item);
    if (!e) return null;
    const home = new THREE.Vector3(e.at[0] - piece.size.w / 2, e.at[1], e.at[2] - piece.size.d / 2), dir = new THREE.Vector3(...e.dir);
    const make = (group: THREE.Object3D, spin = 0) => {
      group.quaternion.setFromUnitVectors(Y, dir);
      return { group: tag(group), item, home, dir, spin, board: e.board };
    };
    // Turned in through the face board's hole: its head ends flush with the face.
    if (f.kind === 'confirmat' || f.kind === 'screw') return make(screw(f.kind === 'screw' ? Number(f.size?.split('×')[1]?.trim()) / 10 || 4 : 5, f.kind === 'screw' ? .2 : .32, steel), 8 * Math.PI);
    if (f.kind === 'bolt') {
      // Its thread turned 11 mm into the face board, its shank and head standing 34 mm out for the cam to grip.
      const g = new THREE.Group();
      g.add(solid(rod, steel, new THREE.Vector3(0, .55, 0), new THREE.Vector3(.25, 1.1, .25)), solid(rod, steel, new THREE.Vector3(0, -1.6, 0), new THREE.Vector3(.18, 3.2, .18)),
        solid(rod, steel, new THREE.Vector3(0, -3.3, 0), new THREE.Vector3(.36, .3, .36)), solid(box, steel, new THREE.Vector3(0, .02, 0), new THREE.Vector3(.5, .06, .1)));
      return make(g, 6 * Math.PI);
    }
    if (f.kind === 'cam') {
      // The cam pushed into its hole, its slot and arrow to the face, then turned half round to grip the bolt's head.
      const g = new THREE.Group();
      g.add(solid(rod, brass, new THREE.Vector3(0, .62, 0), new THREE.Vector3(.72, 1.2, .72)), solid(box, steel, new THREE.Vector3(0, -.01, 0), new THREE.Vector3(1.1, .08, .2)),
        solid(cone, steel, new THREE.Vector3(.5, -.01, 0), new THREE.Vector3(.22, .08, .22)));
      return { ...make(g, Math.PI), turnLast: true };
    }
    if (f.kind === 'dowel') return make(solid(rod, brass, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.4, 3.5, .4)));
    if (f.kind === 'nail') return make(screw(2, .08, steel));
    if (f.kind === 'pin') return make(solid(rod, brass, new THREE.Vector3(0, -.25, 0), new THREE.Vector3(.25, 1.6, .25)));
    if (f.kind === 'hinge') {
      // The hinge's cup pressed into the door, and its arm reaching from the cup to where its plate is on the side panel
      // (made just after it), so the door hung shows which plate each hinge clips onto.
      const plate = piece.fittings[item + 1]?.kind === 'plate' ? piece.fittings[item + 1]! : null;
      return make(hingeCupAndArmMesh(f, plate, dir, rod, box, steel));
    }
    // The plate on the panel over its two screws, a System 32 pitch apart: about 4 cm each way.
    // Cargo front brackets have their own 3D fitting mesh in make-fittings-3d.ts.
    if (f.kind === 'plate' && !f.size?.includes('cargo')) return make(mountingPlateMesh(box, steel));
    return null;
  }

  return {
    build(piece: MakePiece, meshOf: (board: number) => THREE.Object3D | undefined, rest: (board: number) => THREE.Vector3, root: THREE.Object3D) {
      this.clear();
      links = piece.fittings.map(f => f.boards);
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
        // It rides on the board it goes in through, so one fitted while that board lies on the floor goes in with it.
        const host = fastener.board === null ? undefined : meshOf(fastener.board);
        if (host) { fastener.home.sub(rest(fastener.board!)); host.add(fastener.group); } else root.add(fastener.group);
        fastener.group.traverse(o => { if (o instanceof THREE.Mesh) originals.set(o, o.material); });
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
        // It grows into view where it waits, at the end of its dashed line, then goes in along it (a screw turning; a
        // cam pushed home, then turned).
        const e = ease(f.turnLast ? Math.min(1, p / .55) : p), turn = f.turnLast ? ease(Math.max(0, (p - .55) / .45)) : e, seen = ease(film!.seen(f.item));
        f.group.position.copy(f.home).addScaledVector(f.dir, -(1 - e) * WAIT);
        f.group.quaternion.setFromUnitVectors(Y, f.dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, turn * f.spin));
        f.group.scale.setScalar(Math.max(.01, seen) * (1 + (VIS - 1) * (1 - e)));
      }
    },
    /** Highlight the actual fasteners joining an inspected component, at their current timeline transforms. */
    focus(boards: ReadonlySet<number> | null) {
      for (const f of fasteners) {
        const selected = boards && links[f.item]?.some(i => boards.has(i));
        f.group.traverse(o => { if (o instanceof THREE.Mesh) o.material = selected ? highlight : originals.get(o)!; });
      }
    },
    clear() {
      for (const o of [...bits.map(b => b.mesh), ...fasteners.map(f => f.group)]) o.parent?.remove(o);
      bits = []; fasteners = []; originals.clear(); links = [];
    },
    dispose() {
      this.clear();
      for (const g of [rod, cone, box]) g.dispose();
      steel.dispose(); brass.dispose(); drill.dispose(); highlight.dispose();
    },
  };
}
