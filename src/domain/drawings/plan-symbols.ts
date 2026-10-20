import type { Studio } from '../studio/studio';
import { gapsAround, type PlacedBox } from '../studio/scene-gaps';
import { unitAxes } from '../kitchen/kitchen-runs';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { fitting, hasTrait } from '../wardrobe/fittings';
import { isKitchen } from '../furniture/furniture';
import { type Item, type P, line, mm } from './drawing';
import { piecefronts } from './fronts';
import type { PlacedPiece } from './room-pieces';

/** A point of the room seen from above, in millimetres: x to the right, the room's back (−z) up the sheet. */
export const plan = (x: number, z: number): P => ({ x: mm(x), y: -mm(z) });
/** A point of a piece seen from above: `s` from its middle to its right, `t` from its middle to its front. */
export function local(p: Pick<PlacedPiece, 'x' | 'z' | 'angle'>, s: number, t: number): P {
  const { u, v } = unitAxes(p.angle);
  return plan(p.x + u.x * s + v.x * t, p.z + u.z * s + v.z * t);
}
export const box = (p: PlacedPiece): PlacedBox => ({ id: p.id, x: p.x, z: p.z, y: p.y, angle: p.angle, w: p.design.w, d: p.design.d, h: p.design.h });

/** A kitchen unit standing floor to top with no worktop: a tall unit. */
const tallUnit = (p: PlacedPiece) => isKitchen(p.design) && !p.hung && !p.fixture && !kitchenUnit(p.design.unit).worktop && kitchenUnit(p.design.unit).plinth;
/** The kinds of fitting a piece holds. */
const kinds = (p: PlacedPiece) => p.design.secs.flat().map(it => it.k);

/**
 * What a plan says about a piece beyond its outline, as kitchen and joinery plans draw it: a cross over a tall unit (it
 * stands floor to top); a dashed cross over a base unit housing an appliance (a dishwasher, an oven) under the worktop; an
 * arrow out of a unit whose fronts pull out (drawers). Kinematic envelopes are drawn by plan-operations.
 */
export function pieceSymbols(p: PlacedPiece): Item[] {
  const out: Item[] = [], w = p.design.w, d = p.design.d, at = (s: number, t: number) => local(p, s, t);
  const corners = [at(-w / 2, -d / 2), at(w / 2, -d / 2), at(w / 2, d / 2), at(-w / 2, d / 2)] as const;
  const appliance = kinds(p).some(k => hasTrait(k, 'appliance') && !hasTrait(k, 'worktop'));
  if (tallUnit(p)) out.push(line(corners[0], corners[2], 'thin'), line(corners[1], corners[3], 'thin'));
  else if (appliance && !p.hung) out.push(line(corners[0], corners[2], 'hidden'), line(corners[1], corners[3], 'hidden'));
  if (!p.hung && kinds(p).some(k => fitting(k)?.opens === 'pull')) out.push({ kind: 'arrow', at: at(0, d / 2), dir: dirOf(at(0, 0), at(0, 1)) });
  const { cornerPullouts } = piecefronts(p.design);
  if (!p.hung) {
    for (const c of cornerPullouts) {
      const splitS = (c.doorSide === 'right' ? c.blind.x1 : c.blind.x0) - w / 2, px = c.post.x - w / 2, r = c.post.size / 2;
      const s0 = c.cx - c.trayW / 2 - w / 2, s1 = c.cx + c.trayW / 2 - w / 2, t0 = -c.trayD / 2, t1 = c.trayD / 2;
      const kidney = c.doorSide === 'right'
        ? [at(s0, t0), at(s1, t0), at(s1, t1), at(px + 3, t1), at(px + 3, 0), at(s0, 0)]
        : [at(s0, t0), at(s1, t0), at(s1, 0), at(px - 3, 0), at(px - 3, t1), at(s0, t1)];
      out.push(
        line(at(splitS, d / 2 - 6), at(splitS, d / 2), 'thin'),
        { kind: 'line', stroke: 'thin', closed: true, points: [at(px - r, -r), at(px + r, -r), at(px + r, r), at(px - r, r)] },
        { kind: 'line', stroke: 'hidden', closed: true, points: kidney },
        { kind: 'arrow', at: at((c.door.x0 + c.door.x1) / 2 - w / 2, d / 2), dir: dirOf(at(0, 0), at(0, 1)) },
      );
    }
  }
  return out;
}

const dirOf = (a: P, b: P): P => { const n = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / n, y: (b.y - a.y) / n }; };

/** Where a piece standing free is: its distance to what is behind it and to the nearer thing beside it (a wall or another
 * piece), so a fitter can set it out. */
export function freePosition(p: PlacedPiece, pieces: readonly PlacedPiece[], studio: Studio | undefined): Item[] {
  const gaps = gapsAround(box(p), pieces.map(box), studio, ['back', 'left', 'right']);
  const side = gaps.filter(g => g.side !== 'back').sort((a, b) => a.distance - b.distance)[0], back = gaps.find(g => g.side === 'back');
  return [back, side].filter(g => g && g.distance > .5).map(g => {
    const a = plan(g!.from.x, g!.from.z), b = plan(g!.to.x, g!.to.z);
    return { kind: 'dims' as const, origin: a, dir: dirOf(a, b), side: 1 as const, clear: 0, row: 0, stops: [0, mm(g!.distance)] };
  });
}
