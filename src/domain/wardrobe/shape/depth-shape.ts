import type { ShapePoint, WardrobeShape } from './wardrobe-shape';
/** The existing black handles edit the front. An optional rear profile keeps ceiling contact fixed. */
export function rearShape(shape: WardrobeShape): WardrobeShape {
  return { template: shape.template, top: shape.top.map((p, i) => ({ ...p, y: shape.back?.[i] ?? p.y })) };
}
export interface SurfacePoint { x: number; y: number; z: number }
/** Triangles match the board renderer: a diagonal from rear-left to front-right. */
export function topSurface(shape: WardrobeShape, depth: number): SurfacePoint[][] {
  const back = rearShape(shape).top, out: SurfacePoint[][] = [];
  for (let i = 1; i < shape.top.length; i++) {
    const a = shape.top[i - 1]!, b = shape.top[i]!;
    if (b.x - a.x < 1e-8) continue;
    const ra = { ...back[i - 1]!, z: -depth / 2 }, rb = { ...back[i]!, z: -depth / 2 };
    const fa = { ...a, z: depth / 2 }, fb = { ...b, z: depth / 2 };
    out.push([ra, rb, fb], [ra, fb, fa]);
  }
  return out;
}
/** Apply topology edits to both profiles while preserving the rear heights. */
export function withRear(shape: WardrobeShape, top: ShapePoint[]): WardrobeShape {
  if (!shape.back) return { template: shape.template, top };
  const old = shape.top;
  const at = (x: number, frontY: number) => {
    const same = old.findIndex(p => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - frontY) < 1e-6);
    if (same >= 0) return shape.back![same]!;
    for (let i = 1; i < old.length; i++) {
      const a = old[i - 1]!, b = old[i]!;
      if (b.x > a.x && x >= a.x && x <= b.x) return shape.back![i - 1]! + (shape.back![i]! - shape.back![i - 1]!) * (x - a.x) / (b.x - a.x);
    }
    return shape.back![0]!;
  };
  return { template: shape.template, top, back: top.map(p => at(p.x, p.y)) };
}
