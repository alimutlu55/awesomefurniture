import type { PlacedPiece } from './room-pieces';
import { type Item, mm, stops } from './drawing';
import { pieceHeights } from './piece-front';
import { isKitchen } from '../furniture/furniture';
import { kitchenUnit, WORKTOP } from '../kitchen/kitchen-units';
import { plinthOf } from '../wardrobe/carcass';

/** One real vertical stack, rather than a union of unrelated cabinet tops and internal board faces.
 * Prefer a worktop with upper units; every other cabinet retains its exact heights on its shop sheet. */
function referenceStack(pieces: readonly PlacedPiece[]): PlacedPiece[] {
  const cabinets = pieces.filter(p => !p.fixture);
  const stack = (p: PlacedPiece) => {
    const x = (p.lo + p.hi) / 2;
    return cabinets.filter(q => q.wall === p.wall && q.lo <= x && q.hi > x);
  };
  const worktop = (p: PlacedPiece) => isKitchen(p.design) && kitchenUnit(p.design.unit).worktop;
  const ranked = cabinets.map(p => ({ p, stack: stack(p) })).sort((a, b) =>
    Number(b.stack.some(worktop)) - Number(a.stack.some(worktop)) || b.stack.length - a.stack.length || a.p.lo - b.p.lo);
  return ranked[0]?.stack ?? [];
}

/** Room overview: one unit stack, key installation levels, then the uninterrupted room total.
 * Internal boards, drawer zones and small differences between separate units belong to shop sheets. */
export function elevationDimensions(pieces: readonly PlacedPiece[], worktops: readonly number[], height: number, clear = 0): Item[] {
  const stack = referenceStack(pieces), floor = stack.filter(p => !p.hung);
  const tops = floor.flatMap(p => {
    const top = Math.max(...pieceHeights(p));
    return worktops.filter(y => Math.abs(y - top - WORKTOP.thickness) < .05);
  });
  const plinths = floor.flatMap(p => plinthOf(p.design) > 0 ? [p.y + plinthOf(p.design)] : []);
  const undersides = stack.filter(p => p.hung).map(p => p.y);
  const units = [0, height, ...stack.flatMap(pieceHeights), ...tops];
  const levels = [0, height, ...plinths, ...tops, ...undersides];
  return [stops(units.map(mm)), stops(levels.map(mm)), [0, mm(height)]].map((values, row) => ({
    kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, side: 1, clear: mm(clear), row, stops: values,
  }));
}
