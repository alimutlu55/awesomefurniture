import type { Vec } from '../../domain/geometry/profile-polygon';

type Box = { x: number; y: number; w: number; h: number };
const MAX = 16;

/** Zoom and pan of the Shape editor's drawing, so a small part (a wall's 12 cm cross-section, a short step) can
 * be worked on at a finger's size: a wheel zooms at the pointer, two fingers pinch and pan, one finger pans the
 * empty drawing while zoomed in, and Fit shows it whole. Works in the drawing's own centimetres (SVG y down). */
export function createDrawingZoom() {
  let k = 1, centre: Vec | null = null, base: Box | null = null;
  let gesture: { kind: 'pan' | 'pinch'; k: number; centre: Vec; client: Vec; distance: number; perPx: number } | null = null;
  const clamp = (c: Vec, z: number, b: Box): Vec => {
    const hw = b.w / 2 / z, hh = b.h / 2 / z;
    return { x: Math.max(b.x + hw, Math.min(b.x + b.w - hw, c.x)), y: Math.max(b.y + hh, Math.min(b.y + b.h - hh, c.y)) };
  };
  const centreOf = (b: Box) => centre ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  /** Zooms by `factor`, keeping the drawing point `at` (SVG units) where it is on screen. */
  function zoomAt(at: Vec, factor: number) {
    if (!base) return;
    const next = Math.max(1, Math.min(MAX, k * factor)), c = centreOf(base);
    centre = clamp({ x: at.x + (c.x - at.x) * k / next, y: at.y + (c.y - at.y) * k / next }, next, base);
    k = next;
    if (k <= 1.0001) { k = 1; centre = null; }
  }
  return {
    /** The part of `whole` on show. */
    view(whole: Box): Box {
      base = whole;
      if (k === 1) return whole;
      const c = clamp(centreOf(whole), k, whole);
      return { x: c.x - whole.w / 2 / k, y: c.y - whole.h / 2 / k, w: whole.w / k, h: whole.h / k };
    },
    zoomed: () => k > 1,
    /** Shows the drawing zoomed by `factor` with `at` (SVG units) at its centre, as far as the drawing reaches. */
    frame(at: Vec, factor: number) {
      if (!base) return;
      k = Math.max(1, Math.min(MAX, factor));
      centre = k > 1 ? clamp(at, k, base) : null;
    },
    reset() { k = 1; centre = null; gesture = null; },
    wheel(at: Vec, deltaY: number) { zoomAt(at, Math.exp(-deltaY * .0015)); },
    /** Starts a pan (one finger) or a pinch (two), from where the pointers are on screen; `perPx` is drawing units per pixel. */
    begin(kind: 'pan' | 'pinch', client: Vec, distance: number, perPx: number) {
      if (!base) return;
      gesture = { kind, k, centre: centreOf(base), client, distance, perPx };
    },
    /** Follows the pointers: the midpoint pans, the spread (a pinch) zooms. */
    follow(client: Vec, distance: number) {
      const g = gesture;
      if (!g || !base) return;
      const next = g.kind === 'pinch' && g.distance > 0 ? Math.max(1, Math.min(MAX, g.k * distance / g.distance)) : g.k;
      const perPx = g.perPx * g.k / next;
      centre = clamp({ x: g.centre.x - (client.x - g.client.x) * perPx, y: g.centre.y - (client.y - g.client.y) * perPx }, next, base);
      k = next;
      if (k <= 1.0001) { k = 1; centre = null; }
    },
    end() { gesture = null; },
    active: () => gesture !== null,
  };
}
