/** Exact millimetre arithmetic for cut sizes. A carpenter cuts whole millimetres, so every length that is
 * shared out (bays across an inner width, boards along a run) is shared in whole millimetres and the parts
 * add back up to the whole with nothing lost to rounding. */

/** Whole millimetres in a centimetre length, without floating-point drift (183.4 cm → 1834). */
export const toMm = (cm: number) => Math.round(cm * 10);

/** Shares `totalMm` whole millimetres in proportion to `weights`. Each part gets the floor of its share and
 * the millimetres left over go one each to the largest remainders, leftmost first on a tie, so the parts
 * always add up to `totalMm` exactly and the result never depends on summation order. */
export function shareMillimetres(totalMm: number, weights: readonly number[]): number[] {
  if (!weights.length) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map(x => sum > 0 ? totalMm * x / sum : totalMm / weights.length);
  const parts = shares.map(s => Math.floor(s + 1e-9));
  const order = shares.map((s, k) => ({ k, r: s - parts[k]! })).sort((a, b) => b.r - a.r || a.k - b.k);
  for (let left = totalMm - parts.reduce((a, b) => a + b, 0), n = 0; left > 0; left--, n = (n + 1) % order.length) parts[order[n]!.k]!++;
  return parts;
}
