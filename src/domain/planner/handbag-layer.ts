import { WardrobePlanner as planner } from './wardrobe-planner.js';
import type { PlannerConfig, PlannerProposal, PlannerSection } from './wardrobe-planner';
import { BAG, bagsPerShelf } from './handbag-size';

export { BAG, bagsPerShelf };

/** Bags a layout holds on its handbag shelves, counted like the planner's own capacity. */
export function handbagsIn(sections: readonly PlannerSection[]): number {
  return sections.reduce((total, section) => {
    const boxes = planner.layoutSection(section.items, section.width);
    return total + section.items.reduce((n, it, j) => {
      if (it.k !== 'shelf' || it.purpose !== 'handbags' || it.h < BAG.shelf - .05) return n;
      return n + bagsPerShelf(boxes[j]?.w ?? section.width);
    }, 0);
  }, 0);
}

/** Handbags are planned by the space-selection search like every other category. This only reports
 * what the finished plan holds, and says so when it holds fewer bags than were asked for. */
export function reportHandbags(plan: PlannerProposal, cfg: PlannerConfig): PlannerProposal {
  const wanted = Math.max(0, Math.floor(Number((cfg.needs as { handbags?: number } | undefined)?.handbags ?? 0)));
  if (wanted <= 0) return plan;
  const placed = handbagsIn(plan.sections);
  const warnings = placed < wanted ? [...plan.warnings, `Handbags: room for ${placed} of ${wanted} bags.`] : plan.warnings;
  return { ...plan, warnings, bags: { requested: wanted, placed } };
}
