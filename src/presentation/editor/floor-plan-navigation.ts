import type { FloorPlanPorts } from './floor-plan.ports';
type Point = { x: number; y: number };
/** Two-finger navigation cancels the pending edit before changing the view transform. */
export function bindPlanPinch(svg: SVGSVGElement, lifetime: FloorPlanPorts['lifetime'], ports: {
  cancelEdit(): void; scale(): number; zoom(scale: number, anchor: Point, midpoint: Point): void;
}) {
  const pointers = new Map<number, Point>();
  let start: { distance: number; scale: number; midpoint: Point } | null = null;
  const geometry = () => {
    const [a, b] = [...pointers.values()]; if (!a || !b) return null;
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  lifetime.listen(svg, 'pointerdown', (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pair = geometry(); if (!pair) return;
    e.preventDefault(); e.stopImmediatePropagation(); ports.cancelEdit();
    start = { ...pair, scale: ports.scale() }; svg.setPointerCapture(e.pointerId);
  }, true);
  lifetime.listen(svg, 'pointermove', (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pair = geometry(); if (!start || !pair) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ports.zoom(start.scale * pair.distance / Math.max(1, start.distance), start.midpoint, pair.midpoint);
    start = { ...pair, scale: ports.scale() };
  }, true);
  const finish = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (start) { e.preventDefault(); e.stopImmediatePropagation(); if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); }
    if (!pointers.size) start = null;
  };
  lifetime.listen(svg, 'pointerup', finish, true); lifetime.listen(svg, 'pointercancel', finish, true);
  lifetime.cleanup(() => { pointers.clear(); start = null; });
}
