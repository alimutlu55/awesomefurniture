import { MIN_SEGMENT, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { profileAt, type ShapeSide } from '../../domain/wardrobe/shape/shape-handle-edit';

interface Ports {
    current(): { id: number; w: number; d: number; shape: WardrobeShape };
    point(e: PointerEvent, side: ShapeSide): { x: number; y: number } | null;
    rebuild(): void;
    insert(index: number, x: number): void;
}
/** Like the ceiling's insertion cursor: dragging chooses a position, tapping
 * inserts one point. Moving or cancelling the cursor never changes the design. */
export function createShapeSplitCursor(ports: Ports) {
    let owner: number | undefined;
    let positions: Partial<Record<ShapeSide, number>> = {};
    function panels(side: ShapeSide) {
        const current = ports.current();
        if (owner !== current.id) { owner = current.id; positions = {}; }
        const top = profileAt(current.shape, side).top;
        return top.slice(0, -1).flatMap((a, index) => {
            const b = top[index + 1]!, span = b.x - a.x;
            return span >= 2 * MIN_SEGMENT ? [{ a, b, index, span }] : [];
        });
    }
    function marker(side: ShapeSide) {
        const candidates = panels(side), position = positions[side];
        const distance = (p: typeof candidates[number]) => position === undefined ? -p.span
            : Math.abs(position - Math.max(p.a.x + MIN_SEGMENT, Math.min(p.b.x - MIN_SEGMENT, position)));
        const panel = candidates.sort((a, b) => distance(a) - distance(b) || a.index - b.index)[0];
        if (!panel) return null;
        const { a, b, index, span } = panel, { w, d } = ports.current();
        const at = Math.max(a.x + MIN_SEGMENT, Math.min(b.x - MIN_SEGMENT, position ?? (a.x + b.x) / 2));
        return { index, side, at, x: at - w / 2, y: a.y + (b.y - a.y) * (at - a.x) / span,
            z: (side === 'rear' ? -1 : 1) * (d / 2 + 2), ok: true };
    }
    function move(e: PointerEvent, side: ShapeSide) {
        const point = ports.point(e, side);
        if (!point) return;
        let best: { distance: number; x: number } | undefined;
        for (const { a, b, span } of panels(side)) {
            const rise = b.y - a.y;
            const f = Math.max(MIN_SEGMENT / span, Math.min(1 - MIN_SEGMENT / span,
                ((point.x - a.x) * span + (point.y - a.y) * rise) / (span * span + rise * rise)));
            const x = a.x + span * f, y = a.y + rise * f, distance = Math.hypot(point.x - x, point.y - y);
            if (!best || distance < best.distance) best = { distance, x };
        }
        if (best) { positions[side] = Math.round(best.x * 10) / 10; ports.rebuild(); }
    }
    return {
        splitMarkers: () => (['front', 'rear'] as const).flatMap(side => { const m = marker(side); return m ? [m] : []; }),
        moveSplitCursor: move,
        splitPosition: (side: ShapeSide) => { marker(side); return positions[side]; },
        restoreSplitCursor(side: ShapeSide, position: number | undefined) {
            if (position === undefined) delete positions[side]; else positions[side] = position;
            ports.rebuild();
        },
        nudgeSplitCursor(side: ShapeSide, delta: number) {
            const m = marker(side);
            if (m) { positions[side] = m.at + delta; ports.rebuild(); }
        },
        insertSplitPoint(side: ShapeSide) {
            const m = marker(side);
            if (m) { positions = {}; ports.insert(m.index, m.at); }
        },
    };
}
