/** Snapping a dragged value to the lines it can align with (another point's height, a side, a wall).
 * Shared by the shape and room editors so both feel the same. */
export type Align = { v: number; label: string };

/** Nearest target within `tolerance`; a lock keeps the target it caught until the pointer leaves it by
 * more than 1.6 tolerances, so a held line does not flicker between close targets. */
export function alignTo(raw: number, targets: readonly Align[], lock: Align | null, tolerance: number): Align | null {
    if (lock) {
        const same = targets.find(t => Math.abs(t.v - lock.v) < 1e-6 && t.label === lock.label);
        if (same && Math.abs(same.v - raw) <= tolerance * 1.6) return same;
    }
    let best: Align | null = null, bestD = Infinity;
    for (const t of targets) {
        const d = Math.abs(t.v - raw);
        if (d <= tolerance && d < bestD) { best = t; bestD = d; }
    }
    return best;
}
