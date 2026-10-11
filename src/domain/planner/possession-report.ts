import { WardrobePlanner as planner } from './wardrobe-planner.js';
import type { PlannerConfig, PlannerProposal, PlannerSection } from './wardrobe-planner';
import { SHELF_POSSESSIONS, unitsOnShelf } from '../wardrobe/possessions';
import type { ShelfKey } from '../wardrobe/possessions';

/** Units of a shelf possession a layout holds on its shelves, counted like the planner's own capacity. */
export function heldOnShelves(sections: readonly PlannerSection[], key: ShelfKey): number {
  const held = SHELF_POSSESSIONS.find(p => p.key === key);
  if (!held) return 0;
  return sections.reduce((total, section) => {
    const boxes = planner.layoutSection(section.items, section.width);
    return total + section.items.reduce((n, it, j) => {
      if (it.k !== 'shelf' || it.purpose !== key || it.h < held.holder.height - .05) return n;
      return n + unitsOnShelf(held.holder, boxes[j]?.w ?? section.width);
    }, 0);
  }, 0);
}

/** Shelf possessions are planned by the space-selection search like every other category. This only
 * reports what the finished plan holds of each, and says so when it holds fewer than were asked for. */
export function reportShelfPossessions(plan: PlannerProposal, cfg: PlannerConfig): PlannerProposal {
  const needs = (cfg.needs ?? {}) as Record<string, number | undefined>;
  const held: Record<string, { requested: number; placed: number }> = {};
  const warnings = [...plan.warnings];
  for (const p of SHELF_POSSESSIONS) {
    const requested = Math.max(0, Math.floor(Number(needs[p.key] ?? 0)));
    if (requested <= 0) continue;
    const placed = heldOnShelves(plan.sections, p.key);
    held[p.key] = { requested, placed };
    if (placed < requested) warnings.push(`${p.label}: room for ${placed} of ${requested}.`);
  }
  return Object.keys(held).length ? { ...plan, warnings, held } : plan;
}
