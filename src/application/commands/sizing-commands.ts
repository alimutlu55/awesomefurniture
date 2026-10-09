import type { EditorItem } from '../../domain/wardrobe/editor-design';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'report' | 'milestone' | 'changed'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'widths' | 'bayMinW' | 'itemMinW' | 'used' | 'ih' | 'effectiveMin' | 'computeLayout' | 'okItem'>;
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
    function compressBay(i: number) {
        const sec = getDesign().secs[i]!;
        let removed = 0;
        for (let guard = 0; guard < 80 && rules.used(i) > rules.ih() + .05; guard++) {
            const over = rules.used(i) - rules.ih();
            let done = false;
            for (const it of [...sec].sort((a, b) => (b.h - rules.effectiveMin(b.k)) - (a.h - rules.effectiveMin(a.k)))) {
                const slack = it.h - rules.effectiveMin(it.k);
                if (slack <= .05) {
                    break;
                }
                const old = it.h, before = rules.used(i);
                it.h = Math.round((old - Math.min(slack, over)) * 10) / 10;
                if (rules.used(i) < before - .01) {
                    done = true;
                    break;
                }
                it.h = old;
            }
            if (!done) {
                const lay = rules.computeLayout(i);
                let t = 0;
                lay.forEach((q, j) => {
                    if (q.relY1 > lay[t]!.relY1) {
                        t = j;
                    }
                });
                sec.splice(t, 1);
                removed++;
            }
        }
        return removed;
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
            if (rules.used(i) > rules.ih() + .05) {
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
    return { clampWidths, fitColumns, compressBay, refitAfterSize, setWidth };
}
