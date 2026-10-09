import { PANEL as T, PLINTH as PL } from '../../domain/wardrobe/catalog.js';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'report' | 'selectionChanged' | 'milestone' | 'closeInspector'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'dividerBounds' | 'dividerValid' | 'dividerMeasurements' | 'sectionSpaceMeasurements' | 'dividerDupSpot'>;
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
        getDesign().space = null;
        getDesign().proposal = null;
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
        const d = { i, orientation: ('vertical' as const), x: (space.x0! + space.x1!) / 2, y0: space.y0 - PL - T, y1: space.y1 - PL - T, area: { x0: space.x0, x1: space.x1, y0: space.y0 - PL - T, y1: space.y1 - PL - T } };
        run(() => {
            getDesign().dividers = (getDesign().dividers || []).concat(d);
            getDesign().space = { i, x: (space.x0! + d.x - T / 2) / 2, y: (space.y0 + space.y1) / 2 };
            getDesign().item = -1;
            getDesign().divider = getDesign().dividers.length - 1;
            effects.selectionChanged({ deep: true, pillOn: false });
            effects.milestone('cut');
        });
        effects.report('Divider added inside the selected space');
    }
    function addShelfBoard() {
        const i = getDesign().sel, space = rules.sectionSpaceMeasurements(i);
        if (space.x0 === undefined || space.x1 === undefined)
            return;
        if ((space.h - T) / 2 < 15 || space.w < 25) {
            effects.report('This space is too small for a shelf');
            return;
        }
        const y = (space.y0 + space.y1) / 2 - PL - T, d = { i, orientation: ('horizontal' as const), x0: space.x0, x1: space.x1, y, area: { x0: space.x0, x1: space.x1, y0: space.y0 - PL - T, y1: space.y1 - PL - T } };
        run(() => {
            getDesign().dividers = (getDesign().dividers || []).concat(d);
            getDesign().item = -1;
            getDesign().divider = -1;
            getDesign().proposal = null;
            getDesign().space = { i, x: (space.x0! + space.x1!) / 2, y: (space.y0 + y + PL + T - T / 2) / 2 };
        });
        effects.report('Shelf added. Free space above and below');
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
    return { moveDividerTo, setDividerClearance, addSpaceDivider, addShelfBoard, removeDivider, duplicateDivider };
}
