import { PANEL as T, PLINTH as PL } from '../../domain/wardrobe/catalog.js';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'report' | 'selectionChanged' | 'milestone' | 'closeInspector'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'dividerBounds' | 'dividerValid' | 'dividerMeasurements' | 'sectionSpaceMeasurements' | 'dividerDupSpot' | 'clampDivider' | 'ceilingIn' | 'sectionSpaces'>;
    run(fn: () => void): void;
};
export function createDividerCommands({ getDesign, effects, rules, run }: Ports) {
    function moveDividerTo(index: number, value: number) {
        const d = getDesign().dividers?.[index];
        if (!d || !Number.isFinite(value)) {
            return false;
        }
        const a = rules.dividerBounds(d), horizontal = d.orientation === 'horizontal', key = horizontal ? 'y' : 'x', lo = (horizontal ? a.y0 : a.x0) + T / 2, hi = (horizontal ? a.y1 : a.x1) - T / 2, start = d[key], end = Math.max(lo, Math.min(hi, value));
        if (start === undefined)
            return false;
        const steps = Math.max(1, Math.ceil(Math.abs(end - start)));
        let last = start;
        for (let n = 1; n <= steps; n++) {
            const v = start + (end - start) * n / steps;
            if (!rules.dividerValid({ ...d, [key]: v }, index)) {
                let low = last, high = v;
                for (let k = 0; k < 16; k++) {
                    const mid = (low + high) / 2;
                    if (rules.dividerValid({ ...d, [key]: mid }, index)) {
                        low = mid;
                    }
                    else {
                        high = mid;
                    }
                }
                last = low;
                break;
            }
            last = v;
        }
        if (Math.abs(last - start) < .001) {
            return false;
        }
        d[key] = last;
        // Moving a vertical divider keeps its top at the slope where it now stands.
        if (!horizontal) {
            const clamped = rules.clampDivider(d);
            d.y1 = clamped.y1;
        }
        getDesign().space = null;
        getDesign().proposal = null;
        return true;
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
        return moveDividerTo(index, side === 'before' ? m.low + value + T / 2 : m.high - value - T / 2);
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
