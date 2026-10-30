/** Shared interface for viewport and profile-editor guides. Coordinates belong to the producer's frame. */
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
}
export type GuideProject = (point: GuidePoint) => { x: number; y: number; visible?: boolean };
export type GuideFrame = (x: number, y: number) => GuidePoint;

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
