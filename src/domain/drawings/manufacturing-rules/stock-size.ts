import { decorOf } from '../../make/make-parts';
import { hasGrain, STOCK } from '../../make/stock-sheet';
import { mm } from '../drawing';
import { pieceBoards } from '../unit-detail';
import type { ManufacturingFinding } from '../manufacturing-validation';
import type { Rule } from './index';

/**
 * Stock size (D9): every part is cut from one stock sheet, STOCK less its trim all round, along the grain of a decor
 * that has one and either way for one that has none. A part that does not fit is the size that does not: its length
 * against the sheet's, or its width against the sheet's. A wall shelf is a length of shelf board (2 to 5 cm thick, up to
 * 4 m long), not cut from the sheet, and is not checked.
 */
export const stockSize: Rule = (_input, pieces) => {
  const out: ManufacturingFinding[] = [], L = STOCK.length - 2 * STOCK.trim, W = STOCK.width - 2 * STOCK.trim;
  for (const p of pieces) {
    if (p.fixture) continue;
    pieceBoards(p, pieces).forEach((b, board) => {
      const length = mm(b.cut.length), width = mm(b.cut.width), grain = hasGrain(decorOf(b, p.design));
      const long = grain ? length : Math.max(length, width), short = grain ? width : Math.min(length, width);
      const [measured, limit] = long > L ? [long, L] : short > W ? [short, W] : [0, 0];
      if (!limit) return;
      out.push({ id: 'stock-size:' + p.mark + ':' + board, severity: 'critical', area: 'assembly', marks: [p.mark],
        message: p.mark + ' ' + b.name + ' is ' + length + ' × ' + width + ' mm, larger than a ' + L + ' × ' + W + ' mm sheet',
        rule: 'Every part is cut from one ' + STOCK.length + ' × ' + STOCK.width + ' mm sheet', limit, measured, fix: 'Split this part', at: { mark: p.mark, board } });
    });
  }
  return out;
};
