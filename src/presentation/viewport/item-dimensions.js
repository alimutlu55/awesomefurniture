import { MIN_CABINET_DEPTH } from '../../domain/wardrobe/cabinet-limits';
import * as THREE from "three";
import { sceneMeasurementBadge } from '../editor/scene-measurement-badge';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { measureNumber } from '../editor/editor-format.js';

/** The selected fitting's measurements on the model. At rest: its width, height and depth and the clear space
 * above and below it. While one of its edges is dragged, only what that edge changes: the size it sets, in a
 * dark tag, and the gaps it closes, drawn as dimension lines to the side panel, divider or fitting it would
 * meet (width), or to what is above it (height). Everything else waits until the drag ends.
 * @param {{ geometry: any; renderState: any; interactionState: any; inspector: any; label: (p: THREE.Vector3, text: string, cls: string) => HTMLElement;
 *   bindRuler: (el: HTMLElement, a: THREE.Vector3, b: THREE.Vector3, axis: string) => void; dimensionStroke: (points: THREE.Vector3[], group?: THREE.Object3D, order?: number) => THREE.LineSegments }} ports */
export function createItemDimensions({ geometry, renderState, interactionState, inspector, label, bindRuler, dimensionStroke }) {
    const V = THREE.Vector3, f = measureNumber;
    /** The clear run beside the fitting in its section: to the next fitting or divider, or to the side panels. */
    function sideGaps(i, j, g) {
        const others = geometry.computeLayout(i).filter((_, k) => k !== j).map(q => ({ x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1 }))
            .concat(geometry.sectionDividers(i).filter(d => d.orientation === 'vertical').map(d => {
                const r = geometry.dividerRect(geometry.clampDivider(d));
                return { x0: r.x0, x1: r.x1, y0: PLINTH + PANEL + r.y0, y1: PLINTH + PANEL + r.y1 };
            }));
        const x0 = g.x0 - g.bayL, x1 = g.x1 - g.bayL;
        let lo = 0, hi = g.bw;
        for (const q of others) {
            if (q.y0 >= g.y1 - .01 || q.y1 <= g.y0 + .01) continue;
            if (q.x1 <= x0 + .01) lo = Math.max(lo, q.x1);
            if (q.x0 >= x1 - .01) hi = Math.min(hi, q.x0);
        }
        return { left: x0 - lo, right: hi - x1, lo: g.bayL + lo, hi: g.bayL + hi };
    }
    /** Draws them for section `i`, fitting `j`, in a wardrobe `w` wide, `d` deep and `h` tall. */
    return function itemDims(i, j, w, d, h) {
        const g = geometry.itemMeasurements(i, j);
        if (!g) {
            return;
        }
        renderState.selMarks = [];
        const zf = d / 2 + 4, Pt = (x, y, z = zf) => new V(-w / 2 + x, y, z), mid = (g.x0 + g.x1) / 2;
        const gesture = interactionState.itemEdgeGesture, edge = gesture?.moved && gesture.section === i && gesture.index === j ? gesture.edge : null;
        // Individual size rulers use the same fine lines as selected free spaces; the size being dragged is a dark tag.
        const ruler = (a, b, text, axis, dragged) => {
            const el = label(a.clone().add(b).multiplyScalar(.5), text, 'lbl dim space-ruler item-dimension' + (dragged ? ' assist-size' : ''));
            if (!edge) sceneMeasurementBadge(el, { kind: 'item-size', section: i, index: j, axis: axis === 'width' ? 'w' : axis === 'height' ? 'h' : 'd' },
                'Item ' + axis, axis === 'width' ? g.w : axis === 'height' ? g.h : g.dep, axis === 'height' ? 'vertical' : 'horizontal', axis === 'depth' ? MIN_CABINET_DEPTH - 2 : 0, axis === 'depth' ? 78 : 2000);
            // The width and depth read below the fitting and the height beside it: its front stays free to press and
            // drag, and the side resize handles keep their room.
            bindRuler(el, a, b, axis === 'height' ? axis : 'under');
        };
        if (!edge || edge !== 'top') ruler(Pt(g.x0, g.y0), Pt(g.x1, g.y0), 'W ' + f(g.w) + ' cm', 'width', !!edge);
        if (!edge || edge === 'top') ruler(Pt(g.x1, g.y0), Pt(g.x1, g.y1), 'H ' + f(g.h) + ' cm', 'height', !!edge);
        if (!edge) ruler(Pt(g.x0, g.y0, -d / 2 + .5), Pt(g.x0, g.y0, d / 2 - 1.5), 'D ' + f(g.dep) + ' cm', 'depth', false);
        // Selected item and clearances use the same fine strokes as the wardrobe rulers.
        const fz = d / 2 + .6, A = Pt(g.x0, g.y0, fz), B = Pt(g.x1, g.y0, fz), C = Pt(g.x1, g.y1, fz), D = Pt(g.x0, g.y1, fz);
        renderState.selMarks.push(dimensionStroke([A, B, B, C, C, D, D, A], renderState.Gr, 14));
        /** A green bar along an edge: it touches what is there. */
        const touching = (a, b) => {
            const bar = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: new THREE.Color('#2f8a57').convertSRGBToLinear(), toneMapped: false, depthTest: false }));
            bar.renderOrder = 30;
            renderState.Gr.add(bar);
            renderState.selMarks.push(bar);
        };
        const gap = (a, b, value, cls) => {
            const tick = Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? new V(2, 0, 0) : new V(0, 2, 0);
            if (value > .1) renderState.selMarks.push(dimensionStroke([a, b, a.clone().sub(tick), a.clone().add(tick), b.clone().sub(tick), b.clone().add(tick)]));
            else if (cls.includes('assist')) {
                touching(a.clone().sub(tick.clone().multiplyScalar(4)), a.clone().add(tick.clone().multiplyScalar(4)));
                return null;
            }
            return label(value > .1 ? a.clone().add(b).multiplyScalar(.5) : a, value > .1 ? f(value) + ' cm' : '0 cm', cls);
        };
        if (edge === 'left' || edge === 'right') {
            const s = sideGaps(i, j, g), y = (g.y0 + g.y1) / 2;
            // The touching side is drawn at the fitting's edge, not at the far end of a zero gap.
            gap(Pt(g.x0, y), Pt(s.lo, y), s.left, 'lbl assist-gap');
            gap(Pt(g.x1, y), Pt(s.hi, y), s.right, 'lbl assist-gap');
            return;
        }
        const clear = (y0, y1, value, side, cls = 'lbl dim clearance') => {
            const el = y1 - y0 > .1 || cls.includes('assist') ? gap(Pt(mid, y0), Pt(mid, y1), value, cls) : label(Pt(mid, y0 + (y0 >= h / 2 ? 6 : -6)), '0 cm', cls);
            if (el && !edge) inspector.editableItemClearance(el, i, j, side);
        };
        if (edge === 'top') {
            clear(g.y1, g.y1 + g.top, g.top, 'top', 'lbl assist-gap');
            return;
        }
        clear(g.y1, g.y1 + g.top, g.top, 'top');
        clear(PLINTH + PANEL, g.y0, g.bottom, 'bottom');
    };
}
