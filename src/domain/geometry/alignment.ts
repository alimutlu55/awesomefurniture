/**
 * The one rule every editor uses to line a dragged value up with something: a wall, a neighbour's edge, a
 * corner, a level. Room corners and walls, openings, wall and ceiling shapes, a fitting's edges, a board and a
 * whole wardrobe all hand their candidates here, so they catch, hold and let go the same way.
 *
 * A candidate is a value on one axis in the caller's own units and frame (scene centimetres, a bay's
 * centimetres, a profile's). The caller says which candidates are reachable (`within`): a line the part
 * cannot reach without running into something is never offered, so a guide is only shown for a pose the
 * edit can take.
 */

/** A value a dragged one can align with, and why (`label`). `kind` groups candidates that a held line keeps
 * (an edge, a size, a wall); `penalty` makes a weaker kind lose to a stronger one at nearly the same
 * distance; `src` is the caller's reference to what it aligns with, for drawing the guide. */
export interface AlignTarget<S = unknown> {
    readonly v: number;
    readonly label: string;
    readonly kind?: string;
    readonly penalty?: number;
    readonly src?: S;
}
/** A target as the plain value-and-reason pair the room and shape editors keep as their lock. */
export type Align = AlignTarget<never>;

/** A held line lets go once the pointer is this many tolerances away from it, so it does not flicker
 * between two lines that are close together. */
export const ALIGN_HOLD = 1.6;
/** Two candidate values this close are the same line. */
const SAME = 1e-6;

export interface AlignOptions {
    /** How close the raw value must come to catch a line, in the candidates' units. */
    readonly tolerance: number;
    /** The line caught on the last pointer move, kept while it stays within ALIGN_HOLD tolerances. */
    readonly lock?: AlignTarget | null;
    /** The reachable range [low, high]: candidates outside it are never caught. */
    readonly within?: readonly [number, number];
}

const sameLine = (a: AlignTarget, b: AlignTarget) => Math.abs(a.v - b.v) < SAME && (a.kind ?? a.label) === (b.kind ?? b.label);

/** The candidate `raw` aligns with, or null. Deterministic: the held line while it is near enough, else the
 * nearest within `tolerance` (distance plus its penalty); on a tie, the one listed first. */
export function resolveAlignment<T extends AlignTarget>(raw: number, targets: readonly T[], { tolerance, lock = null, within }: AlignOptions): T | null {
    const reachable = within ? targets.filter(t => t.v >= within[0] - SAME && t.v <= within[1] + SAME) : targets;
    if (lock) {
        const held = reachable.find(t => sameLine(t, lock));
        if (held && Math.abs(held.v - raw) <= tolerance * ALIGN_HOLD) return held;
    }
    let best: T | null = null, score = Infinity;
    for (const t of reachable) {
        const d = Math.abs(t.v - raw);
        if (d > tolerance) continue;
        const s = d + (t.penalty ?? 0);
        if (s < score) { best = t; score = s; }
    }
    return best;
}

/** `resolveAlignment` for the plain value-and-reason targets: the room and shape editors' lines. */
export function alignTo(raw: number, targets: readonly Align[], lock: Align | null, tolerance: number): Align | null {
    return resolveAlignment(raw, targets, { tolerance, lock });
}

/** The nearest value within `tolerance` of `raw`, or null: a level a dragged corner or side can land on. */
export function nearestValue(raw: number, values: readonly number[], tolerance: number): number | null {
    return resolveAlignment(raw, values.map(v => ({ v, label: '' })), { tolerance })?.v ?? null;
}

/** The smallest of several moves that each line a part up with something, when it is at most `tolerance`;
 * moves below `still` are where it already is. 0 when none is that small. */
export function smallestMove(moves: readonly number[], tolerance: number, still = .05): number {
    return resolveAlignment(0, moves.filter(m => Math.abs(m) > still).map(v => ({ v, label: '' })), { tolerance })?.v ?? 0;
}
