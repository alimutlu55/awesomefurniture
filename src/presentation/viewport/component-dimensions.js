import { measureNumber as f } from '../editor/editor-format.js';

/** What a selected fitting needs measured beyond its size and gaps, by what it is (from the domain clearance
 * rules, never from kind names): an open shelf's clear opening between its own boards, a hanging rail's height
 * against the Reach line and the drop below it, and a drawer's whole stack with the clear height above the
 * stack. All are net figures (`net`), read-only, drawn inside the fitting's bay.
 * @param {{ geometry: any; label: (p: import('three').Vector3, text: string, cls: string) => HTMLElement;
 *   bindRuler: (el: HTMLElement, a: import('three').Vector3, b: import('three').Vector3, axis: string) => void }} ports */
export function createComponentDimensions({ geometry, label, bindRuler }) {
    const NET = 'lbl dim space-ruler item-dimension net';
    const ruler = (a, b, text, cls = NET, axis = 'height') => {
        const el = label(a.clone().add(b).multiplyScalar(.5), text, cls);
        bindRuler(el, a, b, axis);
        return el;
    };
    /** @param {number} i @param {number} j @param {any} g itemMeasurements @param {(x: number, y: number, z?: number) => import('three').Vector3} Pt
     * @param {number | undefined} reach Reach height from the floor. */
    return function componentDims(i, j, g, Pt, reach) {
        // Inside an open shelf: its clear opening, a little in from the left so the H ruler keeps the right edge.
        const open = geometry.netOpening(i, j);
        if (open && Math.abs(open.h - g.h) > .05) ruler(Pt(g.x0 + Math.min(6, g.w / 4), open.y0), Pt(g.x0 + Math.min(6, g.w / 4), open.y1), f(open.h) + ' cm clear');
        // A rail: the drop below it to what is there, and its height against Reach.
        const rail = geometry.railDrop(i, j);
        if (rail) {
            const x = g.x0 + Math.min(6, g.w / 4), lip = rail.y - rail.drop;
            if (rail.drop > .1) ruler(Pt(x, lip), Pt(x, rail.y), 'Drop ' + f(rail.drop) + ' cm');
            const over = reach === undefined ? 0 : rail.y - reach;
            const relation = reach === undefined ? '' : over > .05 ? ' · ' + f(over) + ' cm above Reach' : ' · within Reach';
            label(Pt(g.x1 - Math.min(6, g.w / 4), rail.y + 4), 'Rail ' + f(rail.y) + ' cm' + relation, 'lbl dim rail-height net' + (over > .05 ? ' over-reach' : ''));
        }
        // A drawer in a stack: the whole stack's height, and what is left clear above the stack.
        const stack = geometry.drawerStack(i, j);
        if (stack && stack.count > 1) {
            const x = g.x0 + Math.min(6, g.w / 4);
            ruler(Pt(x, stack.y0), Pt(x, stack.y1), 'Stack ' + f(stack.h) + ' cm · ' + stack.count + ' drawers');
            if (stack.y1 > g.y1 + .05 && stack.above.gap > .1) ruler(Pt(g.bayL + stack.above.x, stack.y1), Pt(g.bayL + stack.above.x, stack.y1 + stack.above.gap), f(stack.above.gap) + ' cm above stack');
        }
    };
}
