import { createDividerCommands } from './divider-commands';
import { createSizingCommands } from './sizing-commands';
import { createItemCommands } from './item-commands';
import { createLayoutCommands } from './layout-commands';
import { createAppearanceCommands } from './appearance-commands';
import { createCommandWorkflow } from './command-workflow';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import type { EditorState } from '../projects/editor-scene';
import type { CommandEffects } from './command-effects';
import { isRegularShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
/** Compatibility facade: compose independent command families around one workflow. */
export function createDesignCommands(getDesign: () => EditorState, supplied: CommandEffects = {}) {
    const { effects, run } = createCommandWorkflow(getDesign, supplied);
    const rules = createWardrobeGeometry(getDesign, effects.getBudget);
    const dividers = createDividerCommands({ getDesign, effects, rules, run });
    const sizing = createSizingCommands({ getDesign, effects, rules });
    const items = createItemCommands({ getDesign, effects, rules, run, callbacks: { addShelfBoard: dividers.addShelfBoard } });
    const layouts = createLayoutCommands({ getDesign, effects, rules });
    const appearance = createAppearanceCommands({ getDesign, effects, run });
    // Planner proposals are generated for the bounding box; a shaped skeleton then
    // keeps only what fits under its top.
    const shaped = () => !isRegularShape(getDesign().shape);
    /** Outer height a bay planner should assume: the lowest clear point across the bay. */
    const bayHeight = (i: number) => Math.floor(rules.ceilingIn(i, 0, rules.widths()[i]!) + PLINTH + 2 * PANEL);
    const quiet = (fn: () => void) => { const report = effects.report; effects.report = () => { }; try { fn(); } finally { effects.report = report; } };
    /** Auto design for a shaped skeleton keeps the wardrobe's own partitions, which
     * follow its top. The idea's bays are matched to them by height (tallest
     * content into the tallest bay), then everything is fitted under the top. */
    function planShapedBays(p: Parameters<typeof layouts.applyProposal>[0]) {
        effects.checkpoint();
        const design = getDesign(), ws = rules.widths(), clear = (i: number) => rules.ceilingIn(i, 0, ws[i]!);
        const bays = Array.from({ length: design.n }, (_, i) => i).sort((a, b) => clear(b) - clear(a) || ws[b]! - ws[a]!);
        const stack = (k: number) => WardrobePlanner.layoutSection(p.sections[k]!.items, p.sections[k]!.width).reduce((m, q) => Math.max(m, q.y1), 0);
        const sources = p.sections.map((_, k) => k).sort((a, b) => stack(b) - stack(a));
        const assigned = new Map<number, number>();
        for (const i of bays) {
            // The tallest idea bay that fits this bay's clear height, else the tallest left.
            const k = sources.find(k => stack(k) <= clear(i) + .05) ?? sources[0];
            if (k === undefined) break;
            sources.splice(sources.indexOf(k), 1);
            assigned.set(i, k);
        }
        design.secs = design.secs.map((items, i) => {
            if (i >= design.n) return items;
            const k = assigned.get(i);
            if (k === undefined) return [];
            return structuredClone(p.sections[k]!.items).map(it => {
                // Widths are re-fitted to this bay; explicit positions are kept only when they still fit.
                if (it.w !== undefined && it.w >= ws[i]! - .05) { delete it.w; delete it.x; delete it.ax; }
                if (it.w !== undefined && it.x !== undefined && it.x + it.w > ws[i]! + .05) delete it.x;
                return it;
            });
        });
        design.dividers = design.dividers.filter(d => d.i >= design.n).concat((p.dividers ?? []).flatMap(d => {
            const bay = [...assigned].find(([, k]) => k === d.i)?.[0];
            return bay === undefined ? [] : [{ ...structuredClone(d), i: bay }];
        }));
        // A bay whose columns no longer fit side by side (or overlap a shelf board) is
        // planned on its own instead.
        const overlapping = (i: number) => {
            const lay = rules.computeLayout(i);
            return rules.dividerOverlaps(i, lay) || lay.some((q, j) => lay.some((r, k) => k > j && q.x0 < r.x1 - .01 && r.x0 < q.x1 - .01 && q.relY0 < r.relY1 - .01 && r.relY0 < q.relY1 - .01));
        };
        for (let i = 0; i < design.n; i++) {
            if (design.secs[i]!.length && overlapping(i)) {
                design.secs[i] = [];
                design.dividers = design.dividers.filter(d => d.i !== i);
            }
        }
        quiet(() => {
            for (let i = 0; i < design.n; i++) sizing.fitColumns(i);
            sizing.fitToShape();
            // Bays left empty by the idea are planned on their own at their clear height.
            for (const i of bays) if (!design.secs[i]!.length) layouts.autofill(i, bayHeight(i));
            sizing.fitToShape();
        });
        Object.assign(design, { item: -1, divider: -1, space: null, proposal: { title: p.title, summary: 'Adapted to this wardrobe shape' } });
        design.profile.engaged = true;
        effects.closeInspector();
        effects.changed();
        effects.report('Applied: ' + p.title + ' · adapted to this wardrobe shape');
    }
    const applyProposal: typeof layouts.applyProposal = (p, selected) => {
        if (shaped()) planShapedBays(p);
        else layouts.applyProposal(p, selected);
    };
    const autofill: typeof layouts.autofill = i => {
        if (!shaped()) return layouts.autofill(i);
        layouts.autofill(i, bayHeight(i));
        sizing.fitToShape();
    };
    const changeSections: typeof layouts.changeSections = delta => {
        layouts.changeSections(delta);
        if (!shaped()) return;
        sizing.fitToShape();
        effects.changed();
    };
    return { run, ...dividers, ...sizing, ...items, ...layouts, applyProposal, autofill, changeSections, ...appearance };
}
