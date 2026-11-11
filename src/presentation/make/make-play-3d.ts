import * as THREE from 'three';
import type { Fitting } from '../../domain/make/make-joints';
import { fittingTools } from '../../domain/hardware/hardware-registry';
import { entryOf, WAIT } from '../../domain/make/make-fixing';
import type { MakePiece } from '../../domain/make/make-parts';
import {
  camBoltMesh,
  camHousingMesh,
  dowelMesh,
  expandingDowelMesh,
  hingeCupAndArmMesh,
  mountingPlateMesh,
  screwFastenerMesh,
  shelfPinMesh,
} from '../viewport/hardware';

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
  /** Where a drawer board is now: on the mat, going onto its runners, or moved in the cabinet. */
  pose?(board: number): import('../../domain/make/drawer-film').DrawerPose;
  /** How far the runners under a drawer board are pulled out now (cm). */
  pull?(board: number): number;
  /** The mat the drawer boxes are built on, while it is down. */
  readonly mat?: import('../../domain/make/drawer-film').MatArea | null;
  /** How far the carcass lies down now: 1 on its front edges, 0 standing (make-timeline.ts lyingAt). */
  readonly tip?: number;
  /** Hardware points the actual camera should see; only intervening boards become translucent. */
  readonly targets?: readonly import('./assembly-visibility').AssemblyTarget[];
}

const STEEL = 0x555b62, BRASS = 0x9a7434, BIT = 0x2b2e33;
/** Hardware is drawn this much larger than life while it moves, so a 4 mm screw reads on a phone; it lands at its size. */
const VIS = 1.6;
const Y = new THREE.Vector3(0, 1, 0), AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const ease = (t: number) => 1 - (1 - t) ** 3;
/** The hammer, cm: its face square, its head long, its handle long and thick; it rises this high between blows, and
 * gives this many blows to drive one fastener home. */
const HAMMER = { face: 2.6, head: 9, handle: 28, grip: 1.3, lift: 7, blows: 3 } as const;
/** A fastener driven by blows: how far it is in (0 to 1) and how far the hammer's face stands off its head (cm). */
export function blows(p: number): { into: number; off: number } {
  const n = HAMMER.blows, k = Math.min(n - 1, Math.floor(p * n)), phase = p * n - k;
  // Raised over the first half, held, brought down at the end: the fastener moves in as the blow lands.
  const off = phase < .5 ? HAMMER.lift * (1 - (1 - phase / .5) ** 2) : phase < .8 ? HAMMER.lift : HAMMER.lift * (1 - (phase - .8) / .2);
  return { into: Math.min(1, (k + Math.max(0, (phase - .8) / .2)) / n), off: p >= 1 ? 0 : off };
}

interface Fastener {
  readonly group: THREE.Object3D; readonly item: number; readonly home: THREE.Vector3; readonly dir: THREE.Vector3; readonly spin: number; readonly board: number | null;
  /** Pushed home first, then turned (a cam), rather than turned as it goes in (a screw). */
  readonly turnLast?: boolean;
  /** Driven in by a hammer's blows (its hardware goes in with a hammer): it goes in a step at each blow. */
  readonly hammered?: boolean;
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
  const plastic = new THREE.MeshLambertMaterial({ color: 0xd9d6cf, emissive: 0x5a5852, emissiveIntensity: .45 });
  const beech = new THREE.MeshLambertMaterial({ color: 0xe2c48f, emissive: 0x4a3a20, emissiveIntensity: .4 });
  const wood = new THREE.MeshLambertMaterial({ color: 0xa8743f, emissive: 0x3a2814, emissiveIntensity: .45 });
  // The hammer that drives what goes in with one (one on screen at a time, at the fastener being driven): its face at
  // its origin striking along +y, its head behind it and the handle across.
  const hammer = new THREE.Group();
  hammer.add(solid(box, steel, new THREE.Vector3(0, -HAMMER.head / 2, 0), new THREE.Vector3(HAMMER.face, HAMMER.head, HAMMER.face)),
    solid(rod, wood, new THREE.Vector3(HAMMER.handle / 2, -HAMMER.head / 2, 0), new THREE.Vector3(HAMMER.grip, HAMMER.handle, HAMMER.grip), new THREE.Vector3(1, 0, 0)));
  hammer.visible = false;
  hammer.traverse(c => { c.layers.set(layer); c.userData.make = true; c.raycast = () => undefined; });
  const hammered = (f: Fitting) => fittingTools(f.kind, f.size).tools.includes('hammer');
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
  function fastenerOf(piece: MakePiece, f: Fitting, item: number): Fastener | null {
    const e = entryOf(piece, item);
    if (!e) return null;
    const home = new THREE.Vector3(e.at[0] - piece.size.w / 2, e.at[1], e.at[2] - piece.size.d / 2), dir = new THREE.Vector3(...e.dir);
    const make = (group: THREE.Object3D, spin = 0) => {
      group.quaternion.setFromUnitVectors(Y, dir);
      return { group: tag(group), item, home, dir, spin, board: e.board };
    };
    // Turned in through the face board's hole: its head ends flush with the face.
    if (f.kind === 'confirmat' || f.kind === 'screw') return make(screwFastenerMesh(f.kind, f.size, rod, cone, steel), 8 * Math.PI);
    if (f.kind === 'bolt') return make(camBoltMesh(rod, box, steel), 6 * Math.PI);
    if (f.kind === 'cam') return { ...make(camHousingMesh(rod, box, cone, brass, steel), Math.PI), turnLast: true };
    // An expanding dowel is the plastic one with a mushroom head, hammered through a drawer back; a wooden one is tapped in.
    if (f.kind === 'dowel') return { ...make(f.size?.includes('expanding') ? expandingDowelMesh(rod, plastic) : dowelMesh(rod, beech, box, cone)), hammered: hammered(f) };
    if (f.kind === 'nail') return { ...make(screwFastenerMesh('nail', f.size, rod, cone, steel)), hammered: hammered(f) };
    if (f.kind === 'pin') return make(shelfPinMesh(rod, brass));
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
      let striking: { f: Fastener; off: number } | null = null;
      for (const f of fasteners) {
        const p = film?.fit(f.item) ?? null;
        f.group.visible = p !== null;
        if (p === null) continue;
        // It grows into view where it waits, at the end of its dashed line, then goes in along it (a screw turning; a
        // cam pushed home, then turned; a dowel or nail driven a step at each hammer blow).
        const blow = f.hammered && p > 0 && p < 1 ? blows(p) : null;
        if (blow && !striking) striking = { f, off: blow.off };
        const e = blow ? blow.into : ease(f.turnLast ? Math.min(1, p / .55) : p), turn = f.turnLast ? ease(Math.max(0, (p - .55) / .45)) : e, seen = ease(film!.seen(f.item));
        f.group.position.copy(f.home).addScaledVector(f.dir, -(1 - e) * WAIT);
        f.group.quaternion.setFromUnitVectors(Y, f.dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, turn * f.spin));
        f.group.scale.setScalar(Math.max(.01, seen) * (1 + (VIS - 1) * (1 - e)));
      }
      // The hammer over the fastener being driven, on the same board, its face on the fastener's head as each blow lands.
      hammer.visible = !!striking;
      if (striking) {
        const { f, off } = striking;
        (f.group.parent ?? f.group).add(hammer);
        hammer.position.copy(f.group.position).addScaledVector(f.dir, -off - .4);
        // Its face along the way the fastener goes in, its handle turned to point as far up as it can, never into the floor.
        const host = f.group.parent ?? f.group, up = Y.clone().applyQuaternion(host.getWorldQuaternion(new THREE.Quaternion()).invert());
        const handle = up.sub(f.dir.clone().multiplyScalar(up.dot(f.dir)));
        if (handle.lengthSq() < 1e-4) handle.set(1, 0, 0).sub(f.dir.clone().multiplyScalar(f.dir.x));
        const face = new THREE.Quaternion().setFromUnitVectors(Y, f.dir), across = new THREE.Vector3(1, 0, 0).applyQuaternion(face);
        const spin = Math.atan2(across.clone().cross(handle.normalize()).dot(f.dir), across.dot(handle));
        hammer.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(f.dir, spin).multiply(face));
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
      for (const o of [...bits.map(b => b.mesh), ...fasteners.map(f => f.group), hammer]) o.parent?.remove(o);
      bits = []; fasteners = []; originals.clear(); links = [];
    },
    dispose() {
      this.clear();
      for (const g of [rod, cone, box]) g.dispose();
      steel.dispose(); brass.dispose(); drill.dispose(); highlight.dispose(); plastic.dispose(); wood.dispose(); beech.dispose();
    },
  };
}
