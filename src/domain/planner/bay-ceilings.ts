import type { PlannerConfig } from './wardrobe-planner';
import { PANEL, PLINTH } from '../wardrobe/catalog.js';
import { ceilingMin, ceilingPieces, type WardrobeShape } from '../wardrobe/shape/wardrobe-shape';

/** Clear height of each bay of a shaped wardrobe, in millimetres above the base board: the
 * lowest point of the top over the bay, so everything planned in the bay fits under a slope or
 * a step without being cut. Undefined for a rectangular wardrobe (no `shape` in the config).
 * Bays are laid out left to right with a board between them, as the editor lays out sections.
 * @param widths Inner bay widths in centimetres. */
export function bayClearHeights(cfg: PlannerConfig, widths: readonly number[]): number[] | undefined {
  const shape = cfg.shape as WardrobeShape | undefined;
  if (!shape) return undefined;
  const pieces = ceilingPieces(shape);
  let x = PANEL;
  return widths.map(width => {
    const top = ceilingMin(pieces, x, x + width);
    x += width + PANEL;
    return Math.max(0, Math.floor((top - PLINTH - PANEL) * 1000 + 1e-6) / 100);
  });
}
