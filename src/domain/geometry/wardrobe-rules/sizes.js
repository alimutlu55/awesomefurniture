import { WardrobePlanner } from '../../planner/wardrobe-planner.js';
import { MODS, PANEL as T } from '../../wardrobe/catalog.js';
import { hasTrait } from '../../wardrobe/fittings';
/** Fitting size rules: minimum widths and heights, feasibility, new items, bay counts.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {{}} deps Rules from the modules created before this one. */
export function createSizesRules(ctx, deps) {
    const { getDesign } = ctx;
    void deps;

    const maxN = () => Math.max(1, Math.min(6, Math.floor((getDesign().w - T) / (25 + T))));
    const itemMinW = it => it.front ? 55 : MODS[it.k].w;
    function effectiveMin(k) {
        return k === 'long' ? Math.max(MODS[k].mn, WardrobePlanner.longMin(getDesign().profile.longDrop)) : MODS[k].mn;
    }
    function itemFeasible(k, w) {
        const m = MODS[k], front = (k === 'short' || k === 'long') && getDesign().d < 55;
        return getDesign().d >= (front ? 35 : m.d) && w >= (front ? 55 : m.w) && !(k === 'lift' && !getDesign().profile.allowLift);
    }
    function newItem(k, h) {
        return { k, h, purpose: MODS[k].purpose, ...((k === 'short' || k === 'long') && getDesign().d < 55 ? { front: true } : {}) };
    }
    function splitFor(k) {
        return false;
    }
    const bayMinW = i => {
        const items = getDesign().secs[i] || [];
        let full = items.length && items.every(it => hasTrait(it.k, 'filler')) ? 1.4 : 25, L = 0, R = 0;
        for (const it of items) {
            const mw = itemMinW(it);
            if (it.w && it.ax === 'l') {
                L = Math.max(L, mw);
            }
            else if (it.w && it.ax === 'r') {
                R = Math.max(R, mw);
            }
            else {
                full = Math.max(full, mw);
            }
        }
        return Math.max(full, L + R);
    };
    const minTotal = () => {
        let t = (getDesign().n + 1) * T;
        for (let i = 0; i < getDesign().n; i++) {
            t += bayMinW(i);
        }
        return Math.ceil(t * 10) / 10;
    };
    const okItem = (it, bw) => {
        const w = it.w ? Math.min(it.w, bw) : bw, front = (it.k === 'short' || it.k === 'long') && getDesign().d < 55, m = MODS[it.k];
        return getDesign().d >= (front ? 35 : m.d) && w >= (front ? 55 : m.w) - .01 && !(it.k === 'lift' && !getDesign().profile.allowLift);
    };
    return { itemMinW, effectiveMin, itemFeasible, newItem, splitFor, okItem, bayMinW, minTotal, maxN };
}
