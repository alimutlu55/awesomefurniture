import type { Board } from '../drawings/cabinet-boards';
import type { PlacedPiece } from '../drawings/room-pieces';
import { piecefronts } from '../drawings/fronts';
import { BOLT_ENTRY, CAM_ENTRY, DOWEL_ENTRY, RUNNER_ENTRY } from '../hardware/hardware-registry';
import { resolveMaterials } from '../materials/configured-materials';
import { backFaceOf } from '../wardrobe/carcass';
import { PANEL } from '../wardrobe/catalog.js';
import { RUNNER_CLEARANCE, RUNNER_REAR_GAP, runnerForSpace } from '../wardrobe/drawer-runners';
import { centre, frontOf, uprightsAround } from './make-hardware';
import type { Fitting, Groove, Hole } from './make-joints';
import { thinAxis, type Vec3 } from './make-measures';

/**
 * Knock-down drawer boxes on bottom-mounted runners, built as flat-pack drawers are put together:
 *
 * 1. The front lies face down; cam bolts go into its inner face, and the bottom slides into its groove.
 * 2. Dowels go in, the sides go on over the bolts and dowels (the bottom in their grooves), and the cams are turned.
 * 3. The back, as wide as the box, is hooked over the edge of the bottom, swung into place, and fixed to the ends of the
 *    sides with expanding dowels hammered through it.
 * 4. On the cabinet: each runner is screwed to the side (two screws at the front, a peg at the rear); the drawer is
 *    lowered on, its back onto the runners' rear hooks and its bottom over their front pins, through a locking plate;
 *    a lever screwed onto each pin locks it.
 *
 * A wardrobe drawer's own front (its inner front) is the box front. A kitchen drawer, whose front is applied over the
 * carcass, has a box front of its own behind it, and the applied front is screwed on from inside the box.
 * Centimetres in the piece's frame: x from its left face, y up from the floor, z from its back.
 */

/** The bottom's groove: its lower edge this far above the lower edge of the box boards, this deep into each. */
export const BOTTOM_GROOVE = { fromEdge: 1.2, depth: .8 } as const;
/** The bottom: a 6 mm board captured in the groove. */
export const BOTTOM_THICKNESS = .6;
/** Joint stations on a box corner: this far from the side's lower and upper edges. */
const LOW = 3.2, HIGH = 2.5;
/** The lowest box that still takes its bottom's groove and one cam a corner: shallow drawers get a shallow box, never none. */
const MIN_TALL = 5;
/** The runner's front pin: through the bottom, this far inside the box side and behind the front's inner face. */
const PIN = { inside: 1.5, behind: (RUNNER_ENTRY.drilling[3]?.lineMm ?? 30) / 10 } as const;
const HOOK = RUNNER_ENTRY.drilling[2]!, PIN_HOLE = RUNNER_ENTRY.drilling[3]!;
const BOLT_HOLE = BOLT_ENTRY.drilling[0]!, CAM_HOLE = CAM_ENTRY.drilling[0]!, CAM_EDGE = CAM_ENTRY.drilling[1]!;
const CAM_LINE = (CAM_ENTRY.rules.systemLineMm ?? 34) / 10;
const DOWEL_FACE = DOWEL_ENTRY.drilling[0]!, DOWEL_EDGE = DOWEL_ENTRY.drilling[1]!;
const EXPANDING_THROUGH = DOWEL_ENTRY.drilling[4]!, EXPANDING_END = DOWEL_ENTRY.drilling[5]!;
const EXPANDING = DOWEL_ENTRY.variants?.find(v => v.key === 'expanding')?.sizeLabel ?? '8 × 30 expanding';

/** One drawer: its boards by their place in the piece's board list. `applied` is a kitchen drawer's own front. */
export interface DrawerBox {
  readonly front: number;
  readonly applied: number | null;
  readonly sides: readonly [number, number];
  readonly back: number;
  readonly bottom: number;
}

/** A box board, cut with its length along `grain` (0 across, 1 up, 2 front to back). */
function part(name: string, stock: Board['stock'], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, grain: 0 | 1 | 2, edges: string, decorId: string): Board {
  const e = [x1 - x0, y1 - y0, z1 - z0], order = [0, 1, 2].sort((a, b) => e[a]! - e[b]!), t = order[0]!;
  const along = grain === t ? order[2]! : grain, across = [0, 1, 2].find(a => a !== along && a !== t)!;
  return { name, stock, decorId, x0, x1, y0, y1, z0, z1, cut: { length: e[along]!, width: e[across]!, thickness: e[t]! }, edges, note: 'drawer box' };
}

/** Whether `f` is a front a drawer box is built behind: a wardrobe drawer's inner front, or a pull-out front. */
function drawerFront(f: Board, piece: PlacedPiece): boolean {
  const opening = frontOf(piecefronts(piece.design).fronts, f)?.opens;
  return f.name === 'Drawer front' || (f.stock === 'front' && opening === 'pull' && !f.name.startsWith('Cargo') && !f.name.startsWith('Pantry'));
}

/**
 * The boards of every drawer box: two sides, a back as wide as the box, a bottom in their grooves and, for an applied
 * front, a box front. 12.5 mm clear of each upright for the runner, as long as the runner, standing 15 mm above the
 * board under it on the runner's foot.
 */
export function drawerBoxes(piece: PlacedPiece, boards: readonly Board[]): Board[] {
  const { design } = piece, out: Board[] = [], h = design.h, T = PANEL;
  const m = resolveMaterials(design), decor = m.drawerDecorId ?? m.carcassDecorId, bottomDecor = m.backingDecorId ?? decor;
  const clearance = RUNNER_ENTRY.rules.clearanceMm, standoff = (clearance.standoff ?? 2) / 10;
  const bottomGap = (clearance.bottomGap ?? 15) / 10, topDrop = (clearance.topDrop ?? 40) / 10;
  const drawers: { f: Board; x0: number; x1: number; applied: boolean; face: number; zb: number; sideFront: number; lift: number; room: number; key: string }[] = [];
  for (const f of boards) {
    if (!drawerFront(f, piece)) continue;
    const [cx, cy] = centre(f), { left, right } = uprightsAround(boards, cx, cy, h);
    if (!left || !right) continue;
    const x0 = left.b.x1 + RUNNER_CLEARANCE, x1 = right.b.x0 - RUNNER_CLEARANCE;
    // A front at or proud of the carcass's front edge is applied; one inside it is the box's own front. The carcass edge is
    // the deeper upright's: a drawer stack's own side stops behind the fronts, as the boards between drawers do.
    const applied = f.z0 >= Math.max(left.b.z1, right.b.z1) - .01;
    const face = applied ? Math.min(f.z0, left.b.z1, right.b.z1) - standoff : f.z0;
    const length = runnerForSpace(face - backFaceOf(design) - RUNNER_REAR_GAP);
    if (length === undefined) continue;
    const across = boards.filter(b => b.stock === 'carcass' && thinAxis(b) === 'y' && b.x0 < x1 && b.x1 > x0);
    const floor = Math.max(f.y0, left.b.y0, ...across.filter(b => b.y1 <= cy).map(b => b.y1));
    const ceiling = Math.min(f.y1, left.b.y1, ...across.filter(b => b.y0 >= cy).map(b => b.y0));
    // Measured from the front: how far up it the box stands, on its runners clear of any board under it, and the room
    // over that up to the board over it.
    const lift = floor - f.y0 + bottomGap, room = ceiling - f.y0;
    const key = [x0, x1, f.y1 - f.y0, length, applied].map(v => typeof v === 'number' ? Math.round(v * 10) : v).join();
    drawers.push({ f, x0, x1, applied, face, zb: face - length, sideFront: applied ? face - T : face, lift, room, key });
  }
  // Drawers alike (the same width, front and runner) get the same box at the same place behind their fronts, as a maker
  // cuts them: the highest any stands, the lowest any is. In a stack the lowest drawer stands clear of the board under
  // the stack, so every box of the stack stands as high; its fronts are then drilled alike.
  for (const d of drawers) {
    const alike = drawers.filter(o => o.key === d.key), lift = Math.max(...alike.map(o => o.lift));
    const tall = Math.min(25, d.f.y1 - d.f.y0 - topDrop, ...alike.map(o => o.room - lift - bottomGap));
    const { f, x0, x1, applied, face, zb, sideFront } = d, ys = f.y0 + lift;
    // The groove for the bottom must be in the front: an inner front reaching too little below it gets a box front.
    if (x1 - x0 < 4 * T || sideFront - zb < 10 || tall < MIN_TALL) continue;
    const g = BOTTOM_GROOVE, yb = ys + g.fromEdge;
    if (applied) out.push(part('Box front', 'carcass', x0, x1, ys, ys + tall, face - T, face, 0, 'L1', decor));
    out.push(part('Box side', 'carcass', x0, x0 + T, ys, ys + tall, zb + T, sideFront, 2, 'L1', decor),
      part('Box side', 'carcass', x1 - T, x1, ys, ys + tall, zb + T, sideFront, 2, 'L1', decor),
      part('Box back', 'carcass', x0, x1, ys, ys + tall, zb, zb + T, 0, 'L1', decor),
      part('Box bottom', 'back', x0 + T - g.depth, x1 - T + g.depth, yb, yb + BOTTOM_THICKNESS, zb + T - g.depth, sideFront + g.depth, 0, '—', bottomDecor));
  }
  return out;
}

const overlaps = (a: Board, b: Board, axes: readonly (0 | 1 | 2)[]) => axes.every(k => {
  const lo = [a.x0, a.y0, a.z0][k]!, hi = [a.x1, a.y1, a.z1][k]!, lo2 = [b.x0, b.y0, b.z0][k]!, hi2 = [b.x1, b.y1, b.z1][k]!;
  return Math.min(hi, hi2) - Math.max(lo, lo2) > .05;
});

/** Every drawer in a board list: each bottom, with the sides, back and front around it. */
export function drawerGroups(boards: readonly Board[]): DrawerBox[] {
  const out: DrawerBox[] = [];
  boards.forEach((bottom, i) => {
    if (bottom.name !== 'Box bottom') return;
    const find = (test: (b: Board) => boolean) => boards.findIndex(test);
    const sides = boards.map((b, k) => ({ b, k })).filter(({ b }) => b.name === 'Box side' && Math.abs(b.y0 + BOTTOM_GROOVE.fromEdge - bottom.y0) < .01
      && b.z0 < bottom.z1 && b.z1 > bottom.z0 && b.x1 > bottom.x0 - 2 && b.x0 < bottom.x1 + 2).sort((p, q) => p.b.x0 - q.b.x0);
    // The back and a box front are as wide as the box: around the bottom, not in the next bay at the same height.
    const across = (b: Board) => b.x0 <= bottom.x0 + .01 && b.x1 >= bottom.x1 - .01 && b.x0 >= bottom.x0 - 5 && b.x1 <= bottom.x1 + 5;
    const back = find(b => b.name === 'Box back' && across(b) && Math.abs(b.y0 - sides[0]?.b.y0!) < .01 && Math.abs(b.z1 - bottom.z0 - BOTTOM_GROOVE.depth) < .01);
    if (sides.length !== 2 || back < 0) return;
    const [l, r] = [sides[0]!, sides[1]!], z = l.b.z1;
    const box = find(b => b.name === 'Box front' && across(b) && Math.abs(b.z0 - z) < .01 && Math.abs(b.y0 - l.b.y0) < .01);
    const inner = find(b => b.stock === 'front' && Math.abs(b.z0 - z) < .01 && b.x0 <= l.b.x0 + .01 && b.x1 >= r.b.x1 - .01 && overlaps(b, l.b, [1]));
    const front = box >= 0 ? box : inner;
    if (front < 0) return;
    const applied = box >= 0 ? find(b => b.stock === 'front' && b.z0 >= boards[box]!.z1 - .01 && b.z0 <= boards[box]!.z1 + 1 && overlaps(b, l.b, [1])
      && b.x0 <= l.b.x0 + .01 && b.x1 >= r.b.x1 - .01) : -1;
    out.push({ front, applied: applied >= 0 ? applied : null, sides: [l.k, r.k], back, bottom: i });
  });
  return out;
}

/** Where the bottom runs into `board`: the overlap of the two, as a groove cut in `board`. */
function groove(boards: readonly Board[], board: number, bottom: Board): Groove | null {
  const b = boards[board]!, lo: Vec3 = [Math.max(b.x0, bottom.x0), Math.max(b.y0, bottom.y0), Math.max(b.z0, bottom.z0)];
  const hi: Vec3 = [Math.min(b.x1, bottom.x1), Math.min(b.y1, bottom.y1), Math.min(b.z1, bottom.z1)];
  return hi.every((v, k) => v - lo[k]! > 1e-6) ? { board, lo, hi, kind: 'groove' } : null;
}

/**
 * The joints of every drawer box, the grooves its bottom slides into, the hook holes in its back and the pin holes and
 * locks under its bottom. Fittings say which step of building the drawer they belong to (`purpose`).
 */
export function drawerBoxJoints(boards: readonly Board[]) {
  const holes: Hole[] = [], fittings: Fitting[] = [], grooves: Groove[] = [], drawers = drawerGroups(boards);
  for (const d of drawers) {
    const bottom = boards[d.bottom]!, back = boards[d.back]!;
    for (const k of [d.front, ...d.sides, d.back]) { const g = groove(boards, k, bottom); if (g) grooves.push(g); }
    d.sides.forEach((s, n) => {
      const side = boards[s]!, sx = (side.x0 + side.x1) / 2, plane = side.z1, inner = n === 0 ? side.x1 : side.x0, into = n === 0 ? -1 : 1;
      const low = side.y0 + LOW, high = side.y1 - HIGH, stations = high - low >= 3 ? [low, high] : [(low + high) / 2];
      // Front corner: cam bolts into the front's inner face; the side goes on over them and its cams are turned.
      for (const y of stations) {
        const bolt = fittings.length;
        fittings.push({ kind: 'bolt', at: [sx, y, plane], axis: 2, boards: [d.front, s], size: BOLT_ENTRY.display.listLine.defaultSpec, purpose: 'box-front' });
        holes.push({ board: d.front, kind: 'bolt', at: [sx, y, plane], axis: 2, sign: 1, d: BOLT_HOLE.dMm, depth: BOLT_HOLE.depthMm, of: bolt },
          { board: s, kind: 'pilot', at: [sx, y, plane], axis: 2, sign: -1, d: CAM_EDGE.dMm, depth: CAM_EDGE.depthMm, of: bolt + 1 });
        const cam: Vec3 = [inner, y, plane - CAM_LINE];
        fittings.push({ kind: 'cam', at: cam, axis: 0, boards: [d.front, s], size: CAM_ENTRY.display.listLine.defaultSpec, purpose: 'box-sides' });
        holes.push({ board: s, kind: 'cam', at: cam, axis: 0, sign: into as 1 | -1, d: CAM_HOLE.dMm, depth: CAM_HOLE.depthMm, of: bolt + 1 });
      }
      // A wooden dowel between the bolts keeps the side in line with the front.
      if (stations.length > 1) {
        const at: Vec3 = [sx, (low + high) / 2, plane], dowel = fittings.length;
        fittings.push({ kind: 'dowel', at, axis: 2, boards: [d.front, s], size: DOWEL_ENTRY.display.listLine.defaultSpec, purpose: 'box-sides' });
        holes.push({ board: d.front, kind: 'dowel', at, axis: 2, sign: 1, d: DOWEL_FACE.dMm, depth: DOWEL_FACE.depthMm, of: dowel },
          { board: s, kind: 'dowel', at, axis: 2, sign: -1, d: DOWEL_EDGE.dMm, depth: DOWEL_EDGE.depthMm, of: dowel });
      }
      // Back corner: expanding dowels hammered through the back into the side's end.
      for (const y of stations) {
        const at: Vec3 = [sx, y, back.z0], dowel = fittings.length;
        fittings.push({ kind: 'dowel', at, axis: 2, boards: [d.back, s], size: EXPANDING, purpose: 'box-back' });
        holes.push({ board: d.back, kind: 'dowel', at, axis: 2, sign: 1, d: EXPANDING_THROUGH.dMm, depth: EXPANDING_THROUGH.depthMm, of: dowel },
          { board: s, kind: 'dowel', at: [sx, y, back.z1], axis: 2, sign: 1, d: EXPANDING_END.dMm, depth: EXPANDING_END.depthMm, of: dowel });
      }
      // The runner's rear hook goes into the back's lower edge over the side; its front pin up through the bottom.
      holes.push({ board: d.back, kind: 'runner', at: [sx, back.y0 + HOOK.lineMm / 10, back.z0], axis: 2, sign: 1, d: HOOK.dMm, depth: HOOK.depthMm });
      const pin: Vec3 = [n === 0 ? side.x1 + PIN.inside : side.x0 - PIN.inside, bottom.y0, plane - PIN.behind];
      holes.push({ board: d.bottom, kind: 'runner', at: pin, axis: 1, sign: 1, d: PIN_HOLE.dMm, depth: PIN_HOLE.depthMm });
      fittings.push({ kind: 'drawerLock', at: [pin[0], pin[1] - .1, pin[2]], axis: 1, boards: [d.bottom], size: 'plate', purpose: 'drawer-plate' },
        { kind: 'drawerLock', at: [pin[0], pin[1] - .7, pin[2]], axis: 1, boards: [d.bottom], size: 'lever', purpose: 'drawer-lock' });
    });
  }
  return { holes, fittings, grooves, drawers };
}
