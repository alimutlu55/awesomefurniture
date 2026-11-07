import { shelfSpanFor } from '../../wardrobe/carcass';
import { mm } from '../drawing';
import { pieceBoards } from '../unit-detail';
import type { Board } from '../cabinet-boards';
import type { ManufacturingFinding } from '../manufacturing-validation';
import type { Rule } from './index';

/** Less than this is a touch: a board standing on another. Centimetres. */
const TOUCH = .05;
/** The board a shelf that is too long could be made of instead (D2). Centimetres. */
const THICK = 2.5;

/** The longest clear run of a shelf between the dividers that reach up to its underside. */
export function clearSpan(shelf: Board, boards: readonly Board[]): number {
  const under = boards.filter(b => b.name === 'Divider' && b.y0 < shelf.y0 + TOUCH && b.y1 > shelf.y0 - TOUCH && b.x0 > shelf.x0 + TOUCH && b.x1 < shelf.x1 - TOUCH)
    .sort((a, b) => a.x0 - b.x0);
  let from = shelf.x0, longest = 0;
  for (const b of under) { longest = Math.max(longest, b.x0 - from); from = Math.max(from, b.x1); }
  return Math.max(longest, shelf.x1 - from);
}

/**
 * Shelf span (D2): every shelf and fixed shelf, its clear run between the boards that carry it, at most the span its
 * board thickness takes (SHELF_SPAN). A wall shelf on its brackets is not a cabinet shelf and is not checked.
 */
export const shelfSpan: Rule = (_input, pieces) => {
  const out: ManufacturingFinding[] = [];
  for (const p of pieces) {
    if (p.fixture) continue;
    const boards = pieceBoards(p, pieces);
    boards.forEach((b, board) => {
      if (b.name !== 'Shelf') return;
      const measured = mm(clearSpan(b, boards)), limit = mm(shelfSpanFor(b.cut.thickness)), thickness = mm(b.cut.thickness);
      if (measured <= limit) return;
      const thicker = thickness < mm(THICK) && measured <= mm(shelfSpanFor(THICK));
      out.push({ id: 'shelf-span:' + p.mark + ':' + board, severity: 'critical', area: 'assembly', marks: [p.mark],
        message: p.mark + ' ' + b.name + ' spans ' + measured + ' mm', rule: 'A ' + thickness + ' mm shelf spans at most ' + limit + ' mm between supports',
        limit, measured, fix: thicker ? 'Use ' + mm(THICK) + ' mm board' : 'Add a partition', at: { mark: p.mark, board } });
    });
  }
  return out;
};
