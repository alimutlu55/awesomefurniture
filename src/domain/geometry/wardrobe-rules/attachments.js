import { PANEL as T } from '../../wardrobe/catalog.js';
/** @typedef {ReturnType<typeof import('./sizes.js').createSizesRules>} SizesRules */
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** @typedef {ReturnType<typeof import('./dividers.js').createDividersRules>} DividersRules */
/** @typedef {ReturnType<typeof import('./fit.js').createFitRules>} FitRules */
/** Within this distance (cm) two faces touch: the part is attached. */
const TOUCH = .6;
/** Shortest shelf a board can be stretched or squeezed to, in cm. */
const MIN_SHELF = 15;
const near = (a, b) => Math.abs(a - b) <= TOUCH;
const overlaps = (a0, a1, b0, b1) => a0 < b1 - .01 && b0 < a1 - .01;
/** What moves with a board, as a carpenter builds it. One rule for every board and fitting:
 * - A board fits the wardrobe where it stands: a vertical divider stands on what is below it and reaches up
 *   to the top or the slope there (or the shelf it met); a shelf reaches across as far as it did. One
 *   someone made shorter keeps its length. Another part in its way stops it: it never shrinks to pass.
 * - What is attached goes with it. Shelves and fittings touching a vertical divider's face follow it
 *   sideways: one also fixed at its other end stretches, a free one slides. Fittings and dividers standing
 *   on a shelf ride up and down with it; a divider reaching up to it stretches.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres, section coordinates (from the base
 * board, as dividers and pinned fittings are stored). Plans are returned, never applied.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {SizesRules & CeilingRules & LayoutRules & FitRules & DividersRules} deps Rules from the modules created before this one. */
export function createAttachmentRules(ctx, deps) {
    const { getDesign } = ctx;
    const { itemMinW, ceilingIn, ceilingTop, computeLayout, widths, dividerRect, dividerValid, fitsCeiling } = deps;

    /** Everything in a section as rectangles: fittings (with their index `j`) and boards (index `k`). */
    function parts(i, secs = getDesign().secs[i] || [], dividers = getDesign().dividers || []) {
        const items = computeLayout(i, secs).map((q, j) => ({ j, x0: q.x0, x1: q.x1, y0: q.relY0, y1: q.relY1 }));
        const boards = dividers.map((d, k) => ({ k, d, ...dividerRect(d) })).filter(b => b.d.i === i);
        return { items, boards };
    }
    /** The clear run across `span` (a strip [a0, a1] on the other axis) that contains `ref`, among the
     * parts not skipped. Vertical: heights from the base up; horizontal: widths across the section. Null
     * when `ref` is inside a part (the board would cut through it there). */
    function gap(i, axis, span, ref, all, skip = /** @type {(p: any) => boolean} */ (() => false)) {
        const vertical = axis === 'y', list = [...all.items, ...all.boards].filter(p => !skip(p) && (vertical ? overlaps(p.x0, p.x1, span[0], span[1]) : overlaps(p.y0, p.y1, span[0], span[1])));
        let lo = 0, hi = vertical ? Math.min(ceilingTop(i, 0, widths()[i]), ceilingIn(i, span[0], span[1])) : widths()[i], loPart = false, hiPart = false;
        for (const p of list) {
            const a = vertical ? p.y0 : p.x0, b = vertical ? p.y1 : p.x1;
            if (a < ref - .01 && b > ref + .01) return null;
            if (b <= ref + .01) { if (b > lo) { lo = b; loPart = true; } }
            else if (a < hi) { hi = a; hiPart = true; }
        }
        // `loPart`/`hiPart`: the run ends at a part, not at the wardrobe itself (its base, sides, top or slope).
        return hi > lo ? { lo, hi, loPart, hiPart } : null;
    }
    /** A board at its new place (`all`: the section as it will be) fitted into the clear run there, keeping
     * its length if it was shorter than the run it stood in (`old`: the section as it was). */
    function fit(i, d, before, all, old, k) {
        const self = p => p.k === k;
        if (d.orientation === 'vertical') {
            const was = gap(i, 'y', [before.x - T / 2, before.x + T / 2], before.y0 + .5, old, self);
            // It fills its space unless someone made it shorter. A filling divider wants no top of its own, or the
            // wardrobe's full height; a shorter one wants its own top, kept even where a slope cuts it.
            const full = ceilingTop(i, 0, widths()[i]), wanted = before.want ?? before.y1;
            const filling = !was || before.want === undefined || wanted >= full - .5 || (before.y1 >= was.hi - .5 && wanted <= was.hi + .5);
            const run = gap(i, 'y', [d.x - T / 2, d.x + T / 2], d.y0 + .5, all, self);
            // A part lower than its top is in the way: it stops there rather than shrinking under it.
            if (!run || (run.hiPart && run.hi < before.y1 - .01 && run.hi < run.lo + (wanted - before.y0) - .01)) return null;
            const length = wanted - before.y0, y1 = filling ? run.hi : Math.min(run.hi, run.lo + length);
            const across = gap(i, 'x', [run.lo, y1], d.x, all, self) ?? { lo: 0, hi: widths()[i] };
            // Filling up to the top, it grows with the wardrobe (clampDivider cuts it to the slope); up to a part, it ends there.
            const want = filling ? (run.hiPart ? undefined : full) : run.lo + length;
            return { ...d, y0: run.lo, y1, want, area: { x0: across.lo, x1: across.hi, y0: run.lo, y1 } };
        }
        const mid = (b) => (b.x0 + b.x1) / 2, was = gap(i, 'x', [before.y - T / 2, before.y + T / 2], mid(before), old, self);
        const left = was && near(before.x0, was.lo), right = was && near(before.x1, was.hi);
        const run = gap(i, 'x', [d.y - T / 2, d.y + T / 2], left ? d.x0 + .5 : right ? d.x1 - .5 : mid(d), all, self);
        // A part reaching into its length is in the way.
        if (!run || (run.loPart && run.lo > d.x0 + .01) || (run.hiPart && run.hi < d.x1 - .01)) return null;
        const length = d.x1 - d.x0;
        const [x0, x1] = left && right ? [run.lo, run.hi] : left ? [run.lo, Math.min(run.hi, run.lo + length)] : right ? [Math.max(run.lo, run.hi - length), run.hi] : [d.x0, d.x1];
        if (x1 - x0 < MIN_SHELF - .01) return null;
        // It may travel up and down its whole stretch; what is above and below stops it.
        return { ...d, x0, x1, area: { x0, x1, y0: 0, y1: ceilingTop(i, 0, widths()[i]) } };
    }

    /** Board `index` moved to `value` (its x, or its y for a shelf), with what is attached to it and every
     * moved board fitted where it now stands. Returns the section's new fittings and the design's new
     * boards, or null where it cannot stand. */
    function moveWithAttachments(index, value) {
        const design = getDesign(), d = design.dividers?.[index];
        if (!d) return null;
        const i = d.i, now = parts(i), r = dividerRect(d), secs = (design.secs[i] || []).map(it => ({ ...it })), dividers = design.dividers.map(x => ({ ...x }));
        const changed = new Set([index]);
        if (d.orientation === 'vertical') {
            const dx = value - d.x;
            dividers[index] = { ...d, x: value };
            // Anchored: the other end of a part touches the section side or another upright board.
            const anchoredAt = (x, y0, y1) => near(x, 0) || near(x, widths()[i]) || now.boards.some(b => b.k !== index && b.d.orientation === 'vertical' && (near(b.x0, x) || near(b.x1, x)) && overlaps(b.y0, b.y1, y0, y1));
            for (const b of now.boards) {
                if (b.d.orientation !== 'horizontal' || !overlaps(b.y0, b.y1, r.y0, r.y1)) continue;
                const onLeft = near(b.x1, r.x0), onRight = near(b.x0, r.x1);
                if (!onLeft && !onRight) continue;
                const stretch = onLeft ? anchoredAt(b.x0, b.y0, b.y1) : anchoredAt(b.x1, b.y0, b.y1);
                const s = dividers[b.k];
                dividers[b.k] = onLeft ? { ...s, x0: stretch ? s.x0 : s.x0 + dx, x1: s.x1 + dx } : { ...s, x0: s.x0 + dx, x1: stretch ? s.x1 : s.x1 + dx };
                changed.add(b.k);
            }
            for (const q of now.items) {
                if (!overlaps(q.y0, q.y1, r.y0, r.y1)) continue;
                const onLeft = near(q.x1, r.x0), onRight = near(q.x0, r.x1);
                if (!onLeft && !onRight) continue;
                const it = secs[q.j], stretch = it.w !== undefined && (onLeft ? anchoredAt(q.x0, q.y0, q.y1) : anchoredAt(q.x1, q.y0, q.y1));
                const w = q.x1 - q.x0 + (stretch ? (onLeft ? dx : -dx) : 0);
                if (stretch && w < itemMinW(it) - .01) return null;
                Object.assign(it, { w: stretch ? Math.round(w * 100) / 100 : it.w, x: Math.round((onLeft && stretch ? q.x0 : q.x0 + dx) * 100) / 100 });
                // Placed by hand now: it keeps the height it had in the stack.
                if (!Number.isFinite(it.y)) it.y = q.y0;
            }
        } else {
            const dy = value - d.y, top = r.y1, bottom = r.y0;
            dividers[index] = { ...d, y: value };
            for (const q of now.items) {
                if (!near(q.y0, top) || !overlaps(q.x0, q.x1, r.x0, r.x1)) continue;
                Object.assign(secs[q.j], { y: Math.round((q.y0 + dy) * 100) / 100, x: Number.isFinite(secs[q.j].x) ? secs[q.j].x : q.x0 });
            }
            for (const b of now.boards) {
                if (b.d.orientation !== 'vertical' || !overlaps(b.x0, b.x1, r.x0, r.x1)) continue;
                const s = dividers[b.k];
                if (near(b.y0, top)) dividers[b.k] = { ...s, y0: s.y0 + dy, y1: s.y1 + dy, want: (s.want ?? s.y1) + dy };
                else if (near(b.y1, bottom)) dividers[b.k] = { ...s, y1: s.y1 + dy, want: s.y1 + dy };
                else continue;
                changed.add(b.k);
            }
        }
        // Every board that moved fits where it now stands, among everything else as it now is.
        const after = parts(i, secs, dividers);
        for (const k of changed) {
            const fitted = fit(i, dividers[k], design.dividers[k], after, now, k);
            if (!fitted) return null;
            dividers[k] = fitted;
        }
        return { i, secs, dividers, moved: changed.size > 1 || secs.some((it, j) => JSON.stringify(it) !== JSON.stringify(design.secs[i][j])) };
    }
    /** Whether a section would be buildable with these fittings and boards: nothing overlaps, everything
     * fits under the top. Nothing is changed. */
    function sectionOk(i, secs, dividers) {
        const design = getDesign(), was = { secs: design.secs[i], dividers: design.dividers };
        design.secs[i] = secs;
        design.dividers = dividers;
        try {
            const lay = computeLayout(i), apart = (a, b) => a.x0 >= b.x1 - .01 || b.x0 >= a.x1 - .01 || a.relY0 >= b.relY1 - .01 || b.relY0 >= a.relY1 - .01;
            return lay.every((q, j) => q.relY0 >= -.01 && fitsCeiling(i, q, secs[j]) && lay.every((r, k) => j === k || apart(q, r)))
                && dividers.every((d, k) => d.i !== i || dividerValid(d, k));
        } finally {
            design.secs[i] = was.secs;
            design.dividers = was.dividers;
        }
    }
    /** A fitting moved within its section (an item move `plan`) takes what stands on it along: fittings
     * placed on its top and dividers standing on it move by as much as it did, when they still fit there.
     * Returns the design's new fittings and boards. */
    function carryOnMove(plan) {
        const design = getDesign(), i = design.sel, j = design.item, plain = { secs: plan.secs, dividers: design.dividers };
        if (!plan?.valid || plan.to !== i || j < 0) return plain;
        const before = computeLayout(i)[j], after = computeLayout(i, plan.secs[i])[plan.index];
        if (!before || !after) return plain;
        const dx = after.x0 - before.x0, dy = after.relY0 - before.relY0, top = before.relY1;
        if (Math.abs(dx) < .01 && Math.abs(dy) < .01) return plain;
        const resting = (q) => near(q.relY0, top) && overlaps(q.x0, q.x1, before.x0, before.x1);
        const secs = plan.secs.map(sec => sec.map(it => ({ ...it }))), lay = computeLayout(i, plan.secs[i]);
        lay.forEach((q, k) => {
            const it = secs[i][k];
            if (k === plan.index || !Number.isFinite(it.y) || !resting(q)) return;
            Object.assign(it, { x: Math.round((q.x0 + dx) * 100) / 100, y: Math.round((q.relY0 + dy) * 100) / 100 });
        });
        const dividers = design.dividers.map(d => d.i === i && d.orientation === 'vertical' && near(d.y0, top) && overlaps(d.x - T / 2, d.x + T / 2, before.x0, before.x1)
            ? { ...d, x: d.x + dx, y0: d.y0 + dy, y1: d.y1 + dy, ...(d.want !== undefined ? { want: d.want + dy } : {}) } : d);
        return sectionOk(i, secs[i], dividers) ? { secs, dividers } : plain;
    }
    return { moveWithAttachments, carryOnMove };
}
