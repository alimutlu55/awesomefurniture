/** Shared interface for viewport and profile-editor guides. Coordinates belong to the producer's frame. */
import { ALIGN_HOLD, AUTO_ALIGN_CM } from '../../domain/geometry/alignment';
export interface GuideLine<P> { readonly a: P; readonly b: P; readonly label?: string }
export interface GuidePoint { readonly x: number; readonly y: number; readonly z: number }
/** Visual assistance never changes geometry. `current` and `target` distinguish a nearby target from contact. */
export interface SmartGuide extends GuideLine<GuidePoint> {
    readonly id: string;
    readonly group: string;
    readonly label: string;
    readonly current: GuidePoint;
    readonly target: GuidePoint;
    readonly delta: number;
    readonly unit?: 'angle';
    /** Caught and snapped to, but drawn by another overlay (wall contact is the assistant's green bar). */
    readonly quiet?: boolean;
}
export type GuideProject = (point: GuidePoint) => { x: number; y: number; visible?: boolean };
export type GuideFrame = (x: number, y: number) => GuidePoint;

/** A physical correction from the same targets the lines show: the nearest target per group within `tolerance`
 * (centimetres; callers turn a screen distance into it with `snapToleranceCm`). A target caught on the last move
 * (`held`, updated in place) holds out to ALIGN_HOLD tolerances, so jitter while dropping keeps it. Callers apply
 * the move through their collision-checked commands. */
export function autoGuideTranslation(candidates: readonly SmartGuide[], axes: readonly ('x' | 'y' | 'z')[] = ['x', 'y', 'z'],
    tolerance = AUTO_ALIGN_CM, held?: Set<string>): GuidePoint {
    const groups = new Map<string, { g: SmartGuide; score: number }>(), result = { x: 0, y: 0, z: 0 };
    for (const g of candidates) {
        const holding = held?.has(g.id) ?? false;
        if (g.unit === 'angle' || !Number.isFinite(g.delta) || Math.abs(g.delta) > tolerance * (holding ? ALIGN_HOLD : 1) + 1e-6) continue;
        if ((['x', 'y', 'z'] as const).some(a => !axes.includes(a) && Math.abs(g.target[a] - g.current[a]) > 1e-6)) continue;
        const score = Math.abs(g.delta) - (holding ? tolerance : 0), prior = groups.get(g.group);
        if (!prior || score < prior.score - 1e-6) groups.set(g.group, { g, score });
    }
    held?.clear();
    for (const { g } of groups.values()) {
        held?.add(g.id);
        for (const axis of axes) result[axis] += g.target[axis] - g.current[axis];
    }
    return result;
}

/** Shown on the model only once lined up: a line means the part is aligned there, never "almost". */
export const isAligned = (g: SmartGuide) => !g.quiet && Math.abs(g.delta) <= (g.unit === 'angle' ? .05 : AUTO_ALIGN_CM) + 1e-6;

/** A target line in an elevation. `span` includes the edited object and its reference. */
export function axisGuide(id: string, label: string, axis: 'x' | 'y', value: number, target: number,
    span: readonly [number, number], frame: GuideFrame, group: string = axis): SmartGuide {
    const lo = Math.min(...span) - 5, hi = Math.max(...span) + 5, mid = (lo + hi) / 2;
    const at = (v: number, s: number) => axis === 'x' ? frame(v, s) : frame(s, v);
    return { id, group, label, a: at(target, lo), b: at(target, hi), current: at(value, mid), target: at(target, mid), delta: value - target };
}

/** Screen-space tolerance and hysteresis are shared by every viewport interaction. One target per axis wins. */
export function selectSmartGuides(candidates: readonly SmartGuide[], project: GuideProject, held: ReadonlySet<string> = new Set()): SmartGuide[] {
    const scored = candidates.flatMap(guide => {
        if (![guide.delta, ...Object.values(guide.a), ...Object.values(guide.b)].every(Number.isFinite)) return [];
        const a = project(guide.current), b = project(guide.target);
        if (a.visible === false || b.visible === false || ![a.x, a.y, b.x, b.y].every(Number.isFinite)) return [];
        const distance = Math.hypot(a.x - b.x, a.y - b.y), holding = held.has(guide.id);
        if (distance > (holding ? 13 : 9) || guide.unit === 'angle' && Math.abs(guide.delta) > 4) return [];
        return [{ guide, score: distance - (holding ? 3 : 0) }];
    }).sort((a, b) => a.score - b.score || a.guide.id.localeCompare(b.guide.id));
    const groups = new Set<string>(), out: SmartGuide[] = [];
    for (const { guide } of scored) {
        if (groups.has(guide.group)) continue;
        groups.add(guide.group); out.push(guide);
        if (out.length === 4) break;
    }
    return out;
}
