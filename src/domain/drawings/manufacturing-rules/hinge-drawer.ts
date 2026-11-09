import { pulloutSpans, uprightsAround } from '../../make/make-hardware';
import { makePlacedPiece } from '../../make/make-parts';
import { HINGE_PULLOUT_CLEAR, hingeClashes } from '../../wardrobe/hinges';
import { mm } from '../drawing';
import type { ManufacturingFinding } from '../manufacturing-validation';
import type { Rule } from './index';

/**
 * Hinges against drawers behind the door: a hinge's plate and arm stand in the cabinet's front corner, so a drawer
 * sliding past them on that side must be HINGE_PULLOUT_CLEAR above or below. Make moves the hinges clear
 * (hingeStationsClear); this reports a door where there was no room to, since the drawer would hit the hinge.
 */
export const hingeDrawer: Rule = (_input, pieces) => {
  const out: ManufacturingFinding[] = [];
  for (const p of pieces) {
    if (p.fixture || p.design.doors === 'none') continue;
    const made = makePlacedPiece(p, pieces);
    if (!made) continue;
    made.fittings.forEach(f => {
      if (f.kind !== 'hinge' || f.boards.length < 2) return;
      const door = made.boards[f.boards[0]!]!, post = made.boards[f.boards[1]!]!;
      const side = Math.abs(f.at[0] - door.x0) < Math.abs(f.at[0] - door.x1) ? 'left' : 'right';
      const { left, right } = uprightsAround(made.boards, f.at[0], f.at[1], p.design.h);
      if ((side === 'left' ? left : right)?.b !== post) return;
      const spans = pulloutSpans(made.boards, post, side, door);
      if (!hingeClashes([f.at[1] - door.y0], spans).length) return;
      const board = f.boards[0]!;
      out.push({ id: 'hinge-drawer:' + p.mark + ':' + board + ':' + Math.round(f.at[1] * 10), severity: 'critical', area: 'assembly', marks: [p.mark],
        message: p.mark + ' a hinge of the door sits where the drawer behind it slides out', rule: 'A drawer behind a door passes ' + mm(HINGE_PULLOUT_CLEAR) + ' mm clear of its hinges',
        limit: mm(HINGE_PULLOUT_CLEAR), fix: 'Move the drawer up or down', at: { mark: p.mark, board } });
    });
  }
  return out;
};
