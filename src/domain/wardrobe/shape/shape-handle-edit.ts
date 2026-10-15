import { setPoint, type WardrobeShape } from './wardrobe-shape';
import { rearShape } from './depth-shape';

export type ShapeSide = 'front' | 'rear';
/** Front/rear share board joins along x; each edge has independent heights. */
export function profileAt(shape: WardrobeShape, side: ShapeSide): WardrobeShape {
  return side === 'rear' ? rearShape(shape) : shape;
}
export function editProfilePoint(shape: WardrobeShape, side: ShapeSide, index: number, patch: { x?: number; y?: number }): WardrobeShape {
  const profile = setPoint(profileAt(shape, side), index, patch);
  if (side === 'front') return { ...profile, back: shape.back ?? shape.top.map(p => p.y) };
  const top = shape.top.map((p, k) => {
    const next = { ...p, x: profile.top[k]!.x };
    if (profile.top[k]!.partition === undefined) delete next.partition;
    return next;
  });
  return { ...shape, top, back: profile.top.map(p => p.y) };
}
/** Outer-corner x edits move one side, keeping the opposite side and interior
 * joins in place. Interior joins slide at a fixed cabinet width. */
export function moveShapeHandle(shape: WardrobeShape, side: ShapeSide, index: number, dx: number, dy: number, width: number) {
  const point = profileAt(shape, side).top[index]!;
  let next = editProfilePoint(shape, side, index, { x: point.x + dx, y: point.y + dy });
  const outer = index === 0 || index === shape.top.length - 1;
  if (!outer) return { shape: next, w: width, offset: 0 };
  const left = index === 0, w = Math.round((width + (left ? -dx : dx)) * 10) / 10;
  next = { ...next, top: next.top.map((p, k, all) => {
    const point = { ...p, x: k === 0 ? 0 : k === all.length - 1 ? w : Math.round((p.x - (left ? dx : 0)) * 10) / 10 };
    // A width edit leaves joins in world space, releasing partition constraints.
    if (dx) delete point.partition;
    return point;
  }) };
  return { shape: next, w, offset: dx / 2 };
}
