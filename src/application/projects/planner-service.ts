import type {PlannerConfig,PlannerProposal} from '../../domain/planner/wardrobe-planner';
import { generateDesignedLayouts } from '../../domain/planner/wardrobe-composer';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
/** Per-editor bounded proposal cache; replay configuration on hits. */
export function createPlannerService() {
    const GEN_CACHE = new Map<string,PlannerProposal[]>();
    const genKey = (cfg:PlannerConfig) => JSON.stringify(cfg, (k, v) => k === 'engaged' || k === 'reachStd' ? undefined : v); // fields the planner never reads
    function generateCached(cfg:PlannerConfig) {
        const key = genKey(cfg), hit = GEN_CACHE.get(key);
        if (hit) {
            GEN_CACHE.delete(key);
            GEN_CACHE.set(key, hit);
            WardrobePlanner.configure(cfg);
            return hit;
        }
        const out = generateDesignedLayouts(cfg);
        GEN_CACHE.set(key, out);
        if (GEN_CACHE.size > 8) {
            GEN_CACHE.delete(GEN_CACHE.keys().next().value!);
        }
        return out;
    }
    return { generate: generateCached, has: (cfg:PlannerConfig) => GEN_CACHE.has(genKey(cfg)) };
}
