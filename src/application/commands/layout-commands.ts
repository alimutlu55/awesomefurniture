import type { PlannerProposal } from '../../domain/planner/wardrobe-planner';
import { selectStorageLayouts } from '../../domain/planner/selection-planner';
import { buildDemand } from '../../domain/planner/selection-config';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'report' | 'checkpoint' | 'closeInspector' | 'changed' | 'discardCheckpoint'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'plannerConfig' | 'currentLayout' | 'widths' | 'maxN' | 'minTotal'>;
    callbacks: Pick<ReturnType<typeof import('./sizing-commands').createSizingCommands>, 'refitAfterSize'>;
};
export function createLayoutCommands({ getDesign, effects, rules, callbacks }: Ports) {
    function autofill(i: number) {
        const config = rules.plannerConfig(), other = rules.currentLayout();
        other.sections = other.sections.filter((_, j) => j !== i);
        const existing = WardrobePlanner.analyze(other, config), demand = buildDemand(config);
        const pinned = getDesign().proposal === null ? getDesign().secs[i]!.filter(it => it.x !== undefined || it.y !== undefined) : [];
        const boards = getDesign().dividers.filter(d => d.i === i).map(d => ({ ...d, i: 0 }));
        const scoped = { ...config, w: rules.widths()[i]! + 3.6, growth: 0,
            needs: Object.fromEntries(Object.entries(demand).map(([k, n]) => [k, Math.max(0, n - existing.capacities[k]!)])),
            fixedSections: [{ width: rules.widths()[i]!, items: pinned }], fixedDividers: boards };
        const proposal = selectStorageLayouts(scoped)[0];
        if (!proposal) { effects.report('This bay cannot fit the current storage requirements'); return; }
        getDesign().secs[i] = structuredClone(proposal.sections[0]!.items);
        getDesign().dividers = getDesign().dividers.filter(d => d.i !== i).concat(proposal.dividers.map(d => ({ ...d, i })));
        getDesign().space = null;
        getDesign().proposal = null;
        getDesign().profile.engaged = true;
    }
    function applyProposal(p: PlannerProposal) {
        effects.checkpoint();
        getDesign().n = p.sections.length;
        getDesign().wt = p.sections.map(s => s.width).concat([100, 100, 100, 100, 100, 100]).slice(0, 6);
        getDesign().secs = p.sections.map(s => structuredClone(s.items)).concat([[], [], [], [], [], []]).slice(0, 6);
        getDesign().sel = 0;
        getDesign().item = -1;
        getDesign().dividers = structuredClone(p.dividers ?? []);
        getDesign().space = null;
        getDesign().proposal = { title: p.title, summary: p.summary };
        getDesign().profile.engaged = true;
        effects.closeInspector();
        effects.changed();
        effects.report('Applied: ' + p.title);
    }
    function changeSections(delta: number) {
        const n = getDesign().n + delta;
        if (n < 1 || n > rules.maxN()) {
            effects.report(n < 1 ? 'A wardrobe needs at least one section' : 'No room for more sections at this width');
            return;
        }
        const before = JSON.stringify({ n: getDesign().n, wt: getDesign().wt, secs: getDesign().secs, dividers: getDesign().dividers, sel: getDesign().sel, item: getDesign().item, space: getDesign().space });
        effects.checkpoint();
        getDesign().proposal = null;
        if (delta > 0) {
            const avg = getDesign().wt.slice(0, getDesign().n).reduce((a, b) => a + b, 0) / getDesign().n;
            getDesign().wt[getDesign().n] = avg;
            getDesign().secs[getDesign().n] = [];
            getDesign().n = n;
            getDesign().sel = n - 1;
        }
        else {
            const last = getDesign().n - 1, lost = getDesign().secs[last]!.length;
            getDesign().secs[last] = [];
            getDesign().dividers = (getDesign().dividers || []).filter(d => d.i < last);
            getDesign().n = n;
            getDesign().sel = Math.min(getDesign().sel, n - 1);
            if (lost) {
                effects.report(lost + ' item' + (lost > 1 ? 's' : '') + ' removed with the last section. Undo (Ctrl/Cmd+Z) restores ' + (lost > 1 ? 'them' : 'it') + '.');
            }
        }
        getDesign().item = -1;
        getDesign().space = null;
        if (getDesign().w < rules.minTotal()) {
            const b = JSON.parse(before);
            Object.assign(getDesign(), b);
            effects.discardCheckpoint();
            effects.report('Not enough width for another section');
            effects.changed();
            return;
        }
        callbacks.refitAfterSize();
        effects.changed();
    }
    return { autofill, applyProposal, changeSections };
}
