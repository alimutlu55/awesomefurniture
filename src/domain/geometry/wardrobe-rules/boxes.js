import { PANEL as T, PLINTH as PL } from '../../wardrobe/catalog.js';
/** @typedef {ReturnType<typeof import('./dividers.js').createDividersRules>} DividersRules */
/** Boxed fittings: whether they are capped and supported.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {DividersRules} deps Rules from the modules created before this one. */
export function createBoxesRules(ctx, deps) {
    const { getDesign } = ctx;
    const { dividerRect, sectionDividers } = deps;

    const isBoxed = it => ['shelf', 'seasonal', 'basket'].includes(it.k) && !(it.k === 'shelf' && ['folded', 'pants'].includes(it.purpose)) && (it.k === 'seasonal' || ['seasonal', 'linen', 'luggage'].includes(it.purpose));
    function boxCapped(i, j, lay) {
        const p = lay[j], sec = getDesign().secs[i];
        return !!p && lay.some((q, k) => k !== j && sec[k] && q.x0 < p.x1 - .01 && p.x0 < q.x1 - .01 && Math.abs(q.y0 - p.y1) < .06 && !isBoxed(sec[k]));
    }
    function boxSupported(i, j, lay, floorY) {
        const p = lay[j];
        if (!p) {
            return true;
        }
        if (p.y0 <= floorY + .05) {
            return true;
        }
        const sec = getDesign().secs[i];
        return lay.some((q, k) => k !== j && sec[k] && q.x0 < p.x1 - .01 && p.x0 < q.x1 - .01 && Math.abs(q.y1 - p.y0) < .06 && !isBoxed(sec[k]))
            || sectionDividers(i).some(d => {
                const r = dividerRect(d);
                return d.orientation === 'horizontal' && r.x0 < p.x1 - .01 && r.x1 > p.x0 + .01 && Math.abs(PL + T + r.y1 - p.y0) < .06;
            });
    }
    return { isBoxed, boxCapped, boxSupported };
}
