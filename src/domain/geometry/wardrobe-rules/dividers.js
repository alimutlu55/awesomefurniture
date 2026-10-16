import { PANEL as T } from '../../wardrobe/catalog.js';
import { MIN_CUT_BOARD } from '../../wardrobe/shape/angle-cut';
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** Shortest vertical divider, in cm. */
const MIN_DIVIDER = 15;
/** Divider and shelf-board geometry: bounds, cuts under the top, validity, measurements, duplication.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {CeilingRules & LayoutRules} deps Rules from the modules created before this one. */
export function createDividersRules(ctx, deps) {
    const { getDesign } = ctx;
    const { ceilingIn, ceilingTop, clearSpans, computeLayout, widths } = deps;

    function dividerRect(d) {
        return d.orientation === 'horizontal' ? { x0: d.x0, x1: d.x1, y0: d.y - T / 2, y1: d.y + T / 2 } : { x0: d.x - T / 2, x1: d.x + T / 2, y0: d.y0, y1: d.y1 };
    }
    /** The part of a board that is built: a shelf under a sloped top is cut to the longest stretch that clears
     * it, a divider to the top above it. Its outline, handle and measurements follow this, not the stored extent. */
    function visibleRect(d) {
        const r = dividerRect(d.orientation === 'vertical' ? clampDivider(d) : d);
        if (d.orientation !== 'horizontal' || !boardFit(d.i, r, 'horizontal')?.cut) {
            return r;
        }
        const best = clearSpans(d.i, r.x0, r.x1, r.y1).sort((p, q) => (q.x1 - q.x0) - (p.x1 - p.x0))[0];
        return best ? { ...r, x0: best.x0, x1: best.x1 } : r;
    }
    function dividerMeasurements(index) {
        const d = getDesign().dividers?.[index];
        if (!d) {
            return null;
        }
        const r = visibleRect(d), area = dividerBounds(d), hor = d.orientation === 'horizontal';
        let low = hor ? area.y0 : area.x0, high = hor ? area.y1 : area.x1;
        // Above a shelf, the clear height is measured up to the top where the shelf is, not the wardrobe's tallest point.
        if (hor) {
            const mid = (r.x0 + r.x1) / 2;
            high = Math.min(high, ceilingIn(d.i, mid - .5, mid + .5));
        }
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
        const a = dividerBounds(d), next = { ...d, roofFit: false, area: { ...a }, orientation };
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
    function sectionDividers(i) {
        return (getDesign().dividers || []).filter(d => d.i === i);
    }
    function dividerOverlaps(i, layout) {
        return sectionDividers(i).some(d => {
            const r = dividerRect(d);
            return layout.some(q => q.x0 < r.x1 - .01 && q.x1 > r.x0 + .01 && q.relY0 < r.y1 - .01 && q.relY1 > r.y0 + .01);
        });
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
    return { dividerRect, visibleRect, sectionDividers, dividerBounds, boardFit, clampDivider, dividerValid, dividerOrientation, dividerOverlaps, dividerMeasurements, dividerDupSpot };
}
