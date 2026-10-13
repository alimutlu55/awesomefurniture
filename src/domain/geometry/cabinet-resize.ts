/** A handle moves one face; its opposite face stays fixed, even for a rotated wardrobe. */
import { resolveShape, type ShapedDesign } from '../wardrobe/shape/wardrobe-shape';
export type CabinetResizeEdge = 'left' | 'right' | 'front' | 'back' | 'top';
export function cabinetResizeGrip(state: ShapedDesign & { d: number }, edge: CabinetResizeEdge) {
  const top = resolveShape(state).top.reduce((a, b) => b.y > a.y ? b : a);
  if (edge === 'top') return { x: top.x - state.w / 2, y: top.y, z: state.d / 2 };
  if (edge === 'left' || edge === 'right') return { x: state.w / 2 * (edge === 'left' ? -1 : 1), y: state.h * .6, z: 0 };
  return { x: state.w / 2 - 8, y: state.h * .25, z: state.d / 2 * (edge === 'back' ? -1 : 1) };
}
export function cabinetResizePose(cabinet: { x: number; z: number; angle: number; state: { w: number; d: number } },
  key: string, value: number, edge?: CabinetResizeEdge) {
  const a = cabinet.angle * Math.PI / 180;
  const width = key === 'w' && (edge === 'left' || edge === 'right');
  const depth = key === 'd' && (edge === 'front' || edge === 'back');
  const shift = width ? (value - cabinet.state.w) / 2 * (edge === 'left' ? -1 : 1)
    : depth ? (value - cabinet.state.d) / 2 * (edge === 'back' ? -1 : 1) : 0;
  return { x: cabinet.x + shift * (width ? Math.cos(a) : Math.sin(a)), z: cabinet.z + shift * (width ? -Math.sin(a) : Math.cos(a)) };
}
