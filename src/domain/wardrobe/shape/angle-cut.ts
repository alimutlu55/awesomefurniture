import { PANEL } from '../catalog.js';
import type { ItemKind } from '../wardrobe';
import { ceilingMin, fitSpans, type CeilingPiece, type Span } from './wardrobe-shape';

/** Open shelving is built from boards that a joiner can cut to the angle of a
 * sloped or stepped top. Drawers, baskets, rails and pull-outs run on hardware
 * that needs their full rectangle, so they are never cut. */
export const ANGLE_CUT_KINDS: readonly ItemKind[] = ['shelf', 'folded', 'seasonal', 'shoe', 'void'];
export const canAngleCut = (kind: ItemKind) => ANGLE_CUT_KINDS.includes(kind);
/** Shortest shelf board worth keeping after a cut. */
export const MIN_CUT_BOARD = 15;

export interface Point { x: number; y: number }
const EPS = 1e-6;

/** Breakpoints of the clear-height function inside (x0, x1), plus the points where
 * it crosses `levels`. Between consecutive results the function is linear. */
function breaks(pieces: readonly CeilingPiece[], x0: number, x1: number, levels: readonly number[]): number[] {
  const xs = new Set([x0, x1]);
  for (const p of pieces) {
    for (const x of [p.x0, p.x1]) if (x > x0 + EPS && x < x1 - EPS) xs.add(x);
    if (Math.abs(p.y1 - p.y0) < EPS) continue;
    for (const y of levels) {
      const x = p.x0 + (y - p.y0) * (p.x1 - p.x0) / (p.y1 - p.y0);
      if (x > x0 + EPS && x < x1 - EPS && x >= p.x0 - EPS && x <= p.x1 + EPS) xs.add(x);
    }
  }
  return [...xs].sort((a, b) => a - b);
}
/** One-sided limits of the clear height at x (they differ at a step). */
const leftOf = (pieces: readonly CeilingPiece[], x: number, x0: number) => ceilingMin(pieces, Math.max(x0, x - 1e-5), x);
const rightOf = (pieces: readonly CeilingPiece[], x: number, x1: number) => ceilingMin(pieces, x, Math.min(x1, x + 1e-5));

/** The part of rectangle [x0,x1]×[y0,y1] below the top, as closed outlines traced
 * counter-clockwise from the bottom left. The upper edge follows the underside of
 * the top boards exactly, so a board drawn from it meets the slope flush. Parts
 * separated where the top dips below y0 become separate outlines. */
export function clipBelowTop(pieces: readonly CeilingPiece[], x0: number, x1: number, y0: number, y1: number): Point[][] {
  if (x1 - x0 < EPS || y1 - y0 < EPS) return [];
  const xs = breaks(pieces, x0, x1, [y0, y1]), outlines: Point[][] = [];
  let upper: Point[] = [];
  const flush = () => {
    if (upper.length >= 2) {
      const a = upper[0]!.x, b = upper[upper.length - 1]!.x;
      if (b - a > EPS) outlines.push([{ x: a, y: y0 }, { x: b, y: y0 }, ...upper.reverse()]);
    }
    upper = [];
  };
  const clamp = (c: number) => Math.min(y1, c);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i]!, b = xs[i + 1]!, mid = ceilingMin(pieces, (a + b) / 2, (a + b) / 2);
    if (b - a < EPS) continue;
    if (mid <= y0 + EPS) { flush(); continue; }
    const ya = clamp(i === 0 ? rightOf(pieces, a, x1) : rightOf(pieces, a, x1)), yb = clamp(leftOf(pieces, b, x0));
    const prev = upper[upper.length - 1];
    if (prev && Math.abs(prev.x - a) < EPS) {
      if (Math.abs(prev.y - ya) > EPS) upper.push({ x: a, y: Math.max(y0, ya) });
    }
    else upper.push({ x: a, y: Math.max(y0, ya) });
    upper.push({ x: b, y: Math.max(y0, yb) });
  }
  flush();
  return outlines;
}

/** Parts of a span where a board of thickness PANEL whose top is at `top` is whole. */
export function wholeBoardSpans(pieces: readonly CeilingPiece[], x0: number, x1: number, top: number): Span[] {
  return fitSpans(pieces, x0, x1, top);
}

/** Highest clear height reachable by every point of some window of width `w`
 * inside [x0,x1]: where a fitting of that width would sit most comfortably.
 * Exact at breakpoints; a 0.5 cm search covers peaks between them. */
export function bestWindowClear(pieces: readonly CeilingPiece[], x0: number, x1: number, w: number): number {
  if (x1 - x0 < w - EPS) return -Infinity;
  const starts = new Set([x0, x1 - w]);
  for (const x of breaks(pieces, x0, x1, [])) for (const s of [x, x - w]) if (s >= x0 - EPS && s <= x1 - w + EPS) starts.add(s);
  for (let s = x0; s <= x1 - w; s += .5) starts.add(s);
  let best = -Infinity;
  for (const s of starts) best = Math.max(best, ceilingMin(pieces, s, s + w));
  return best;
}

/** Board lengths of a shelf cut to the top: front-view length along its top and bottom faces. */
export function cutBoardLengths(pieces: readonly CeilingPiece[], x0: number, x1: number, bottom: number) {
  const top = bottom + PANEL, length = (y: number) => fitSpans(pieces, x0, x1, y).reduce((s, q) => s + q.x1 - q.x0, 0);
  return { top: length(top), bottom: length(bottom), cut: length(top) < x1 - x0 - .05 };
}
