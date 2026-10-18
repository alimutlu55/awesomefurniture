import { PANEL as T } from '../../wardrobe/catalog.js';
import { hasTrait } from '../../wardrobe/fittings';
import { interiorFloorOf, RAIL_DROP } from '../../wardrobe/carcass';
import { fittingPanels } from '../shared-board-spans';
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** @typedef {ReturnType<typeof import('./fit.js').createFitRules>} FitRules */
/** @typedef {ReturnType<typeof import('./dividers.js').createDividersRules>} DividersRules */
/** @typedef {{ x0: number; x1: number; y0: number; y1: number }} Rect Section-local x, y from the floor. */
/** @typedef {'fitting' | 'board' | 'top' | 'base'} Limit What a clearance runs to. */
/** @typedef {{ gap: number; y: number; x: number; to: Limit }} Clearance Net gap, the face it ends on and the x to draw it at. */

/** Net clearances a carpenter measures: from a fitting's face to the face of whatever is really there (the
 * next fitting, a shelf board, the top or the base board), never through it. Also the rail drop of a hanging
 * fitting, the height of a drawer stack and the clear opening inside an open shelf (its pitch minus its own
 * boards). Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {CeilingRules & LayoutRules & FitRules & DividersRules} deps Rules from the modules created before this one. */
export function createClearanceRules(ctx, deps) {
    const { getDesign } = ctx;
    /** Where the clear interior starts: the top of the base board (the floor of a wall unit is its lower edge). */
    const floor = () => interiorFloorOf(getDesign());
    const { ceilingIn, ceilingTop, ceilingOutline, computeLayout, sectionDividers, dividerRect, clampDivider, itemFit } = deps;
    const round = v => Math.round(v * 100) / 100;
    /** Everything fixed in a section: fittings (layout) and shelf boards and dividers, as section rects.
     * @returns {(Rect & { to: Limit })[]} */
    function sectionObstacles(i, layout = computeLayout(i)) {
        const boards = sectionDividers(i).map(d => {
            const r = dividerRect(d.orientation === 'vertical' ? clampDivider(d) : d);
            return { x0: r.x0, x1: r.x1, y0: floor() + r.y0, y1: floor() + r.y1, to: /** @type {Limit} */ ('board') };
        });
        return layout.map(q => ({ x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1, to: /** @type {Limit} */ ('fitting') })).concat(boards);
    }
    /** Net gaps above and below `rect` in section `i`, to the nearest obstacle over its width (or the top and base).
     * A gap is drawn where it is measured: over the part of the rect the limiting obstacle covers.
     * @param {number} i @param {Rect} rect @param {(Rect & { to?: Limit })[]} obstacles
     * @returns {{ above: Clearance; below: Clearance }} */
    function gapsAround(i, rect, obstacles) {
        const over = o => o.x0 < rect.x1 - .01 && rect.x0 < o.x1 - .01, mid = (rect.x0 + rect.x1) / 2;
        const lineX = o => (Math.max(rect.x0, o.x0) + Math.min(rect.x1, o.x1)) / 2;
        const topAt = floor() + ceilingIn(i, mid - .5, mid + .5);
        let above = { y: Math.max(rect.y1, topAt), x: mid, to: /** @type {Limit} */ ('top') };
        let below = { y: floor(), x: mid, to: /** @type {Limit} */ ('base') };
        for (const o of obstacles) {
            if (!over(o)) continue;
            if (o.y0 >= rect.y1 - .01 && o.y0 < above.y) above = { y: o.y0, x: lineX(o), to: o.to ?? 'fitting' };
            if (o.y1 <= rect.y0 + .01 && o.y1 > below.y) below = { y: o.y1, x: lineX(o), to: o.to ?? 'fitting' };
        }
        return { above: { ...above, gap: round(Math.max(0, above.y - rect.y1)) }, below: { ...below, gap: round(Math.max(0, rect.y0 - below.y)) } };
    }
    /** Net gaps of fitting j in section i to its real neighbours. */
    function itemGaps(i, j) {
        const layout = computeLayout(i), q = layout[j];
        if (!q) return null;
        return gapsAround(i, { x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1 }, sectionObstacles(i, layout).filter((_, k) => k !== j));
    }
    /** A hanging fitting's rail: its height from the floor and the clear drop below it to what is there. */
    function railDrop(i, j) {
        const it = getDesign().secs[i]?.[j], layout = computeLayout(i), q = layout[j];
        if (!it || !q || !hasTrait(it.k, 'hanging')) return null;
        const fit = itemFit(i, q, it), coreTop = fit ? q.y0 + (fit.core.y1 - fit.core.y0) : q.y1;
        const y = coreTop - RAIL_DROP, x0 = fit ? fit.core.x0 : q.x0, x1 = fit ? fit.core.x1 : q.x1;
        const { below } = gapsAround(i, { x0, x1, y0: q.y0, y1: q.y1 }, sectionObstacles(i, layout).filter((_, k) => k !== j));
        return { y: round(y), drop: round(Math.max(0, y - below.y)), to: below.to, belowY: below.y, x: below.x };
    }
    /** The run of drawers stacked directly on and under drawer j, with the clear height left above it. */
    function drawerStack(i, j) {
        const sec = getDesign().secs[i], layout = computeLayout(i), q = layout[j];
        if (!sec?.[j] || !q || !hasTrait(sec[j].k, 'drawerBox')) return null;
        const same = k => hasTrait(sec[k]?.k, 'drawerBox') && Math.abs(layout[k].x0 - q.x0) < .05 && Math.abs(layout[k].x1 - q.x1) < .05;
        const members = new Set([j]);
        for (let grew = true; grew;) {
            grew = false;
            for (let k = 0; k < layout.length; k++) {
                if (members.has(k) || !same(k)) continue;
                if ([...members].some(m => Math.abs(layout[k].y1 - layout[m].y0) < .05 || Math.abs(layout[k].y0 - layout[m].y1) < .05)) { members.add(k); grew = true; }
            }
        }
        const y0 = Math.min(...[...members].map(k => layout[k].y0)), y1 = Math.max(...[...members].map(k => layout[k].y1));
        const others = sectionObstacles(i, layout).filter((_, k) => !members.has(k));
        const { above } = gapsAround(i, { x0: q.x0, x1: q.x1, y0, y1 }, others);
        return { count: members.size, y0, y1, h: round(y1 - y0), above };
    }
    /** Clear opening inside an open shelf: its pitch less the top board it carries and the board it stands on. */
    function netOpening(i, j) {
        const sec = getDesign().secs[i], layout = computeLayout(i), q = layout[j];
        if (!sec?.[j] || !q || !hasTrait(sec[j].k, 'openShelf')) return null;
        const shared = sectionDividers(i).filter(d => d.orientation === 'horizontal').map(d => {
            const r = dividerRect(d);
            return { ...r, y0: floor() + r.y0, y1: floor() + r.y1 };
        });
        const panels = fittingPanels(layout, floor(), (x0, x1) => floor() + ceilingTop(i, x0, x1), shared)[j];
        const top = panels.top.length ? T : 0, rise = Math.max(0, ...panels.support.map(s => s.rise));
        return { y0: q.y0 + rise, y1: q.y1 - top, h: round(Math.max(0, q.y1 - top - q.y0 - rise)), pitch: sec[j].h };
    }
    /** Where a free space under a sloped top is tallest, so its height ruler stands there and stays under the top.
     * @param {number} i @param {{ x0: number; x1: number; y0: number; y1: number }} space Section-local x, y from the floor. */
    function spaceTallest(i, space) {
        const cap = space.y1 - floor(), inset = Math.min(2, (space.x1 - space.x0) / 4);
        let best = { x: space.x1 - inset, h: 0 };
        for (const p of ceilingOutline(i, space.x0 + inset, space.x1 - inset)) {
            const h = Math.min(p.y, cap) - (space.y0 - floor());
            if (h > best.h + 1e-6) best = { x: p.x, h: round(h) };
        }
        return best;
    }
    return { sectionObstacles, gapsAround, itemGaps, railDrop, drawerStack, netOpening, spaceTallest };
}
