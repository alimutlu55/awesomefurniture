import { PANEL as T, PLINTH as PL } from '../../wardrobe/catalog.js';
import { fittingDepth } from '../../wardrobe/carcass';
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** @typedef {ReturnType<typeof import('./fit.js').createFitRules>} FitRules */
/** @typedef {ReturnType<typeof import('./spaces.js').createSpacesRules>} SpacesRules */
/** @typedef {ReturnType<typeof import('./clearances.js').createClearanceRules>} ClearanceRules */
/** Measurements of a placed fitting for the dimension labels.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {CeilingRules & LayoutRules & FitRules & SpacesRules & ClearanceRules} deps Rules from the modules created before this one. */
export function createMeasurementsRules(ctx, deps) {
    const { getDesign } = ctx;
    const { ceilingTop, computeLayout, itemFit, itemFreeAbove, itemGaps, widths } = deps;

    function itemGeom(i, j) {
        const ws = widths(), sec = getDesign().secs[i], it = sec && sec[j];
        if (!it) {
            return null;
        }
        const bw = ws[i], bayL = T + ws.slice(0, i).reduce((a, b) => a + b + T, 0);
        const lay = computeLayout(i), pos = lay[j];
        if (!pos) {
            return null;
        }
        const wd = pos.w, off = pos.off, y0 = pos.y0, y1 = pos.y1;
        const depth = fittingDepth(getDesign().d);
        return { bw, bayL, w: wd, x0: bayL + off, x1: bayL + off + wd, gapL: off, gapR: bw - wd - off, y0, y1, h: it.h,
            z0: depth.z0, z1: depth.z1, dep: depth.depth, freeTop: itemFreeAbove(i, j) };
    }
    function itemMeasurements(i, j) {
        const g = itemGeom(i, j);
        if (!g) {
            return null;
        }
        const layout = computeLayout(i), current = layout[j];
        let support = PL + T;
        for (let k = 0; k < layout.length; k++) {
            const q = layout[k];
            if (k !== j && q.x0 < current.x1 - .01 && current.x0 < q.x1 - .01 && q.y1 <= g.y0 + .01) {
                support = Math.max(support, q.y1);
            }
        }
        const fit = itemFit(i, current, getDesign().secs[i][j]);
        const core = fit?.core && { x0: g.bayL + fit.core.x0, x1: g.bayL + fit.core.x1, w: fit.core.x1 - fit.core.x0, h: fit.core.y1 - fit.core.y0 };
        // `top`/`bottom` run to the carcass top and base board; `gapAbove`/`gapBelow` are the net gaps to whatever is
        // really there (the next fitting, a shelf board, the top or the base), measured at `lineAbove`/`lineBelow`.
        const gaps = itemGaps(i, j);
        return { ...g, cut: !!fit?.cut, core, top: Math.max(0, PL + T + ceilingTop(i, current.x0, current.x1) - g.y1), bottom: Math.max(0, g.y0 - PL - T),
            freeBelow: Math.max(0, g.y0 - support), gapAbove: gaps.above.gap, gapBelow: gaps.below.gap,
            lineAbove: { x: g.bayL + gaps.above.x, to: gaps.above.to }, lineBelow: { x: g.bayL + gaps.below.x, to: gaps.below.to } };
    }
    return { itemGeom, itemMeasurements };
}
