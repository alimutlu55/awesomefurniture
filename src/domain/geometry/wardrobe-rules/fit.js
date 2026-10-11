/** @typedef {ReturnType<typeof import('./sizes.js').createSizesRules>} SizesRules */
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** Whether fittings fit under the top, and how much they overflow it.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {SizesRules & CeilingRules & LayoutRules} deps Rules from the modules created before this one. */
export function createFitRules(ctx, deps) {
    const { getDesign } = ctx;
    const { ceilingIn, ceilingTop, clearSpans, computeLayout, effectiveMin, itemMinW, windowClear } = deps;

    /** How a fitting meets the top. Every fitting's enclosure (boards, front,
     * highlight) is cut to the top's angle; its working core (drawer box, rail,
     * basket, contents) is the largest rectangle that fits: the fitting's own
     * height where a wide enough part allows it, else down to its minimum height.
     * Null when even the minimum core cannot fit. Section-local, relative to the base. */
    function itemFit(i, q, it) {
        const x0 = q.x0, x1 = q.x1, y0 = q.relY0, y1 = q.relY1;
        if (y1 <= ceilingIn(i, x0, x1) + .01) {
            return { cut: false, core: { x0, x1, y0, y1 } };
        }
        if (!it || y1 > ceilingTop(i, x0, x1) + .01) {
            return null;
        }
        const minW = Math.min(itemMinW(it), x1 - x0), mn = Math.min(effectiveMin(it.k), y1 - y0);
        const h = Math.min(y1 - y0, windowClear(i, x0, x1, minW) - y0);
        if (h < mn - .01) {
            return null;
        }
        const span = clearSpans(i, x0, x1, y0 + h).filter(s => s.x1 - s.x0 >= minW - .01).sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0];
        return span ? { cut: true, core: { x0: span.x0, x1: span.x1, y0, y1: y0 + h } } : null;
    }
    const fitsCeiling = (i, q, it) => !!itemFit(i, q, it);
    /** How far the least fitting item is from fitting under the top (0 when all fit). */
    function itemOverflow(i, q, it) {
        if (itemFit(i, q, it)) {
            return 0;
        }
        if (!it) {
            return Math.max(0, q.relY1 - ceilingIn(i, q.x0, q.x1));
        }
        const minW = Math.min(itemMinW(it), q.x1 - q.x0), mn = Math.min(effectiveMin(it.k), q.relY1 - q.relY0);
        return Math.max(.06, q.relY1 - ceilingTop(i, q.x0, q.x1), q.relY0 + mn - windowClear(i, q.x0, q.x1, minW));
    }
    function overflow(i, layout = computeLayout(i), items = getDesign().secs[i] || []) {
        return Math.max(0, ...layout.map((q, j) => itemOverflow(i, q, items[j])));
    }
    /** Every fitting in a section with its cut and working core, for rendering and measuring. */
    function sectionFits(i) {
        return overflow(i) <= .05;
    }
    function fittingFit(i, j) {
        const lay = computeLayout(i), q = lay[j], it = getDesign().secs[i]?.[j];
        return q && it ? itemFit(i, q, it) : null;
    }
    return { itemFit, fitsCeiling, itemOverflow, overflow, sectionFits, fittingFit };
}
