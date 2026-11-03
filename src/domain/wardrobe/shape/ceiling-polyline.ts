import type { CeilingPiece } from './wardrobe-shape';

export const valueAt = (p: CeilingPiece, x: number) => p.x1 - p.x0 < 1e-6 ? Math.min(p.y0, p.y1) : p.y0 + (p.y1 - p.y0) * (x - p.x0) / (p.x1 - p.x0);

/** Underside traced left to right, including vertical jumps at steps. */
export function ceilingPolyline(pieces: readonly CeilingPiece[], x0: number, x1: number): { x: number; y: number }[] {
  const xs = [...new Set([x0, x1, ...pieces.flatMap(p => [p.x0, p.x1]).filter(x => x > x0 + 1e-6 && x < x1 - 1e-6)])].sort((a, b) => a - b);
  // Evaluate the one-sided limit at x itself. Sampling a short interval moves a
  // sloping edge down and leaves an artificial gap under the roof.
  const limit = (x: number, fromRight: boolean) => Math.min(...pieces
    .filter(p => fromRight ? p.x0 <= x && p.x1 > x : p.x0 < x && p.x1 >= x)
    .map(p => valueAt(p, x)));
  const left = (x: number) => limit(x, false), right = (x: number) => limit(x, true);
  const out: { x: number; y: number }[] = [];
  xs.forEach((x, i) => {
    const l = i === 0 ? right(x) : left(x), r = i === xs.length - 1 ? left(x) : right(x);
    out.push({ x, y: l });
    if (Math.abs(r - l) > 1e-4) out.push({ x, y: r });
  });
  return out;
}

