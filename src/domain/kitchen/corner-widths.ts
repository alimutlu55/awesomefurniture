import { RUN_TOLERANCE, unitAxes } from './kitchen-runs';
import { isFixture, kitchenUnit, WORKTOP } from './kitchen-units';
import type { EditorDesign } from '../wardrobe/editor-design';

interface Cabinet {
  readonly id: number; readonly x: number; readonly z: number; readonly y?: number; readonly angle: number;
  readonly state: Pick<EditorDesign, 'w' | 'h' | 'd' | 'product' | 'unit' | 'cornerStrip'>;
}
export interface FaceWidth { readonly from: number; readonly to: number; readonly covered: boolean; readonly strip?: boolean }
// Numerical tolerance only (centimetres). Real gaps and offsets are never snapped or rounded here.
const EPS = 1e-7;
// The editor recognises quarter-turn alignment within half a degree. Keep actual angles for intersections.
const QUARTER_TURN = Math.sin(.5 * Math.PI / 180);
// Remove trigonometric round-off before display rounding (e.g. 611.4999999999999 mm at a half-mm stop).
const stable = (cm: number) => Math.round(cm * 1e9) / 1e9;
const cabinet = (p: Cabinet) => p.state.product === 'kitchen' && !isFixture(p.state);

/** A hinged front intersecting the perpendicular return cannot operate there: it is a fixed cover in the
 * installed view. Front coordinates and width segments are measured from the same cabinet left edge. */
export function frontCoveredByReturn(x0: number, x1: number, widths: readonly FaceWidth[]): boolean {
  return widths.some(s => (s.covered || s.strip) && Math.min(x1, s.to) - Math.max(x0, s.from) > EPS);
}

/** Width along the carcass front, from its left edge, split by a perpendicular return in the same run.
 * A return can stop just beyond the front (a worktop overhang / joint), rather than on its exact plane.
 * Extend only the return's side ends for detection; its front/back planes still set the exact width stops.
 * All values remain in model centimetres. Board cutting sizes and the overall cabinet width are unchanged. */
export function cornerCabinetWidths(box: Cabinet, others: readonly Cabinet[]): FaceWidth[] {
  const w = box.state.w, plain = [{ from: 0, to: w, covered: false }];
  if (!cabinet(box)) return plain;
  const { u, v } = unitAxes(box.angle), front = { x: box.x + v.x * box.state.d / 2, z: box.z + v.z * box.state.d / 2 };
  const join = RUN_TOLERANCE + (kitchenUnit(box.state.unit).worktop ? WORKTOP.overhang : 0) + (box.state.cornerStrip ?? 0);
  const covered: [number, number][] = [];
  for (const other of others) {
    if (other.id === box.id || !cabinet(other)) continue;
    if ((other.y ?? 0) >= (box.y ?? 0) + box.state.h - EPS || (other.y ?? 0) + other.state.h <= (box.y ?? 0) + EPS) continue;
    const axes = unitAxes(other.angle);
    if (Math.abs(u.x * axes.u.x + u.z * axes.u.z) > QUARTER_TURN + EPS) continue;
    // A cabinet entirely behind this front does not hide it, even if its projected width lines up.
    const normal = (other.x - front.x) * v.x + (other.z - front.z) * v.z;
    const reach = Math.abs(axes.u.x * v.x + axes.u.z * v.z) * other.state.w / 2
      + Math.abs(axes.v.x * v.x + axes.v.z * v.z) * other.state.d / 2;
    if (normal + reach < -EPS) continue;
    let lo = -w / 2, hi = w / 2;
    for (const [axis, half] of [[axes.u, other.state.w / 2 + join], [axes.v, other.state.d / 2]] as const) {
      const origin = (front.x - other.x) * axis.x + (front.z - other.z) * axis.z;
      const dir = u.x * axis.x + u.z * axis.z;
      if (Math.abs(dir) < EPS) {
        if (Math.abs(origin) > half + EPS) { hi = lo; break; }
      } else {
        const a = (-half - origin) / dir, b = (half - origin) / dir;
        lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
      }
    }
    if (hi - lo > EPS) covered.push([stable(lo + w / 2), stable(hi + w / 2)]);
  }
  // Union overlapping returns before splitting: duplicate/overlapping neighbours cannot create extra ticks.
  const merged: [number, number][] = [];
  for (const span of covered.sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1] + EPS) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  const out: FaceWidth[] = [];
  let from = 0;
  for (const [a, b] of merged) {
    if (a - from > EPS) out.push({ from, to: a, covered: false });
    out.push({ from: a, to: b, covered: true }); from = b;
  }
  if (w - from > EPS) out.push({ from, to: w, covered: false });
  const widths = out.length ? out : plain, strip = box.state.cornerStrip ?? 0;
  if (!(strip > EPS)) return widths;
  return widths.flatMap((s, i): FaceWidth[] => {
    if (s.covered) return [s];
    const left = widths[i - 1]?.covered ? Math.min(strip, s.to - s.from) : 0;
    const right = widths[i + 1]?.covered ? Math.min(strip, s.to - s.from - left) : 0;
    return [...(left > EPS ? [{ from: s.from, to: stable(s.from + left), covered: false, strip: true }] : []),
      ...(s.to - right - s.from - left > EPS ? [{ from: stable(s.from + left), to: stable(s.to - right), covered: false }] : []),
      ...(right > EPS ? [{ from: stable(s.to - right), to: s.to, covered: false, strip: true }] : [])];
  });
}
