import { PANEL as T, PLINTH as PL } from '../../domain/wardrobe/catalog.js';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'report' | 'selectionChanged' | 'milestone' | 'closeInspector'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'dividerBounds' | 'dividerValid' | 'dividerMeasurements' | 'sectionSpaceMeasurements' | 'dividerDupSpot' | 'clampDivider' | 'ceilingIn' | 'sectionSpaces'
        | 'moveWithAttachments' | 'sectionLayoutValid' | 'ceilingTop' | 'widths'>;
    run(fn: () => void): void;
};
export function createDividerCommands({ getDesign, effects, rules, run }: Ports) {
    /** The design with a board moved to `v` and what is attached to it (`moveWithAttachments`), when
     * everything in its section still fits; else null. Nothing is changed. */
    function planMove(index: number, v: number) {
        const plan = rules.moveWithAttachments(index, v);
        if (!plan) return null;
        const design = getDesign(), dividers = design.dividers, secs = design.secs[plan.i];
        design.dividers = plan.dividers;
        design.secs[plan.i] = plan.secs;
        try {
            const ok = rules.sectionLayoutValid(plan.i) && plan.dividers.every((d, k) => d.i !== plan.i || rules.dividerValid(d, k));
            return ok ? plan : null;
        } finally {
            design.dividers = dividers;
            design.secs[plan.i] = secs!;
        }
    }
    /** Moves a board as far towards `value` as it can go: anywhere in its section, fitted to the space where
     * it stands, with the shelves and fittings attached to it. Returns 'all' when attached parts moved too
     * (the section needs redrawing), true when only the board did, false when nothing moved. */
    function moveDividerTo(index: number, value: number): boolean | 'all' {
        const d = getDesign().dividers?.[index];
        if (!d || !Number.isFinite(value)) {
            return false;
        }
        const horizontal = d.orientation === 'horizontal', key = horizontal ? 'y' : 'x', start = d[key];
        if (start === undefined)
            return false;
        const lo = T / 2, hi = (horizontal ? rules.ceilingTop(d.i, 0, rules.widths()[d.i]!) : rules.widths()[d.i]!) - T / 2, end = Math.max(lo, Math.min(hi, value));
        // Step by centimetres so nothing is jumped over; the last step is found exactly by halving.
        const steps = Math.max(1, Math.ceil(Math.abs(end - start)));
        let last = start, plan: ReturnType<typeof planMove> = null;
        for (let n = 1; n <= steps; n++) {
            const v = start + (end - start) * n / steps, next = planMove(index, v);
            if (!next) {
                let low = last, high = v;
                for (let k = 0; k < 16; k++) {
                    const mid = (low + high) / 2, m = planMove(index, mid);
                    if (m) { low = mid; plan = m; } else high = mid;
                }
                // Stopped against something: settle exactly onto its face (the halving lands a hair short).
                const flush = Math.round(low * 10) / 10, m = Math.abs(flush - low) < .02 ? planMove(index, flush) : null;
                if (m) plan = m;
                last = m ? flush : low;
                break;
            }
            last = v;
            plan = next;
        }
        if (Math.abs(last - start) < .001 || !plan) {
            return false;
        }
        getDesign().dividers = plan.dividers;
        getDesign().secs[plan.i] = plan.secs;
        getDesign().space = null;
        getDesign().proposal = null;
        return plan.moved ? 'all' : true;
    }
    /** Height of a vertical divider, from its base. Limited by the slope above it and by
     * the shortest divider; a height the slope cannot reach is reported and kept as the
     * tallest allowed. */
    function setDividerHeight(index: number, height: number) {
        const d = getDesign().dividers?.[index];
        if (!d || d.orientation !== 'vertical' || !Number.isFinite(height)) {
            return false;
        }
        const base = d.y0 ?? 0, current = d.y1 ?? base;
        const top = rules.clampDivider({ ...d, want: base + height, y1: base + height }).y1 ?? base;
        if ((top ?? base) - base < 15 - .01) {
            effects.report('A divider needs at least 15 cm of height here.');
            return false;
        }
        // Asking above the slope always says so, even when the divider already stands at its limit.
        if (top < base + height - .05) {
            effects.report('The slope limits this divider to ' + Math.round((top - base) * 10) / 10 + ' cm here.');
        }
        const wanted = base + height;
        if (Math.abs(top - current) < .05 && Math.abs(wanted - (d.want ?? current)) < .05) {
            return false;
        }
        run(() => {
            // The wanted height is kept, so the divider returns to it when the slope allows.
            getDesign().dividers[index]!.want = wanted;
            getDesign().dividers[index]!.y1 = top;
            getDesign().space = null;
        });
        return true;
    }
    function setDividerClearance(index: number, side: 'top' | 'bottom' | 'before' | 'after', value: number) {
        if (!Number.isFinite(value) || value < 0 || !['before', 'after'].includes(side)) {
            return false;
        }
        const m = rules.dividerMeasurements(index);
        if (!m) {
            return false;
        }
        return !!moveDividerTo(index, side === 'before' ? m.low + value + T / 2 : m.high - value - T / 2);
    }
    function addSpaceDivider() {
        const i = getDesign().sel, space = rules.sectionSpaceMeasurements(i);
        if (space.x0 === undefined || space.x1 === undefined)
            return;
        if ((space.w - T) / 2 < 25) {
            effects.report('This space is too narrow for a divider');
            return;
        }
        // A new divider starts at the most the slope allows above its position.
        const d = rules.clampDivider({ i, orientation: ('vertical' as const), x: (space.x0! + space.x1!) / 2, y0: space.y0 - PL - T, y1: space.y1 - PL - T, area: { x0: space.x0, x1: space.x1, y0: space.y0 - PL - T, y1: space.y1 - PL - T } });
        run(() => {
            getDesign().dividers = (getDesign().dividers || []).concat(d);
            getDesign().space = { i, x: (space.x0! + d.x - T / 2) / 2, y: (space.y0 + space.y1) / 2 };
            getDesign().item = -1;
            getDesign().divider = getDesign().dividers.length - 1;
            effects.selectionChanged({ deep: true, pillOn: false });
            effects.milestone('cut');
        });
    }
    /** A shelf needs room for itself and its clearance on both sides. */
    const shelfFits = (q: { w: number; h: number }) => (q.h - T) / 2 >= 15 && q.w >= 25;
    function addShelfBoard() {
        const i = getDesign().sel;
        let space = rules.sectionSpaceMeasurements(i);
        if (!shelfFits(space)) {
            // The selected space is too small. Use the open space nearest the selection that fits a shelf,
            // so shelves fill the area being worked on before they move elsewhere in the section.
            const point = getDesign().space;
            const distance = (q: { x0?: number | undefined; x1?: number | undefined; y0?: number | undefined; y1?: number | undefined }) => {
                if (!point) return 0;
                const dx = Math.max((q.x0 ?? 0) - point.x, 0, point.x - (q.x1 ?? 0));
                const dy = Math.max((q.y0 ?? 0) - point.y, 0, point.y - (q.y1 ?? 0));
                return Math.hypot(dx, dy);
            };
            const fitting = rules.sectionSpaces(i).filter(shelfFits).sort((a, b) => distance(a) - distance(b) || b.w * b.h - a.w * a.h)[0];
            if (!fitting) {
                effects.report('No open space in this section is big enough for a shelf');
                return;
            }
            space = fitting;
            getDesign().space = { i, x: (fitting.x0! + fitting.x1!) / 2, y: (fitting.y0! + fitting.y1!) / 2 };
        }
        if (space.x0 === undefined || space.x1 === undefined)
            return;
        const y = (space.y0 + space.y1) / 2 - PL - T, d = { i, orientation: ('horizontal' as const), x0: space.x0, x1: space.x1, y, area: { x0: space.x0, x1: space.x1, y0: space.y0 - PL - T, y1: space.y1 - PL - T } };
        run(() => {
            getDesign().dividers = (getDesign().dividers || []).concat(d);
            getDesign().item = -1;
            getDesign().divider = -1;
            getDesign().proposal = null;
            getDesign().space = { i, x: (space.x0! + space.x1!) / 2, y: (space.y0 + y + PL + T - T / 2) / 2 };
        });
    }
    function removeDivider() {
        run(() => {
            getDesign().dividers.splice(getDesign().divider, 1);
            getDesign().divider = -1;
            getDesign().item = -1;
        });
        effects.selectionChanged({ pillOn: true });
        effects.closeInspector();
    }
    function duplicateDivider() {
        const index = getDesign().divider, d = getDesign().dividers?.[index], v = rules.dividerDupSpot(index);
        if (!d) {
            return false;
        }
        const word = d.orientation === 'horizontal' ? 'shelf' : 'divider';
        if (v == null) {
            effects.report('No room for another ' + word + ' here');
            return false;
        }
        const key = d.orientation === 'horizontal' ? 'y' : 'x';
        run(() => {
            const copy = structuredClone(d);
            delete copy.id;
            getDesign().dividers.push({ ...copy, [key]: v });
            getDesign().divider = getDesign().dividers.length - 1;
            getDesign().item = -1;
            getDesign().space = null;
            effects.selectionChanged({ pillOn: false, deep: true });
        });
        effects.report(word.charAt(0).toUpperCase() + word.slice(1) + ' duplicated');
        return true;
    }
    return { moveDividerTo, setDividerHeight, setDividerClearance, addSpaceDivider, addShelfBoard, removeDivider, duplicateDivider };
}
