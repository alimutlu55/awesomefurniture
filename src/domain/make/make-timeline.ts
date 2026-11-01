import type { FittingKind } from './make-joints';
import type { MakePiece } from './make-parts';
import { fixGroups, type FixGroup } from './make-fixing';
import { thinAxis } from './make-measures';

/**
 * The assembly as a film: each step drills its holes, brings its boards in, then fixes them, and holds a moment. What is
 * on screen is a pure function of the time, so playing, pausing, scrubbing and replaying all show the same thing.
 * Seconds; every progress runs 0 to 1.
 */

/** Hardware fitted between drilling and bringing the boards in: shelf pins and hinge plates go on the uprights first. */
export const FITTED_FIRST: ReadonlySet<FittingKind> = new Set(['pin', 'plate']);
/** Hardware fitted to its board while it still lies on the floor, before it goes in: a hinge's cup pressed into the
 * back of its door, laid face down. */
export const FITTED_LYING: ReadonlySet<FittingKind> = new Set(['hinge']);
/** The film opens on the parts laid out (INTRO) and ends going round the finished piece (OUTRO). */
export const INTRO = 2.6, OUTRO = 4;
const DRILL = 1.8, PLACE = 2.6, HOLD = .9;
/** A joint's fixing: its fasteners come into view at the ends of their lines while the camera comes in (SHOW), go in
 * one after another (longer for more, up to a few seconds), and are seen home (REST). */
const SHOW = .8, REST = .45, travelFor = (n: number) => Math.min(3.4, 1 + .2 * (n - 1));
/** How much of the drilling phase each hole's own drilling takes; the rest staggers them, one after another. */
export const HOLE_WINDOW = .35;

/** A joint fixed in a step, and when (seconds); `lying` when it is fixed to its board where it waits on the floor. */
export interface Fix extends FixGroup { readonly at: readonly [number, number]; readonly lying: boolean }
export interface StepTime {
  readonly start: number; readonly drill: readonly [number, number]; readonly place: readonly [number, number]; readonly fix: readonly [number, number]; readonly end: number;
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
    const placing = s.boards.length ? Math.min(7, PLACE + .45 * (s.boards.length - 1)) : 0;
    // Each joint in its turn, its screws going in one after another.
    const fixing = (lying: boolean) => fixGroups(piece, s.items, i => FITTED_FIRST.has(piece.fittings[i]!.kind) || FITTED_LYING.has(piece.fittings[i]!.kind) !== lying).map(g => {
      const n = g.items.length, travel = travelFor(n), own = n > 1 ? Math.min(1, travel * .55) : travel, from = t + SHOW;
      g.items.forEach((i, j) => { const go = from + (n > 1 ? (travel - own) * j / (n - 1) : 0); itemTime[i] = [t, go, go + own]; });
      return { ...g, lying, at: [t, t += SHOW + travel + REST] as const };
    });
    // Drilled, then what is fitted to a board lying on the floor, then the boards brought in and fixed.
    const start = t, drill = [t, t += mine.length ? DRILL : 0] as const, before = fixing(true), place = [t, t += placing] as const;
    const fixStart = t, fixes = [...before, ...fixing(false)];
    steps.push({ start, drill, place, fix: [fixStart, t] as const, end: t += HOLD, fixes });
  });
  return { steps, duration: t + OUTRO, boardStep, itemStep, holeStep, holeStart, boardStart, itemTime };
}

/** Where the film is at time `t`: the step (from 0) and how far through each of its phases. */
export interface Playhead { readonly step: number; readonly drill: number; readonly place: number; readonly fix: number; readonly t: number }
export function playhead(tl: Timeline, t: number): Playhead {
  const at = Math.max(0, Math.min(tl.duration, t)), k = Math.max(0, tl.steps.findIndex(s => at < s.end) === -1 ? tl.steps.length - 1 : tl.steps.findIndex(s => at < s.end));
  const s = tl.steps[k]!, part = (p: readonly [number, number]) => p[1] <= p[0] ? (at >= p[0] ? 1 : 0) : Math.max(0, Math.min(1, (at - p[0]) / (p[1] - p[0])));
  return { step: k, drill: part(s.drill), place: part(s.place), fix: part(s.fix), t: at };
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
