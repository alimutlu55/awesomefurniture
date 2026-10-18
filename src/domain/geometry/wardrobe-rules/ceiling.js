import { PANEL as T } from '../../wardrobe/catalog.js';
import { resolveShape, ceilingPieces, ceilingMin, ceilingMax, ceilingPolyline, fitSpans, sectionOrigins } from '../../wardrobe/shape/wardrobe-shape';
import { bestWindowClear, clipBelowTop } from '../../wardrobe/shape/angle-cut';
import { plinthOf } from '../../wardrobe/carcass';
/** The wardrobe top: clear height over any span, its outline, and cutting shapes to its angle.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {{}} deps Rules from the modules created before this one. */
export function createCeilingRules(ctx, deps) {
    const { getDesign } = ctx;
    /** The plinth under this design's carcass (none under a wall unit). */
    const plinth = () => plinthOf(getDesign());
    void deps;

    /** Resolved skeleton for the current design: every section's clear height comes
     * from the same top profile, whatever template created it. */
    function shapeInfo() {
        const shape = resolveShape(getDesign());
        return { shape, pieces: ceilingPieces(shape), origins: sectionOrigins(getDesign()) };
    }
    const floor2 = v => Math.floor(v * 100 + 1e-6) / 100;
    /** Clear height above the base board over a section-local span (lowest point). */
    function ceilingIn(i, x0, x1) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return floor2(ceilingMin(pieces, o + Math.min(x0, x1), o + Math.max(x0, x1)) - plinth() - T);
    }
    /** Highest clear point over a section-local span. */
    function ceilingTop(i, x0, x1) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return floor2(ceilingMax(pieces, o + Math.min(x0, x1), o + Math.max(x0, x1)) - plinth() - T);
    }
    /** Section-local underside of the top, left to right, relative to the base board. */
    function ceilingOutline(i, x0, x1) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return ceilingPolyline(pieces, o + x0, o + x1).map(p => ({ x: p.x - o, y: p.y - plinth() - T }));
    }
    /** Parts of a section span with at least `top` cm of clear height. */
    function clearSpans(i, x0, x1, top) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return fitSpans(pieces, o + x0, o + x1, top + plinth() + T - 1e-6).map(q => ({ x0: q.x0 - o, x1: q.x1 - o }));
    }
    /** Highest clear height (relative) that a window of width w inside a span reaches everywhere. */
    function windowClear(i, x0, x1, w) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return floor2(bestWindowClear(pieces, o + x0, o + x1, w) - plinth() - T);
    }
    /** Outline of a section-local rectangle cut to the top; x section-local, y absolute. */
    function cutOutline(i, x0, x1, y0, y1) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return clipBelowTop(pieces, o + x0, o + x1, y0, y1).map(poly => poly.map(p => ({ x: p.x - o, y: p.y })));
    }
    return { shapeInfo, floor2, ceilingIn, ceilingTop, ceilingOutline, clearSpans, windowClear, cutOutline };
}
