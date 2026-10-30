import { PANEL } from '../../domain/wardrobe/catalog';
import { boardAlignTargets, type BayView } from '../../domain/geometry/board-alignment';
import { axisGuide, type GuideFrame, type SmartGuide } from './smart-guides';
type Geometry = ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>;
type State = import('../../application/projects/editor-scene').EditorState;
export interface GuideRect { x0: number; x1: number; y0: number; y1: number }

/** Fittings align to the frame, centres, other fittings and boards, including levels in neighbouring bays. */
export function fittingSmartGuides(state: State, geometry: Geometry, section: number, index: number,
    rect: GuideRect, frame: GuideFrame, axis?: 'x' | 'y', edge?: string): SmartGuide[] {
    const widths = geometry.widths(), left = (i: number) => PANEL + widths.slice(0, i).reduce((a, w) => a + w + PANEL, 0);
    const base = left(section), floor = geometry.interiorFloor(), out: SmartGuide[] = [];
    const add = (key: string, label: string, a: 'x' | 'y', value: number, target: number, span: [number, number]) => {
        if (!axis || axis === a) out.push(axisGuide(key, label, a, value, target, span, frame));
    };
    const xs = edge === 'left' ? [rect.x0] : edge === 'right' ? [rect.x1] : [rect.x0, (rect.x0 + rect.x1) / 2, rect.x1];
    const ys = edge === 'bottom' ? [rect.y0] : edge === 'top' ? [rect.y1] : [rect.y0, (rect.y0 + rect.y1) / 2, rect.y1];
    const vertical = (id: string, label: string, targets: number[], other = rect) => {
        for (const [k, v] of xs.entries()) for (const [j, target] of targets.entries()) {
            add(`${id}:x:${k}:${j}`, label, 'x', base + v, base + target,
                [Math.min(rect.y0, other.y0), Math.max(rect.y1, other.y1)]);
        }
    };
    const horizontal = (id: string, label: string, targets: number[], x0: number, x1: number) => {
        for (const [k, v] of ys.entries()) for (const [j, target] of targets.entries()) {
            add(`${id}:y:${k}:${j}`, label, 'y', v, target, [Math.min(base + rect.x0, x0), Math.max(base + rect.x1, x1)]);
        }
    };
    vertical('frame', 'Aligned with side', [0, widths[section]!]);
    vertical('centre', 'Centred in section', [widths[section]! / 2]);
    horizontal('frame', 'Aligned with base / top', [floor, floor + geometry.ceilingTop(section, rect.x0, rect.x1)], base, base + widths[section]!);
    for (let i = 0; i < state.n; i++) {
        const others: GuideRect[] = geometry.computeLayout(i).filter((_: unknown, j: number) => i !== section || j !== index);
        for (const d of state.dividers ?? []) if (d.i === i) {
            const r = geometry.dividerRect(geometry.clampDivider(d));
            others.push({ ...r, y0: floor + r.y0, y1: floor + r.y1 });
        }
        others.forEach((o: GuideRect, j: number) => {
            const id = `other:${i}:${j}`;
            horizontal(id, 'Aligned with neighbour', [o.y0, (o.y0 + o.y1) / 2, o.y1], left(i) + o.x0, left(i) + o.x1);
            if (i === section) vertical(id, 'Aligned with neighbour', [o.x0, (o.x0 + o.x1) / 2, o.x1], o);
            if (edge === 'top') horizontal(id + ':size', 'Same height', [rect.y0 + o.y1 - o.y0], left(i) + o.x0, left(i) + o.x1);
            if (edge === 'bottom') horizontal(id + ':size', 'Same height', [rect.y1 - (o.y1 - o.y0)], left(i) + o.x0, left(i) + o.x1);
            if (i === section && edge === 'right') vertical(id + ':size', 'Same width', [rect.x0 + o.x1 - o.x0], o);
            if (i === section && edge === 'left') vertical(id + ':size', 'Same width', [rect.x1 - (o.x1 - o.x0)], o);
        });
    }
    return out;
}

/** A read-only board adapter: querying a guide never moves a board or the contents resting on it. */
export function boardSmartGuides(state: State, geometry: Geometry, index: number, frame: GuideFrame): SmartGuide[] {
    const d = state.dividers?.[index];
    if (!d) return [];
    const ws = geometry.widths(), floor = geometry.interiorFloor();
    const left = (i: number) => PANEL + ws.slice(0, i).reduce((a, w) => a + w + PANEL, 0);
    const bays: BayView[] = ws.map((width: number, i: number) => ({ width, top: geometry.ceilingTop(i, 0, width),
        items: geometry.computeLayout(i).map((q: GuideRect & { relY0: number; relY1: number }) => ({ ...q, y0: q.relY0, y1: q.relY1 })),
        boards: (state.dividers ?? []).flatMap((b, k) => b.i === i
            ? [{ index: k, orientation: b.orientation, rect: geometry.dividerRect(geometry.clampDivider(b)) }] : []) }));
    const rect = geometry.dividerRect(geometry.clampDivider(d)), horizontal = d.orientation === 'horizontal';
    return boardAlignTargets(bays, d.i, index, PANEL).map((t, k) => {
        const source = t.src!, other = source.rect ?? rect;
        const span: [number, number] = horizontal
            ? [Math.min(left(d.i) + rect.x0, left(source.bay) + other.x0), Math.max(left(d.i) + rect.x1, left(source.bay) + other.x1)]
            : [floor + Math.min(rect.y0, other.y0), floor + Math.max(rect.y1, other.y1)];
        return axisGuide(`board:${k}`, t.label, horizontal ? 'y' : 'x',
            horizontal ? floor + d.y! + source.at - t.v : left(d.i) + d.x! + source.at - t.v,
            horizontal ? floor + source.at : left(source.bay) + source.at, span, frame);
    });
}
