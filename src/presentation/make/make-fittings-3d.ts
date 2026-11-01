import * as THREE from 'three';
import type { Fitting, Hole } from '../../domain/make/make-joints';
import type { MakePiece } from '../../domain/make/make-parts';

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
  /** Shows only the holes and fittings that pass (the film of the assembly at one moment), or everything (null). */
  only(hole: ((index: number) => boolean) | null, fitting: ((index: number) => boolean) | null): void;
  /** Hides the holes of every board but this part's (null: every board's holes show). */
  focus(boards: ReadonlySet<number> | null): void;
  clear(): void;
  dispose(): void;
}

export function createMakeFittings(layer: number): FittingsLayer {
  const ring = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), disc = new THREE.CylinderGeometry(1, 1, 1, 18);
  const bar = new THREE.BoxGeometry(1, 1, 1), rod = new THREE.CylinderGeometry(1, 1, 1, 14);
  const holeMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide });
  const metal = new THREE.MeshLambertMaterial({ color: METAL, emissive: 0x3a3c40, emissiveIntensity: .4 });
  let holes: { mesh: THREE.Object3D; board: number; index: number }[] = [], fittings: { mesh: THREE.Object3D; index: number; board: number | null }[] = [];
  let shown: ((index: number) => boolean) | null = null, shownFittings: ((index: number) => boolean) | null = null, focused: ReadonlySet<number> | null = null;

  const tag = (o: THREE.Object3D) => { o.traverse(c => { c.layers.set(layer); c.userData.make = true; c.raycast = () => undefined; }); return o; };
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
    if (f.kind === 'rail') return solid(rod, metal, at, new THREE.Vector3(1.25, size, 1.25), AXES[0]);
    if (f.kind === 'support') return solid(disc, metal, at, new THREE.Vector3(2, .4, 2), AXES[0]);
    if (f.kind === 'leg') return solid(rod, metal, at.clone().setY(at.y + size / 2), new THREE.Vector3(2.2, size, 2.2));
    if (f.kind === 'hanger' || f.kind === 'bracket') return solid(bar, metal, at.clone().setZ(at.z - .5), new THREE.Vector3(f.kind === 'hanger' ? 6 : 4, 4, 1));
    return null;
  }
  function visible() {
    for (const h of holes) h.mesh.visible = (!shown || shown(h.index)) && (!focused || focused.has(h.board));
    for (const f of fittings) f.mesh.visible = !shownFittings || shownFittings(f.index);
  }

  return {
    build(piece, meshOf, rest, root) {
      this.clear();
      piece.holes.forEach((h, index) => {
        const host = meshOf(h.board);
        if (!host) return;
        const mesh = holeMesh(piece, h);
        mesh.position.sub(rest(h.board));
        host.add(mesh);
        holes.push({ mesh, board: h.board, index });
      });
      piece.fittings.forEach((f, index) => {
        if (f.kind === 'runner') {
          // A pair: one on the outer face of each side of the box, as long as the runner, riding on that side.
          const left = f.boards[0]!, box = piece.boards[left]!, len = Number(f.size) / 10;
          const right = piece.boards.map((b, i) => ({ b, i })).filter(({ b }) => b.name === 'Box side' && b.x0 > box.x0 && Math.abs(b.y0 - box.y0) < .01 && Math.abs(b.z0 - box.z0) < .01)
            .sort((p, q) => p.b.x0 - q.b.x0)[0]?.i;
          for (const i of right === undefined ? [left] : [left, right]) {
            const b = piece.boards[i]!, host = meshOf(i), x = i === left ? b.x0 - .62 : b.x1 + .62;
            if (!host) continue;
            const mesh = solid(bar, metal, frame(piece, [x, b.y0 + 3.2, b.z1 - len / 2]), new THREE.Vector3(1.25, 3.5, len));
            mesh.position.sub(rest(i));
            host.add(mesh);
            fittings.push({ mesh, index, board: i });
          }
          return;
        }
        const mesh = fittingMesh(piece, f);
        if (!mesh) return;
        // Handles ride on their front; the rest stay with the piece.
        const board = f.kind === 'handle' ? f.boards[0] ?? null : null, host = board === null ? undefined : meshOf(board);
        if (host && board !== null) { mesh.position.sub(rest(board)); host.add(mesh); } else root.add(mesh);
        fittings.push({ mesh, index, board: host ? board : null });
      });
      visible();
    },
    only(boards, items) { shown = boards; shownFittings = items; visible(); },
    focus(boards) { focused = boards; visible(); },
    clear() {
      for (const o of [...holes.map(h => h.mesh), ...fittings.map(f => f.mesh)]) o.parent?.remove(o);
      holes = []; fittings = [];
    },
    dispose() {
      this.clear();
      for (const g of [ring, disc, bar, rod]) g.dispose();
      holeMaterial.dispose(); metal.dispose();
    },
  };
}
