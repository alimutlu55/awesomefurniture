import { drawerBoardOffset } from '../../domain/make/drawer-installation';
import type { MakePiece } from '../../domain/make/make-parts';
import { adjustingNow, arrivalAt, assemblyTimeline, doorNudge, seeThrough, drillAt, drilled, fittedAt, fixingNow, type Playhead, playhead, seenAt, stepStart, type Timeline } from '../../domain/make/make-timeline';
import { doorGaps, entryOf, WAIT } from '../../domain/make/make-fixing';
import type { FittingKind } from '../../domain/make/make-joints';
import type { Measure, Vec3 } from '../../domain/make/make-measures';
import { lyingPoint, type Staged, stagingLayout } from '../../domain/make/make-staging';
import type { MakeFilm } from './make-play-3d';

/**
 * The assembly film's player: the time, playing or paused, seeking, step by step, and the film at the time now. It
 * holds no view: Make draws the film and writes the controls.
 */
export function createMakePlayer() {
  let piece: MakePiece | null = null, tl: Timeline | null = null, staged: Staged[] = [], t = 0, playing = false, rate: 1 | -1 = 1;
  let stopAt: number | null = null;
  const head = (): Playhead => tl ? playhead(tl, t) : { step: 0, drill: 0, place: 0, hang: 0, fix: 0, adjust: 0, t: 0 };
  return {
    /** Takes a piece; `floor` is where the floor is in its frame (below a hung unit), where its parts wait. */
    load(next: MakePiece, floor = 0) { piece = next; tl = assemblyTimeline(next); staged = stagingLayout(next, floor); t = Math.min(t, tl.duration); playing = false; rate = 1; stopAt = null; },
    get timeline() { return tl; },
    get staged() { return staged; },
    get time() { return t; },
    get duration() { return tl?.duration ?? 0; },
    get playing() { return playing; },
    get rate() { return rate; },
    direction(next: 1 | -1) { rate = next; },
    get head() { return head(); },
    /** Each step's start, for its chapter. */
    get starts() { return tl ? tl.steps.map(s => s.start) : []; },
    seek(to: number) { stopAt = null; if (Number.isFinite(to)) t = Math.max(0, Math.min(tl?.duration ?? 0, to)); },
    /** Demonstrates a mechanism to an exact endpoint, then pauses without continuing to another drawer. */
    animateTo(to: number) {
      if (!tl || !Number.isFinite(to)) return;
      stopAt = Math.max(0, Math.min(tl.duration, to));
      rate = stopAt >= t ? 1 : -1; playing = Math.abs(stopAt - t) > .001;
    },
    /** Plays or pauses; at the end, plays again from the start. */
    toggle() {
      if (!tl) return;
      stopAt = null;
      if (!playing && rate > 0 && t >= tl.duration - .01) t = 0;
      if (!playing && rate < 0 && t <= .01) t = tl.duration;
      playing = !playing;
    },
    pause() { playing = false; stopAt = null; },
    /** The start of the step `by` steps from the one showing. */
    step(by: number) { if (tl) { const k = head().step; t = stepStart(tl, by < 0 && t - tl.steps[k]!.start > .6 ? k : k + by); } },
    chapter(k: number) { if (tl) t = stepStart(tl, k); },
    /** Moves the time on while playing; true when it moved. */
    advance(dt: number) {
      if (!playing || !tl) return false;
      if (!Number.isFinite(dt) || dt < 0) return false;
      const next = Math.max(0, Math.min(tl.duration, t + dt * rate));
      if (stopAt !== null && (next - stopAt) * rate >= 0) {
        t = stopAt; stopAt = null; playing = false;
      } else t = next;
      if ((rate > 0 && t >= tl.duration) || (rate < 0 && t <= 0)) playing = false;
      return true;
    },
    /** The parts the step showing puts in, by number. */
    building(): Set<number> {
      if (!piece || !tl) return new Set();
      const k = head().step, boards = piece.steps[k]?.boards ?? [];
      return new Set(piece.parts.filter(p => p.ids.some(i => boards.includes(i))).map(p => p.n));
    },
    film(): MakeFilm | null {
      if (!piece || !tl) return null;
      const line = tl, ph = head(), fittings = piece.fittings;
      return {
        arrive: board => arrivalAt(line, ph, board),
        stage: board => staged[board]!,
        now: board => line.boardStep[board] === ph.step,
        hole: index => drilled(line, ph, index),
        // Hardware drawn on the piece comes in as its joint is fixed; runners are on their drawer from the start.
        item: index => fittedAt(line, ph, index, fittings[index]!.kind),
        bit: hole => drillAt(line, ph, hole),
        fit: item => fittedAt(line, ph, item, fittings[item]!.kind),
        seen: item => seenAt(line, ph, item),
        nudge: board => {
          const door = doorNudge(line, ph, board), drawer = drawerBoardOffset(piece!, line, ph, board);
          return [door[0] + drawer[0], door[1] + drawer[1], door[2] + drawer[2]];
        },
        seeThrough: board => seeThrough(line, ph, board) || (piece!.steps[ph.step]!.stage === 'drawer-test' && ['Side', 'Partition'].includes(piece!.boards[board]!.name)),
      };
    },
    /** While the doors chapter adjusts the doors: the gaps they are set to, as measurements, and which way now. */
    adjusting(): { gaps: readonly Measure[]; way: 'side' | 'height' | 'depth' } | null {
      if (!piece || !tl) return null;
      const way = adjustingNow(tl, head());
      return way ? { gaps: doorGaps(piece), way } : null;
    },
    /** The joint being fixed now: each fitting's dashed line in (from where it waits to its hole), how far it has come
     * into view and gone in, and what goes in, counted. */
    fixing(): Fixing | null {
      if (!piece || !tl) return null;
      const ph = head(), now = fixingNow(tl, ph), p = piece;
      if (!now) return null;
      // A joint fixed on a board lying on the floor is drawn where that board lies.
      const board = now.board, where = (q: Vec3): Vec3 => {
        if (now.lying && board !== null) return lyingPoint(p.boards[board]!, staged[board]!, q);
        if (board === null) return q;
        const off = drawerBoardOffset(p, tl!, ph, board);
        return [q[0] + off[0], q[1] + off[1], q[2] + off[2]];
      };
      const lines = now.items.flatMap(i => {
        const e = entryOf(p, i);
        if (!e) return [];
        const from: Vec3 = where([e.at[0] - e.dir[0] * WAIT, e.at[1] - e.dir[1] * WAIT, e.at[2] - e.dir[2] * WAIT]);
        return [{ from, to: where(e.at), seen: seenAt(tl!, ph, i), go: fittedAt(tl!, ph, i, p.fittings[i]!.kind) ?? 0 }];
      });
      const counts = new Map<string, { kind: FittingKind; size?: string; qty: number }>();
      for (const i of now.items) {
        const f = p.fittings[i]!, key = `${f.kind} ${f.size ?? ''}`, c = counts.get(key) ?? { kind: f.kind, ...f.size ? { size: f.size } : {}, qty: 0 };
        c.qty++;
        counts.set(key, c);
      }
      return { lines, hardware: [...counts.values()] };
    },
  };
}
export type MakePlayer = ReturnType<typeof createMakePlayer>;
/** A joint being fixed, as Make writes it over the film. */
export interface Fixing {
  readonly lines: readonly { readonly from: Vec3; readonly to: Vec3; readonly seen: number; readonly go: number }[];
  readonly hardware: readonly { readonly kind: FittingKind; readonly size?: string; readonly qty: number }[];
}
