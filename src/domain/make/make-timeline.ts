import { HARDWARE, HINGE_ENTRY } from '../hardware/hardware-registry';
import type { FittingKind } from './make-joints';
import type { MakePiece } from './make-parts';
import { FITTED_BEFORE, fixGroups, type FixGroup } from './make-fixing';
import { thinAxis, type Vec3 } from './make-measures';

/**
 * The assembly as a film: each step drills its holes, brings its boards in, then fixes them, and holds a moment. What is
 * on screen is a pure function of the time, so playing, pausing, scrubbing and replaying all show the same thing.
 * Seconds; every progress runs 0 to 1.
 */

/** Hardware fitted between drilling and bringing the boards in: declared by `assembly.fittedFirst` in the hardware registry. */
export const FITTED_FIRST: ReadonlySet<FittingKind> = new Set(
  HARDWARE.filter(h => h.assembly.fittedFirst).map(h => h.key as FittingKind),
);

/** The film opens on the parts laid out (INTRO) and ends going round the finished piece (OUTRO). */
export const INTRO = 2.6, OUTRO = 4;
const DRILL = 1.8, PLACE = 2.6, HOLD = .9;
/** The doors chapter ends adjusting each door on its hinges: side, then height, then depth, a third each (seconds). */
export const ADJUST = 3.6;
/** How far a door hangs out of true when first clipped on, before it is adjusted: side, height, depth. Centimetres. */
export const CLIPPED_ON: Vec3 = [.15, -.2, .1];
/** Hanging a door: it comes in held HANG_OUT cm in front of its place, its hinge arms short of their plates, then is
 * pushed home over HANG seconds so each arm slides onto its plate and clicks. */
export const HANG = 2.4, HANG_OUT = 6;
/** A joint's fixing: its fasteners come into view at the ends of their lines while the camera comes in (SHOW), go in
 * one after another (longer for more, up to a few seconds), and are seen home (REST). */
const SHOW = .8, REST = .45, travelFor = (n: number) => Math.min(3.4, 1 + .2 * (n - 1));
/** How much of the drilling phase each hole's own drilling takes; the rest staggers them, one after another. */
export const HOLE_WINDOW = .35;

/** A joint fixed in a step, and when (seconds): `before` the boards come in, and then `lying` when it goes into a
 * board still waiting on the floor. */
export interface Fix extends FixGroup { readonly at: readonly [number, number]; readonly before: boolean; readonly lying: boolean }
export interface StepTime {
  readonly start: number; readonly drill: readonly [number, number]; readonly place: readonly [number, number]; readonly fix: readonly [number, number]; readonly end: number;
  /** The doors chapter's hanging, after the doors come in: pushed home onto their plates (zero length in any other step). */
  readonly hang: readonly [number, number];
  /** The doors chapter's adjusting, after the fixing (zero length in any other step). */
  readonly adjust: readonly [number, number];
  /** Its fixing, one joint after another. */
  readonly fixes: readonly Fix[];
}
export interface Timeline {
  readonly steps: readonly StepTime[];
  /** The whole film: the opening, every step, and the closing turn round the piece. */
  readonly duration: number;
  /** The step (from 0) each board, fitting and hole belongs to; a hole's start within its step's drilling (0 to 1). */
  readonly boardStep: readonly number[];
  readonly itemStep: readonly number[];
  readonly holeStep: readonly number[];
  readonly holeStart: readonly number[];
  /** When a board starts in, within its step's placing (0 to 1); boards go in one after another. */
  readonly boardStart: readonly number[];
  /** When each fitting fixed joint by joint shows at the end of its line, starts in and is home (seconds); null for
   * one fitted otherwise. */
  readonly itemTime: readonly (readonly [number, number, number] | null)[];
}
/** How much of the placing each board's own way in takes when a step puts in several. */
const BOARD_WINDOW = .42;

export function assemblyTimeline(piece: MakePiece): Timeline {
  const boardStep = piece.boards.map(() => 0), itemStep = piece.fittings.map(() => 0);
  piece.steps.forEach((s, k) => { s.boards.forEach(i => { boardStep[i] = k; }); s.items.forEach(i => { itemStep[i] = k; }); });
  const holeStep = piece.holes.map(h => h.of === undefined ? boardStep[h.board]! : itemStep[h.of]!), holeStart = piece.holes.map(() => 0), boardStart = piece.boards.map(() => 0);
  const itemTime: ([number, number, number] | null)[] = piece.fittings.map(() => null);
  const steps: StepTime[] = [];
  let t = INTRO;
  piece.steps.forEach((s, k) => {
    const mine = piece.holes.map((_, i) => i).filter(i => holeStep[i] === k);
    mine.forEach((h, j) => { holeStart[h] = mine.length > 1 ? (1 - HOLE_WINDOW) * j / (mine.length - 1) : 0; });
    // One after another as a maker would: what lies flat before what stands on it (the base before the sides), from the
    // bottom up, left to right.
    const key = (i: number) => { const b = piece.boards[i]!; return [s.stage === 'carcass' && thinAxis(b) !== 'y' ? 1 : 0, Math.round(b.y0 / 10), thinAxis(b) === 'y' ? 0 : 1, b.x0]; };
    const order = [...s.boards].sort((a, b) => { const p = key(a), q = key(b), k = p.findIndex((v, i) => v !== q[i]); return k < 0 ? 0 : p[k]! - q[k]!; });
    order.forEach((b, j) => { boardStart[b] = order.length > 1 ? (1 - BOARD_WINDOW) * j / (order.length - 1) : 0; });
    // More boards take longer to bring in, each in its turn.
    const count = piece.fittings.filter(f => f.runner).length;
    const baskets = s.items.filter(i => piece.fittings[i]!.size?.startsWith('cargo basket:')).length;
    const placing = s.stage === 'cargo-baskets' ? 1.5 + baskets * 6 : s.stage === 'drawers' || s.stage === 'cargo-frame' ? 6 : s.stage === 'drawer-test' ? count * 6
      : s.boards.length ? Math.min(7, PLACE + .45 * (s.boards.length - 1)) : 0;
    // Each joint in its turn, its screws going in one after another.
    // What goes into a board lying on the floor first (a door's hinges), then what goes into one standing (their plates).
    const lies = (g: FixGroup, before: boolean) => before && g.board !== null && boardStep[g.board] === k ? 0 : 1;
    const fittedBefore = (i: number) => {
      const f = piece.fittings[i]!;
      return FITTED_BEFORE.has(f.kind) || f.purpose === 'drawer-front' && piece.boards[f.boards[0]!]!.name === 'Cargo front';
    };
    const fixing = (before: boolean) => fixGroups(piece, s.items, i => FITTED_FIRST.has(piece.fittings[i]!.kind) || fittedBefore(i) !== before)
      .sort((a, b) => before ? lies(a, before) - lies(b, before) : 0).map(g => {
      const n = g.items.length, travel = travelFor(n), own = n > 1 ? Math.min(1, travel * .55) : travel, from = t + SHOW;
      g.items.forEach((i, j) => { const go = from + (n > 1 ? (travel - own) * j / (n - 1) : 0); itemTime[i] = [t, go, go + own]; });
      return { ...g, before, lying: before && g.board !== null && boardStep[g.board] === k, at: [t, t += SHOW + travel + REST] as const };
    });
    // Drilled, then what goes in before the boards come together (bolts, dowels, hinge cups), then the boards brought
    // in and fixed.
    const start = t, drill = [t, t += mine.length ? DRILL : 0] as const, before = fixing(true), place = [t, t += placing] as const;
    // The doors, in front of their places, are pushed home onto their plates.
    const hang = [t, t += s.stage === 'doors' ? HANG : 0] as const;
    const fixStart = t, fixes = [...before, ...fixing(false)], fix = [fixStart, t] as const;
    // The doors (and 3D-adjustable cargo fronts, GTV Manual Page 6 REGULACJA) are set true: side, height and depth.
    const hasCargoFront = s.stage === 'fronts' && s.boards.some(i => piece.boards[i]?.name === 'Cargo front');
    const adjust = [t, t += s.stage === 'doors' || hasCargoFront ? ADJUST : 0] as const;
    steps.push({ start, drill, place, hang, fix, adjust, end: t += HOLD, fixes });
  });
  return { steps, duration: t + OUTRO, boardStep, itemStep, holeStep, holeStart, boardStart, itemTime };
}

/** Where the film is at time `t`: the step (from 0) and how far through each of its phases. */
export interface Playhead { readonly step: number; readonly drill: number; readonly place: number; readonly hang: number; readonly fix: number; readonly adjust: number; readonly t: number }
export function playhead(tl: Timeline, t: number): Playhead {
  const at = Math.max(0, Math.min(tl.duration, t)), k = Math.max(0, tl.steps.findIndex(s => at < s.end) === -1 ? tl.steps.length - 1 : tl.steps.findIndex(s => at < s.end));
  const s = tl.steps[k]!, part = (p: readonly [number, number]) => p[1] <= p[0] ? (at >= p[0] ? 1 : 0) : Math.max(0, Math.min(1, (at - p[0]) / (p[1] - p[0])));
  return { step: k, drill: part(s.drill), place: part(s.place), hang: part(s.hang), fix: part(s.fix), adjust: part(s.adjust), t: at };
}
/** Where a hole's drill is (0 above it, 1 back out), or null when it is not being drilled now. */
export function drillAt(tl: Timeline, ph: Playhead, hole: number): number | null {
  if (tl.holeStep[hole] !== ph.step) return null;
  const p = (ph.drill - tl.holeStart[hole]!) / HOLE_WINDOW;
  return p > 0 && p < 1 ? p : null;
}
/** Whether a hole has been drilled by now. */
export const drilled = (tl: Timeline, ph: Playhead, hole: number) =>
  tl.holeStep[hole]! < ph.step || (tl.holeStep[hole] === ph.step && ph.drill >= tl.holeStart[hole]! + HOLE_WINDOW / 2);
const unit = (v: number) => Math.max(0, Math.min(1, v));
/** How far a fitting is in (0 waiting at the end of its line, 1 home), or null while it is not on screen yet. */
export function fittedAt(tl: Timeline, ph: Playhead, item: number, kind: FittingKind): number | null {
  const s = tl.itemStep[item]!, w = tl.itemTime[item];
  if (s < ph.step) return 1;
  if (s > ph.step) return null;
  if (FITTED_FIRST.has(kind)) return ph.drill >= 1 ? Math.min(1, ph.place * 3) : null;
  if (!w) return ph.drill >= 1 ? 1 : null;
  return ph.t < w[0] ? null : unit((ph.t - w[1]) / (w[2] - w[1]));
}
/** How far a fitting has come into view at the end of its line (0 to 1), as its joint's turn comes. */
export function seenAt(tl: Timeline, ph: Playhead, item: number): number {
  const w = tl.itemTime[item];
  return !w || tl.itemStep[item]! < ph.step ? 1 : unit((ph.t - w[0]) / (SHOW * .6));
}
/** The joint being fixed now, or null. */
export function fixingNow(tl: Timeline, ph: Playhead): Fix | null {
  return tl.steps[ph.step]?.fixes.find(f => ph.t >= f.at[0] && ph.t < f.at[1]) ?? null;
}
/** A board: waiting where it lies before its step (0), on its way in during it, in place after (1). */
export function arrivalAt(tl: Timeline, ph: Playhead, board: number): number {
  const s = tl.boardStep[board]!;
  if (s !== ph.step) return s < ph.step ? 1 : 0;
  if (ph.place >= 1) return 1;
  const window = tl.boardStart.filter((_, i) => tl.boardStep[i] === s).length > 1 ? BOARD_WINDOW : 1;
  return Math.max(0, Math.min(1, (ph.place - tl.boardStart[board]!) / window));
}
/** The start of step `k`, to jump to it. */
export const stepStart = (tl: Timeline, k: number) => tl.steps[Math.max(0, Math.min(tl.steps.length - 1, k))]!.start;

const ADJUST_AXES = HINGE_ENTRY.assembly.adjustAxes ?? (['side', 'height', 'depth'] as const);
/** Which way a door is being adjusted now (one after another: side, height, depth), or null when none is. */
export function adjustingNow(tl: Timeline, ph: Playhead): 'side' | 'height' | 'depth' | null {
  const s = tl.steps[ph.step]!;
  if (s.adjust[1] <= s.adjust[0] || ph.t < s.adjust[0] || ph.t >= s.adjust[1]) return null;
  return ADJUST_AXES[Math.min(ADJUST_AXES.length - 1, Math.floor(ph.adjust * ADJUST_AXES.length))]!;
}
/** How far a door board stands from where it hangs true at this moment (side, height, depth, cm): held HANG_OUT in front
 * until it is pushed home onto its plates, clipped on slightly out (CLIPPED_ON), then each way set true in its turn
 * while the doors chapter adjusts; true before its chapter and after. */
export function doorNudge(tl: Timeline, ph: Playhead, board: number): Vec3 {
  const s = tl.steps[ph.step]!;
  if (tl.boardStep[board] !== ph.step || s.adjust[1] <= s.adjust[0]) return [0, 0, 0];
  const hasHang = s.hang[1] > s.hang[0];
  const out = hasHang ? HANG_OUT * (1 - ph.hang * ph.hang * (3 - 2 * ph.hang)) : 0;
  const engaged = hasHang ? 1 : unit((ph.t - s.fix[1]) / .4);
  return CLIPPED_ON.map((v, axis) => v * engaged * (1 - unit(ph.adjust * 3 - axis)) + (axis === 2 ? out : 0)) as unknown as Vec3;
}
/** Whether a door is drawn see-through: while it comes in and is hung, so its hinge arms are seen going onto the plates. */
export function seeThrough(tl: Timeline, ph: Playhead, board: number): boolean {
  const s = tl.steps[ph.step]!;
  return tl.boardStep[board] === ph.step && s.hang[1] > s.hang[0] && ph.t >= s.place[0] && ph.t < s.hang[1];
}
