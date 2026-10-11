import { WardrobePlanner } from '../planner/wardrobe-planner.js';
import { MODS, FIN, ADD_ORDER, r1, PANEL as T, PLINTH as PL } from '../wardrobe/catalog.js';
import { resolveShape, ceilingPieces, ceilingMin, ceilingMax, ceilingPolyline, fitSpans, sectionOrigins, elevationArea, shapePanels } from '../wardrobe/shape/wardrobe-shape';
import { bestWindowClear, clipBelowTop, MIN_CUT_BOARD } from '../wardrobe/shape/angle-cut';
/** Shortest vertical divider, in cm. */
const MIN_DIVIDER = 15;
/** Geometry and feasibility rules. Only the centimetre design is read. */
/** @param {() => import('../wardrobe/editor-design').EditorDesign & { sel: number; item: number; divider: number; space: {i:number;x:number;y:number}|null }} getDesign */
export function createWardrobeGeometry(getDesign, getBudget = () => 900) {
    const widths = () => {
        const n = getDesign().n, iw = getDesign().w - (n + 1) * T, wt = getDesign().wt.slice(0, n), s = wt.reduce((a, b) => a + b);
        return wt.map(x => iw * x / s);
    };
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
        return floor2(ceilingMin(pieces, o + Math.min(x0, x1), o + Math.max(x0, x1)) - PL - T);
    }
    /** Highest clear point over a section-local span. */
    function ceilingTop(i, x0, x1) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return floor2(ceilingMax(pieces, o + Math.min(x0, x1), o + Math.max(x0, x1)) - PL - T);
    }
    /** Section-local underside of the top, left to right, relative to the base board. */
    function ceilingOutline(i, x0, x1) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return ceilingPolyline(pieces, o + x0, o + x1).map(p => ({ x: p.x - o, y: p.y - PL - T }));
    }
    /** Parts of a section span with at least `top` cm of clear height. */
    function clearSpans(i, x0, x1, top) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return fitSpans(pieces, o + x0, o + x1, top + PL + T - 1e-6).map(q => ({ x0: q.x0 - o, x1: q.x1 - o }));
    }
    /** Highest clear height (relative) that a window of width w inside a span reaches everywhere. */
    function windowClear(i, x0, x1, w) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return floor2(bestWindowClear(pieces, o + x0, o + x1, w) - PL - T);
    }
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
    /** Outline of a section-local rectangle cut to the top; x section-local, y absolute. */
    function cutOutline(i, x0, x1, y0, y1) {
        const { pieces, origins } = shapeInfo(), o = origins[i] ?? T;
        return clipBelowTop(pieces, o + x0, o + x1, y0, y1).map(poly => poly.map(p => ({ x: p.x - o, y: p.y })));
    }
    /** Every fitting in a section with its cut and working core, for rendering and measuring. */
    function sectionFits(i) {
        return overflow(i) <= .05;
    }
    function fittingFit(i, j) {
        const lay = computeLayout(i), q = lay[j], it = getDesign().secs[i]?.[j];
        return q && it ? itemFit(i, q, it) : null;
    }
    function computeLayout(i, secArg, bwArg) {
        const bw = bwArg !== undefined ? bwArg : widths()[i], sec = secArg !== undefined ? secArg : getDesign().secs[i];
        if (!sec || !sec.length) {
            return [];
        }
        return WardrobePlanner.layoutSection(sec, bw).map(p => ({ relY0: p.y0, relY1: p.y1, y0: PL + T + p.y0, y1: PL + T + p.y1, x0: p.x0, x1: p.x1, w: p.w, off: p.off, h: p.h }));
    }
    function planItemMove(from, to, slot, swap = false, align) {
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
    function itemFreeAbove(i, j) {
        const sec = getDesign().secs[i];
        if (!sec || !sec[j]) {
            return 0;
        }
        const lay = computeLayout(i), pos = lay[j];
        if (!pos) {
            return 0;
        }
        // A fitting may rise into a sloped top: its enclosure is cut to the angle.
        let ceiling = ceilingTop(i, pos.x0, pos.x1);
        for (let k = 0; k < sec.length; k++) {
            if (k === j) {
                continue;
            }
            const other = lay[k];
            if (pos.x0 < other.x1 - .01 && other.x0 < pos.x1 - .01) {
                if (other.relY0 >= pos.relY1 - .01 && other.relY0 < ceiling) {
                    ceiling = other.relY0;
                }
            }
        }
        for (const d of sectionDividers(i)) {
            const r = dividerRect(d);
            if (pos.x0 < r.x1 - .01 && pos.x1 > r.x0 + .01 && r.y0 >= pos.relY1 - .01) {
                ceiling = Math.min(ceiling, r.y0);
            }
        }
        return Math.max(0, Math.round((ceiling - pos.relY1) * 10) / 10);
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
    const maxN = () => Math.max(1, Math.min(6, Math.floor((getDesign().w - T) / (25 + T))));
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
        return { bw, bayL, w: wd, x0: bayL + off, x1: bayL + off + wd, gapL: off, gapR: bw - wd - off, y0, y1, h: it.h, z0: .5, z1: getDesign().d - 1.5, dep: getDesign().d - 2, freeTop: itemFreeAbove(i, j) };
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
        return { ...g, cut: !!fit?.cut, core: fit?.core && { x0: g.bayL + fit.core.x0, x1: g.bayL + fit.core.x1, w: fit.core.x1 - fit.core.x0, h: fit.core.y1 - fit.core.y0 }, top: Math.max(0, PL + T + ceilingTop(i, current.x0, current.x1) - g.y1), bottom: Math.max(0, g.y0 - PL - T), freeBelow: Math.max(0, g.y0 - support) };
    }
    function dividerRect(d) {
        return d.orientation === 'horizontal' ? { x0: d.x0, x1: d.x1, y0: d.y - T / 2, y1: d.y + T / 2 } : { x0: d.x - T / 2, x1: d.x + T / 2, y0: d.y0, y1: d.y1 };
    }
    function dividerMeasurements(index) {
        const d = getDesign().dividers?.[index];
        if (!d) {
            return null;
        }
        const r = dividerRect(d), area = dividerBounds(d), hor = d.orientation === 'horizontal';
        let low = hor ? area.y0 : area.x0, high = hor ? area.y1 : area.x1;
        const obstacles = computeLayout(d.i).map(q => ({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })).concat((getDesign().dividers || []).filter((q, j) => j !== index && q.i === d.i).map(dividerRect));
        obstacles.forEach(q => {
            if (hor) {
                if (q.x0 >= r.x1 - .01 || q.x1 <= r.x0 + .01) {
                    return;
                }
                if (q.y1 <= r.y0 + .01) {
                    low = Math.max(low, q.y1);
                }
                if (q.y0 >= r.y1 - .01) {
                    high = Math.min(high, q.y0);
                }
            }
            else {
                if (q.y0 >= r.y1 - .01 || q.y1 <= r.y0 + .01) {
                    return;
                }
                if (q.x1 <= r.x0 + .01) {
                    low = Math.max(low, q.x1);
                }
                if (q.x0 >= r.x1 - .01) {
                    high = Math.min(high, q.x0);
                }
            }
        });
        return { ...r, hor, low, high, before: Math.max(0, (hor ? r.y0 : r.x0) - low), after: Math.max(0, high - (hor ? r.y1 : r.x1)), width: r.x1 - r.x0, height: r.y1 - r.y0, depth: getDesign().d - 2 };
    }
    function dividerBounds(d) {
        return d.area || { x0: 0, x1: widths()[d.i], y0: d.y0, y1: d.y1 };
    }
    /** A board meeting a sloped top is cut to its angle. A shelf board stays valid
     * while a whole length of at least MIN_CUT_BOARD remains; a vertical divider
     * while it reaches the top at its tallest point and keeps room below. */
    function boardFit(i, r, orientation) {
        if (r.y1 <= ceilingIn(i, r.x0, r.x1) + .01) {
            return { cut: false, length: r.x1 - r.x0 };
        }
        if (r.y1 > ceilingTop(i, r.x0, r.x1) + .01) {
            return null;
        }
        if (orientation === 'horizontal') {
            const length = Math.max(0, ...clearSpans(i, r.x0, r.x1, r.y1).map(q => q.x1 - q.x0));
            return length >= MIN_CUT_BOARD - .01 ? { cut: true, length } : null;
        }
        return ceilingIn(i, r.x0, r.x1) - r.y0 >= 10 ? { cut: true, length: r.x1 - r.x0 } : null;
    }
    /** A vertical divider stands on the base and stops at the slope over its own
     * thickness, like an item. Its stored top is the most it can be: this clamps it. */
    function clampDivider(d) {
        if (d.orientation !== 'vertical') {
            return d;
        }
        // The wanted top is remembered; the drawn top is the lower of it and the slope.
        const want = d.want ?? d.y1, r = dividerRect({ ...d, y1: want }), top = Math.min(want, ceilingIn(d.i, r.x0, r.x1));
        return { ...d, want, y1: Math.max(d.y0, top) };
    }
    function dividerValid(d, index) {
        const eff = clampDivider(d), r = dividerRect(eff), bw = widths()[eff.i];
        if (r.x0 < -.01 || r.x1 > bw + .01 || r.y0 < -.01 || !boardFit(eff.i, r, eff.orientation)) {
            return false;
        }
        // Too short to be a divider once the slope has taken its top.
        if (eff.orientation === 'vertical' && r.y1 - r.y0 < MIN_DIVIDER - .01) {
            return false;
        }
        const overlaps = q => r.x0 < q.x1 - .01 && r.x1 > q.x0 + .01 && r.y0 < q.y1 - .01 && r.y1 > q.y0 + .01;
        return !computeLayout(eff.i).some(q => overlaps({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })) && !(getDesign().dividers || []).some((q, j) => j !== index && q.i === eff.i && overlaps(dividerRect(q.orientation === 'vertical' ? clampDivider(q) : q)));
    }
    function dividerOrientation(index, orientation) {
        const d = getDesign().dividers?.[index];
        if (!d) {
            return null;
        }
        if ((d.orientation || 'vertical') === orientation) {
            return { ...d };
        }
        const a = dividerBounds(d), next = { ...d, area: { ...a }, orientation };
        if (orientation === 'horizontal') {
            if (a.y1 - a.y0 < T + 30) {
                return null;
            }
            Object.assign(next, { x0: a.x0, x1: a.x1, y: (a.y0 + a.y1) / 2 });
        }
        else {
            if (a.x1 - a.x0 < T + 50) {
                return null;
            }
            Object.assign(next, { x: (a.x0 + a.x1) / 2, y0: a.y0, y1: a.y1 });
        }
        return dividerValid(next, index) ? next : null;
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
    function sectionDividers(i) {
        return (getDesign().dividers || []).filter(d => d.i === i);
    }
    function dividerOverlaps(i, layout) {
        return sectionDividers(i).some(d => {
            const r = dividerRect(d);
            return layout.some(q => q.x0 < r.x1 - .01 && q.x1 > r.x0 + .01 && q.relY0 < r.y1 - .01 && q.relY1 > r.y0 + .01);
        });
    }
    function sectionLayoutValid(i) {
        const layout = computeLayout(i);
        return !dividerOverlaps(i, layout) && layout.every((q, j) => q.relY0 >= -.01 && fitsCeiling(i, q, getDesign().secs[i][j]) && layout.every((r, k) => j === k || q.x0 >= r.x1 - .01 || r.x0 >= q.x1 - .01 || q.relY0 >= r.relY1 - .01 || r.relY0 >= q.relY1 - .01));
    }
    function sectionSpaces(i) {
        const bw = widths()[i];
        if (bw === undefined) {
            return [];
        }
        // Areas above the top boards are obstacles. Steps give exact boundaries;
        // a slope keeps its bounding height and records its lower edge.
        const H = ih(i), outline = ceilingOutline(i, 0, bw), roof = [];
        for (let n = 0; n < outline.length - 1; n++) {
            const a = outline[n], b = outline[n + 1];
            if (b.x - a.x > .01 && Math.max(a.y, b.y) < H - .01) {
                roof.push({ x0: a.x, x1: b.x, y0: Math.max(a.y, b.y), y1: H });
            }
        }
        const obstacles = computeLayout(i).map(q => ({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })).concat(sectionDividers(i).map(dividerRect), roof), ys = [...new Set([0, H, ...obstacles.flatMap(q => [Math.max(0, Math.min(H, q.y0)), Math.max(0, Math.min(H, q.y1))])])].sort((a, b) => a - b), regions = [];
        for (let n = 0; n < ys.length - 1; n++) {
            const y0 = ys[n], y1 = ys[n + 1];
            if (y1 - y0 < .01) {
                continue;
            }
            const blocked = obstacles.filter(q => q.y0 < y1 - .01 && q.y1 > y0 + .01).sort((a, b) => a.x0 - b.x0);
            let x = 0;
            const gaps = [];
            for (const q of blocked) {
                if (q.x0 > x + .01) {
                    gaps.push([x, Math.min(bw, q.x0)]);
                }
                x = Math.max(x, q.x1);
            }
            if (x < bw - .01) {
                gaps.push([x, bw]);
            }
            for (const [x0, x1] of gaps) {
                const previous = regions.find(q => Math.abs(q.x0 - x0) < .01 && Math.abs(q.x1 - x1) < .01 && Math.abs(q.y1 - y0) < .01);
                if (previous) {
                    previous.y1 = y1;
                }
                else {
                    regions.push({ x0, x1, y0, y1 });
                }
            }
        }
        return regions.map(q => {
            const y1 = Math.min(q.y1, ceilingTop(i, q.x0, q.x1)), low = Math.min(y1, ceilingIn(i, q.x0, q.x1));
            return { ...q, w: q.x1 - q.x0, h: y1 - q.y0, hMin: Math.max(0, low - q.y0), sloped: y1 - low > .05, dep: getDesign().d - 2, y0: q.y0 + PL + T, y1: y1 + PL + T };
        }).filter(q => q.h > .01);
    }
    function sectionSpaceMeasurements(i) {
        const spaces = sectionSpaces(i), point = getDesign().space?.i === i ? getDesign().space : null;
        const selected = point && spaces.find(q => point.x >= q.x0 - .01 && point.x <= q.x1 + .01 && point.y >= q.y0 - .01 && point.y <= q.y1 + .01);
        return selected || spaces.sort((a, b) => b.y1 - a.y1 || b.w * b.h - a.w * a.h)[0] || { x0: 0, x1: widths()[i] || 0, w: widths()[i] || 0, h: 0, hMin: 0, sloped: false, dep: getDesign().d - 2, y0: PL + T + ih(i), y1: PL + T + ih(i) };
    }
    const itemMinW = it => it.front ? 55 : MODS[it.k].w;
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
    function planCfg() {
        const c = plannerConfig();
        return getDesign().profile.engaged ? c : { ...c, needs: { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0 }, upper: 'more', reach: 210, seasonalAboveReach: false };
    }
    function plannerConfig() {
        // Whole-cabinet Auto design starts from the envelope and preferences.
        // Commands that preserve fittings (such as bay autofill) pass them explicitly.
        return { w: getDesign().w, h: getDesign().h, d: getDesign().d, budget: getBudget(), finFactor: Number(FIN[getDesign().fin][1]), doors: getDesign().doors, ...getDesign().profile };
    }
    function currentLayout() {
        const ws = widths();
        return { sections: ws.map((width, i) => ({ width, items: getDesign().secs[i] || [], role: 'Section ' + (i + 1) })) };
    }
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
    function edgeGap(k) {
        const i = getDesign().sel, bw = widths()[i], mn = effectiveMin(k), front = (k === 'short' || k === 'long') && getDesign().d < 55, minW = Math.max(25, front ? 55 : MODS[k].w), lay = computeLayout(i);
        if (ih(i) < mn - .01 || !lay.some(p => p.w < bw - .05)) {
            return null;
        }
        const xs = [0, bw];
        lay.forEach(p => xs.push(p.x0, p.x1));
        const pts = [...new Set(xs.map(v => Math.round(Math.max(0, Math.min(bw, v)) * 100) / 100))].sort((a, b) => a - b), empty = [];
        for (let n = 0; n < pts.length - 1; n++) {
            const a = pts[n], b = pts[n + 1];
            empty.push(b - a <= .05 || !lay.some(p => p.x0 < b - .05 && p.x1 > a + .05));
        }
        let l = 0;
        while (l < empty.length && empty[l]) {
            l++;
        }
        let r = 0;
        while (r < empty.length - l && empty[empty.length - 1 - r]) {
            r++;
        }
        const left = l ? { w: Math.floor(pts[l] * 10) / 10, ax: 'l' } : null, right = r ? { w: Math.floor((bw - pts[pts.length - 1 - r]) * 10) / 10, ax: 'r' } : null;
        return [left, right].filter(g => g && g.w >= minW - .01 && g.w < bw - .05).sort((a, b) => b.w - a.w)[0] || null;
    }
    const bayMinW = i => {
        let full = 25, L = 0, R = 0;
        for (const it of getDesign().secs[i] || []) {
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
    /** Widest part of a free space where a fitting of height h clears the top.
     * Section-local; null when no part is at least minW wide. */
    function spaceSpan(i, space, h, minW) {
        const y0 = space.y0 - PL - T, spans = clearSpans(i, space.x0, space.x1, y0 + h).filter(q => q.x1 - q.x0 >= minW - .01);
        return spans.sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0] || null;
    }
    /** Narrowest change that brings a fitting back under a lowered or sloped top:
     * keep its height and slide/narrow it into the tallest part of its row. */
    function narrowToFit(i, j) {
        const it = getDesign().secs[i]?.[j], lay = computeLayout(i), p = lay[j];
        if (!it || !p) {
            return null;
        }
        const others = lay.filter((q, k) => k !== j).map(q => ({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })).concat(sectionDividers(i).map(dividerRect));
        const spans = clearSpans(i, 0, widths()[i], p.relY1).flatMap(q => {
            // Neighbouring fittings in the same row also limit the span.
            let pieces = [q];
            for (const o of others) {
                if (o.y0 >= p.relY1 - .01 || o.y1 <= p.relY0 + .01) {
                    continue;
                }
                pieces = pieces.flatMap(r => o.x1 <= r.x0 + .01 || o.x0 >= r.x1 - .01 ? [r] : [{ x0: r.x0, x1: Math.min(r.x1, o.x0) }, { x0: Math.max(r.x0, o.x1), x1: r.x1 }].filter(z => z.x1 - z.x0 > .01));
            }
            return pieces;
        }).filter(q => q.x1 - q.x0 >= itemMinW(it) - .01);
        if (!spans.length) {
            return null;
        }
        spans.sort((a, b) => Math.min(b.x1 - b.x0, p.w) - Math.min(a.x1 - a.x0, p.w) || Math.abs((a.x0 + a.x1) / 2 - (p.x0 + p.x1) / 2) - Math.abs((b.x0 + b.x1) / 2 - (p.x0 + p.x1) / 2));
        const q = spans[0], w = Math.floor(Math.min(p.w, q.x1 - q.x0) * 10) / 10, x = Math.max(q.x0, Math.min(q.x1 - w, p.x0));
        return { w, x: Math.round(x * 100) / 100, y: Math.round(p.relY0 * 100) / 100 };
    }
    function addSuggestions() {
        const sp = sectionSpaceMeasurements(getDesign().sel), w = sp.w, H = sp.h, b = sp.y0, t = sp.y1, reach = getDesign().profile.reach, dMax = getDesign().profile.accessible ? 105 : Math.max(100, Math.min(135, Math.round(reach * .7))), onFloor = b - (PL + T) <= 1, high = b >= reach - 1, above = Math.max(0, t - Math.max(b, reach)), eng = !!getDesign().profile.engaged, need = { short: 'short', long: 'long', pants: 'pants', folded: 'folded', drawer: 'folded', shoe: 'shoes', sdrawer: 'small' }, list = [];
        [...ADD_ORDER, 'divider'].forEach((k, o) => {
            let fit = true, s = 0, why = '', hint = '', warn = false;
            if (k === 'divider') {
                fit = (w - T) / 2 >= 25;
                s = (w >= 100 ? 45 : 30) + (H >= 100 ? 8 : 0) - (high ? 15 : 0);
                why = 'Splits this space side by side';
                if (!fit) {
                    hint = 'Space too narrow';
                }
            }
            else {
                const m = MODS[k], mn = effectiveMin(k), front = (k === 'short' || k === 'long') && getDesign().d < 55, needW = front ? 55 : m.w, needD = front ? 35 : m.d;
                fit = itemFeasible(k, w) && ((mn <= H + .01 && !!spaceSpan(getDesign().sel, sp, mn, front ? 55 : m.w)) || !!edgeGap(k));
                if (!fit) {
                    hint = k === 'lift' && !getDesign().profile.allowLift ? 'Pull-down is off' : w < needW - .01 ? 'Needs ' + needW + ' cm width' : getDesign().d < needD ? 'Needs ' + needD + ' cm depth' : 'Needs ' + r1(mn) + ' cm height';
                }
                else {
                    const top = b + mn, ok = k === 'seasonal' || k === 'shelf' || k === 'void' ? true : k === 'short' || k === 'long' ? top - 6 <= reach + .03 : k === 'lift' ? top - 6 - 65 <= reach + .03 : ['drawer', 'sdrawer', 'basket'].includes(k) ? top <= Math.min(reach, dMax) + .03 : top <= reach + .03;
                    switch (k) {
                        case 'seasonal':
                            s = high ? 100 : above >= 34 ? (b >= reach - 60 ? 70 : 50) : b >= reach - 40 ? 25 : -10;
                            why = 'Occasional items belong above your reach';
                            break;
                        case 'shelf':
                            s = 40 + (high ? 25 : 0) + (above >= 34 ? 10 : 0) + (H >= 150 ? 10 : 0);
                            why = 'Flexible shelf';
                            break;
                        case 'short':
                            s = 55 + (H >= 100 ? 20 : 0) + (b >= 30 && b <= 130 ? 5 : 0);
                            why = 'Daily hanging';
                            break;
                        case 'long':
                            s = 40 + (onFloor ? 25 : b <= 50 ? 10 : -30) + (H >= 170 ? 5 : 0);
                            why = 'Long garments need floor-length hanging';
                            break;
                        case 'lift':
                            s = top - 6 > reach ? 50 : 10;
                            why = 'Brings a high rail down to reach';
                            break;
                        case 'pants':
                            s = 45 + (b <= 60 ? 20 : -10);
                            why = 'Trousers hang best low to mid';
                            break;
                        case 'shoe':
                            s = (onFloor ? 75 : b < 30 ? 55 : b < 60 ? 20 : -30) - (H >= 130 ? 25 : 0) + (H <= 60 ? 10 : 0);
                            why = 'Shoes sit best at floor level';
                            break;
                        case 'drawer':
                            s = 50 + (b >= 20 && b <= 90 ? 20 : 0) + (H <= 45 ? 15 : 0) - (b > 100 ? 20 : 0) - (H >= 130 ? 5 : 0);
                            why = 'Drawers keep folded clothes easy to reach';
                            break;
                        case 'sdrawer':
                            s = 30 + (b >= 60 && b <= 110 ? 25 : 0);
                            why = 'Small items sit best at hand height';
                            break;
                        case 'basket':
                            s = 35 + (onFloor ? 20 : b < 60 ? 10 : 0);
                            why = 'Low pull-out for laundry or bulky items';
                            break;
                        case 'folded':
                            s = 48 + (b >= 60 && b <= 150 ? 18 : 0) + (H <= 45 ? 10 : 0) - (H >= 140 ? 15 : 0);
                            why = 'Folded clothes work best at chest height';
                            break;
                    }
                    if (!ok) {
                        s -= 45;
                        warn = true;
                        why = 'Out of easy reach here';
                    }
                    const nk = need[k];
                    if (eng && nk) {
                        s += getDesign().profile.needs[nk] > 0 ? 8 : -8;
                    }
                    if (eng && k === 'seasonal' && getDesign().profile.upper === 'none') {
                        s -= 30;
                    }
                    hint = warn ? 'Out of reach' : '';
                }
            }
            list.push({ k, o, fit, s, why, hint, warn });
        });
        const intent = high ? '<b>High space</b>, above your ' + reach + ' cm reach. Best for seasonal boxes and occasional storage.'
            : onFloor && H >= 130 ? '<b>Full-height space.</b> Good for hanging, long garments and pull-outs.'
                : above >= 34 ? '<b>Reaches above your ' + reach + ' cm line.</b> Keep daily items below it and boxes on top.'
                    : onFloor && H <= 60 ? '<b>Low space at floor level.</b> Good for shoes, drawers and folded clothes.'
                        : H >= 100 ? '<b>Roomy space within reach.</b> Good for hanging and everyday storage.'
                            : b >= 100 ? '<b>Upper shelf zone.</b> Good for folded clothes and light storage.'
                                : '<b>Compact space.</b> Good for drawers, shelves and folded clothes.';
        return { list, intent };
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
    function dividerDupSpot(index) {
        const d = getDesign().dividers?.[index];
        if (!d) {
            return null;
        }
        const hor = d.orientation === 'horizontal', key = hor ? 'y' : 'x', a = dividerBounds(d), lo = (hor ? a.y0 : a.x0) + T / 2, hi = (hor ? a.y1 : a.x1) - T / 2, GAP = 3, bw = widths()[d.i];
        const obs = computeLayout(d.i).map(q => ({ x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 })).concat((getDesign().dividers || []).filter(q => q.i === d.i).map(dividerRect));
        const ok = v => {
            const r = dividerRect({ ...d, [key]: v });
            if (r.x0 < -.01 || r.x1 > bw + .01 || r.y0 < -.01 || !boardFit(d.i, r, d.orientation)) {
                return false;
            }
            const g = hor ? { x0: r.x0, x1: r.x1, y0: r.y0 - GAP, y1: r.y1 + GAP } : { x0: r.x0 - GAP, x1: r.x1 + GAP, y0: r.y0, y1: r.y1 };
            return !obs.some(q => g.x0 < q.x1 - .01 && g.x1 > q.x0 + .01 && g.y0 < q.y1 - .01 && g.y1 > q.y0 + .01);
        };
        const runs = [];
        let run = null;
        for (let v = lo; v <= hi + 1e-6; v += .5) {
            if (ok(v)) {
                if (run) {
                    run.end = v;
                }
                else {
                    run = { start: v, end: v };
                    runs.push(run);
                }
            }
            else {
                run = null;
            }
        }
        if (!runs.length) {
            return null;
        }
        const mid = r => (r.start + r.end) / 2;
        runs.sort((p, q) => (q.end - q.start) - (p.end - p.start) || Math.abs(mid(p) - d[key]) - Math.abs(mid(q) - d[key]));
        return mid(runs[0]);
    }
    return { clampDivider, shapeInfo, ceilingIn, ceilingTop, ceilingOutline, clearSpans, windowClear, itemFit, fittingFit, cutOutline, boardFit, fitsCeiling, overflow, sectionFits, spaceSpan, narrowToFit, widths, computeLayout, planItemMove, planFreeMove, verticalNeighbor, itemFreeAbove, ih, used, free, maxN, cost, stats, itemGeom, itemMeasurements, dividerRect, dividerMeasurements, dividerBounds, dividerValid, dividerOrientation, itemYBounds, sectionDividers, dividerOverlaps, sectionLayoutValid, sectionSpaces, sectionSpaceMeasurements, itemMinW, isBoxed, boxCapped, boxSupported, planCfg, plannerConfig, currentLayout, effectiveMin, itemFeasible, newItem, splitFor, edgeGap, bayMinW, minTotal, okItem, addSuggestions, duplicateSideSpot, resizeObstacles, itemEdgeSize, widthEdgeFor, dividerDupSpot };
}
