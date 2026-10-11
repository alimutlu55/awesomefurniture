import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { ItemKind } from '../../domain/wardrobe/wardrobe';
import type { ItemEdit, ItemMovePlan, ItemResizeSession, ItemResizeTarget } from './command-types';
import { itemName, MODS, PANEL as T, PLINTH as PL } from '../../domain/wardrobe/catalog.js';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'changed' | 'report' | 'closeInspector' | 'requestUndo' | 'milestone' | 'checkpoint'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'computeLayout' | 'ih' | 'fitsCeiling' | 'sectionFits' | 'itemFit' | 'dividerOverlaps' | 'itemMeasurements' | 'itemYBounds' | 'sectionDividers' | 'sectionSpaceMeasurements' | 'effectiveMin' | 'itemFeasible' | 'newItem' | 'widths' | 'itemFreeAbove' | 'free' | 'edgeGap' | 'splitFor' | 'sectionLayoutValid' | 'duplicateSideSpot' | 'itemMinW' | 'used' | 'itemGeom' | 'maxN'>;
    callbacks: Pick<ReturnType<typeof import('./divider-commands').createDividerCommands>, 'addShelfBoard'>;
    run(fn: () => void): void;
};
export function createItemCommands({ getDesign, effects, rules, callbacks, run }: Ports) {
    function applyItemEdgeSize(a: ItemResizeSession, target: ItemResizeTarget) {
        const sec = structuredClone(a.original), it = sec[a.index];
        if (!it)
            return false;
        if (a.edge === 'top') {
            if (!('h' in target))
                return false;
            it.h = target.h;
        }
        else {
            if (!('w' in target))
                return false;
            sec.forEach((o, j) => o.y = a.layout[j]!.relY0);
            it.w = target.w;
            it.x = target.x;
            delete it.ax;
            if (target.w >= a.g.bw - .05) {
                delete it.w;
                delete it.x;
            }
        }
        const layout = rules.computeLayout(a.section, sec), valid = layout.every((q, j) => rules.fitsCeiling(a.section, q, sec[j]) && layout.every((r, k) => j === k || q.x0 >= r.x1 - .01 || r.x0 >= q.x1 - .01 || q.y0 >= r.y1 - .01 || r.y0 >= q.y1 - .01));
        if (!valid || rules.dividerOverlaps(a.section, layout)) {
            return false;
        }
        getDesign().secs[a.section] = sec;
        getDesign().proposal = null;
        effects.changed(true);
        return true;
    }
    function setItemClearance(i: number, j: number, side: 'top' | 'bottom' | 'before' | 'after', value: number) {
        if (!Number.isFinite(value) || value < 0) {
            return null;
        }
        const m = rules.itemMeasurements(i, j), b = rules.itemYBounds(i, j);
        if (!m || !b) {
            return null;
        }
        const want = side === 'top' ? b.cur + (m.top - value) : value, next = Math.round(Math.max(b.lo, Math.min(b.hi, want)) * 10) / 10;
        if (Math.abs(next - b.cur) < .05) {
            return { changed: false, limited: Math.abs(want - b.cur) > .15 };
        }
        run(() => {
            getDesign().secs[i]![j]!.y = next;
        });
        return { changed: true, limited: Math.abs(next - want) > .15 };
    }
    /** A shelf item for handbags: it fills the selected open space at full width, 25 cm tall
     * (a 23 cm bag with clearance). Bags stand upright on it. */
    function addHandbagShelf() {
        const i = getDesign().sel, space = rules.sectionSpaceMeasurements(i), h = 25;
        if (space.x0 === undefined || space.x1 === undefined) return;
        if (space.h < h || space.w < 33) {
            effects.report('No room for a handbag shelf here. It needs 25 cm of height and 33 cm of width.');
            return;
        }
        run(() => {
            const it = { ...rules.newItem('shelf', h), purpose: 'handbags' as const, w: space.w, x: space.x0, y: space.y0 - PL - T };
            getDesign().secs[i]!.push(it);
            getDesign().item = getDesign().secs[i]!.length - 1;
            getDesign().space = null;
        });
        effects.report('Handbag shelf added');
    }
    function addMod(k: ItemKind) {
        if ((k as string) === 'handbags') {
            addHandbagShelf();
            return;
        }
        if (k === 'shelf') {
            callbacks.addShelfBoard();
            return;
        }
        getDesign().divider = -1;
        const i = getDesign().sel, before = JSON.stringify(getDesign().secs), inSpace = getDesign().item < 0 && (getDesign().space?.i === i || rules.sectionDividers(i).length), space = inSpace ? rules.sectionSpaceMeasurements(i) : null;
        addMod0(k);
        if (JSON.stringify(getDesign().secs) === before || getDesign().item < 0) {
            return;
        }
        // Keep the "Add to this space" panel open so several items can be added in a row.
        // The new item is not left selected, so the next add targets free space instead of stacking on it.
        const it = getDesign().secs[i]![getDesign().item]!;
        getDesign().item = -1;
        if (space && it) {
            const top = space.y0 + it.h;
            if (space.y1 - top >= .5) {
                getDesign().space = { i, x: (space.x0! + space.x1!) / 2, y: (top + space.y1) / 2 };
            }
        }
        effects.changed(true);
    }
    function addMod0(k: ItemKind) {
        if (getDesign().item < 0 && (getDesign().space?.i === getDesign().sel || rules.sectionDividers(getDesign().sel).length)) {
            const space = rules.sectionSpaceMeasurements(getDesign().sel), m = MODS[k], mn = rules.effectiveMin(k);
            if (!rules.itemFeasible(k, space.w) || space.h < mn) {
                effects.report(m.n + ' does not fit the selected space');
                return;
            }
            // Under a sloped or stepped top the fitting fills the space and is cut to
            // the angle; its working core keeps the default height where it fits.
            const y0 = space.y0 - PL - T, fit = (h: number) => rules.itemFit(getDesign().sel, { x0: space.x0!, x1: space.x1!, relY0: y0, relY1: y0 + h }, rules.newItem(k, h));
            let hh = Math.min(Math.max(m.h, mn), space.h), place = fit(hh);
            for (let h = hh; !place && h >= mn - .01; h = Math.round((h - .5) * 10) / 10) {
                if ((place = fit(h))) hh = h;
            }
            if (!place) {
                effects.report(m.n + ' needs ' + mn + ' cm of height; the top is too low across this space');
                return;
            }
            if (place.cut) effects.report(m.n + ' cut to the angle of the top');
            run(() => {
                const it = { ...rules.newItem(k, hh), w: space.w, x: space.x0, y: y0 };
                getDesign().secs[getDesign().sel]!.push(it);
                getDesign().item = getDesign().secs[getDesign().sel]!.length - 1;
                getDesign().space = null;
            });
            return;
        }
        const m = MODS[k], w = rules.widths()[getDesign().sel]!, mn = rules.effectiveMin(k);
        if (!rules.itemFeasible(k, w)) {
            effects.report(m.n + ' does not fit this bay’s width or depth');
            return;
        }
        const selIt = getDesign().item >= 0 ? getDesign().secs[getDesign().sel]![getDesign().item]! : null, selFree = selIt ? rules.itemFreeAbove(getDesign().sel, getDesign().item) : 0;
        if (selIt && selIt.w && selFree >= mn) {
            run(() => {
                const nit = { ...rules.newItem(k, Math.min(Math.max(m.h, mn), selFree)), w: selIt.w, ...(selIt.ax ? { ax: selIt.ax } : {}) };
                getDesign().secs[getDesign().sel]!.splice(getDesign().item + 1, 0, nit);
                getDesign().item = getDesign().item + 1;
                getDesign().proposal = null;
            });
            return;
        }
        const f = rules.free(getDesign().sel);
        if (f < mn && addUnderSlope(k)) {
            return;
        }
        if (f < mn) {
            const g = rules.edgeGap(k);
            if (g) {
                const hh = Math.min(Math.max(m.h, mn), rules.ih(getDesign().sel));
                run(() => {
                    getDesign().divider = -1;
                    getDesign().secs[getDesign().sel]!.push({ ...rules.newItem(k, hh), w: g.w, ax: (g.ax as 'l' | 'c' | 'r') });
                    getDesign().item = getDesign().secs[getDesign().sel]!.length - 1;
                });
                return;
            }
            if (rules.splitFor(k)) {
                return;
            }
            effects.report(m.n + ' needs ' + mn + ' cm of height but only ' + f + ' cm is free here, and there is not enough width for this item');
            return;
        }
        run(() => {
            getDesign().secs[getDesign().sel]!.push(rules.newItem(k, Math.min(Math.max(m.h, mn), f)));
            getDesign().item = getDesign().secs[getDesign().sel]!.length - 1;
            getDesign().proposal = null;
        });
    }
    /** On top of the stack under a sloped top: the fitting spans the bay and is
     * cut to the angle, keeping the tallest working core that fits. */
    function addUnderSlope(k: ItemKind) {
        const i = getDesign().sel, m = MODS[k], mn = rules.effectiveMin(k), y = rules.used(i), bw = rules.widths()[i]!;
        for (let h = Math.max(m.h, mn); h >= mn - .01; h = Math.round((h - .5) * 10) / 10) {
            if (!rules.itemFit(i, { x0: 0, x1: bw, relY0: y, relY1: y + h }, rules.newItem(k, h))) continue;
            run(() => {
                getDesign().secs[i]!.push({ ...rules.newItem(k, h), y });
                getDesign().item = getDesign().secs[i]!.length - 1;
            });
            effects.report(m.n + ' cut to the angle of the top');
            return true;
        }
        return false;
    }
    function duplicateItem(i: number = getDesign().sel, j: number = getDesign().item) {
        const a = getDesign().secs[i]!, it = a && a[j];
        if (!it) {
            return;
        }
        const h = Math.min(it.h, rules.itemFreeAbove(i, j));
        if (h >= rules.effectiveMin(it.k)) {
            run(() => {
                const q = rules.computeLayout(i)[j]!;
                a.splice(j + 1, 0, { ...it, h, y: q.relY1 });
                if (!rules.sectionLayoutValid(i)) {
                    a.splice(j + 1, 1);
                    effects.report('The duplicate would overlap an item or divider');
                    return;
                }
                getDesign().item = j + 1;
                effects.report('Item duplicated');
            });
            return;
        }
        const spot = rules.duplicateSideSpot(i, j);
        if (spot == null) {
            effects.report('No room above or beside this item');
            return;
        }
        const x = spot.x;
        if (x === undefined)
            return;
        run(() => {
            const q = rules.computeLayout(i)[j]!, bw = rules.widths()[i]!, w = q.w, mxx = bw - w, copy = { ...it, w, y: spot.y };
            delete copy.ax;
            delete copy.x;
            if (x < .01) {
                copy.ax = 'l';
            }
            else if (x > mxx - .01) {
                copy.ax = 'r';
            }
            else {
                copy.x = x;
            }
            a.splice(j + 1, 0, copy);
            if (!rules.sectionLayoutValid(i)) {
                a.splice(j + 1, 1);
                effects.report('The duplicate would overlap an item or divider');
                return;
            }
            getDesign().item = j + 1;
            effects.report('Item duplicated beside the original');
        });
    }
    function deleteItem(i: number = getDesign().sel, j: number = getDesign().item) {
        const a = getDesign().secs[i]!;
        if (!a || !a[j]) {
            return;
        }
        const name = itemName(a[j]);
        run(() => {
            a.splice(j, 1);
            getDesign().item = -1;
        });
        effects.closeInspector();
        effects.report(name + ' removed', { label: 'Undo', fn: effects.requestUndo });
    }
    function removeTop() {
        const a = getDesign().secs[getDesign().sel]!;
        if (a && a.length) {
            deleteItem(getDesign().sel, getDesign().item >= 0 ? getDesign().item : a.length - 1);
        }
    }
    function setItemH(h: number) {
        const it = getDesign().secs[getDesign().sel]![getDesign().item]!;
        if (!it || isNaN(h)) {
            return;
        }
        const m = MODS[it.k], mn = rules.effectiveMin(it.k), mx = Math.min(m.mx, it.h + rules.itemFreeAbove(getDesign().sel, getDesign().item));
        if (mx < mn) {
            effects.report('Not enough room for the required clearance');
            return;
        }
        it.h = Math.max(mn, Math.min(mx, Math.round(h * 2) / 2));
        getDesign().proposal = null;
        effects.milestone('tune');
        effects.changed();
    }
    function setItemW(x: number) {
        const it = getDesign().secs[getDesign().sel]![getDesign().item]!;
        if (!it || !Number.isFinite(x)) {
            return;
        }
        const bw = rules.widths()[getDesign().sel]!, mn = rules.itemMinW(it);
        x = Math.max(mn, Math.min(bw, Math.round(x * 2) / 2));
        const oldW = it.w;
        if (x >= bw - .05) {
            delete it.w;
        }
        else {
            it.w = x;
        }
        if (!rules.sectionFits(getDesign().sel)) {
            if (oldW === undefined) {
                delete it.w;
            }
            else {
                it.w = oldW;
            }
            effects.report('Not enough height under the top for items to stack at this width');
            return;
        }
        getDesign().proposal = null;
        effects.milestone('tune');
        effects.changed();
    }
    function editItem(i: number, j: number, edit: ItemEdit) {
        const it = getDesign().secs[i]!?.[j]!;
        if (!it) {
            return false;
        }
        if (edit.kind) {
            const m = MODS[edit.kind], f = it.h + rules.itemFreeAbove(i, j), mn = rules.effectiveMin(edit.kind), nh = Math.min(Math.max(m.h, mn), f);
            if (nh < mn || !rules.itemFeasible(edit.kind, rules.itemGeom(i, j)!.w)) {
                if (nh < mn && rules.itemFeasible(edit.kind, rules.widths()[i]!) && rules.splitFor(edit.kind)) {
                    return false;
                }
                effects.report(m.n + ' does not fit the space or clearance, around the current items');
                return false;
            }
            run(() => {
                Object.assign(it, rules.newItem(edit.kind, nh));
                if (it.w && it.w < rules.itemMinW(it)) {
                    delete it.w;
                }
                it.front = !!rules.newItem(edit.kind, nh).front;
            });
            return true;
        }
        let accepted = true;
        run(() => {
            const original = { ...it };
            if (edit.fullWidth) {
                delete it.w;
                delete it.x;
                delete it.ax;
            }
            if (edit.align !== undefined) {
                delete it.x;
                if (edit.align === 'c') {
                    delete it.ax;
                }
                else {
                    it.ax = edit.align;
                }
            }
            if ((edit.fullWidth || edit.align !== undefined) && !rules.sectionLayoutValid(i)) {
                Object.keys(it).forEach(k => delete it[k as keyof EditorItem]);
                Object.assign(it, original);
                accepted = false;
                effects.report(edit.fullWidth ? 'Full width would overlap an item or divider' : 'This alignment would overlap an item or divider');
                return;
            }
            if (edit.fullWidth || edit.align !== undefined || edit.stretch) {
                effects.milestone('tune');
            }
            if (edit.finish !== undefined) {
                it.f = edit.finish || null;
                if (edit.finish) {
                    effects.milestone('paint');
                }
            }
            if (edit.stretch) {
                it.h = Math.min(MODS[it.k].mx, it.h + rules.itemFreeAbove(i, j));
            }
            if (edit.purpose !== undefined) {
                it.purpose = edit.purpose;
            }
        });
        return accepted;
    }
    function clearSection(i: number) {
        run(() => {
            getDesign().secs[i] = [];
            getDesign().dividers = (getDesign().dividers || []).filter(d => d.i !== i);
            getDesign().space = null;
        });
    }
    function applyMove(plan: ItemMovePlan) {
        if (!plan?.valid || plan.unchanged) {
            return false;
        }
        effects.checkpoint();
        getDesign().secs = plan.secs;
        getDesign().sel = plan.to;
        getDesign().item = plan.index;
        getDesign().proposal = null;
        effects.changed();
        return true;
    }
    function restoreSection(i: number, items: EditorItem[]) {
        getDesign().secs[i] = structuredClone(items);
        effects.changed(true);
    }
    function normalizeSelection() {
        const state = getDesign(), mn = rules.maxN();
        if (state.n > mn) {
            state.n = mn;
        }
        if (state.sel >= state.n) {
            state.sel = state.n - 1;
        }
        if (state.item >= state.secs[state.sel]!.length) {
            state.item = -1;
        }
    }
    return { applyItemEdgeSize, setItemClearance, addHandbagShelf, addMod, addMod0, duplicateItem, deleteItem, removeTop, setItemH, setItemW, editItem, clearSection, applyMove, restoreSection, normalizeSelection };
}
