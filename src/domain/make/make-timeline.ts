import type { FittingKind } from './make-joints';
import type { MakePiece } from './make-parts';

/**
 * The assembly as a film: each step drills its holes, brings its boards in, then fixes them, and holds a moment. What is
 * on screen is a pure function of the time, so playing, pausing, scrubbing and replaying all show the same thing.
 * Seconds; every progress runs 0 to 1.
 */

/** Hardware fitted between drilling and bringing the boards in: shelf pins, dowels and hinge plates go in first. */
export const FITTED_FIRST: ReadonlySet<FittingKind> = new Set(['pin', 'dowel', 'plate']);
const DRILL = 1.6, PLACE = 1.5, FIX = 1.6, HOLD = .8;
/** How much of the drilling phase each hole's own drilling takes; the rest staggers them, one after another. */
export const HOLE_WINDOW = .35;

export interface StepTime { readonly start: number; readonly drill: readonly [number, number]; readonly place: readonly [number, number]; readonly fix: readonly [number, number]; readonly end: number }
export interface Timeline {
  readonly steps: readonly StepTime[];
  readonly duration: number;
  /** The step (from 0) each board, fitting and hole belongs to; a hole's start within its step's drilling (0 to 1). */
  readonly boardStep: readonly number[];
  readonly itemStep: readonly number[];
  readonly holeStep: readonly number[];
  readonly holeStart: readonly number[];
}

export function assemblyTimeline(piece: MakePiece): Timeline {
  const boardStep = piece.boards.map(() => 0), itemStep = piece.fittings.map(() => 0);
  piece.steps.forEach((s, k) => { s.boards.forEach(i => { boardStep[i] = k; }); s.items.forEach(i => { itemStep[i] = k; }); });
  const holeStep = piece.holes.map(h => h.of === undefined ? boardStep[h.board]! : itemStep[h.of]!), holeStart = piece.holes.map(() => 0);
  const steps: StepTime[] = [];
  let t = 0;
  piece.steps.forEach((s, k) => {
    const mine = piece.holes.map((_, i) => i).filter(i => holeStep[i] === k);
    mine.forEach((h, j) => { holeStart[h] = mine.length > 1 ? (1 - HOLE_WINDOW) * j / (mine.length - 1) : 0; });
    const start = t, drill = [t, t += mine.length ? DRILL : 0] as const, place = [t, t += s.boards.length ? PLACE : 0] as const;
    const fix = [t, t += s.items.length ? FIX : 0] as const;
    steps.push({ start, drill, place, fix, end: t += HOLD });
  });
  return { steps, duration: t, boardStep, itemStep, holeStep, holeStart };
}

/** Where the film is at time `t`: the step (from 0) and how far through each of its phases. */
export interface Playhead { readonly step: number; readonly drill: number; readonly place: number; readonly fix: number }
export function playhead(tl: Timeline, t: number): Playhead {
  const at = Math.max(0, Math.min(tl.duration, t)), k = Math.max(0, tl.steps.findIndex(s => at < s.end) === -1 ? tl.steps.length - 1 : tl.steps.findIndex(s => at < s.end));
  const s = tl.steps[k]!, part = (p: readonly [number, number]) => p[1] <= p[0] ? (at >= p[0] ? 1 : 0) : Math.max(0, Math.min(1, (at - p[0]) / (p[1] - p[0])));
  return { step: k, drill: part(s.drill), place: part(s.place), fix: part(s.fix) };
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
/** How far a fitting is in (0 not yet, 1 home), or null before its step. */
export function fittedAt(tl: Timeline, ph: Playhead, item: number, kind: FittingKind): number | null {
  const s = tl.itemStep[item]!;
  if (s < ph.step) return 1;
  if (s > ph.step) return null;
  if (FITTED_FIRST.has(kind)) return ph.drill >= 1 ? Math.min(1, ph.place * 3) : null;
  return ph.fix > 0 ? ph.fix : null;
}
/** A board: hidden before its step, coming in during it (0 away, 1 in place), in place after. */
export function arrivalAt(tl: Timeline, ph: Playhead, board: number): number | null {
  const s = tl.boardStep[board]!;
  return s < ph.step ? 1 : s > ph.step ? null : ph.place;
}
/** The start of step `k`, to jump to it. */
export const stepStart = (tl: Timeline, k: number) => tl.steps[Math.max(0, Math.min(tl.steps.length - 1, k))]!.start;
