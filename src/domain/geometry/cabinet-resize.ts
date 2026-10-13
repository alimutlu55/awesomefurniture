/** A face resize keeps the opposite face fixed, including for a rotated wardrobe. */
export type CabinetResizeEdge = 'left' | 'right' | 'front' | 'back' | 'top';
export function cabinetResizePose(cabinet: { x: number; z: number; angle: number; state: { w: number; d: number } },
  key: string, value: number, edge?: CabinetResizeEdge) {
  const a = cabinet.angle * Math.PI / 180;
  const width = key === 'w' && (edge === 'left' || edge === 'right');
  const depth = key === 'd' && (edge === 'front' || edge === 'back');
  const shift = width ? (value - cabinet.state.w) / 2 * (edge === 'left' ? -1 : 1)
    : depth ? (value - cabinet.state.d) / 2 * (edge === 'back' ? -1 : 1) : 0;
  return { x: cabinet.x + shift * (width ? Math.cos(a) : Math.sin(a)), z: cabinet.z + shift * (width ? -Math.sin(a) : Math.cos(a)) };
}
