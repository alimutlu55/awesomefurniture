import * as THREE from 'three';
import type { Fitting, Hole } from '../../domain/make/make-joints';
import type { MakePiece } from '../../domain/make/make-parts';
import { WAIT } from '../../domain/make/make-fixing';
import { drawerRunnerMeshes } from './drawer-runner-3d';
import { cargoPulloutGeometry } from '../../domain/kitchen/cargo-pullout';

/**
 * What is drilled and bought, drawn in Make's 3D: every hole as a dark ring at its mouth, and the hardware a maker can
 * see on a finished piece (handles, hanging rails, runners, legs, hangers and wall brackets). A hole or fitting held by
 * one board rides on that board's mesh, so it moves with it when the piece is taken apart.
 */

const INK = 0x2b2a26, METAL = 0x9ea2a8;
const Y = new THREE.Vector3(0, 1, 0), AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

export interface FittingsLayer {
  /** Builds the holes and hardware; `meshOf(i)` is board i's mesh and `rest(i)` where it stands assembled. */
  build(piece: MakePiece, meshOf: (board: number) => THREE.Object3D | undefined, rest: (board: number) => THREE.Vector3, root: THREE.Object3D): void;
  /** The film of the assembly at one moment: which holes are drilled, and how far each fitting has come in (null: not
   * yet; 0 waiting at the end of its line, 1 home) and into view (`seen`, 0 to 1); or everything, home (null). */
  only(hole: ((index: number) => boolean) | null, fitting: ((index: number) => number | null) | null, seen?: (index: number) => number): void;
  /** Hides the holes of every board but this part's (null: every board's holes show). */
  focus(boards: ReadonlySet<number> | null): void;
  /** Rings these holes, by their place in the piece's hole list: a halo round each, seen through the boards (null: none). */
  ring(holes: ReadonlySet<number> | null): void;
  /** The room the ringed holes take, in world space, with `margin` cm round them; null when none is ringed. */
  ringExtent(margin: number): THREE.Box3 | null;
  motion(): void;
  clear(): void;
  dispose(): void;
}

export function createMakeFittings(layer: number): FittingsLayer {
  const ring = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), disc = new THREE.CylinderGeometry(1, 1, 1, 18);
  const bar = new THREE.BoxGeometry(1, 1, 1), rod = new THREE.CylinderGeometry(1, 1, 1, 14);
  const holeMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide });
  const metal = new THREE.MeshLambertMaterial({ color: METAL, emissive: 0x3a3c40, emissiveIntensity: .4 });
  const highlight = new THREE.MeshLambertMaterial({ color: 0x4976ad, emissive: 0x243b56, emissiveIntensity: .5 });
  // A ringed hole: a halo 12 mm out from its edge, drawn over the boards so it shows wherever the hole is.
  const halo = new THREE.TorusGeometry(1, .2, 8, 40).rotateX(Math.PI / 2), HALO = 1.2;
  const ringed = new THREE.MeshBasicMaterial({ color: 0x4976ad, depthTest: false, transparent: true });
  let links: readonly (readonly number[])[] = [];
  let slides: { mesh: THREE.Object3D; moving: THREE.Object3D; rest: number; home: number; max: number; ratio: number }[] = [];
  let holes: { mesh: THREE.Mesh; board: number; index: number; size: THREE.Vector3; geometry: THREE.BufferGeometry }[] = [];
  let fittings: { mesh: THREE.Object3D; index: number; board: number | null; home: THREE.Vector3; from: THREE.Vector3; size: THREE.Vector3 }[] = [];
  const fromFor = (kind: string) => kind === 'leg' ? new THREE.Vector3(0, -1, 0) : kind === 'hanger' || kind === 'bracket' ? new THREE.Vector3(0, 0, -1)
    : kind === 'runner' ? new THREE.Vector3() : new THREE.Vector3(0, 0, 1);
  let shown: ((index: number) => boolean) | null = null, shownFittings: ((index: number) => number | null) | null = null, focused: ReadonlySet<number> | null = null;
  let seenFittings: ((index: number) => number) | null = null, rung: ReadonlySet<number> | null = null;

  const tag = <T extends THREE.Object3D>(o: T): T => { o.traverse(c => { c.layers.set(layer); c.userData.make = true; c.raycast = () => undefined; }); return o; };
  /** A mesh of `geometry` (unit size) scaled to `size`, its y axis along `axis`, centred at `at`. */
  function solid(geometry: THREE.BufferGeometry, material: THREE.Material, at: THREE.Vector3, size: THREE.Vector3, axis = Y) {
    const m = new THREE.Mesh(geometry, material);
    m.scale.copy(size);
    m.quaternion.setFromUnitVectors(Y, axis);
    m.position.copy(at);
    return tag(m);
  }
  const frame = (piece: MakePiece, p: readonly number[]) => new THREE.Vector3(p[0]! - piece.size.w / 2, p[1]!, p[2]! - piece.size.d / 2);

  function holeMesh(piece: MakePiece, h: Hole) {
    // A ring as wide as the hole and 1.5 mm into the board from its mouth, so it reads on the face from any side.
    const r = h.d / 20, axis = AXES[h.axis]!.clone().multiplyScalar(h.sign), at = frame(piece, h.at).addScaledVector(axis, .07);
    return solid(r > .6 ? ring : disc, holeMaterial, at, new THREE.Vector3(r, .15, r), axis);
  }
  function fittingMesh(piece: MakePiece, f: Fitting): THREE.Object3D | null {
    const at = frame(piece, f.at), size = Number(f.size) / 10;
    if (f.kind === 'handle') {
      // A bar 128 mm between centres standing 30 mm proud of the front, upright on a door, level on a drawer.
      const door = piece.holes.some(h => h.kind === 'handle' && Math.abs(h.at[0] - f.at[0]) < .01 && Math.abs(h.at[1] - f.at[1]) > 1);
      const g = new THREE.Group(), along = door ? Y : AXES[0]!;
      g.add(solid(rod, metal, at.clone().add(new THREE.Vector3(0, 0, 3)), new THREE.Vector3(.6, 16, .6), along));
      for (const s of [-6.4, 6.4]) g.add(solid(rod, metal, at.clone().addScaledVector(along, s).add(new THREE.Vector3(0, 0, 1.5)), new THREE.Vector3(.4, 3, .4), AXES[2]));
      return tag(g);
    }
    if (f.kind === 'rail' && !f.size?.includes('cargo')) return solid(rod, metal, at, new THREE.Vector3(1.25, size, 1.25), AXES[0]);
    if (f.kind === 'leg') return solid(rod, metal, at.clone().setY(at.y + size / 2), new THREE.Vector3(2.2, size, 2.2));
    if (f.kind === 'support' && (f.size?.includes('cargo frame') || f.size?.includes('cargo pull-out'))) {
      const parts = f.size.split(':'), tiers = Number(parts[1]) || 2, style = parts[2] === 'solid' ? 'solid' : 'wire';
      const b = piece.boards[f.boards[0]!] ?? piece.boards.find(q => q.name === 'Cargo front');
      const w = b ? b.x1 - b.x0 : 30, h = b ? b.y1 - b.y0 : 74, d = piece.size.d;
      const geo = cargoPulloutGeometry(f.at[0], b?.y0 ?? f.at[1] - h / 2, w, h, d, { tiers, basketStyle: style, isTall: h >= 100 });
      const g = new THREE.Group();
      // Upright steel tubes
      for (const u of geo.frame.uprights) {
        g.add(solid(bar, metal, frame(piece, [(u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, (u.z0 + u.z1) / 2]), new THREE.Vector3(u.x1 - u.x0, u.y1 - u.y0, u.z1 - u.z0)));
      }
      // Structural crossbars and runner carrier plate
      for (const c of geo.frame.crossbars) {
        g.add(solid(bar, metal, frame(piece, [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2]), new THREE.Vector3(c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0)));
      }
      return tag(g);
    }
    if (f.kind === 'rail' && f.size?.includes('cargo basket')) {
      const parts = f.size.split(':'), style = parts[1] === 'solid' ? 'solid' : 'wire';
      const b = piece.boards[f.boards[0]!] ?? piece.boards.find(q => q.name === 'Cargo front');
      const w = b ? b.x1 - b.x0 : 30, h = b ? b.y1 - b.y0 : 74, d = piece.size.d;
      const tiers = h >= 100 ? 4 : 2;
      const geo = cargoPulloutGeometry(f.at[0], b?.y0 ?? f.at[1] - h / 2, w, h, d, { tiers, basketStyle: style, isTall: h >= 100 });
      const bkt = geo.baskets.find(bk => Math.abs(bk.base.y0 - f.at[1]) < 2) ?? geo.baskets[0];
      if (!bkt) return null;
      const g = new THREE.Group();
      const bw = bkt.base.x1 - bkt.base.x0, bd = bkt.base.z1 - bkt.base.z0, bz = (bkt.base.z0 + bkt.base.z1) / 2;
      // Basket base plate (wire mesh or solid Arena panel)
      g.add(solid(bar, metal, frame(piece, [(bkt.base.x0 + bkt.base.x1) / 2, (bkt.base.y0 + bkt.base.y1) / 2, bz]), new THREE.Vector3(bw, bkt.base.y1 - bkt.base.y0, bd)));
      // Safety perimeter railing
      const rw = bkt.rail.x1 - bkt.rail.x0, rd = bkt.rail.z1 - bkt.rail.z0, ry = bkt.rail.y1;
      g.add(solid(bar, metal, frame(piece, [f.at[0], ry, bz + bd / 2]), new THREE.Vector3(rw, .3, .3)));
      g.add(solid(bar, metal, frame(piece, [f.at[0], ry, bz - bd / 2]), new THREE.Vector3(rw, .3, .3)));
      g.add(solid(bar, metal, frame(piece, [f.at[0] - rw / 2, ry, bz]), new THREE.Vector3(.3, .3, rd)));
      g.add(solid(bar, metal, frame(piece, [f.at[0] + rw / 2, ry, bz]), new THREE.Vector3(.3, .3, rd)));
      // Frame clip-on hooks
      for (const s of [-rw / 2 + .4, rw / 2 - .4]) {
        g.add(solid(bar, metal, frame(piece, [f.at[0] + s, (bkt.base.y0 + ry) / 2, bz]), new THREE.Vector3(.4, ry - bkt.base.y0, .6)));
      }
      return tag(g);
    }
    if ((f.kind === 'bracket' || f.kind === 'plate') && f.size?.includes('cargo')) {
      const g = new THREE.Group();
      g.add(solid(bar, metal, at.clone().setZ(at.z - .2), new THREE.Vector3(5, 1.8, .4)));
      g.add(solid(bar, metal, at.clone().setZ(at.z - 1.2), new THREE.Vector3(1.2, 1.4, 2)));
      return tag(g);
    }
    if (f.kind === 'hanger' || f.kind === 'bracket') return solid(bar, metal, at.clone().setZ(at.z - .5), new THREE.Vector3(f.kind === 'hanger' ? 6 : 4, 4, 1));
    if (f.kind === 'support') return solid(disc, metal, at, new THREE.Vector3(2, .4, 2), AXES[0]);
    return null;
  }
  function visible() {
    for (const h of holes) {
      const on = !!rung?.has(h.index);
      h.mesh.visible = (!shown || shown(h.index)) && (!focused || focused.has(h.board));
      h.mesh.material = on ? ringed : holeMaterial;
      h.mesh.geometry = on ? halo : h.geometry;
      h.mesh.renderOrder = on ? 10 : 0;
      if (on) h.mesh.scale.setScalar(h.size.x + HALO); else h.mesh.scale.copy(h.size);
    }
    for (const f of fittings) {
      // Coming in: growing into view where it waits at the end of its line (a handle in front, a leg below), easing home.
      const p = shownFittings ? shownFittings(f.index) : 1, seen = seenFittings?.(f.index) ?? 1;
      f.mesh.visible = p !== null;
      if (f.mesh instanceof THREE.Mesh) f.mesh.material = focused && links[f.index]?.some(i => focused!.has(i)) ? highlight : metal;
      f.mesh.position.copy(f.home).addScaledVector(f.from, (1 - (p ?? 1)) ** 3 * WAIT);
      f.mesh.scale.copy(f.size).multiplyScalar(Math.max(.01, 1 - (1 - seen) ** 3));
    }
    applyMotion();
  }

  function applyMotion() {
    for (const rail of slides) {
      const inStaging = Math.abs(rail.moving.quaternion.w - 1) > 0.05 || rail.moving.position.y < 5;
      const delta = inStaging ? 0 : Math.max(0, Math.min(rail.max, rail.moving.position.z - rail.rest));
      rail.mesh.position.z = rail.home + delta * rail.ratio;
    }
  }

  return {
    build(piece, meshOf, rest, root) {
      this.clear();
      links = piece.fittings.map(f => f.boards);
      piece.holes.forEach((h, index) => {
        const host = meshOf(h.board);
        if (!host) return;
        const mesh = holeMesh(piece, h);
        mesh.position.sub(rest(h.board));
        host.add(mesh);
        holes.push({ mesh, board: h.board, index, size: mesh.scale.clone(), geometry: mesh.geometry });
      });
      piece.fittings.forEach((f, index) => {
        if (f.kind === 'runner') {
          for (const rail of drawerRunnerMeshes(piece, f, bar, metal)) {
            const i = rail.board, host = meshOf(i), mesh = tag(rail.mesh);
            if (!host) continue;
            mesh.position.sub(rest(i));
            host.add(mesh);
            fittings.push({ mesh, index, board: i, home: mesh.position.clone(), from: fromFor('runner'), size: mesh.scale.clone() });
            const moving = rail.moving === undefined ? undefined : meshOf(rail.moving);
            if (moving && rail.moving !== undefined) slides.push({ mesh, moving, rest: rest(rail.moving).z,
              home: mesh.position.z, ratio: rail.ratio ?? 0, max: Number(f.size) / 10 * .7 });
          }
          return;
        }
        const mesh = fittingMesh(piece, f);
        if (!mesh) return;
        // Handles and cargo brackets ride on their front; cargo chassis and baskets stay with the piece.
        const isCargoBracket = (f.kind === 'bracket' || f.kind === 'plate') && f.size?.includes('cargo');
        const isCargoChassis = (f.kind === 'support' || f.kind === 'rail') && f.size?.includes('cargo');
        const board = (f.kind === 'handle' || isCargoBracket) ? f.boards[0] ?? null : null, host = board === null ? undefined : meshOf(board);
        if (host && board !== null) { mesh.position.sub(rest(board)); host.add(mesh); } else root.add(mesh);
        fittings.push({ mesh, index, board: host ? board : null, home: mesh.position.clone(), from: fromFor(f.kind), size: mesh.scale.clone() });
        if (isCargoChassis) {
          const frontIdx = f.boards[0] ?? piece.boards.findIndex(q => q.name === 'Cargo front');
          const moving = frontIdx >= 0 ? meshOf(frontIdx) : undefined;
          if (moving && frontIdx >= 0) {
            const runner = piece.fittings.find(r => r.runner);
            slides.push({
              mesh,
              moving,
              rest: rest(frontIdx).z,
              home: mesh.position.z,
              ratio: 1,
              max: Number(runner?.size ?? 450) / 10 * .7,
            });
          }
        }
      });
      visible();
    },
    only(boards, items, seen) { shown = boards; shownFittings = items; seenFittings = seen ?? null; visible(); },
    motion() { applyMotion(); },
    focus(boards) { focused = boards; visible(); },
    ring(next) { rung = next; visible(); },
    ringExtent(margin) {
      const on = holes.filter(h => rung?.has(h.index));
      if (!on.length) return null;
      const box = new THREE.Box3();
      for (const h of on) box.expandByPoint(h.mesh.getWorldPosition(new THREE.Vector3()));
      return box.expandByScalar(margin);
    },
    clear() {
      for (const o of [...holes.map(h => h.mesh), ...fittings.map(f => f.mesh)]) o.parent?.remove(o);
      holes = []; fittings = []; slides = []; links = []; focused = null; rung = null;
    },
    dispose() {
      this.clear();
      for (const g of [ring, disc, bar, rod, halo]) g.dispose();
      holeMaterial.dispose(); metal.dispose(); highlight.dispose(); ringed.dispose();
    },
  };
}
