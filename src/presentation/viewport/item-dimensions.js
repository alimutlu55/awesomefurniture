import * as THREE from "three";
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { measureNumber } from '../editor/editor-format.js';

/** The selected fitting's measurements on the model: its width, height and depth and the clear space above
 * and below it.
 * @param {{ geometry: any; renderState: any; interactionState: any; inspector: any; label: (p: THREE.Vector3, text: string, cls: string) => HTMLElement;
 *   bindRuler: (el: HTMLElement, a: THREE.Vector3, b: THREE.Vector3, axis: string) => void; dimensionStroke: (points: THREE.Vector3[], group?: THREE.Object3D, order?: number) => THREE.LineSegments }} ports */
export function createItemDimensions({ geometry, renderState, inspector, label, bindRuler, dimensionStroke }) {
    const V = THREE.Vector3;
    /** Draws them for section `i`, fitting `j`, in a wardrobe `w` wide, `d` deep and `h` tall. */
    return function itemDims(i, j, w, d, h) {
        const g = geometry.itemMeasurements(i, j);
        if (!g) {
            return;
        }
        renderState.selMarks = [];
        const zf = d / 2 + 4, Pt = (x, y, z = zf) => new V(-w / 2 + x, y, z), mid = (g.x0 + g.x1) / 2, f = measureNumber;
        // Individual size rulers use the same fine lines as selected free spaces.
        const ruler = (a, b, text, axis) => {
            const el = label(a.clone().add(b).multiplyScalar(.5), text, 'lbl dim space-ruler item-dimension');
            bindRuler(el, a, b, axis);
        };
        ruler(Pt(g.x0, g.y0), Pt(g.x1, g.y0), 'W ' + f(g.w) + ' cm', 'width');
        ruler(Pt(g.x1, g.y0), Pt(g.x1, g.y1), 'H ' + f(g.h) + ' cm', 'height');
        ruler(Pt(g.x0, g.y0, -d / 2 + .5), Pt(g.x0, g.y0, d / 2 - 1.5), 'D ' + f(g.dep) + ' cm', 'depth');
        // Selected item and clearances use the same fine strokes as the wardrobe rulers.
        const fz = d / 2 + .6, A = Pt(g.x0, g.y0, fz), B = Pt(g.x1, g.y0, fz), C = Pt(g.x1, g.y1, fz), D = Pt(g.x0, g.y1, fz);
        renderState.selMarks.push(dimensionStroke([A, B, B, C, C, D, D, A], renderState.Gr, 14));
        const clear = (y0, y1, txt, side) => {
            let el;
            if (y1 - y0 > .1) {
                const a = Pt(mid, y0), b = Pt(mid, y1), tick = new V(2, 0, 0);
                renderState.selMarks.push(dimensionStroke([a, b, a.clone().sub(tick), a.clone().add(tick), b.clone().sub(tick), b.clone().add(tick)]));
                el = label(Pt(mid, (y0 + y1) / 2), txt + ' cm', 'lbl dim clearance');
            }
            else {
                el = label(Pt(mid, y0 + (y0 >= h / 2 ? 6 : -6)), '0 cm', 'lbl dim clearance');
            }
            inspector.editableItemClearance(el, i, j, side);
        };
        clear(g.y1, g.y1 + g.top, f(g.top), 'top');
        clear(PLINTH + PANEL, g.y0, f(g.bottom), 'bottom');
    };
}
