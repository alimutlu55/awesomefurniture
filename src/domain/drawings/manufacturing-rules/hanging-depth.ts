import { depthForFitting, fittingDepth, MIN_HANGING_DEPTH } from '../../wardrobe/carcass';
import { hasTrait } from '../../wardrobe/fittings';
import { isKitchen } from '../../furniture/furniture';
import { mm } from '../drawing';
import type { ManufacturingFinding } from '../manufacturing-validation';
import type { Rule } from './index';

/**
 * Hanging depth (D3): a side-facing hanging rail needs MIN_HANGING_DEPTH of clear fitting depth, or hangers catch the
 * doors. Behind doors that stops them closing (critical); an open wardrobe only shows the sleeves (a warning). A rail
 * that can face front clears it that way; one that cannot needs a deeper wardrobe.
 */
export const hangingDepth: Rule = (_input, pieces) => {
  const out: ManufacturingFinding[] = [];
  for (const p of pieces) {
    if (p.fixture || isKitchen(p.design)) continue;
    const measured = mm(fittingDepth(p.design.d).depth), limit = mm(MIN_HANGING_DEPTH);
    if (measured >= limit) continue;
    const doors = p.design.doors !== 'none';
    p.design.secs.slice(0, p.design.n).forEach((items, bay) => items.forEach((it, j) => {
      if (!hasTrait(it.k, 'hanging') || it.front) return;
      const fix = hasTrait(it.k, 'fixedRail') ? 'Use a front-facing rail' : 'Make it ' + Math.ceil(depthForFitting(MIN_HANGING_DEPTH)) + ' cm deep';
      out.push({ id: 'hanging-depth:' + p.mark + ':' + bay + ':' + j, severity: doors ? 'critical' : 'warning', area: 'assembly', marks: [p.mark],
        message: p.mark + ' section ' + (bay + 1) + ': hangers need ' + limit + ' mm, the fitting depth is ' + measured + ' mm',
        rule: 'A side-facing rail needs ' + limit + ' mm of clear depth', limit, measured, fix, at: { mark: p.mark } });
    }));
  }
  return out;
};
