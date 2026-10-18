import { WardrobePlanner } from '../../planner/wardrobe-planner.js';
import { PANEL as T } from '../../wardrobe/catalog.js';
import { sectionWidths } from '../../wardrobe/shape/wardrobe-shape';
import { plinthOf } from '../../wardrobe/carcass';
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** Section widths, fitting positions in a section, and used and free height.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {CeilingRules} deps Rules from the modules created before this one. */
export function createLayoutRules(ctx, deps) {
    const { getDesign } = ctx;
    /** The plinth under this design's carcass (none under a wall unit). */
    const plinth = () => plinthOf(getDesign());
    const { ceilingIn, ceilingTop } = deps;

    /** Net bay widths in whole millimetres; they close exactly on the outer width (sectionWidths). */
    /** Where the clear interior starts: the top of the base board over its plinth (a wall unit has none). */
    const interiorFloor = () => plinth() + T;
    const widths = () => sectionWidths(getDesign());
    function computeLayout(i, secArg, bwArg) {
        const bw = bwArg !== undefined ? bwArg : widths()[i], sec = secArg !== undefined ? secArg : getDesign().secs[i];
        if (!sec || !sec.length) {
            return [];
        }
        return WardrobePlanner.layoutSection(sec, bw).map(p => ({ relY0: p.y0, relY1: p.y1, y0: plinth() + T + p.y0, y1: plinth() + T + p.y1, x0: p.x0, x1: p.x1, w: p.w, off: p.off, h: p.h }));
    }
    /** Tallest clear height of a section, or of the whole cabinet without an index. */
    const ih = i => {
        const ws = widths();
        if (i !== undefined) {
            return ws[i] === undefined ? 0 : ceilingTop(i, 0, ws[i]);
        }
        return Math.max(...ws.map((w, k) => ceilingTop(k, 0, w)));
    };
    const used = i => {
        const l = computeLayout(i);
        return l.length ? Math.max(...l.map(p => p.relY1)) : 0;
    };
    const free = i => Math.round((ceilingIn(i, 0, widths()[i] ?? 0) - used(i)) * 10) / 10;
    function currentLayout() {
        const ws = widths();
        return { sections: ws.map((width, i) => ({ width, items: getDesign().secs[i] || [], role: 'Section ' + (i + 1) })) };
    }
    return { widths, computeLayout, ih, used, free, currentLayout, interiorFloor };
}
