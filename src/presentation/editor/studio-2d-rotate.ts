import type { EditorCabinet } from '../../application/projects/editor-scene';
import { createTransform, type Point2D, type ViewportTransform } from './studio-2d-canvas';

interface RotationPorts {
  cabinet(): EditorCabinet | undefined;
  transform(): ViewportTransform;
  snapshot(): string;
  checkpoint(snapshot: string): void;
  previewRotation(id: number, angle: number, from: { x: number; z: number }): boolean;
  restorePose(id: number, pose: { x: number; z: number; angle: number }): void;
  settleCabinet(id: number): string | null | undefined;
  refresh(): void;
}
export function rotationHandle(c: EditorCabinet, t: ViewportTransform, turning = false): string {
  const a = c.angle * Math.PI / 180, distance = c.state.d / 2 + 36 / t.zoom;
  const p = createTransform(t).toScreen({ x: c.x - Math.sin(a) * distance, z: c.z - Math.cos(a) * distance });
  return `<g class="sp2d-rotate" data-rotate-id="${c.id}" role="button" tabindex="0" aria-label="Turn furniture. Drag or press R">
    <circle cx="${p.x}" cy="${p.z}" r="22" fill="transparent" pointer-events="all"/>
    <circle cx="${p.x}" cy="${p.z}" r="12" class="sp2d-rotate-disc"/>
    <text x="${p.x}" y="${p.z + 5}" text-anchor="middle">↻</text>
    ${turning ? `<text aria-hidden="true" x="${p.x}" y="${p.z - 20}" text-anchor="middle" class="sp2d-angle-halo">${Math.round(c.angle)}°</text>
      <text x="${p.x}" y="${p.z - 20}" text-anchor="middle" class="sp2d-angle">${Math.round(c.angle)}°</text>` : ''}
  </g>`;
}
export function createPlanRotation(ports: RotationPorts) {
  let drag: { id: number; pointer: number; from: { x: number; z: number; angle: number }; polar: number; snapshot: string } | null = null;
  const point = (e: PointerEvent, svg: Element): Point2D => {
    const r = svg.getBoundingClientRect();
    return createTransform(ports.transform()).toScene(e.clientX - r.left, e.clientY - r.top);
  };
  function finish(cancel = false) {
    if (!drag) return;
    const g = drag; drag = null;
    const c = ports.cabinet();
    if (cancel || !c || ports.settleCabinet(g.id)) ports.restorePose(g.id, g.from);
    else if (c.angle !== g.from.angle || c.x !== g.from.x || c.z !== g.from.z) ports.checkpoint(g.snapshot);
    ports.refresh();
  }
  return {
    active: () => !!drag,
    down(e: PointerEvent, svg: Element) {
      if (drag) { finish(true); return false; }
      if (!(e.target as Element).closest('[data-rotate-id]') || e.button !== 0) return false;
      const c = ports.cabinet(); if (!c) return false;
      const p = point(e, svg);
      drag = { id: c.id, pointer: e.pointerId, from: { x: c.x, z: c.z, angle: c.angle },
        polar: Math.atan2(p.x - c.x, p.z - c.z), snapshot: ports.snapshot() };
      ports.refresh(); return true;
    },
    move(e: PointerEvent, svg: Element) {
      if (!drag || e.pointerId !== drag.pointer) return;
      const p = point(e, svg), a = Math.atan2(p.x - drag.from.x, p.z - drag.from.z) - drag.polar;
      let angle = drag.from.angle + Math.atan2(Math.sin(a), Math.cos(a)) * 180 / Math.PI;
      if (!e.shiftKey) {
        angle = Math.round(angle / 5) * 5;
        const right = Math.round(angle / 90) * 90;
        if (Math.abs(angle - right) <= 5) angle = right;
      }
      ports.previewRotation(drag.id, (angle % 360 + 360) % 360, drag.from);
      ports.refresh();
    },
    finish,
    quarterTurn() {
      if (drag) return;
      const c = ports.cabinet(); if (!c) return;
      const from = { x: c.x, z: c.z, angle: c.angle }, snapshot = ports.snapshot();
      ports.previewRotation(c.id, (c.angle + 90) % 360, from);
      if (ports.settleCabinet(c.id)) ports.restorePose(c.id, from);
      else if (c.angle !== from.angle || c.x !== from.x || c.z !== from.z) ports.checkpoint(snapshot);
      ports.refresh();
    },
  };
}
