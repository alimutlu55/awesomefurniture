import { cargoRunnerMeshes } from './cargo-runners-3d';
import * as THREE from 'three';
import type { Fitting, Hole } from '../../domain/make/make-joints';
import type { MakePiece } from '../../domain/make/make-parts';
import { WAIT } from '../../domain/make/make-fixing';
import { drawerRunnerMeshes } from './drawer-runner-3d';
import { cargoPulloutGeometry } from '../../domain/kitchen/cargo-pullout';
import { hardwareStagingLayout, stagingLayout } from '../../domain/make/make-staging';
import { makeFittingHandleMesh, railEndSupportMesh, railTubeMesh } from '../viewport/hardware';

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
  motion(nudge?: (board: number) => readonly [number, number, number]): void;
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
  let frontStepItems: number[] = [];
  let slides: { mesh: THREE.Object3D; moving: THREE.Object3D; movingBoard?: number; rest: number; home: number; max: number; ratio: number }[] = [];
  let holes: { mesh: THREE.Mesh; board: number; index: number; size: THREE.Vector3; geometry: THREE.BufferGeometry }[] = [];
  let fittings: {
    mesh: THREE.Object3D;
    index: number;
    board: number | null;
    home: THREE.Vector3;
    from: THREE.Vector3;
    size: THREE.Vector3;
    staged?: { pos: THREE.Vector3; rot: THREE.Quaternion } | undefined;
    hook?: { pivot: THREE.Vector3 };
    placement?: THREE.Vector3;
  }[] = [];
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
      return tag(makeFittingHandleMesh(piece, f, at, metal));
    }
    if (f.kind === 'rail' && !f.size?.includes('cargo')) return tag(railTubeMesh(at, size, rod, metal));
    if (f.kind === 'leg') return solid(rod, metal, at.clone().setY(at.y + size / 2), new THREE.Vector3(2.2, size, 2.2));
    if (f.kind === 'support' && (f.size?.includes('cargo frame') || f.size?.includes('cargo pull-out'))) {
      const parts = f.size.split(':'), tiers = Number(parts[1]) || 2, style = parts[2] === 'solid' ? 'solid' : 'wire';
      const b = piece.boards[f.boards[0]!] ?? piece.boards.find(q => q.name === 'Cargo front');
      const w = b ? b.x1 - b.x0 : 30, h = b ? b.y1 - b.y0 : 74, d = piece.size.d;
      const geo = f.cargo ?? cargoPulloutGeometry(f.at[0], b?.y0 ?? f.at[1] - h / 2, w, h, d, { tiers, basketStyle: style, isTall: h >= 100 });
      const cFrame = frame(piece, [
        f.at[0],
        (geo.frame.uprights[0]!.y0 + geo.frame.uprights[0]!.y1) / 2,
        (geo.runners.bottom.z0 + geo.runners.bottom.z1) / 2,
      ]);
      const g = new THREE.Group();
      g.position.copy(cFrame);
      // Upright steel tubes
      for (const u of geo.frame.uprights) {
        const uPos = frame(piece, [(u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, (u.z0 + u.z1) / 2]).sub(cFrame);
        g.add(solid(bar, metal, uPos, new THREE.Vector3(u.x1 - u.x0, u.y1 - u.y0, u.z1 - u.z0)));
      }
      // Structural crossbars and runner carrier plate
      for (const c of geo.frame.crossbars) {
        const cPos = frame(piece, [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2]).sub(cFrame);
        g.add(solid(bar, metal, cPos, new THREE.Vector3(c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0)));
      }
      return tag(g);
    }
    if (f.kind === 'rail' && f.size?.includes('cargo basket')) {
      const parts = f.size.split(':'), style = parts[1] === 'solid' ? 'solid' : 'wire';
      const b = piece.boards[f.boards[0]!] ?? piece.boards.find(q => q.name === 'Cargo front');
      const w = b ? b.x1 - b.x0 : 30, h = b ? b.y1 - b.y0 : 74, d = piece.size.d;
      const tiers = Number(piece.fittings.find(q => q.kind === 'support' && q.size?.startsWith('cargo frame:'))?.size?.split(':')[1]) || (h >= 100 ? 4 : 2);
      const geo = f.cargo ?? cargoPulloutGeometry(f.at[0], b?.y0 ?? f.at[1] - h / 2, w, h, d, { tiers, basketStyle: style, isTall: h >= 100 });
      const bkt = geo.baskets.find(bk => Math.abs(bk.base.y0 - f.at[1]) < 2) ?? geo.baskets[0];
      if (!bkt) return null;
      const bw = bkt.base.x1 - bkt.base.x0, bd = bkt.base.z1 - bkt.base.z0, bz = (bkt.base.z0 + bkt.base.z1) / 2;
      const rw = bkt.rail.x1 - bkt.rail.x0, rd = bkt.rail.z1 - bkt.rail.z0, ry = bkt.rail.y1, midRailY = bkt.base.y0 + (ry - bkt.base.y0) * .45;
      const cBasket = frame(piece, [f.at[0], (bkt.base.y0 + ry) / 2, bz]);
      const g = new THREE.Group();
      g.position.copy(cBasket);
      if (style === 'solid') {
        g.add(solid(bar, metal, frame(piece, [(bkt.base.x0 + bkt.base.x1) / 2, (bkt.base.y0 + bkt.base.y1) / 2, bz]).sub(cBasket), new THREE.Vector3(bw, bkt.base.y1 - bkt.base.y0, bd)));
      } else {
        // Wire basket (1. Kosz 150/200): longitudinal bottom wires + cross-wires at 2–3 pręt and 16–17 pręt (192 mm span)
        const wireCount = Math.max(5, Math.round(bw / 1.8));
        for (let wIdx = 0; wIdx < wireCount; wIdx++) {
          const wx = bkt.base.x0 + .4 + (bw - .8) * (wIdx / Math.max(1, wireCount - 1));
          g.add(solid(bar, metal, frame(piece, [wx, bkt.base.y0 + .2, bz]).sub(cBasket), new THREE.Vector3(.22, .22, bd)));
        }
        for (const wz of [bkt.base.z1 - 3.0, bkt.base.z1 - 4.6, bz, bkt.base.z1 - 23.8, bkt.base.z0 + 2.5]) {
          if (wz > bkt.base.z0 && wz < bkt.base.z1) {
            g.add(solid(bar, metal, frame(piece, [f.at[0], bkt.base.y0 + .1, wz]).sub(cBasket), new THREE.Vector3(bw, .26, .26)));
          }
        }
      }
      // Double perimeter safety gallery railing (upper + lower wire rings)
      for (const railY of [ry, midRailY]) {
        g.add(solid(bar, metal, frame(piece, [f.at[0], railY, bz + bd / 2]).sub(cBasket), new THREE.Vector3(rw, .3, .3)));
        g.add(solid(bar, metal, frame(piece, [f.at[0], railY, bz - bd / 2]).sub(cBasket), new THREE.Vector3(rw, .3, .3)));
        g.add(solid(bar, metal, frame(piece, [f.at[0] - rw / 2, railY, bz]).sub(cBasket), new THREE.Vector3(.3, .3, rd)));
        g.add(solid(bar, metal, frame(piece, [f.at[0] + rw / 2, railY, bz]).sub(cBasket), new THREE.Vector3(.3, .3, rd)));
      }
      // Clip-on transverse wire divider (6. Separatory, Manual Pages 1 & 7)
      const sep = bkt.separator, sepZ = (sep.z0 + sep.z1) / 2;
      g.add(solid(bar, metal, frame(piece, [f.at[0], sep.y1 - .15, sepZ]).sub(cBasket), new THREE.Vector3(rw, .28, .28)));
      g.add(solid(bar, metal, frame(piece, [f.at[0], sep.y0 + .6, sepZ]).sub(cBasket), new THREE.Vector3(rw - .6, .24, .24)));
      for (const sx of [-rw / 2 + .15, rw / 2 - .15]) {
        g.add(solid(bar, metal, frame(piece, [f.at[0] + sx, (sep.y0 + sep.y1) / 2, sepZ]).sub(cBasket), new THREE.Vector3(.28, sep.y1 - sep.y0, .45)));
      }
      // Frame clip-on hooks
      for (const s of [-rw / 2 + .4, rw / 2 - .4]) {
        g.add(solid(bar, metal, frame(piece, [f.at[0] + s, (bkt.base.y0 + ry) / 2, bz]).sub(cBasket), new THREE.Vector3(.4, ry - bkt.base.y0, .6)));
      }
      return tag(g);
    }
    if ((f.kind === 'bracket' || f.kind === 'plate') && f.size?.includes('cargo')) {
      const g = new THREE.Group();
      g.position.copy(at);
      // Child 0: GTV Movix Mocowania frontu mounting plate (103.5 × 36.5 mm, 78 mm screw hole centres = ±3.9 cm)
      const basePlate = new THREE.Group();
      basePlate.add(solid(bar, metal, new THREE.Vector3(0, 0, -.18), new THREE.Vector3(10.35, 3.65, .35)));
      for (const sx of [-3.9, 3.9]) {
        basePlate.add(solid(ring, metal, new THREE.Vector3(sx, 0, -.36), new THREE.Vector3(.45, .12, .45), AXES[2]!));
      }
      g.add(basePlate);
      // Child 1: Open U-channel receiver (46 × 22 mm aperture accepts 44 × 20 mm frame tongue) + "GTV move" snap-on protective cover
      const receiver = new THREE.Group(); receiver.position.z = -1.4;
      for (const side of [-1, 1]) {
        receiver.add(solid(bar, metal, new THREE.Vector3(side * 2.65, 0, 0), new THREE.Vector3(.7, 2.8, 2.4)));
        receiver.add(solid(bar, metal, new THREE.Vector3(0, side * 1.25, 0), new THREE.Vector3(4.6, .3, 2.4)));
      }
      // Snap-on "GTV move" protective cover cap (Manual Page 1 Item 2 & Page 7 top diagram)
      receiver.add(solid(bar, metal, new THREE.Vector3(0, 0, -.95), new THREE.Vector3(5.2, 3.1, .22)));
      g.add(receiver);
      // Child 2: 3D lateral (⇄) & depth/tilt (⇕) adjustment and locking screws (Manual Page 6 diagrams 2 & 3)
      g.add(solid(disc, metal, new THREE.Vector3(1.5, 0, -1.4), new THREE.Vector3(.7, .3, .7), AXES[0]!));
      // Child 3: 3D vertical height (⇅) adjustment top screw (Manual Page 6 diagram 1)
      g.add(solid(disc, metal, new THREE.Vector3(0, 1.2, -1.4), new THREE.Vector3(.7, .3, .7), Y));
      return tag(g);
    }
    if (f.kind === 'hanger' || f.kind === 'bracket') return solid(bar, metal, at.clone().setZ(at.z - .5), new THREE.Vector3(f.kind === 'hanger' ? 6 : 4, 4, 1));
    if (f.kind === 'support') return tag(railEndSupportMesh(at, disc, metal));
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
      const p = shownFittings ? shownFittings(f.index) : 1, seen = seenFittings?.(f.index) ?? 1;
      if (f.staged) {
        f.mesh.visible = p !== null;
        if (p === null) {
          f.mesh.position.copy(f.staged.pos);
          f.mesh.quaternion.copy(f.staged.rot);
          f.mesh.scale.copy(f.size);
        } else if (p < 1) {
          const u = Math.max(0, Math.min(1, p));
          const progress = u * u * (3 - 2 * u);
          f.mesh.position.lerpVectors(f.staged.pos, f.home, progress);
          f.mesh.position.y += 20 * Math.sin(Math.PI * progress);
          f.mesh.quaternion.copy(f.staged.rot).slerp(new THREE.Quaternion(), progress);
          if (f.hook) {
            // Rest the front edge first, then lower the rear hooks into their seats.
            const angle = .22 * (1 - Math.max(0, (u - .8) / .2));
            const turn = new THREE.Quaternion().setFromAxisAngle(AXES[0]!, angle);
            const seat = f.home.clone().add(f.hook.pivot).sub(f.hook.pivot.clone().applyQuaternion(turn));
            const approach = Math.min(1, u / .8), ease = approach * approach * (3 - 2 * approach);
            f.mesh.position.lerpVectors(f.staged.pos, seat, ease);
            f.mesh.position.y += 20 * Math.sin(Math.PI * ease);
            f.mesh.quaternion.copy(f.staged.rot).slerp(turn, ease);
          }
          f.mesh.scale.copy(f.size);
        } else {
          f.mesh.position.copy(f.home);
          f.mesh.quaternion.identity();
          f.mesh.scale.copy(f.size);
        }
      } else {
        f.mesh.visible = p !== null;
        if (f.mesh instanceof THREE.Mesh) f.mesh.material = focused && links[f.index]?.some(i => focused!.has(i)) ? highlight : metal;
        f.mesh.position.copy(f.home).addScaledVector(f.from, (1 - (p ?? 1)) ** 3 * WAIT);
        f.mesh.scale.copy(f.size).multiplyScalar(Math.max(.01, 1 - (1 - seen) ** 3));
      }
      f.placement = f.mesh.position.clone();
    }
    applyMotion();
  }

  function applyMotion(nudge?: (board: number) => readonly [number, number, number]) {
    // Cabinet runner channels stay closed until the fronts / travel-test chapters engage them.
    const frontsStarted = !shownFittings || frontStepItems.length === 0 || frontStepItems.some(idx => shownFittings!(idx) !== null);
    for (const rail of slides) {
      const fitting = fittings.find(f => f.mesh === rail.mesh);
      const progress = shownFittings && fitting ? shownFittings(fitting.index) : 1;
      if (progress === null) continue;
      let delta = 0;
      if (rail.max < Infinity && !frontsStarted) {
        delta = 0;
      } else if (nudge && rail.movingBoard !== undefined) {
        delta = Math.max(0, Math.min(rail.max, nudge(rail.movingBoard)[2]));
      } else {
        const inStaging = Math.abs(rail.moving.quaternion.w - 1) > 0.05 || rail.moving.position.y < 5;
        delta = inStaging ? 0 : Math.max(0, Math.min(rail.max, rail.moving.position.z - rail.rest));
      }
      const p = fitting?.hook ? Math.min(1, progress / .8) : progress;
      const weight = p * p * (3 - 2 * p);
      rail.mesh.position.z = (fitting?.placement?.z ?? rail.home) + delta * rail.ratio * weight;
    }
  }

  return {
    build(piece, meshOf, rest, root) {
      this.clear();
      links = piece.fittings.map(f => f.boards);
      frontStepItems = piece.fittings
        .map((f, idx) => (f.purpose === 'drawer-front' || f.size === 'cargo front bracket' ? idx : -1))
        .filter(idx => idx >= 0);
      piece.holes.forEach((h, index) => {
        const host = meshOf(h.board);
        if (!host) return;
        const mesh = holeMesh(piece, h);
        mesh.position.sub(rest(h.board));
        host.add(mesh);
        holes.push({ mesh, board: h.board, index, size: mesh.scale.clone(), geometry: mesh.geometry });
      });
      const hwStaged = hardwareStagingLayout(piece, stagingLayout(piece, 0), 0);
      piece.fittings.forEach((f, index) => {
        const st = hwStaged.get(index);
        const staged = st ? {
          pos: frame(piece, st.at),
          rot: f.kind === 'support' && f.size?.includes('cargo frame')
            ? new THREE.Quaternion().setFromAxisAngle(AXES[0]!, -Math.PI / 2)
            : new THREE.Quaternion(),
        } : undefined;

        if (f.kind === 'runner') {
          for (const rail of (piece.boards[f.runner?.moving[0] ?? -1]?.name === 'Cargo front' ? cargoRunnerMeshes : drawerRunnerMeshes)(piece, f, bar, metal)) {
            const i = rail.board, host = meshOf(i), mesh = tag(rail.mesh);
            if (!host) continue;
            if (staged) {
              root.add(mesh);
              fittings.push({ mesh, index, board: null, home: mesh.position.clone(), from: fromFor('runner'), size: mesh.scale.clone(), staged });
            } else {
              mesh.position.sub(rest(i));
              host.add(mesh);
              fittings.push({ mesh, index, board: i, home: mesh.position.clone(), from: fromFor('runner'), size: mesh.scale.clone() });
            }
            const moving = rail.moving === undefined ? undefined : meshOf(rail.moving);
            if (moving && rail.moving !== undefined) slides.push({
              mesh, moving, movingBoard: rail.moving, rest: rest(rail.moving).z,
              home: mesh.position.z, ratio: rail.ratio ?? 0, max: Number(f.size) / 10 * .7,
            });
          }
          return;
        }
        const mesh = fittingMesh(piece, f);
        if (!mesh) return;
        if (staged) {
          // Align the rotated geometry's actual centre to its floor staging slot.
          const bounds = new THREE.Box3().setFromObject(mesh);
          const centre = bounds.getCenter(new THREE.Vector3()).sub(mesh.position).applyQuaternion(staged.rot);
          const size = bounds.getSize(new THREE.Vector3());
          const height = Math.abs(staged.rot.x) > .5 ? size.z : size.y;
          staged.pos.y = height / 2 - centre.y;
          staged.pos.x -= centre.x; staged.pos.z -= centre.z;
        }

        const isCargoBracket = (f.kind === 'bracket' || f.kind === 'plate') && f.size?.includes('cargo');
        const isCargoChassis = (f.kind === 'support' || f.kind === 'rail') && f.size?.includes('cargo');
        const frontIdx = piece.boards.findIndex(q => q.name === 'Cargo front' || q.stock === 'front');

        const cargoDoorFixing = isCargoBracket || f.purpose === 'drawer-front' && piece.boards[f.boards[0]!] ?.name === 'Cargo front';
        if (cargoDoorFixing) {
          const board = f.boards[0]!, host = meshOf(board);
          if (host) {mesh.position.sub(rest(board));host.add(mesh);}
          fittings.push({mesh,index,board,home:mesh.position.clone(),from:new THREE.Vector3(0,0,-1),size:mesh.scale.clone()});
        } else if (staged || isCargoChassis) {
          root.add(mesh);
          const bounds = new THREE.Box3().setFromObject(mesh);
          const hook = f.kind === 'rail' && f.size?.includes('cargo basket')
            ? {pivot:new THREE.Vector3(0,bounds.min.y-mesh.position.y,bounds.max.z-mesh.position.z)} : undefined;
          fittings.push({ mesh, index, board: null, home: mesh.position.clone(), from: fromFor(f.kind), size: mesh.scale.clone(),
            staged, ...(hook ? {hook} : {}) });
          if ((isCargoChassis || isCargoBracket) && frontIdx >= 0) {
            const moving = meshOf(frontIdx);
            if (moving) {
              slides.push({
                mesh,
                moving,
                movingBoard: frontIdx,
                rest: rest(frontIdx).z,
                home: mesh.position.z,
                ratio: 1,
                max: Infinity,
              });
            }
          }
        } else {
          const board = f.kind === 'handle' ? f.boards[0] ?? null : null, host = board === null ? undefined : meshOf(board);
          if (host && board !== null) { mesh.position.sub(rest(board)); host.add(mesh); } else root.add(mesh);
          fittings.push({ mesh, index, board: host ? board : null, home: mesh.position.clone(), from: fromFor(f.kind), size: mesh.scale.clone() });
        }
      });
      visible();
    },
    only(boards, items, seen) { shown = boards; shownFittings = items; seenFittings = seen ?? null; visible(); },
    motion(nudge) { applyMotion(nudge); },
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
      holes = []; fittings = []; slides = []; links = []; frontStepItems = []; focused = null; rung = null;
    },
    dispose() {
      this.clear();
      for (const g of [ring, disc, bar, rod, halo]) g.dispose();
      holeMaterial.dispose(); metal.dispose(); highlight.dispose(); ringed.dispose();
    },
  };
}
