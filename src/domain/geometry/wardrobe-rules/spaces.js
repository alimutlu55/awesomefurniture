import { MODS, PANEL as T } from '../../wardrobe/catalog.js';
import { fittingDepth } from '../../wardrobe/carcass';
import { plinthOf } from '../../wardrobe/carcass';
/** @typedef {ReturnType<typeof import('./sizes.js').createSizesRules>} SizesRules */
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** @typedef {ReturnType<typeof import('./dividers.js').createDividersRules>} DividersRules */
/** Open spaces in a section: finding them, their centre and size, fitting into them.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {SizesRules & CeilingRules & LayoutRules & DividersRules} deps Rules from the modules created before this one. */
export function createSpacesRules(ctx, deps) {
    const { getDesign } = ctx;
    /** The plinth under this design's carcass (none under a wall unit). */
    const plinth = () => plinthOf(getDesign());
    const { ceilingIn, ceilingOutline, ceilingTop, clearSpans, computeLayout, dividerRect, effectiveMin, ih, itemMinW, sectionDividers, widths } = deps;

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
            return { ...q, w: q.x1 - q.x0, h: y1 - q.y0, hMin: Math.max(0, low - q.y0), sloped: y1 - low > .05, dep: fittingDepth(getDesign().d).depth, y0: q.y0 + plinth() + T, y1: y1 + plinth() + T };
        }).filter(q => q.h > .01);
    }
    /** Centre of mass of a free space's clear area: the true middle of the room left after the
     * slope, for rectangles and any other shape. Section-local x; absolute y (like the space). */
    function spaceCentre(i, space) {
        const N = 48, x0 = space.x0, x1 = space.x1, base = space.y0, cap = space.y1;
        let area = 0, sx = 0, sy = 0;
        for (let k = 0; k < N; k++) {
            const x = x0 + (x1 - x0) * (k + .5) / N;
            const top = Math.min(cap, ceilingIn(i, x, x + .01) + plinth() + T);
            const h = Math.max(0, top - base);
            area += h;
            sx += x * h;
            sy += (base + h / 2) * h;
        }
        if (area < 1e-6) {
            return { x: (x0 + x1) / 2, y: (base + cap) / 2 };
        }
        return { x: sx / area, y: sy / area };
    }
    function sectionSpaceMeasurements(i) {
        const spaces = sectionSpaces(i), point = getDesign().space?.i === i ? getDesign().space : null;
        const selected = point && spaces.find(q => point.x >= q.x0 - .01 && point.x <= q.x1 + .01 && point.y >= q.y0 - .01 && point.y <= q.y1 + .01);
        const top = plinth() + T + ih(i), none = { x0: 0, x1: widths()[i] || 0, w: widths()[i] || 0, h: 0, hMin: 0, sloped: false, dep: fittingDepth(getDesign().d).depth, y0: top, y1: top };
        return selected || spaces.sort((a, b) => b.y1 - a.y1 || b.w * b.h - a.w * a.h)[0] || none;
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
    /** Widest part of a free space where a fitting of height h clears the top.
     * Section-local; null when no part is at least minW wide. */
    function spaceSpan(i, space, h, minW) {
        const y0 = space.y0 - plinth() - T, spans = clearSpans(i, space.x0, space.x1, y0 + h).filter(q => q.x1 - q.x0 >= minW - .01);
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
    return { sectionSpaces, spaceCentre, sectionSpaceMeasurements, spaceSpan, narrowToFit, edgeGap, itemFreeAbove };
}
