import { FIN } from '../../wardrobe/catalog.js';
import { isRegularShape } from '../../wardrobe/shape/wardrobe-shape';
/** @typedef {ReturnType<typeof import('./ceiling.js').createCeilingRules>} CeilingRules */
/** @typedef {ReturnType<typeof import('./layout.js').createLayoutRules>} LayoutRules */
/** The configuration Auto design receives for the current wardrobe.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {CeilingRules & LayoutRules} deps Rules from the modules created before this one. */
export function createPlannerConfigRules(ctx, deps) {
    const { getDesign, getBudget } = ctx;
    const { shapeInfo, widths } = deps;

    function planCfg() {
        const c = plannerConfig();
        return getDesign().profile.engaged ? c : { ...c, needs: { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0 }, upper: 'more', reach: 210, seasonalAboveReach: false };
    }
    function plannerConfig() {
        // Whole-cabinet Auto design starts from the envelope and preferences.
        // Commands that preserve fittings (such as bay autofill) pass them explicitly.
        const cfg = { w: getDesign().w, h: getDesign().h, d: getDesign().d, budget: getBudget(), finFactor: Number(FIN[getDesign().fin][1]), doors: getDesign().doors, ...getDesign().profile };
        if (isRegularShape(getDesign().shape)) return cfg;
        // A shaped wardrobe: the planner keeps every bay under the top. Steps anchored to bay
        // boundaries move with them, so those bays keep their widths.
        const shape = shapeInfo().shape, anchored = shape.top.some(p => p.partition !== undefined);
        return { ...cfg, shape, ...(anchored ? { bayWidths: widths() } : {}) };
    }
    return { plannerConfig, planCfg };
}
