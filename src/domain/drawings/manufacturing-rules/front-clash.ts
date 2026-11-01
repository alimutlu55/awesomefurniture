import { frontHardware } from '../../make/make-hardware';
import { mm } from '../drawing';
import { pieceBoards } from '../unit-detail';
import type { ManufacturingFinding } from '../manufacturing-validation';
import type { Rule } from './index';

/** The least room between anything on an inner front and the back face of the closed door over it (decision D4). Cm. */
export const INNER_FRONT_CLEARANCE = .3;
/** How far a handle stands proud of its front, as the 3D model draws it (hardware.ts barPull: posts 24 mm, bar 6 mm). Cm. */
const HANDLE_PROJECTION = 3;

/**
 * Fronts against closed doors (D4): a drawer front behind a door, with what is fitted on it (a handle, as Make buys and
 * drills it), stays INNER_FRONT_CLEARANCE clear of the door's back face, or the door cannot shut.
 */
export const frontClash: Rule = (_input, pieces) => {
  const out: ManufacturingFinding[] = [];
  for (const p of pieces) {
    if (p.fixture || p.design.doors === 'none') continue;
    const boards = pieceBoards(p, pieces), handles = frontHardware(p, pieces, boards).fittings.filter(f => f.kind === 'handle');
    boards.forEach((front, board) => {
      if (front.name !== 'Drawer front') return;
      const door = boards.find(b => b.stock === 'door' && b.x0 < front.x1 && b.x1 > front.x0 && b.y0 < front.y1 && b.y1 > front.y0);
      if (!door) return;
      const proud = handles.some(h => h.boards.includes(board)) ? HANDLE_PROJECTION : 0;
      const measured = mm(door.z0 - front.z1 - proud), limit = mm(INNER_FRONT_CLEARANCE);
      if (measured >= limit) return;
      out.push({ id: 'front-clash:' + p.mark + ':' + board, severity: 'critical', area: 'assembly', marks: [p.mark],
        message: p.mark + ' ' + front.name + (proud ? ': its handle reaches ' : ' reaches ') + (limit - measured) + ' mm too far for the closed door',
        rule: 'An inner front stays ' + limit + ' mm clear of the closed door', limit, measured, fix: proud ? 'Remove the handle' : 'Set the front back', at: { mark: p.mark, board } });
    });
  }
  return out;
};
