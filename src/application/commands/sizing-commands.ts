import type { EditorItem } from '../../domain/wardrobe/editor-design';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'report' | 'milestone' | 'changed'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'widths' | 'bayMinW' | 'itemMinW' | 'used' | 'ih' | 'effectiveMin' | 'computeLayout' | 'okItem' | 'overflow' | 'narrowToFit' | 'dividerValid' | 'clampDivider'>;
};
export function createSizingCommands({ getDesign, effects, rules }: Ports) {
    function clampWidths() {
        if (getDesign().n < 2) {
            return;
        }
        const ws = rules.widths(), total = ws.reduce((a, b) => a + b);
        let mins = ws.map((_, i) => rules.bayMinW(i));
        if (mins.reduce((a, b) => a + b) > total + .01) {
            mins = ws.map(() => 25);
        }
        const remaining = total - mins.reduce((a, b) => a + b), extras = ws.map((w, i) => Math.max(0, w - mins[i]!)), sum = extras.reduce((a, b) => a + b);
        getDesign().wt = extras.map((x, i) => mins[i]! + (sum ? remaining * x / sum : remaining / getDesign().n)).concat([100, 100, 100, 100, 100, 100]).slice(0, 6);
    }
    function fitColumns(i: number) {
        const sec = getDesign().secs[i]!, bw = rules.widths()[i]!, left = sec.filter(it => it.w && it.ax === 'l'), right = sec.filter(it => it.w && it.ax === 'r'), ext = (a: EditorItem[]) => a.reduce((m, it) => Math.max(m, Math.min(it.w!, bw)), 0), mn = (a: EditorItem[]) => a.reduce((m, it) => Math.max(m, rules.itemMinW(it)), 0);
        let L = ext(left), R = ext(right);
        if (L + R > bw + .05) {
            const sl = Math.max(0, L - mn(left)), sr = Math.max(0, R - mn(right)), tot = sl + sr, cut = Math.min(L + R - bw, tot);
            if (tot > 0) {
                L -= cut * sl / tot;
                R -= cut * sr / tot;
            }
        }
        left.forEach(it => it.w = Math.max(rules.itemMinW(it), Math.min(it.w!, Math.floor(L * 10) / 10)));
        right.forEach(it => it.w = Math.max(rules.itemMinW(it), Math.min(it.w!, Math.floor(R * 10) / 10)));
        sec.forEach(it => {
            if (it.w && it.w >= bw - .05) {
                delete it.w;
                delete it.ax;
            }
            else if (it.w && !it.ax) {
                it.w = Math.max(rules.itemMinW(it), Math.min(it.w!, bw));
            }
        });
    }
    /** Bring every fitting in a bay under the top. Heights shrink first (down to
     * each fitting's minimum); under a sloped top a fitting may then narrow into
     * the taller part; only then is the most overflowing fitting removed. */
    function compressBay(i: number) {
        const sec = getDesign().secs[i]!;
        let removed = 0;
        for (let guard = 0; guard < 80 && rules.overflow(i) > .05; guard++) {
            const over = rules.overflow(i);
            let done = false;
            for (const it of [...sec].sort((a, b) => (b.h - rules.effectiveMin(b.k)) - (a.h - rules.effectiveMin(a.k)))) {
                const slack = it.h - rules.effectiveMin(it.k);
                if (slack <= .05) {
                    break;
                }
                const old = it.h;
                it.h = Math.round((old - Math.min(slack, over)) * 10) / 10;
                if (rules.overflow(i) < over - .01) {
                    done = true;
                    break;
                }
                it.h = old;
            }
            if (!done) {
                const lay = rules.computeLayout(i);
                let t = 0, worst = -Infinity;
                lay.forEach((q, j) => {
                    const o = rules.overflow(i, [q], [sec[j]!]);
                    if (o > worst + .001 || (Math.abs(o - worst) <= .001 && q.relY1 > lay[t]!.relY1)) {
                        worst = o;
                        t = j;
                    }
                });
                const fit = rules.narrowToFit(i, t);
                if (fit) {
                    const it = sec[t]!, before = structuredClone(it);
                    it.w = fit.w;
                    it.x = fit.x;
                    it.y = fit.y;
                    delete it.ax;
                    if (rules.overflow(i) < over - .01) {
                        continue;
                    }
                    Object.keys(it).forEach(k => delete it[k as keyof EditorItem]);
                    Object.assign(it, before);
                }
                sec.splice(t, 1);
                removed++;
            }
        }
        return removed;
    }
    /** Fit fittings and shelf boards to a changed skeleton. Returns what changed. */
    function fitToShape() {
        let removed = 0, squeezed = false;
        for (let i = 0; i < getDesign().n; i++) {
            if (rules.overflow(i) > .05) {
                squeezed = true;
                removed += compressBay(i);
            }
        }
        // Dividers follow the slope like items: their tops are cut first, and only a divider
        // the slope leaves too short is removed.
        const before = getDesign().dividers.length;
        getDesign().dividers = getDesign().dividers.map(d => d.i < getDesign().n ? rules.clampDivider(d) : d);
        getDesign().dividers = getDesign().dividers.filter((d, j) => d.i >= getDesign().n || rules.dividerValid(d, j));
        const boards = before - getDesign().dividers.length;
        if (removed || boards) {
            const parts = [removed && removed + ' module' + (removed > 1 ? 's' : ''), boards && boards + ' shelf or divider' + (boards > 1 ? 's' : '')].filter(Boolean).join(' and ');
            effects.report(parts + ' no longer fit under the top and ' + (removed + boards > 1 ? 'were' : 'was') + ' removed. Undo (Ctrl/Cmd+Z) restores ' + (removed + boards > 1 ? 'them' : 'it') + '.');
        }
        else if (squeezed) {
            effects.report('Modules were compacted to fit under the top. Undo (Ctrl/Cmd+Z) reverts.');
        }
        return { removed, boards, squeezed };
    }
    function refitAfterSize() {
        clampWidths();
        const ws = rules.widths();
        let removed = 0, squeezed = false;
        for (let i = 0; i < getDesign().n; i++) {
            const sec = getDesign().secs[i]!;
            fitColumns(i);
            for (let j = sec.length - 1; j >= 0; j--) {
                if (!rules.okItem(sec[j], ws[i])) {
                    sec.splice(j, 1);
                    removed++;
                }
            }
            sec.forEach(it => {
                if (it.k === 'short' || it.k === 'long') {
                    it.front = getDesign().d < 55;
                }
            });
            if (rules.overflow(i) > .05) {
                squeezed = true;
                removed += compressBay(i);
            }
        }
        if (removed) {
            effects.report(removed + ' module' + (removed > 1 ? 's' : '') + ' no longer fit and ' + (removed > 1 ? 'were' : 'was') + ' removed. Undo (Ctrl/Cmd+Z) restores ' + (removed > 1 ? 'them' : 'it') + '.');
        }
        else if (squeezed) {
            effects.report('Module heights were compacted to fit. Undo (Ctrl/Cmd+Z) reverts.');
        }
        getDesign().proposal = null;
    }
    function setWidth(i: number, x: number) {
        const ws = rules.widths(), total = ws.reduce((a, b) => a + b);
        if (getDesign().n < 2 || !Number.isFinite(x)) {
            return;
        }
        x = Math.max(25, Math.min(total - 25 * (getDesign().n - 1), x));
        const rest = total - x - 25 * (getDesign().n - 1), weights = ws.map((w, j) => j === i ? 0 : Math.max(0, w - 25)), sum = weights.reduce((a, b) => a + b);
        getDesign().wt = ws.map((_, j) => j === i ? x : 25 + (sum ? rest * weights[j]! / sum : rest / (getDesign().n - 1))).concat([100, 100, 100, 100, 100, 100]).slice(0, 6);
        getDesign().proposal = null;
        effects.milestone('cut');
        effects.changed();
    }
    return { clampWidths, fitColumns, compressBay, fitToShape, refitAfterSize, setWidth };
}
