import { PANEL as T } from '../../domain/wardrobe/catalog.js';
import { resolveAlignment, type AlignTarget } from '../../domain/geometry/alignment';
import { boardAlignTargets, type BayRect, type BayView, type BoardTarget } from '../../domain/geometry/board-alignment';
type Rules = Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>,
    'widths' | 'computeLayout' | 'dividerRect' | 'clampDivider' | 'ceilingTop' | 'interiorFloor'>;
interface Ports {
    getDesign(): import('../projects/editor-scene').EditorState;
    rules: Rules;
    moveDividerTo(index: number, value: number): boolean | 'all';
}
/** A board's guide in the wardrobe's own frame (x from its left outer side, y from the floor): the line `pos`
 * running `orient` ('v' upright, 'h' level) across `span`, the stretch of the board and what it lines up with. */
export interface BoardSnapGuide { readonly orient: 'v' | 'h'; readonly pos: number; readonly span: readonly [number, number]; readonly label: string; readonly kind?: string }
export interface BoardSnap { readonly moved: boolean | 'all'; readonly line: BoardTarget | null; readonly guide: BoardSnapGuide | null }

/** Whole millimetres: a snapped board stands where it can be drilled. Centred is the one exception: in a space
 * an odd number of millimetres wide the middle is half a millimetre off the grid, and equal gaps either side
 * are what centred means, so it keeps the exact middle. */
const mm = (t: BoardTarget) => t.kind === 'center' ? t.v : Math.round(t.v * 10) / 10;
const more = (a: boolean | 'all', b: boolean | 'all') => a === 'all' || b === 'all' ? 'all' : a || b;

/** Lining up a board while it is dragged: the candidates from the board-alignment rule, chosen by the shared
 * alignment rule, and moved with the same command as a free drag so a snap can never put it where a drag
 * could not. */
export function createDividerAlign({ getDesign, rules, moveDividerTo }: Ports) {
    function bays(): BayView[] {
        const dividers = getDesign().dividers ?? [];
        return rules.widths().map((width, i) => ({ width, top: rules.ceilingTop(i, 0, width),
            items: rules.computeLayout(i).map(q => ({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })),
            boards: dividers.flatMap((d, index) => d.i === i ? [{ index, orientation: d.orientation, rect: rules.dividerRect(rules.clampDivider(d)) as BayRect }] : []) }));
    }
    /** The guide for line `t` of board `index`, in the wardrobe's frame. */
    function guideFor(index: number, t: BoardTarget): BoardSnapGuide {
        const d = getDesign().dividers![index]!, ws = rules.widths(), floor = rules.interiorFloor();
        const left = (i: number) => T + ws.slice(0, i).reduce((x, w) => x + w + T, 0), g = t.src!;
        // Centred is drawn where the board now stands; anything else at the line it meets.
        const r = rules.dividerRect(rules.clampDivider(d)) as BayRect, o = g.rect, at = t.kind === 'center' ? t.v : g.at;
        if (d.orientation === 'vertical') {
            const ys = [r.y0, r.y1, ...(o ? [o.y0, o.y1] : [])];
            return { orient: 'v', pos: left(g.bay) + at, span: [floor + Math.min(...ys), floor + Math.max(...ys)], label: t.label, ...(t.kind ? { kind: t.kind } : {}) };
        }
        const xs = [left(d.i) + r.x0, left(d.i) + r.x1, ...(o ? [left(g.bay) + o.x0, left(g.bay) + o.x1] : [])];
        return { orient: 'h', pos: floor + at, span: [Math.min(...xs), Math.max(...xs)], label: t.label, ...(t.kind ? { kind: t.kind } : {}) };
    }
    /** Moves board `index` towards `raw` (its centre, in its bay's centimetres) as a drag does, lined up with
     * the nearest thing within `tolerance` that it can reach exactly; a line something stands in the way of is
     * passed over for the next. `free` (Shift) never lines up. */
    function alignDividerTo(index: number, raw: number, { tolerance, lock = null, free = false }: { tolerance: number; lock?: AlignTarget | null; free?: boolean }): BoardSnap {
        const d = getDesign().dividers?.[index];
        if (!d) return { moved: false, line: null, guide: null };
        const key = d.orientation === 'horizontal' ? 'y' : 'x';
        const targets = free ? [] : boardAlignTargets(bays(), d.i, index, T).map(t => ({ ...t, v: mm(t) }));
        let moved: boolean | 'all' = false;
        for (let tries = 0; tries < 3; tries++) {
            const line = resolveAlignment(raw, targets, { tolerance, lock });
            if (!line) break;
            moved = more(moved, moveDividerTo(index, line.v));
            if (Math.abs((getDesign().dividers![index]![key] ?? NaN) - line.v) < .001) return { moved, line, guide: guideFor(index, line) };
            targets.splice(targets.indexOf(line), 1);
        }
        return { moved: more(moved, moveDividerTo(index, raw)), line: null, guide: null };
    }
    return { alignDividerTo };
}
