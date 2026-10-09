import { WardrobePlanner as planner } from './wardrobe-planner.js';
import type { PlannerConfig, PlannerSection } from './wardrobe-planner';
import { PANEL, PLINTH, purposeName } from '../wardrobe/catalog.js';
const base = PLINTH + PANEL;
const drawer = (kind: string) => kind === 'drawer' || kind === 'sdrawer';
const clone = (sections: readonly PlannerSection[]) => sections.map(s => ({ ...s, items: s.items.map(it => ({ ...it })) }));
const capacityKeys = ['short', 'long', 'pants', 'folded', 'shoes', 'small', 'seasonalBoxes'];
/** Soft design costs complement, rather than replace, physical fit and capacity. */
export function dailyStorageQuality(sections: readonly PlannerSection[], cfg: PlannerConfig) {
    const width = sections.reduce((n, s) => n + s.width, 0) || 1;
    const seated = cfg.accessible === true, primeLow = seated ? 38 : 60;
    let fillerHeight = 0, lowFoldedHeight = 0, smallAccessCost = 0, drawerGroups = 0;
    for (const section of sections) {
        const weight = section.width / width, positions = planner.layoutSection(section.items, section.width);
        let previousDrawer = false;
        section.items.forEach((it, i) => {
            const position = positions[i]!;
            if (it.k === 'void' || (it.k === 'shelf' && it.purpose === 'accessories')) fillerHeight += it.h * weight;
            if (['folded', 'shelf'].includes(it.k) && ['folded', 'pants'].includes(it.purpose ?? '')) {
                lowFoldedHeight += Math.max(0, Math.min(position.y1 + base, primeLow) - (position.y0 + base)) * weight;
            }
            if (drawer(it.k)) {
                if (!previousDrawer) drawerGroups++;
                if (it.purpose === 'small') {
                    const access = position.y1 + base, low = seated ? 38 : 70, high = seated ? 105 : 110;
                    smallAccessCost += Math.max(0, low - access, access - high) / 70 * 12;
                }
            }
            previousDrawer = drawer(it.k);
        });
    }
    const fragmentation = Math.max(0, drawerGroups - 1);
    const penalty = Math.min(30, fillerHeight / 175 * 30) + Math.min(15, lowFoldedHeight / 50 * 15)
        + Math.min(18, smallAccessCost) + Math.min(12, fragmentation * 4);
    return { fillerHeight, lowFoldedHeight, drawerGroups, penalty };
}
/** Bounded drawer relocations; preserve all daily capacities, reach and garment clearance. */
export function refineDailyStorage(sections: readonly PlannerSection[], cfg: PlannerConfig): PlannerSection[] {
    let best = clone(sections);
    const initial = planner.analyze(best, cfg);
    if (!initial.valid) return best;
    // Generated padding is available space, not an invented accessories requirement.
    for (const section of best) {
        if (section.items.some(it => it.x !== undefined || it.y !== undefined)) continue;
        section.items = section.items.map(it => it.k === 'shelf' && it.purpose === 'accessories' ? { ...it, k: 'void' as const, purpose: 'free' as const } : it);
        section.role = [...new Set(section.items.map(purposeName))].join(' + ');
    }
    const quality = (layout: PlannerSection[], ergo: number) => ergo * 120 - dailyStorageQuality(layout, cfg).penalty;
    let bestValue = quality(best, initial.ergo);
    for (let pass = 0; pass < 3; pass++) {
        let next = best, nextValue = bestValue;
        for (let bay = 0; bay < best.length; bay++) {
            const section = best[bay]!;
            if (section.items.some(it => it.x !== undefined || it.y !== undefined)) continue;
            const end = section.items.findIndex(it => it.k === 'seasonal');
            const limit = end < 0 ? section.items.length : end;
            for (let from = 0; from < limit; from++) {
                if (!drawer(section.items[from]!.k)) continue;
                for (let to = 0; to < limit; to++) {
                    if (from === to) continue;
                    const candidate = clone(best), items = candidate[bay]!.items;
                    const [moved] = items.splice(from, 1); items.splice(to, 0, moved!);
                    const metrics = planner.analyze(candidate, cfg);
                    if (!metrics.valid || capacityKeys.some(k => metrics.capacities[k]! < initial.capacities[k]! - .01)) continue;
                    const value = quality(candidate, metrics.ergo);
                    if (value > nextValue + .01) { next = candidate; nextValue = value; }
                }
            }
        }
        if (next === best) break;
        best = next; bestValue = nextValue;
    }
    return best;
}
