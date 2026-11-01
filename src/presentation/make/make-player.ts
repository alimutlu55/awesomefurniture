import type { MakePiece } from '../../domain/make/make-parts';
import { arrivalAt, assemblyTimeline, drillAt, drilled, fittedAt, type Playhead, playhead, stepStart, type Timeline } from '../../domain/make/make-timeline';
import type { MakeFilm } from './make-play-3d';

/**
 * The assembly film's player: the time, playing or paused, seeking, step by step, and the film at the time now. It
 * holds no view: Make draws the film and writes the controls.
 */
export function createMakePlayer() {
  let piece: MakePiece | null = null, tl: Timeline | null = null, t = 0, playing = false;
  const head = (): Playhead => tl ? playhead(tl, t) : { step: 0, drill: 0, place: 0, fix: 0 };
  return {
    load(next: MakePiece) { piece = next; tl = assemblyTimeline(next); t = Math.min(t, tl.duration); playing = false; },
    get time() { return t; },
    get duration() { return tl?.duration ?? 0; },
    get playing() { return playing; },
    get head() { return head(); },
    /** Each step's start, for its chapter. */
    get starts() { return tl ? tl.steps.map(s => s.start) : []; },
    seek(to: number) { t = Math.max(0, Math.min(tl?.duration ?? 0, to)); },
    /** Plays or pauses; at the end, plays again from the start. */
    toggle() {
      if (!tl) return;
      if (!playing && t >= tl.duration - .01) t = 0;
      playing = !playing;
    },
    pause() { playing = false; },
    /** The start of the step `by` steps from the one showing. */
    step(by: number) { if (tl) { const k = head().step; t = stepStart(tl, by < 0 && t - tl.steps[k]!.start > .6 ? k : k + by); } },
    chapter(k: number) { if (tl) t = stepStart(tl, k); },
    /** Moves the time on while playing; true when it moved. */
    advance(dt: number) {
      if (!playing || !tl) return false;
      t = Math.min(tl.duration, t + dt);
      if (t >= tl.duration) playing = false;
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
        now: board => line.boardStep[board] === ph.step,
        hole: index => drilled(line, ph, index),
        // Hardware drawn on the piece comes on as its step fixes it; runners come in with their drawer.
        item: index => line.itemStep[index]! < ph.step || (line.itemStep[index] === ph.step && (ph.fix > 0 || (fittings[index]!.kind === 'runner' && ph.place > 0))),
        bit: hole => drillAt(line, ph, hole),
        fit: item => fittedAt(line, ph, item, fittings[item]!.kind),
      };
    },
  };
}
export type MakePlayer = ReturnType<typeof createMakePlayer>;
