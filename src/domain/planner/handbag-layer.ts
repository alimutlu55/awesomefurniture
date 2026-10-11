import { WardrobePlanner as planner } from './wardrobe-planner.js';
import type { PlannerConfig, PlannerProposal, PlannerSection } from './wardrobe-planner';
import { createSpaceModel } from './selection-spaces';
import { MODS } from '../wardrobe/catalog.js';
import type { OpenSpace } from './selection-spaces';

/** Handbags stand upright on open shelves. Design bag: 31 × 14 × 23 cm, 33 cm per bag with a 2 cm gap.
 * Centimetres. The shelf is 25 cm tall: the bag plus 2 cm of clearance. */
export const BAG = { width: 31, depth: 14, height: 23, pitch: 33, shelf: 25 } as const;

export const bagsPerShelf = (widthCm: number) => Math.max(0, Math.floor((widthCm - 2) / BAG.pitch));
/** The planner's contents top is the item top plus the base (9.8 cm). Handbags must stay within reach. */
const BASE = 9.8;
const inReach = (bottomCm: number, cfg: PlannerConfig) => bottomCm + BASE + BAG.shelf <= Number(cfg.reach ?? 185) + .05;

/** Bags a section already holds on its handbag shelves. */
export function handbagsIn(sections: readonly PlannerSection[]): number {
  return sections.reduce((total, section) => {
    const boxes = planner.layoutSection(section.items, section.width);
    return total + section.items.reduce((n, it, j) => {
      if (it.k !== 'shelf' || it.purpose !== 'handbags' || it.h < BAG.shelf - .05) return n;
      return n + bagsPerShelf(boxes[j]?.w ?? section.width);
    }, 0);
  }, 0);
}

/** Adds handbag shelves to a finished plan, in open space it still has. Clothing layouts are
 * not changed. Reports how many bags fit when the plan cannot hold all of them. */
export function placeHandbags(plan: PlannerProposal, cfg: PlannerConfig): PlannerProposal {
  const wanted = Math.max(0, Math.floor(Number((cfg.needs as Record<string, unknown> | undefined)?.bags ?? 0)));
  if (wanted <= 0) return plan;
  planner.configure(cfg);
  const sections = plan.sections.map(s => ({ ...s, items: s.items.map(it => ({ ...it })) }));
  let have = handbagsIn(sections);
  // Space the plan can spare becomes handbag shelves first: free space (void items) and the flexible
  // reserve/accessory shelves. A shelf keeps the part above the bags as the shelf it was, if it is tall
  // enough, otherwise as free space.
  const spare = (it: { k: string; purpose?: string | undefined; h: number }) =>
    it.k === 'void' || (it.k === 'shelf' && (it.purpose === 'reserve' || it.purpose === 'accessories'));
  for (const section of sections) {
    for (let j = 0; j < section.items.length && have < wanted; j++) {
      const it = section.items[j]!;
      const width = it.w ?? section.width;
      if (!spare(it) || it.h < BAG.shelf - .05 || bagsPerShelf(width) < 1) continue;
      const bottom = planner.layoutSection(section.items, section.width)[j]?.y0 ?? 0;
      if (!inReach(bottom, cfg)) continue;
      const rest = Math.round((it.h - BAG.shelf) * 10) / 10;
      const shelf = { ...it, k: "shelf" as const, purpose: "handbags" as const, h: BAG.shelf };
      const keepKind = it.k === 'shelf' && rest >= MODS.shelf.mn ? { ...it, h: rest, y: it.y === undefined ? undefined : it.y + BAG.shelf } : null;
      const above = keepKind ?? (rest >= 1 ? { ...it, k: 'void' as const, purpose: 'free' as const, h: rest, y: it.y === undefined ? undefined : it.y + BAG.shelf } : null);
      section.items.splice(j, 1, shelf, ...(above ? [above] : []));
      have += bagsPerShelf(width);
      j += above ? 1 : 0;
    }
  }
  for (let guard = 0; have < wanted && guard < 12; guard++) {
    const model = createSpaceModel({ ...cfg, fixedSections: sections, fixedDividers: plan.dividers ?? [] } as PlannerConfig);
    // The largest open space that can hold a handbag shelf.
    const space = model.spaces
      .filter((s: OpenSpace) => s.h >= (BAG.shelf + 2) * 10 && s.w >= BAG.pitch * 10 && inReach(s.y / 10, cfg))
      .sort((a: OpenSpace, b: OpenSpace) => b.w * b.h - a.w * a.h)[0];
    if (!space) break;
    const bags = bagsPerShelf(space.w / 10);
    sections[space.bay]!.items.push({ k: 'shelf', purpose: 'handbags', h: BAG.shelf, x: space.x / 10, y: space.y / 10, w: space.w / 10 });
    have += bags;
  }
  const metrics = planner.analyze(sections, cfg);
  // A plan that no longer checks out keeps its clothing layout and reports the bags it cannot hold.
  if (!metrics.valid) {
    const kept = handbagsIn(plan.sections);
    return { ...plan, warnings: [...plan.warnings, `Handbags: room for ${kept} of ${wanted} bags.`], bags: { requested: wanted, placed: kept } };
  }
  const placed = handbagsIn(sections);
  const warnings = placed < wanted ? [...plan.warnings, `Handbags: room for ${placed} of ${wanted} bags.`] : plan.warnings;
  return { ...plan, sections, metrics, warnings, bags: { requested: wanted, placed } };
}
