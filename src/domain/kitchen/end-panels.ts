import { installationKind, isFixture } from './kitchen-units';
import { unitAxes, RUN_TOLERANCE } from './kitchen-runs';
import { cornerCabinetWidths, cornerReturnSides } from './corner-widths';
import type { EditorDesign } from '../wardrobe/editor-design';
import type { WardrobeShape } from '../wardrobe/shape/wardrobe-shape';

interface PanelState {
  w: number; h: number; d: number; product?: 'kitchen' | undefined; unit?: EditorDesign['unit'];
  endPanelThickness?: number | undefined; cornerStrip?: number | undefined; shape?: WardrobeShape | undefined;
}
export interface PanelPose<S extends PanelState = PanelState> {
  id: number | string; x: number; y?: number | undefined; z: number; angle: number; state: S;
}
const EPS = 1e-7;
export const endPanelThickness = (d: PanelState) => d.endPanelThickness ?? 1.8;
const solid = (p: PanelPose) => !isFixture(p.state);

/** A vertical extension inherits the source's finishes and construction, with the side's actual roof profile.
 * Stored cabinet dimensions stay intact: this board occupies an additional, separately dimensioned width. */
export function endPanelDesign<S extends PanelState>(source: S, side: -1 | 1, width = endPanelThickness(source)) {
  const from = structuredClone(source), top = from.shape?.top, at = side < 0 ? 0 : (top?.length ?? 1) - 1;
  const front = top?.[at]?.y ?? from.h, back = from.shape?.back?.[at] ?? front;
  const shape: WardrobeShape | undefined = top ? { template: 'custom', top: [{ x: 0, y: front }, { x: width, y: front }], back: [back, back] } : undefined;
  return { ...from, product: 'kitchen' as const, unit: 'end-panel' as const, w: width, h: Math.max(front, back), n: 1,
    wt: [100, 100, 100, 100, 100, 100], secs: [[], [], [], [], [], []], dividers: [], doors: 'none' as const,
    shape, cornerStrip: undefined, ventilationWidth: undefined, ventilationHeight: undefined, fridgeSplit: undefined };
}

/** Is the complete run end occupied by another unit? Exact footprint tests, with only numerical tolerance.
 * A real end panel or a perpendicular corner strip already closes that end and prevents double counting. */
export function exposedEnd(box: PanelPose, others: readonly PanelPose[], side: -1 | 1) {
  const widths = cornerCabinetWidths(box, others), edge = side < 0 ? widths[0] : widths.at(-1);
  if (edge?.covered || edge?.strip || cornerReturnSides(box, others).includes(side)) return false;
  const { u, v } = unitAxes(box.angle), x = box.x + u.x * side * box.state.w / 2, z = box.z + u.z * side * box.state.w / 2;
  return !others.some(other => {
    if (other.id === box.id || !solid(other) || (other.y ?? 0) >= (box.y ?? 0) + box.state.h - EPS
      || (other.y ?? 0) + other.state.h <= (box.y ?? 0) + EPS) return false;
    const axes = unitAxes(other.angle);
    // Clip the complete side segment against the neighbour's footprint; sampling misses narrow returns.
    let lo = -box.state.d / 2, hi = box.state.d / 2;
    for (const [axis, half] of [[axes.u, other.state.w / 2 + RUN_TOLERANCE], [axes.v, other.state.d / 2]] as const) {
      const origin = (x - other.x) * axis.x + (z - other.z) * axis.z, dir = v.x * axis.x + v.z * axis.z;
      if (Math.abs(dir) < EPS) { if (Math.abs(origin) > half + EPS) return false; }
      else {
        const a = (-half - origin) / dir, b = (half - origin) / dir;
        lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
      }
    }
    return hi - lo > EPS;
  });
}

/** Derived physical panels: never saved as duplicate cabinets, always rebuilt from the same owner settings.
 * Negative ids are reserved for these derived parts. Cabinet ids in a saved scene are positive. */
export function automaticEndPanels<S extends PanelState>(boxes: readonly PanelPose<S>[]) {
  return boxes.flatMap(box => {
    if (Number(box.id) < 0 || !Number.isFinite(Number(box.id)) || box.state.product !== 'kitchen' || isFixture(box.state) || installationKind(box.state)) return [];
    const { u } = unitAxes(box.angle), width = endPanelThickness(box.state);
    return ([-1, 1] as const).filter(side => exposedEnd(box, boxes, side)).map(side => ({
      id: -Number(box.id) * 4 - (side > 0 ? 1 : 0), ownerId: box.id, side, name: 'End/Separator pane',
      x: box.x + u.x * side * (box.state.w + width) / 2, y: box.y ?? 0,
      z: box.z + u.z * side * (box.state.w + width) / 2, angle: box.angle, state: endPanelDesign(box.state, side, width),
    }));
  });
}
