import { DOOR_LIMITS } from '../../wardrobe/door-layout';
import { mm } from '../drawing';
import { piecefronts, isFrontBoard } from '../fronts';
import { cornerFaceWidths } from '../corner-widths';
import { pieceBoards } from '../unit-detail';
import type { ManufacturingFinding } from '../manufacturing-validation';
import type { Rule } from './index';

/** The fewest equal leaves within the limit, and the size of each, in mm. */
const split = (size: number, limit: number) => { const n = Math.ceil(size / limit); return { n, each: Math.round(size / n) }; };

/**
 * Hinged door leaf size (D1): every hinged leaf, as it is cut, at most DOOR_LIMITS wide and tall. An appliance's door
 * (a fridge's) is the maker's, not checked here.
 */
export const leafSize: Rule = (_input, pieces) => {
  const out: ManufacturingFinding[] = [];
  for (const p of pieces) {
    if (p.fixture) continue;
    const faces = cornerFaceWidths(p, pieces), boards = pieceBoards(p, pieces);
    for (const f of piecefronts(p.design, faces).fronts) {
      if (f.opens !== 'side' || f.label || f.own) continue;
      const board = boards.findIndex(b => (b.stock === 'door' || b.stock === 'front') && isFrontBoard(f, b)), b = boards[board];
      if (!b) continue;
      const sizes = [['width', mm(b.x1 - b.x0), mm(DOOR_LIMITS.width), ' wide'], ['height', mm(b.y1 - b.y0), mm(DOOR_LIMITS.height), ' tall']] as const;
      for (const [side, measured, limit, word] of sizes) {
        if (measured <= limit) continue;
        const { n, each } = split(measured, limit);
        out.push({ id: 'leaf-' + side + ':' + p.mark + ':' + board, severity: 'critical', area: 'assembly', marks: [p.mark],
          message: p.mark + ' ' + b.name + ' is ' + measured + ' mm' + word, rule: 'A hinged leaf is at most ' + limit + ' mm' + word,
          limit, measured, fix: 'Split into ' + n + ' leaves of ' + each + ' mm' + (side === 'height' ? ' high' : ''), at: { mark: p.mark, board } });
      }
    }
  }
  return out;
};
