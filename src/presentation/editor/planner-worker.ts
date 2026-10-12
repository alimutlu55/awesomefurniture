import { generateDesignedLayouts } from '../../domain/planner/wardrobe-composer';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import type { PlannerConfig } from '../../domain/planner/wardrobe-planner';

/** Auto design's layouts, computed off the page's thread: the editor stays responsive while they are planned.
 * The same planner as on the page, configured as the page configures it before planning. */
const scope = globalThis as unknown as { onmessage: ((e: MessageEvent<{ id: number; cfg: PlannerConfig }>) => void) | null; postMessage(message: unknown): void };
scope.onmessage = e => {
  const { id, cfg } = e.data;
  try {
    WardrobePlanner.configure(cfg);
    scope.postMessage({ id, result: generateDesignedLayouts(cfg) });
  } catch {
    scope.postMessage({ id, result: null });
  }
};
