import type { Board } from '../drawings/cabinet-boards';
import { resolveAssemblyStages } from '../hardware/hardware-registry';
import type { AssemblyStage } from '../hardware/hardware-types';
import type { DrawerBox } from './drawer-box';
import type { Construction, JointSystem } from './make-construction';
import { type Axis, connectorStations, type Joint, hi, isTilted, lo } from './make-joints';
import { thinAxis, type Vec3 } from './make-measures';

/**
 * The order a piece is built in, worked out from its boards and joints rather than written per product, and the
 * connector each joint can really be made with in that order.
 *
 * A carcass goes together from the left: the left side, what stands against it, the next upright closing that bay, and
 * so on to the right side, each bay from the bottom up; then the top; then the back. That order is the one in which
 * every board still has a free way in: a shelf is pushed against the upright already standing and the next upright
 * closes onto its other end, so nothing ever has to go between two boards that are both fixed. It follows from one
 * rule on every joint: the board on the left, underneath or behind is placed first.
 *
 * For each joint the piece's connector is used when it can be: a screw when its head can be reached with a driver when
 * the later board goes in, a dowel or cam when the board can still travel onto it. Where it cannot (two shelves level
 * either side of a partition: the second one's screws would have to go in through the first), the joint takes the
 * other kind, and says why. A joint that can be made neither way is reported: the piece is not buildable as drawn.
 *
 * Centimetres in the piece's frame: x from its left face, y up from the floor, z from its back.
 */

export type Stage = AssemblyStage;
/** Every stage in the order resolved from the hardware registry's prerequisites. */
export const STAGES: readonly Stage[] = resolveAssemblyStages();

const AX = { x: 0, y: 1, z: 2 } as const;
const thin = (b: Board) => AX[thinAxis(b)];

/** A carcass board the build order is planned for: joined edge to face, not a front, a back, a loose shelf or a drawer. */
export const isStructural = (b: Board) => b.stock === 'carcass' && b.note !== 'drawer box' && b.note !== 'adjustable' && !isTilted(b);

/** The stages of a piece in the order they are done: a back slid into grooves goes in before the top closes them. */
export function stageOrder(construction: Construction): Stage[] {
  if (construction.back !== 'grooved') return [...STAGES];
  const rest = STAGES.filter(s => s !== 'back'), top = rest.indexOf('top');
  return [...rest.slice(0, top), 'back', ...rest.slice(top)];
}

export interface BuildSequence {
  /** The stages in the order this piece does them. */
  readonly stages: readonly Stage[];
  /** The stage each board is placed in, by its place in the piece's board list. */
  readonly stage: readonly Stage[];
  /** Each board's place in the order boards are put in, from 0. */
  readonly rank: readonly number[];
}

/**
 * The order the structural boards are placed in: every joint puts the board on the low side of it (left, underneath,
 * behind) before the board on its high side; among boards free to go, the leftmost first, then the lowest. Boards over
 * the whole piece (`last`) wait until the rest stands.
 */
function structuralOrder(boards: readonly Board[], joints: readonly Joint[], ids: readonly number[], last: ReadonlySet<number>): number[] {
  const mine = new Set(ids), before = new Map<number, Set<number>>(ids.map(i => [i, new Set<number>()]));
  for (const j of joints) {
    if (!mine.has(j.face) || !mine.has(j.edge)) continue;
    // The edge board is on the face board's high side (`side` +1) or its low side.
    const [first, then] = j.side > 0 ? [j.face, j.edge] : [j.edge, j.face];
    before.get(then)!.add(first);
  }
  const key = (i: number) => [last.has(i) ? 1 : 0, boards[i]!.x0, boards[i]!.y0, boards[i]!.z0, i];
  const compare = (a: number, b: number) => { const p = key(a), q = key(b), k = p.findIndex((v, n) => Math.abs(v - q[n]!) > 1e-9); return k < 0 ? 0 : p[k]! - q[k]!; };
  const out: number[] = [], left = new Set(ids);
  while (left.size) {
    const free = [...left].filter(i => ![...before.get(i)!].some(p => left.has(p)));
    // Boards that wait on each other (which the low-side rule cannot produce for boards that only touch) go in by place.
    const next = (free.length ? free : [...left]).sort(compare)[0]!;
    out.push(next); left.delete(next);
  }
  return out;
}

/**
 * The stage and place in the order of every board. The plinth frame; then the left side and the base (`carcass`);
 * the bays to the right side (`partitions`); the top; the back (before the top when it slides into grooves); what
 * rests or hangs inside; the drawers, built outside the piece; fronts and doors.
 */
export function buildSequence(boards: readonly Board[], joints: readonly Joint[], drawers: readonly DrawerBox[], construction: Construction): BuildSequence {
  const stages = stageOrder(construction), box = new Map<number, Stage>();
  for (const d of drawers) {
    box.set(d.front, 'drawer-boxes'); box.set(d.bottom, 'drawer-boxes'); box.set(d.back, 'drawer-back');
    for (const side of d.sides) box.set(side, 'drawer-sides');
  }
  const h = Math.max(...boards.map(b => b.y1)), ids = boards.map((_, i) => i), structural = ids.filter(i => isStructural(boards[i]!) && !box.has(i));
  const horizontals = structural.filter(i => thin(boards[i]!) === 1), base = horizontals.length ? Math.min(...horizontals.map(i => boards[i]!.y0)) : -1;
  const isTop = (i: number) => thin(boards[i]!) === 1 && boards[i]!.y1 >= h - .05;
  const order = structuralOrder(boards, joints, structural, new Set(structural.filter(isTop)));
  // The carcass stage stands the first upright and the first base board; the bays follow, to the right side.
  const lower = order.filter(i => !isTop(i)), firstBase = lower.findIndex(i => thin(boards[i]!) === 1 && Math.abs(boards[i]!.y0 - base) < .05);
  const firstUpright = lower.findIndex(i => thin(boards[i]!) === 0), opening = Math.max(firstBase, firstUpright, 0);
  const structuralStage = new Map<number, Stage>(lower.map((i, k) => [i, k <= opening ? 'carcass' : 'partitions']));
  const stage = boards.map((b, i): Stage => {
    const drawer = box.get(i);
    if (drawer) return drawer;
    if (b.stock === 'plinth') return 'plinth';
    if (b.stock === 'door') return 'doors';
    if (b.stock === 'front') return 'fronts';
    if (b.note === 'drawer box') return 'drawer-boxes';
    if (b.note === 'adjustable') return 'inside';
    if (b.stock === 'back') return 'back';
    if (isTilted(b)) return 'top';
    return structuralStage.get(i) ?? (isTop(i) ? 'top' : 'inside');
  });
  const placed = new Map(order.map((i, k) => [i, k]));
  const sorted = [...ids].sort((a, b) => stages.indexOf(stage[a]!) - stages.indexOf(stage[b]!) || (placed.get(a) ?? 0) - (placed.get(b) ?? 0) || a - b);
  const rank = ids.map(() => 0);
  sorted.forEach((i, k) => { rank[i] = k; });
  return { stages, stage, rank };
}

/** How a joint's connector goes in. */
export type JointAccess =
  /** A screw driven from outside the piece, or from the open side of a bay. */
  | 'driven'
  /** A screw driven up through the base from underneath: with the carcass lying down, before it is stood up. */
  | 'driven-below'
  /** A dowel or cam the later board travels onto. */
  | 'closed';
export interface JointChoice {
  readonly joint: Joint;
  readonly system: JointSystem;
  readonly access: JointAccess;
  /** The piece's own connector could not be used here, and why: the other kind was. */
  /** `covered`: its screw heads would be behind a board already in. `underneath`: they would go in from under the
   * piece. `captured`: the board cannot travel onto dowels or cams here, so it is screwed. */
  readonly instead?: 'covered' | 'underneath' | 'captured' | undefined;
  /** It can be made neither way: the piece cannot be built as drawn. */
  readonly stuck?: boolean | undefined;
}

/** A driver and its bit need this much room behind a screw head, and this much round it. Centimetres. */
const TOOL = { length: 15, radius: 1.5 } as const;
/** A board travels this far onto its dowels or cam bolts. */
const TRAVEL = 3.5;
/** A screw driven upward from this near the floor is driven from underneath the piece. */
const UNDERNEATH = 25;
const BLIND: ReadonlySet<JointSystem> = new Set(['cam', 'dowel']);

/**
 * The connector for each structural joint, decided when the later of its two boards goes in (`rank`). Screwed where the
 * screw head is in reach; closed on dowels or cams where the board can still travel that way; the piece's own system
 * first. Joints into the plinth are always screwed and are not listed.
 */
export function chooseConnectors(boards: readonly Board[], joints: readonly Joint[], sequence: BuildSequence, construction: Construction): JointChoice[] {
  const structural = joints.filter(j => isStructural(boards[j.face]!) && isStructural(boards[j.edge]!));
  const rank = sequence.rank, later = (j: Joint) => rank[j.face]! > rank[j.edge]! ? j.face : j.edge;
  const out: JointChoice[] = [];
  for (const board of [...new Set(structural.map(later))].sort((a, b) => rank[a]! - rank[b]!)) {
    const mine = structural.filter(j => later(j) === board), placed = boards.map((_, i) => i).filter(i => rank[i]! < rank[board]!);
    const reach = new Map(mine.map(j => [j, screwAccess(boards, placed, j)]));
    // The way the incoming board travels to close each joint, and whether it is free to start that far back.
    const way = (j: Joint) => { const sign = board === j.edge ? -j.side : j.side; return `${j.axis}:${sign}`; };
    const free = (j: Joint) => travelsFree(boards, placed, board, j.axis, (board === j.edge ? -j.side : j.side) as 1 | -1);
    const ways = [...new Set(mine.filter(free).map(way))];
    const blindPreferred = BLIND.has(construction.joints), other: JointSystem = blindPreferred ? 'confirmat' : 'dowel';
    // A screw from underneath is a last resort: it needs the carcass lying down, and is avoided where a dowel will do.
    const easy = (j: Joint) => reach.get(j) === 'driven', wants = (j: Joint) => blindPreferred || !easy(j);
    // One way in for the board: the one that leaves no joint unmade, then the fewest screws from underneath, then the
    // most joints closed that want closing; every other joint is screwed.
    const chosen = ways.map(w => {
      const rest = mine.filter(j => way(j) !== w);
      return { w, n: mine.filter(j => way(j) === w && wants(j)).length, stuck: rest.filter(j => reach.get(j) === null).length, below: rest.filter(j => reach.get(j) === 'driven-below').length };
    }).sort((a, b) => a.stuck - b.stuck || (blindPreferred ? 0 : a.below - b.below) || b.n - a.n || a.below - b.below)[0];
    for (const j of mine) {
      const access = reach.get(j) ?? null, closes = !!chosen && chosen.n > 0 && way(j) === chosen.w && wants(j);
      if (closes) out.push({ joint: j, system: blindPreferred ? construction.joints : other, access: 'closed', ...(blindPreferred ? {} : { instead: access ? 'underneath' as const : 'covered' as const }) });
      else if (access) out.push({ joint: j, system: 'confirmat', access, ...(blindPreferred ? { instead: 'captured' as const } : {}) });
      else out.push({ joint: j, system: construction.joints, access: blindPreferred ? 'closed' : 'driven', stuck: true });
    }
  }
  return out;
}

/** Whether the screws through the face board of `j` can be driven when its later board goes in: nothing already placed
 * within a driver's length behind any of their heads. `driven-below` when they go up through a board near the floor,
 * which can only be done with the carcass lying down. */
function screwAccess(boards: readonly Board[], placed: readonly number[], j: Joint): 'driven' | 'driven-below' | null {
  const A = boards[j.face]!, B = boards[j.edge]!, out = -j.side, from = j.side > 0 ? lo(A)[j.axis] : hi(A)[j.axis];
  const tb = thin(B), run = ([0, 1, 2] as Axis[]).find(k => k !== j.axis && k !== tb)!;
  const r0 = Math.max(lo(A)[run], lo(B)[run]), r1 = Math.min(hi(A)[run], hi(B)[run]), across = (Math.max(lo(A)[tb], lo(B)[tb]) + Math.min(hi(A)[tb], hi(B)[tb])) / 2;
  const blocked = connectorStations(r1 - r0).some(station => placed.some(i => {
    if (i === j.face || i === j.edge) return false;
    const c = boards[i]!, c0 = lo(c)[j.axis], c1 = hi(c)[j.axis];
    const behind = out > 0 ? c1 > from + .05 && c0 < from + TOOL.length : c0 < from - .05 && c1 > from - TOOL.length;
    const over = (k: Axis, at: number) => lo(c)[k] < at + TOOL.radius - .05 && hi(c)[k] > at - TOOL.radius + .05;
    return behind && over(tb, across) && over(run, r0 + station);
  }));
  if (blocked) return null;
  return j.axis === 1 && out < 0 && from < UNDERNEATH ? 'driven-below' : 'driven';
}

/** Whether `board` can start TRAVEL back from its place along `axis` (having come the `sign` way) without standing in
 * a board already placed. */
function travelsFree(boards: readonly Board[], placed: readonly number[], board: number, axis: Axis, sign: 1 | -1): boolean {
  const b = boards[board]!, from: Vec3 = lo(b), to: Vec3 = hi(b);
  const a0 = sign > 0 ? from[axis] - TRAVEL : to[axis], a1 = sign > 0 ? from[axis] : to[axis] + TRAVEL;
  return !placed.some(i => {
    const c = boards[i]!;
    return ([0, 1, 2] as Axis[]).every(k => k === axis ? Math.min(hi(c)[k], a1) - Math.max(lo(c)[k], a0) > .05 : Math.min(hi(c)[k], to[k]) - Math.max(lo(c)[k], from[k]) > .05);
  });
}
