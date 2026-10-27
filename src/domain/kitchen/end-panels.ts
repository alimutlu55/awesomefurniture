import { PANEL } from '../wardrobe/catalog.js';
import { isCoverUnit } from './kitchen-design';
import { installationKind, isFixture } from './kitchen-units';
import { unitAxes, RUN_TOLERANCE } from './kitchen-runs';
import { cornerCabinetWidths, cornerReturnSides } from './corner-widths';
import type { EditorDesign, EditorItem } from '../wardrobe/editor-design';
import type { WardrobeShape } from '../wardrobe/shape/wardrobe-shape';

interface PanelState {
  w: number; h: number; d: number; product?: 'kitchen' | undefined; unit?: EditorDesign['unit'];
  n?: number | undefined; secs?: readonly (readonly EditorItem[])[] | undefined;
  endPanelSides?: (-1 | 1)[] | undefined;
  endPanelThickness?: number | undefined; cornerStrip?: number | undefined; shape?: WardrobeShape | undefined;
}
export interface PanelPose<S extends PanelState = PanelState> {
  id: number | string; x: number; y?: number | undefined; z: number; angle: number; state: S;
}
const EPS = 1e-7;
export const endPanelThickness = (d: PanelState) => d.endPanelThickness ?? PANEL;
const solid = (p: PanelPose) => !isFixture(p.state);

function cornerClosed(box: PanelPose, others: readonly PanelPose[], side: -1 | 1) {
  const widths = cornerCabinetWidths(box, others), edge = side < 0 ? widths[0] : widths.at(-1);
  return Boolean(edge?.covered || edge?.strip || cornerReturnSides(box, others).includes(side));
}

function sideOccupiedWithin(box: PanelPose, others: readonly PanelPose[], side: -1 | 1, tolerance: number) {
  const { u, v } = unitAxes(box.angle), x = box.x + u.x * side * box.state.w / 2, z = box.z + u.z * side * box.state.w / 2;
  return others.some(other => {
    if (other.id === box.id || !solid(other) || (other.y ?? 0) >= (box.y ?? 0) + box.state.h - EPS
      || (other.y ?? 0) + other.state.h <= (box.y ?? 0) + EPS) return false;
    const axes = unitAxes(other.angle);
    // Clip the complete side segment against the neighbour's footprint; sampling misses narrow returns.
    let lo = -box.state.d / 2, hi = box.state.d / 2;
    for (const [axis, half] of [[axes.u, other.state.w / 2 + tolerance], [axes.v, other.state.d / 2]] as const) {
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

/** A vertical extension inherits the source's finishes and construction, with the side's actual roof profile.
 * Stored cabinet dimensions stay intact: this board occupies an additional, separately dimensioned width. */
export function endPanelDesign<S extends PanelState>(source: S, side: -1 | 1, width = endPanelThickness(source) || PANEL) {
  const from = structuredClone(source), top = from.shape?.top, at = side < 0 ? 0 : (top?.length ?? 1) - 1;
  const front = top?.[at]?.y ?? from.h, back = from.shape?.back?.[at] ?? front;
  const shape: WardrobeShape | undefined = top ? { template: 'custom', top: [{ x: 0, y: front }, { x: width, y: front }], back: [back, back] } : undefined;
  return { ...from, product: 'kitchen' as const, unit: 'end-panel' as const, w: width, h: Math.max(front, back), n: 1,
    wt: [100, 100, 100, 100, 100, 100], secs: [[], [], [], [], [], []], dividers: [], doors: 'none' as const,
    shape, endPanelSides: undefined, cornerStrip: undefined, ventilationWidth: undefined, ventilationHeight: undefined, fridgeSplit: undefined };
}

/** Is the complete run end occupied by another unit? Exact footprint tests, with only numerical tolerance.
 * A real end panel or a perpendicular corner strip already closes that end and prevents double counting. */
export function exposedEnd(box: PanelPose, others: readonly PanelPose[], side: -1 | 1) {
  if (cornerClosed(box, others, side)) return false;
  return !sideOccupiedWithin(box, others, side, RUN_TOLERANCE);
}

/** Derived physical panels: never saved as duplicate cabinets, always rebuilt from the same owner settings.
 * Negative ids are reserved for these derived parts. Cabinet ids in a saved scene are positive. */
export function automaticEndPanels<S extends PanelState>(boxes: readonly PanelPose<S>[]) {
  return boxes.flatMap(box => {
    if (Number(box.id) < 0 || !Number.isFinite(Number(box.id)) || box.state.product !== 'kitchen' || isFixture(box.state) || installationKind(box.state) || isCoverUnit(box.state)) return [];
    const { u } = unitAxes(box.angle), width = endPanelThickness(box.state);
    if (width <= 0) return [];
    return ([-1, 1] as const).filter(side => !cornerClosed(box, boxes, side) && !explicitSidePanel(box, boxes, side) && (box.state.endPanelSides?.includes(side) || exposedEnd(box, boxes, side))).map(side => ({
      id: -Number(box.id) * 4 - (side > 0 ? 1 : 0), ownerId: box.id, side, name: 'End/Separator pane',
      x: box.x + u.x * side * (box.state.w + width) / 2, y: box.y ?? 0,
      z: box.z + u.z * side * (box.state.w + width) / 2, angle: box.angle, state: endPanelDesign(box.state, side, width),
    }));
  });
}


/** An explicit board remains a cabinet entity; do not draw a second attached board in the same place. */
function explicitSidePanel(box: PanelPose, boxes: readonly PanelPose[], side: -1 | 1) {
  const { u, v } = unitAxes(box.angle);
  return boxes.some(p => p.id !== box.id && installationKind(p.state) === 'end-panel'
    && Math.abs(Math.sin((p.angle - box.angle) * Math.PI / 180)) < EPS
    && Math.abs((p.x - box.x) * u.x + (p.z - box.z) * u.z - side * (box.state.w + p.state.w) / 2) < EPS
    && Math.abs((p.x - box.x) * v.x + (p.z - box.z) * v.z - (p.state.d - box.state.d) / 2) < EPS
    && (p.y ?? 0) <= (box.y ?? 0) + EPS && (p.y ?? 0) + p.state.h >= (box.y ?? 0) + box.state.h - EPS);
}

/** Called at a committed scene boundary, never by a renderer or collision preview. */
export function rememberEndPanels(boxes: readonly PanelPose[]) {
  const parts = automaticEndPanels(boxes);
  for (const box of boxes) {
    if (isCoverUnit(box.state)) { delete box.state.endPanelSides; continue; }
    const open = (box.state.endPanelSides ?? []).filter(side => !cornerClosed(box, boxes, side) && !sideOccupiedWithin(box, boxes, side, .05));
    const sides = [...new Set([...open, ...parts.filter(p => p.ownerId === box.id).map(p => p.side)])].sort();
    if (sides.length) box.state.endPanelSides = sides;
    else delete box.state.endPanelSides;
  }
}
