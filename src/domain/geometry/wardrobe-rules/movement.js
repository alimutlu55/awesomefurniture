import { WardrobePlanner } from '../../planner/wardrobe-planner.js';
import { MODS, PANEL as T, PLINTH as PL } from '../../wardrobe/catalog.js';
/** @typedef {ReturnType<typeof import('./sizes.js').createSizesRules>} SizesRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** @typedef {ReturnType<typeof import('./fit.js').createFitRules>} FitRules */
/** @typedef {ReturnType<typeof import('./dividers.js').createDividersRules>} DividersRules */
/** @typedef {ReturnType<typeof import('./spaces.js').createSpacesRules>} SpacesRules */
/** Moving, swapping, resizing and duplicating fittings: plans that are checked before they are applied.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {SizesRules & LayoutRules & FitRules & DividersRules & SpacesRules} deps Rules from the modules created before this one. */
export function createMovementRules(ctx, deps) {
    const { getDesign } = ctx;
    const { computeLayout, dividerOverlaps, dividerRect, effectiveMin, fitsCeiling, free, ih, itemFreeAbove, itemMinW, sectionDividers, widths } = deps;

    /** `restack`: inserting into a stack of items pinned at their heights (as Auto design places them), the stacks it
     * changes are laid out again from the floor in their new order, so the move shows. */
    function planItemMove(from, to, slot, swap = false, align, restack = false) {
        const ws = widths(), it = getDesign().secs[from.i]?.[from.j], target = getDesign().secs[to]?.[slot];
        const fail = reason => ({ valid: false, reason });
        if (!it || to < 0 || to >= getDesign().n || !Number.isInteger(slot)) {
            return fail('Choose a destination inside the wardrobe.');
        }
        if (swap && (!target || (to === from.i && slot === from.j))) {
            return fail('Choose another item to swap with.');
        }
        const secs = getDesign().secs.map(a => a.slice()), oldLayout = computeLayout(from.i), sourcePos = oldLayout[from.j];
        const transfer = (item, sourceWidth, destWidth, ax) => {
            const next = { ...item }, w = WardrobePlanner.itemWidth(item, sourceWidth);
            if (w > destWidth + .01) {
                return null;
            }
            if (Math.abs(w - destWidth) < .01) {
                delete next.w;
            }
            else {
                next.w = w;
            }
            if (ax === undefined) {
                ax = item.ax || 'c';
            }
            if (ax === 'c') {
                delete next.ax;
            }
            else {
                next.ax = ax;
            }
            delete next.x; // an explicit x offset would override the alignment
            return next;
        };
        const moved = transfer(it, ws[from.i], ws[to], swap ? (target.ax || 'c') : align);
        if (!moved) {
            return fail('This item is wider than section ' + (to + 1) + '. Resize it before moving.');
        }
        let index;
        if (swap) {
            const other = transfer(target, ws[to], ws[from.i], it.ax || 'c');
            if (!other) {
                return fail('The other item is too wide for the source section.');
            }
            secs[from.i][from.j] = other;
            secs[to][slot] = moved;
            index = slot;
        }
        else {
            if (slot < 0 || slot > secs[to].length) {
                return fail('Choose a valid stack position.');
            }
            secs[from.i].splice(from.j, 1);
            index = slot - (to === from.i && slot > from.j ? 1 : 0);
            secs[to].splice(index, 0, moved);
            if (restack) for (const i of new Set([from.i, to])) secs[i] = secs[i].map(({ y, ...rest }) => (void y, rest));
        }
        const affected = [...new Set([from.i, to])], layouts = {};
        for (const i of affected) {
            const a = secs[i], lay = computeLayout(i, a, ws[i]);
            layouts[i] = lay;
            if (dividerOverlaps(i, lay)) {
                return fail('This placement would overlap a divider.');
            }
            for (let j = 0; j < a.length; j++) {
                const item = a[j], m = MODS[item.k], p = lay[j];
                if (!m || !Number.isFinite(item.h) || item.h < effectiveMin(item.k) - .01 || p.w < itemMinW(item) - .01 || item.w > ws[i] + .01 || getDesign().d < (item.front ? 35 : m.d)) {
                    return fail('A module would lose its required width, depth, or clearance.');
                }
                if (!fitsCeiling(i, p, item)) {
                    return fail('Not enough height in section ' + (i + 1) + '. The whole stack must fit under the top.');
                }
                for (let k = 0; k < j; k++) {
                    const q = lay[k];
                    if (p.x0 < q.x1 - .01 && q.x0 < p.x1 - .01 && p.relY0 < q.relY1 - .01 && q.relY0 < p.relY1 - .01) {
                        return fail('This placement would overlap another item.');
                    }
                }
            }
        }
        const unchanged = affected.every(i => JSON.stringify(secs[i]) === JSON.stringify(getDesign().secs[i]));
        return { valid: true, unchanged, secs, to, index, moved, swap, layouts, sourcePos, from, reason: unchanged ? 'Already in this position.' : (swap ? 'Swap' : 'Move') + ' · section ' + (to + 1) + ' · ' + Math.round(layouts[to][index].y0 * 10) / 10 + ' cm from floor' };
    }
    function planFreeMove(from, to, want, opts = {}) {
        const ws = widths(), it = getDesign().secs[from.i]?.[from.j], fail = reason => ({ valid: false, reason }), rd = v => Math.round(v * 10) / 10;
        if (!it || to < 0 || to >= getDesign().n) {
            return fail('Drop inside a section. Outside the wardrobe cancels the move.');
        }
        const m = MODS[it.k], w = WardrobePlanner.itemWidth(it, ws[from.i]);
        if (w > ws[to] + .01) {
            return fail('This item is wider than section ' + (to + 1) + '. Resize it before moving.');
        }
        if (getDesign().d < (it.front ? 35 : m.d)) {
            return fail('This wardrobe is too shallow for this item.');
        }
        const aff = [...new Set([from.i, to])], old = {}, oldPos = new Map();
        for (const i of aff) {
            old[i] = computeLayout(i);
            getDesign().secs[i].forEach((o, j) => oldPos.set(o, old[i][j]));
        }
        const r = WardrobePlanner.placeItem({ bw: ws[to], H: ih(to), w, h: it.h, want, snap: !opts.free, others: old[to].map(q => ({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })).filter((_, j) => !(to === from.i && j === from.j)).concat(sectionDividers(to).map(dividerRect)) });
        if (!r) {
            return fail('No free space in section ' + (to + 1) + ' for a ' + rd(w) + ' × ' + rd(it.h) + ' cm item.');
        }
        const here = oldPos.get(it);
        if (to === from.i && Math.abs(here.x0 - r.x) < .01 && Math.abs(here.relY0 - r.y) < .01) {
            return { valid: true, unchanged: true, reason: 'Already in this position.', to, index: from.j, layouts: old };
        }
        const next = { ...it };
        delete next.ax;
        delete next.x;
        if (Math.abs(w - ws[to]) < .01) {
            delete next.w;
        }
        else {
            next.w = w;
            const mxx = ws[to] - w;
            if (r.x < .01) {
                next.ax = 'l';
            }
            else if (r.x > mxx - .01) {
                next.ax = 'r';
            }
            else if (Math.abs(r.x - mxx / 2) >= .01) {
                next.x = r.x;
            }
        }
        next.y = r.y;
        const secs = getDesign().secs.map(a => a.slice());
        secs[from.i].splice(from.j, 1);
        let index;
        if (to === from.i) {
            index = from.j;
            secs[to].splice(index, 0, next);
        }
        else {
            secs[to].push(next);
            index = secs[to].length - 1;
        }
        const lay = {};
        for (let pass = 0; pass <= 24; pass++) {
            let changed = false;
            for (const i of aff) {
                lay[i] = computeLayout(i, secs[i], ws[i]);
                secs[i].forEach((o, j) => {
                    const p0 = oldPos.get(o);
                    if (o === next || !p0 || Number.isFinite(o.y) || Math.abs(p0.relY0 - lay[i][j].relY0) < .01) {
                        return;
                    }
                    secs[i][j] = { ...o, y: Math.round(p0.relY0 * 100) / 100 };
                    oldPos.set(secs[i][j], p0);
                    changed = true;
                });
            }
            if (!changed) {
                break;
            }
        }
        for (const i of aff) {
            if (dividerOverlaps(i, lay[i])) {
                return fail('This placement would overlap a divider.');
            }
        }
        for (const i of aff) {
            for (let j = 0; j < secs[i].length; j++) {
                const p = lay[i][j];
                if (!fitsCeiling(i, p, secs[i][j])) {
                    return fail('Not enough height under the top in section ' + (i + 1) + '.');
                }
                for (let k = 0; k < j; k++) {
                    const q = lay[i][k];
                    if (p.x0 < q.x1 - .01 && q.x0 < p.x1 - .01 && p.relY0 < q.relY1 - .01 && q.relY0 < p.relY1 - .01) {
                        return fail('This placement would overlap another item.');
                    }
                }
            }
        }
        const bits = [r.snapX && (r.snapX === 'neighbour' ? 'aligned sideways' : 'snapped ' + r.snapX), r.snapY && (r.snapY === 'neighbour' ? 'aligned vertically' : 'snapped to ' + r.snapY), r.pushed && 'nudged clear of a neighbour'].filter(Boolean);
        return { valid: true, unchanged: false, secs, to, index, moved: next, swap: false, layouts: lay, sourcePos: old[from.i][from.j], from, reason: 'Move · section ' + (to + 1) + ' · ' + rd(lay[to][index].x0) + ' cm from left · ' + rd(r.y) + ' cm from floor' + (bits.length ? ' · ' + bits.join(', ') : '') };
    }
    function verticalNeighbor(i, j, direction) {
        const lay = computeLayout(i), p = lay[j];
        if (!p) {
            return -1;
        }
        const candidates = lay.map((q, k) => ({ q, k })).filter(({ q, k }) => k !== j && p.x0 < q.x1 - .01 && q.x0 < p.x1 - .01 && (direction > 0 ? q.y0 >= p.y1 - .01 : q.y1 <= p.y0 + .01));
        candidates.sort((a, b) => direction > 0 ? a.q.y0 - b.q.y0 : b.q.y1 - a.q.y1);
        return candidates[0]?.k ?? -1;
    }
    function itemYBounds(i, j) {
        const sec = getDesign().secs[i], lay = computeLayout(i), pos = lay[j];
        if (!sec || !pos) {
            return null;
        }
        let lo = 0;
        for (let k = 0; k < sec.length; k++) {
            if (k === j) {
                continue;
            }
            const o = lay[k];
            if (o && pos.x0 < o.x1 - .01 && o.x0 < pos.x1 - .01 && o.relY1 <= pos.relY0 + .01) {
                lo = Math.max(lo, o.relY1);
            }
        }
        for (const d of sectionDividers(i)) {
            const r = dividerRect(d);
            if (pos.x0 < r.x1 - .01 && pos.x1 > r.x0 + .01 && r.y1 <= pos.relY0 + .01) {
                lo = Math.max(lo, r.y1);
            }
        }
        return { lo, hi: pos.relY0 + itemFreeAbove(i, j), cur: pos.relY0 };
    }
    function sectionLayoutValid(i) {
        const layout = computeLayout(i);
        return !dividerOverlaps(i, layout) && layout.every((q, j) => q.relY0 >= -.01 && fitsCeiling(i, q, getDesign().secs[i][j]) && layout.every((r, k) => j === k || q.x0 >= r.x1 - .01 || r.x0 >= q.x1 - .01 || q.relY0 >= r.relY1 - .01 || r.relY0 >= q.relY1 - .01));
    }
    function duplicateSideSpot(i, j) {
        const a = getDesign().secs[i], it = a && a[j], lay = computeLayout(i), pos = lay[j];
        if (!it || !pos) {
            return null;
        }
        const bw = widths()[i], w = pos.w, y0 = pos.relY0, y1 = pos.relY1;
        if (w > bw - .5) {
            return null;
        }
        const blockers = lay.map(q => ({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })).concat(sectionDividers(i).map(dividerRect));
        const fits = x => x >= -.01 && x + w <= bw + .01 && fitsCeiling(i, { x0: x, x1: x + w, relY0: y0, relY1: y1 }, it) && !blockers.some(o => x < o.x1 - .01 && o.x0 < x + w - .01 && y0 < o.y1 - .01 && o.y0 < y1 - .01);
        const r2 = v => Math.round(v * 100) / 100, xs = [...new Set([pos.x1, pos.x0 - w, 0, bw - w, ...blockers.flatMap(o => [o.x1, o.x0 - w])].map(v => r2(Math.max(0, Math.min(bw - w, v)))))].filter(fits);
        if (!xs.length) {
            return null;
        }
        // Prefer the spot right beside the item (right first, then left), then the nearest free spot in the same row.
        xs.sort((p, q) => {
            const rp = p >= pos.x1 - .01 ? 0 : 1, rq = q >= pos.x1 - .01 ? 0 : 1;
            const dp = rp ? pos.x0 - (p + w) : p - pos.x1, dq = rq ? pos.x0 - (q + w) : q - pos.x1;
            return Math.abs(dp) - Math.abs(dq) || rp - rq;
        });
        // Settle it: the copy rests on whatever is under it in its new column (an item, a shelf divider, or the floor) instead of hanging in mid-air.
        const x = xs[0];
        let y = 0;
        for (const o of blockers) {
            if (x < o.x1 - .01 && o.x0 < x + w - .01 && o.y1 <= y0 + .01) {
                y = Math.max(y, o.y1);
            }
        }
        return { x, y: Math.round(y * 100) / 100 };
    }
    /** @returns {Array<{x0:number;x1:number;y0:number;y1:number;relY0?:number}>} */
    function resizeObstacles(i) {
        return [...computeLayout(i), ...sectionDividers(i).map(d => {
                const r = dividerRect(d);
                return { ...r, y0: PL + T + r.y0, y1: PL + T + r.y1 };
            })];
    }
    function itemEdgeSize(g, edge, delta, neighbors, index, minW, minH, maxH) {
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), round = v => Math.round(v * 2) / 2;
        if (edge === 'top') {
            return { h: clamp(round(g.h + delta), minH, maxH) };
        }
        const left = g.x0 - g.bayL, right = g.x1 - g.bayL;
        let low = 0, high = g.bw;
        neighbors.forEach((q, j) => {
            if (j === index || q.y0 >= g.y1 - .01 || q.y1 <= g.y0 + .01) {
                return;
            }
            if (q.x1 <= left + .01) {
                low = Math.max(low, q.x1);
            }
            if (q.x0 >= right - .01) {
                high = Math.min(high, q.x0);
            }
        });
        const w = clamp(round(g.w + (edge === 'left' ? -delta : delta)), Math.min(minW, g.w), edge === 'left' ? right - low : high - left);
        return { w, x: edge === 'left' ? right - w : left };
    }
    function widthEdgeFor(g) {
        return g.gapR < .05 && g.gapL > .05 ? 'left' : 'right';
    }
    return { planItemMove, planFreeMove, verticalNeighbor, itemYBounds, sectionLayoutValid, duplicateSideSpot, resizeObstacles, itemEdgeSize, widthEdgeFor };
}
