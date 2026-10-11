import { WardrobePlanner } from '../../planner/wardrobe-planner.js';
import { MODS, FIN } from '../../wardrobe/catalog.js';
import { elevationArea, shapePanels } from '../../wardrobe/shape/wardrobe-shape';
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** Price estimate and storage statistics.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {CeilingRules & LayoutRules} deps Rules from the modules created before this one. */
export function createCostingRules(ctx, deps) {
    const { getDesign } = ctx;
    const { ih, shapeInfo, used, widths } = deps;

    function cost() {
        const { shape } = shapeInfo(), D = getDesign(), top = shapePanels(shape), sides = top.filter(p => p.kind === 'side').reduce((s, p) => s + p.length, 0), boards = top.filter(p => p.kind !== 'side').reduce((s, p) => s + p.length, 0), parts = widths().slice(0, -1).reduce((s, w, i) => s + Math.min(ih(i), ih(i + 1)), 0);
        const f = Number(FIN[D.fin][1]), a = (sides * D.d + (boards + D.w) * D.d + parts * D.d + elevationArea(shape)) / 1e4, panels = a * 38 * f;
        let mods = 0;
        {
            const cw = widths();
            getDesign().secs.slice(0, getDesign().n).forEach((s, i) => s.forEach(it => mods += MODS[it.k].p * (.6 + .4 * it.h / MODS[it.k].h) * (.5 + .5 * WardrobePlanner.itemWidth(it, cw[i]) / cw[i])));
        }
        const doors = getDesign().doors === 'none' ? 0 : getDesign().n * (getDesign().doors === 'glass' ? 55 : 35) * (getDesign().h / 230) * f;
        return { panels: Math.round(panels), mods: Math.round(mods), doors: Math.round(doors), total: Math.round(panels + mods + doors) };
    }
    function stats() {
        const ws = widths();
        let hang = 0, shelf = 0, dr = 0, shoe = 0, mods = 0, fills = [], types = new Set();
        for (let i = 0; i < getDesign().n; i++) {
            fills.push(used(i) / ih(i));
            getDesign().secs[i].forEach(it => {
                const k = it.k;
                mods++;
                types.add(k);
                const iwd = WardrobePlanner.itemWidth(it, ws[i]);
                if (k === 'short' || k === 'long' || k === 'lift') {
                    hang += (it.front ? getDesign().d - 10 : iwd) / 100;
                }
                if (['shelf', 'shoe', 'folded', 'seasonal'].includes(k)) {
                    shelf += iwd * getDesign().d / 1e4;
                }
                if (k === 'drawer' || k === 'sdrawer') {
                    dr++;
                }
                if (k === 'shoe') {
                    shoe++;
                }
            });
        }
        const avg = fills.reduce((a, b) => a + b) / getDesign().n;
        return { hang, shelf, drawers: dr, shoe, mods, avg, maxFill: Math.max(...fills), allUsed: fills.every(f => f > 0), types: types.size, cost: cost() };
    }
    return { cost, stats };
}
