import { PANEL } from '../../domain/wardrobe/catalog.js';

export interface FocusBox {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
}

export const PANEL_GAP = 36;

export function selectionFocusBox(ports: {
  model: { activeCabinet(): any };
  inspector: { inside(): any };
  geometry: {
    itemGeom(sel: number, item: number): any;
    dividerRect(d: any): any;
    widths(): number[];
    interiorFloor(): number;
    sectionSpaceMeasurements(sel: any): any;
  };
}): { w: any; angle: number; box: FocusBox } {
  const w = ports.model.activeCabinet(), angle = (w.angle || 0) * Math.PI / 180;
  let box: FocusBox = { x: 0, y: w.state.h / 2, w: w.state.w, h: w.state.h, d: w.state.d };
  const g = w.state.item >= 0 ? ports.geometry.itemGeom(w.state.sel, w.state.item) : null;
  if (g) {
    box = { x: (g.x0 + g.x1) / 2 - w.state.w / 2, y: (g.y0 + g.y1) / 2, w: g.w + 18, h: g.h + 18, d: w.state.d };
  } else if (w.state.divider >= 0) {
    const d = w.state.dividers[w.state.divider];
    const r = ports.geometry.dividerRect(d);
    const base = -w.state.w / 2 + PANEL + ports.geometry.widths().slice(0, d.i).reduce((a: number, b: number) => a + b + PANEL, 0);
    box = { x: base + (r.x0 + r.x1) / 2, y: ports.geometry.interiorFloor() + (r.y0 + r.y1) / 2, w: Math.max(50, r.x1 - r.x0 + 24), h: Math.max(50, r.y1 - r.y0 + 24), d: w.state.d };
  } else if (ports.inspector.inside()) {
    const r = ports.geometry.sectionSpaceMeasurements(w.state.sel);
    const base = -w.state.w / 2 + PANEL + ports.geometry.widths().slice(0, w.state.sel).reduce((a: number, b: number) => a + b + PANEL, 0);
    box = { x: base + (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, w: r.w + 18, h: r.h + 18, d: w.state.d };
  }
  return { w, angle, box };
}

export function cameraAnchoredTarget(target: { x: number; y: number; z: number }, anchor: { x: number; y: number; z: number } | null, ratio: number) {
  if (!anchor) return { x: target.x, y: target.y, z: target.z };
  return { x: anchor.x + (target.x - anchor.x) * ratio, y: anchor.y + (target.y - anchor.y) * ratio, z: anchor.z + (target.z - anchor.z) * ratio };
}

export function modelHalfWidthPx(box: FocusBox, angle: number, az: number, el: number, dist: number, viewWidth: number, viewHeight: number) {
  const a = az - angle, e = el, d = dist, tanH = Math.tan(35 * Math.PI / 360) * viewWidth / viewHeight;
  let frac = 0;
  for (const x of [-box.w / 2, box.w / 2]) {
    for (const y of [-box.h / 2, box.h / 2]) {
      for (const z of [-box.d / 2, box.d / 2]) {
        const depth = x * Math.cos(e) * Math.sin(a) + y * Math.sin(e) + z * Math.cos(e) * Math.cos(a);
        const horizontal = x * Math.cos(a) - z * Math.sin(a);
        const range = Math.max(1, d - depth);
        frac = Math.max(frac, Math.abs(horizontal) / (range * tanH));
      }
    }
  }
  return Math.min(1, frac) * viewWidth / 2;
}

export function measurePanelRight($: (sel: string) => HTMLElement): number {
  try {
    const panel = $('#left')?.getBoundingClientRect?.(), view = $('#view').getBoundingClientRect();
    const right = panel && panel.width > 0 ? panel.right - (view.left ?? 0) : NaN;
    return $('#app').classList.contains('props-open') && Number.isFinite(right) ? Math.max(0, right) : 340;
  } catch { return 340; }
}
