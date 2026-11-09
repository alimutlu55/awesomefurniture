import type { Board } from '../drawings/cabinet-boards';
import type { Hole } from './make-joints';

/**
 * Two bores in one board, in three dimensions. Every hole is the cylinder a drill leaves: from its mouth, along its
 * axis, as deep as it is drilled (right through for depth 0). Two of them clash when less than MIN_WALL of board is
 * left between them anywhere, whichever faces or edges they are drilled from: side by side in one face, crossing at a
 * right angle inside the board (a screw through a face meeting the pilot hole run in from an end), or end to end from
 * opposite faces.
 *
 * One rule, used twice: where connectors and hardware are set out (they step along System 32 until they are clear) and
 * where the finished drilling is checked (`drillingChecks`), so what is set out clear is never reported, and whatever
 * is reported really is in the way. Millimetres.
 */

/** The least board left between two bores. */
export const MIN_WALL = 2;
/** Two blind bores drilled towards each other from opposite faces keep at least this between their ends. */
export const MIN_BETWEEN_ENDS = 1;

type Axis = 0 | 1 | 2;
interface Bore { readonly axis: Axis; readonly from: number; readonly to: number; readonly at: readonly [number, number, number]; readonly r: number; readonly through: boolean }

const round = (v: number) => Number(v.toPrecision(12));

/** A hole as the cylinder drilled: its extent along its own axis (`from` below `to`), its centre line and its radius. */
function bore(board: Board, h: Hole): Bore {
  const lo = [board.x0, board.y0, board.z0], hi = [board.x1, board.y1, board.z1], at = h.at.map(v => v * 10) as [number, number, number];
  const mouth = at[h.axis]!, through = h.depth === 0;
  // Right through: from the mouth to the far side of the board, whichever way it is thick there.
  const end = through ? (h.sign > 0 ? hi[h.axis]! * 10 : lo[h.axis]! * 10) : mouth + h.sign * h.depth;
  return { axis: h.axis, from: Math.min(mouth, end), to: Math.max(mouth, end), at, r: h.d / 2, through };
}

export interface BoreClash { readonly kind: 'clash' | 'meet'; readonly gap: number }

/**
 * How two bores in `board` are in each other's way, or null when they are clear: `clash` with the board left between
 * them (negative: they run into each other), `meet` for two blind holes from opposite faces with less than
 * MIN_BETWEEN_ENDS between their ends. The same hole named twice (two shelves sharing one row of pin holes, a hole
 * drilled right through from either face) is one hole, not a clash.
 */
export function boresClash(board: Board, p: Hole, q: Hole, wall = MIN_WALL, shared = true): BoreClash | null {
  const a = bore(board, p), b = bore(board, q);
  if (a.axis === b.axis) {
    const [u, v] = ([0, 1, 2] as Axis[]).filter(k => k !== a.axis) as [Axis, Axis];
    const apart = Math.hypot(a.at[u] - b.at[u], a.at[v] - b.at[v]), gap = round(apart - a.r - b.r), overlap = Math.min(a.to, b.to) - Math.max(a.from, b.from);
    const same = shared && apart < .05 && p.kind === q.kind && p.d === q.d && (a.through && b.through || p.sign === q.sign && p.depth === q.depth);
    if (same) return null;
    if (overlap > 1e-6) return gap < wall ? { kind: 'clash', gap } : null;
    // End to end: their circles overlap and too little is left between their ends.
    return gap < 0 && -overlap < MIN_BETWEEN_ENDS ? { kind: 'meet', gap: round(-overlap) } : null;
  }
  // At a right angle: the distance between their centre lines, where each runs within the other's length.
  const k = ([0, 1, 2] as Axis[]).find(x => x !== a.axis && x !== b.axis)!, gap = round(Math.abs(a.at[k] - b.at[k]) - a.r - b.r);
  if (gap >= wall) return null;
  const reaches = (one: Bore, other: Bore) => other.at[one.axis] > one.from - other.r - wall && other.at[one.axis] < one.to + other.r + wall;
  return reaches(a, b) && reaches(b, a) ? { kind: 'clash', gap } : null;
}

/** Whether `hole` can be drilled in its board without clashing with any of `drilled` there. `own` names holes that
 * are meant to meet it (a cam housing and the channel its bolt comes in by); `shared` lets it be a hole already there
 * (the next shelf's row of pin holes). */
export function boreIsClear(boards: readonly Board[], drilled: readonly Hole[], hole: Hole, own: (other: Hole) => boolean = () => false, shared = false): boolean {
  const board = boards[hole.board]!;
  return !drilled.some(h => h.board === hole.board && !own(h) && boresClash(board, h, hole, MIN_WALL, shared));
}

/** A cam housing and the channel its own bolt comes in by are meant to meet. */
export const meantToMeet = (a: Hole, b: Hole) => a.of !== undefined && a.of === b.of && (a.kind === 'cam' && b.kind === 'pilot' || a.kind === 'pilot' && b.kind === 'cam');
