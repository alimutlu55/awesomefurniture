import { rearShape, type SurfacePoint } from './depth-shape';
import { shapeBoards, type WardrobeShape } from './wardrobe-shape';
import { fittingDepth } from '../carcass';

/** Roof underside patches clipped to a divider's actual footprint. Keeping the
 * roof's triangle diagonal also handles independently sloping front/rear edges. */
export function dividerRoofPatches(shape: WardrobeShape, depth: number, x0: number, x1: number): SurfacePoint[][] {
  // A divider is a fitting board: it runs from the back board's face to the fitting setback.
  const front = shapeBoards(shape), rear = shapeBoards(rearShape(shape)), out: SurfacePoint[][] = [], reach = fittingDepth(depth);
  front.forEach((board, i) => {
    if (board.kind !== 'top') return;
    const a = { ...board.points[0]!, z: depth / 2 }, b = { ...board.points[1]!, z: depth / 2 };
    const ra = { ...rear[i]!.points[0]!, z: -depth / 2 }, rb = { ...rear[i]!.points[1]!, z: -depth / 2 };
    for (let poly of [[ra, rb, a], [rb, b, a]]) {
      for (const distance of [(p: SurfacePoint) => p.x - x0, (p: SurfacePoint) => x1 - p.x,
        (p: SurfacePoint) => p.z - reach.centre + reach.depth / 2, (p: SurfacePoint) => reach.centre + reach.depth / 2 - p.z]) poly = clip(poly, distance);
      const area = poly.reduce((sum, p, k) => { const q = poly[(k + 1) % poly.length]!; return sum + p.x * q.z - q.x * p.z; }, 0);
      if (Math.abs(area) > 1e-7) out.push(poly);
    }
  });
  // Step risers occupy a board-thick strip below adjoining top panels. A
  // divider in that strip meets the riser's underside rather than piercing it.
  let patches = out;
  front.forEach((board, i) => {
    if (board.kind !== 'riser') return;
    const lo = board.points[0]!.x, hi = board.points[1]!.x;
    const ceiling = (p: SurfacePoint) => rear[i]!.points[0]!.y
      + (board.points[0]!.y - rear[i]!.points[0]!.y) * (p.z / depth + .5);
    patches = patches.flatMap(poly => [clip(poly, p => lo - p.x), clip(poly, p => p.x - hi),
      ...cap(clip(clip(poly, p => p.x - lo), p => hi - p.x), ceiling)]).filter(poly => poly.length >= 3);
  });
  return patches;
}

function cap(poly: SurfacePoint[], ceiling: (p: SurfacePoint) => number) {
  return [clip(poly, p => ceiling(p) - p.y), clip(poly, p => p.y - ceiling(p)).map(p => ({ ...p, y: ceiling(p) }))];
}

function clip(points: SurfacePoint[], distance: (p: SurfacePoint) => number): SurfacePoint[] {
  const out: SurfacePoint[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!, da = distance(a), db = distance(b);
    if (da >= 0) out.push(a);
    if ((da < 0) !== (db < 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    }
  });
  return out;
}
