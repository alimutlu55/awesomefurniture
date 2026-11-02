import { mm } from '../drawing';
import { piecefronts, isFrontBoard } from '../fronts';
import { cornerFaceWidths } from '../corner-widths';
import { pieceBoards } from '../unit-detail';
import { leafSwing, quarterArc } from '../plan-operations';
import { intersects, obstacles, roomDoorOperation } from '../plan-clearances';
import { local, plan } from '../plan-symbols';
import { wallGeometry } from '../room-pieces';
import type { ManufacturingFinding } from '../manufacturing-validation';
import type { Rule } from './index';

/**
 * Door swing (P1-13): a hinged leaf, swung as far as its hinge opens (its arc on the plan), stays clear of walls, other
 * pieces and room doors. Where it only meets something by swinging past square at its hinge side (a wall or a piece
 * beside it) a filler gives it room; where it meets something in front, a hinge that folds the door right back keeps
 * it out of the way once open. A warning: the door still opens, only not as far.
 */
export const swing: Rule = (input, pieces) => {
  const out: ManufacturingFinding[] = [], solids = obstacles(input.studio, pieces);
  // Room doors whose handing is confirmed sweep their own arc.
  const doors = (input.studio?.walls ?? []).flatMap(wall => {
    const g = wallGeometry(input.studio!, wall);
    if (!g) return [];
    const at = (t: number, n: number) => plan(g.line.a.x + g.line.ux * t + g.line.nx * n, g.line.a.z + g.line.uz * t + g.line.nz * n);
    return g.openings.filter(o => o.kind === 'door' && o.hinge && o.swing).map(o => ({ key: 'Door ' + o.id, sill: o.sill, height: o.height,
      points: roomDoorOperation(at, o.offset - o.width / 2, wall.thickness / 2, o.width, o.height, o.hinge, o.swing).points }));
  });
  for (const p of pieces) {
    if (p.fixture) continue;
    const boards = pieceBoards(p, pieces);
    for (const f of piecefronts(p.design, cornerFaceWidths(p, pieces)).fronts) {
      if (f.opens !== 'side' || f.label || f.own) continue;
      const s = leafSwing(p, f), bottom = p.y + f.y0, top = p.y + f.y1, side = f.hinge === 'right' ? 'right' : 'left';
      // What a square swing would already meet is in front of the door; what only the swing past square meets is beside.
      const right = f.hinge === 'right', at = (u: number, t: number) => local(p, u - p.design.w / 2, t + p.design.d / 2);
      const square = [at(right ? f.x1 : f.x0, 0), ...quarterArc(at, right ? f.x1 : f.x0, 0, f.x1 - f.x0, right ? -1 : 1)];
      const met = new Map<string, boolean>();
      for (const solid of solids) {
        if (solid.owners.includes(p.id) || solid.bottom >= top || solid.top <= bottom || !intersects(s.points, solid.points)) continue;
        const name = solid.owners.length ? pieces.find(q => q.id === solid.owners[0])!.mark : 'wall ' + solid.key;
        met.set(name, (met.get(name) ?? false) || intersects(square, solid.points));
      }
      for (const door of doors) if (door.sill < top && door.sill + door.height > bottom && intersects(s.points, door.points)) met.set(door.key, true);
      if (!met.size) continue;
      const board = boards.findIndex(b => (b.stock === 'door' || b.stock === 'front') && isFrontBoard(f, b));
      for (const [target, inFront] of met) {
        // Swinging past square, the free edge reaches |cos θ| of the leaf's width beyond the hinge side.
        const needed = mm((f.x1 - f.x0) * Math.max(0, -Math.cos(s.angle * Math.PI / 180))), room = p.sides[side];
        out.push({ id: 'swing:' + p.mark + ':' + board + ':' + target, severity: 'warning', area: 'geometry', marks: [p.mark],
          message: p.mark + ' door swung to ' + s.angle + '° meets ' + target, rule: 'A door opens clear of walls, other pieces and room doors',
          ...(inFront ? { fix: 'Use 170° hinges' } : { fix: 'Add a filler', limit: needed, ...(Number.isFinite(room) ? { measured: mm(room) } : {}) }),
          at: { mark: p.mark, board } });
      }
    }
  }
  return out;
};

