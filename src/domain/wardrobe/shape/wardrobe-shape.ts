import { PANEL, PLINTH } from '../catalog.js';
import { rearShape, withRear } from './depth-shape';

/** Built-in wardrobe skeletons share one model: an x-monotone outer top profile
 * over the full cabinet width. Every template, sloped or stepped, is data in this
 * model; geometry, validation and rendering never branch on the template name.
 * Centimetres; x is measured from the left outer face, y is outer height from the floor. */
/** 'room': fitted under a room's ceiling by the editor (studio-fit.ts), never chosen from the templates. */
export const SHAPE_TEMPLATE_IDS = ['regular', 'sloped', 'stepped', 'under-stairs', 'alcove', 'custom', 'room'] as const;
export type ShapeTemplateId = typeof SHAPE_TEMPLATE_IDS[number];

export interface ShapePoint {
  x: number;
  y: number;
  /** A step pair (two points sharing x) can follow a section partition. */
  partition?: number | undefined;
}
export interface WardrobeShape {
  template: ShapeTemplateId;
  top: ShapePoint[];
  /** Rear heights at the same profile points; omitted when front and rear match. */
  back?: number[] | undefined;
}

/** Lowest outer height of any part of the cabinet. */
export const MIN_OUTER_HEIGHT = 40;
export const MAX_OUTER_HEIGHT = 280;
/** Steeper tops are built as vertical steps. */
export const MAX_SLOPE_DEG = 70;
/** Shortest horizontal top panel and smallest step rise. */
export const MIN_SEGMENT = 5;
export const MIN_STEP = 1;
/** Clear height left above the base board everywhere inside the cabinet. */
export const MIN_INNER_CLEARANCE = 15;
const EPS = 1e-6;
const BASE = PLINTH + PANEL;

export interface Span { x0: number; x1: number }
/** A linear piece of a board's underside: the clear interior is below it. */
export interface CeilingPiece { x0: number; x1: number; y0: number; y1: number }
export interface BoardPolygon {
  kind: 'top' | 'riser';
  /** Index of the first profile point of the panel's segment. */
  segment: number;
  points: { x: number; y: number }[];
}
/** Minimal design surface used by shape rules, so commands, mapping and
 * rendering all resolve the same geometry from the same fields. */
export interface ShapedDesign {
  w: number; h: number; n: number; wt: readonly number[];
  shape?: WardrobeShape | undefined;
}

const round = (v: number) => Math.round(v * 10) / 10;

export function regularShape(w: number, h: number): WardrobeShape {
  return { template: 'regular', top: [{ x: 0, y: h }, { x: w, y: h }] };
}

/** True when the profile is one flat top across the whole width. */
export function isRegularShape(shape: WardrobeShape | undefined): boolean {
  if (!shape) return true;
  const ys = [...shape.top.map(p => p.y), ...(shape.back ?? [])];
  return Math.max(...ys) - Math.min(...ys) < .05;
}

/** Inner section widths: identical to the editor's long-standing weight rule. */
export function sectionWidths(design: Pick<ShapedDesign, 'w' | 'n' | 'wt'>): number[] {
  const iw = design.w - (design.n + 1) * PANEL, wt = design.wt.slice(0, design.n), total = wt.reduce((a, b) => a + b, 0);
  return wt.map(x => iw * x / total);
}
/** Left face of each partition between section k and k+1. */
export function partitionPositions(design: Pick<ShapedDesign, 'w' | 'n' | 'wt'>): number[] {
  const ws = sectionWidths(design), out: number[] = [];
  let x = PANEL;
  for (let k = 0; k < ws.length - 1; k++) {
    x += ws[k]!;
    out.push(x);
    x += PANEL;
  }
  return out;
}
/** Absolute left inner face of each section. */
export function sectionOrigins(design: Pick<ShapedDesign, 'w' | 'n' | 'wt'>): number[] {
  const ws = sectionWidths(design);
  let x = PANEL;
  return ws.map(w => { const o = x; x += w + PANEL; return o; });
}

/** Stored shape with partition-anchored steps placed on their partition and the
 * width scaled to the cabinet. A step's riser always sits on its higher side, so
 * an anchored riser lines up with the partition board below it. */
export function resolveShape(design: ShapedDesign): WardrobeShape {
  const stored = design.shape ?? regularShape(design.w, design.h);
  const last = stored.top[stored.top.length - 1]!.x, scale = last > EPS ? design.w / last : 1;
  const parts = partitionPositions(design);
  const top = stored.top.map(p => ({ ...p, x: Math.abs(scale - 1) < 1e-9 ? p.x : round(p.x * scale) }));
  top[0]!.x = 0;
  top[top.length - 1]!.x = design.w;
  for (let k = 0; k < top.length - 1; k++) {
    const a = top[k]!, b = top[k + 1]!;
    if (a.partition === undefined || a.partition !== b.partition) continue;
    const p = parts[a.partition];
    if (p === undefined) continue;
    a.x = b.x = b.y > a.y ? p : p + PANEL;
  }
  return { ...stored, top };
}

/** Vertical board thickness of a panel with this slope. */
function boardDrop(a: ShapePoint, b: ShapePoint) {
  const m = (b.y - a.y) / (b.x - a.x);
  return PANEL * Math.sqrt(1 + m * m);
}

/** Top boards with vertical end cuts and step risers on each step's higher side. */
export function shapeBoards(shape: WardrobeShape): BoardPolygon[] {
  const pts = shape.top, boards: BoardPolygon[] = [];
  const dropAt = (k: number) => {
    const a = pts[k], b = pts[k + 1];
    return a && b && b.x - a.x > EPS ? boardDrop(a, b) : PANEL;
  };
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k]!, b = pts[k + 1]!;
    if (b.x - a.x > EPS) {
      const t = boardDrop(a, b);
      boards.push({ kind: 'top', segment: k, points: [{ x: a.x, y: a.y - t }, { x: b.x, y: b.y - t }, { x: b.x, y: b.y }, { x: a.x, y: a.y }] });
    }
    else {
      const left = a.y - dropAt(k - 1), right = b.y - dropAt(k + 1), up = b.y > a.y;
      const x0 = up ? a.x : a.x - PANEL, x1 = x0 + PANEL, y0 = Math.min(left, right), y1 = Math.max(left, right);
      boards.push({ kind: 'riser', segment: k, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
    }
  }
  return boards;
}

/** The underside of the top boards across the full width. The clear interior lies
 * below the minimum of the overlapping pieces. */
export function ceilingPieces(shape: WardrobeShape): CeilingPiece[] {
  return [...shapeBoards(shape), ...(shape.back ? shapeBoards(rearShape(shape)) : [])].map(board => {
    const [p0, p1] = board.points as [{ x: number; y: number }, { x: number; y: number }];
    return { x0: p0.x, x1: p1.x, y0: p0.y, y1: p1.y };
  });
}

const valueAt = (p: CeilingPiece, x: number) => p.x1 - p.x0 < EPS ? Math.min(p.y0, p.y1) : p.y0 + (p.y1 - p.y0) * (x - p.x0) / (p.x1 - p.x0);
const overlaps = (p: CeilingPiece, x0: number, x1: number) => x1 - x0 < EPS ? p.x0 <= x0 + EPS && p.x1 >= x0 - EPS : p.x1 > x0 + EPS && p.x0 < x1 - EPS;

/** Lowest underside over a span (exact for linear pieces). */
export function ceilingMin(pieces: readonly CeilingPiece[], x0: number, x1: number): number {
  let low = Infinity;
  for (const p of pieces) {
    if (!overlaps(p, x0, x1)) continue;
    low = Math.min(low, valueAt(p, Math.max(p.x0, x0)), valueAt(p, Math.min(p.x1, x1)));
  }
  return low;
}
/** Highest clear point over a span. */
export function ceilingMax(pieces: readonly CeilingPiece[], x0: number, x1: number): number {
  const xs = [x0, x1, ...pieces.flatMap(p => [p.x0, p.x1]).filter(x => x > x0 && x < x1)];
  let high = -Infinity;
  for (const x of xs) {
    for (const side of [-1, 1]) {
      const a = Math.max(x0, Math.min(x1, x + side * 1e-4));
      const v = ceilingMin(pieces, Math.min(a, x), Math.max(a, x));
      if (Number.isFinite(v)) high = Math.max(high, v);
    }
  }
  return high;
}

/** Underside traced left to right, including vertical jumps at steps. */
export function ceilingPolyline(pieces: readonly CeilingPiece[], x0: number, x1: number): { x: number; y: number }[] {
  const xs = [...new Set([x0, x1, ...pieces.flatMap(p => [p.x0, p.x1]).filter(x => x > x0 + EPS && x < x1 - EPS)])].sort((a, b) => a - b);
  const left = (x: number) => ceilingMin(pieces, Math.max(x0, x - 1e-4), x), right = (x: number) => ceilingMin(pieces, x, Math.min(x1, x + 1e-4));
  const out: { x: number; y: number }[] = [];
  xs.forEach((x, i) => {
    const l = i === 0 ? right(x) : left(x), r = i === xs.length - 1 ? left(x) : right(x);
    out.push({ x, y: l });
    if (Math.abs(r - l) > 1e-4) out.push({ x, y: r });
  });
  return out;
}

/** Parts of [x0,x1] where the clear height reaches yTop. Exact: breakpoints and
 * crossings split the span into intervals with a constant verdict. */
export function fitSpans(pieces: readonly CeilingPiece[], x0: number, x1: number, yTop: number): Span[] {
  const xs = new Set([x0, x1]);
  for (const p of pieces) {
    for (const x of [p.x0, p.x1]) if (x > x0 && x < x1) xs.add(x);
    if (Math.abs(p.y1 - p.y0) > EPS) {
      const x = p.x0 + (yTop - p.y0) * (p.x1 - p.x0) / (p.y1 - p.y0);
      if (x > x0 && x < x1 && x >= p.x0 && x <= p.x1) xs.add(x);
    }
  }
  const sorted = [...xs].sort((a, b) => a - b), spans: Span[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!, b = sorted[i + 1]!;
    if (b - a < EPS) continue;
    const mid = (a + b) / 2, ok = ceilingMin(pieces, mid, mid) >= yTop - 1e-6;
    if (!ok) continue;
    const prev = spans[spans.length - 1];
    if (prev && Math.abs(prev.x1 - a) < EPS) prev.x1 = b;
    else spans.push({ x0: a, x1: b });
  }
  return spans;
}

/** Outer profile clipped to [x0,x1], including step corners. */
export function outerPolyline(shape: WardrobeShape, x0: number, x1: number): { x: number; y: number }[] {
  const pts = shape.top, out: { x: number; y: number }[] = [];
  const at = (x: number, fromRight: boolean) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k]!, b = pts[k + 1]!;
      if (b.x - a.x < EPS) continue;
      if (x >= a.x - EPS && x <= b.x + EPS && (fromRight ? x < b.x - EPS || k === pts.length - 2 : x > a.x + EPS || k === 0)) return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    }
    return pts[fromRight ? pts.length - 1 : 0]!.y;
  };
  out.push({ x: x0, y: at(x0, true) });
  for (const p of pts) if (p.x > x0 + EPS && p.x < x1 - EPS) out.push({ x: p.x, y: p.y });
  out.push({ x: x1, y: at(x1, false) });
  return out;
}

export function maxHeight(shape: WardrobeShape): number {
  return Math.max(...shape.top.map(p => p.y), ...(shape.back ?? []));
}

/** Area of the cabinet's front elevation, for material and cost estimates. */
export function elevationArea(shape: WardrobeShape): number {
  let a = 0;
  for (let k = 0; k < shape.top.length - 1; k++) {
    const p = shape.top[k]!, q = shape.top[k + 1]!;
    a += (q.x - p.x) * (p.y + q.y) / 2;
  }
  return a;
}

export interface ShapePanel {
  kind: 'side' | 'top' | 'step';
  /** Profile point indices bounding the panel. */
  from: number; to: number;
  label: string;
  length: number; angle: number; rise: number;
}
/** Structural panels described in carpenter's terms for inspectors and rulers.
 * Angle is degrees above horizontal, rising to the right. */
export function shapePanels(shape: WardrobeShape): ShapePanel[] {
  const pts = shape.top, panels: ShapePanel[] = [];
  panels.push({ kind: 'side', from: 0, to: 0, label: 'Left side', length: pts[0]!.y, angle: 90, rise: 0 });
  let tops = 0, steps = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k]!, b = pts[k + 1]!, dx = b.x - a.x, dy = b.y - a.y;
    if (dx > EPS) panels.push({ kind: 'top', from: k, to: k + 1, label: 'Top panel ' + ++tops, length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) * 180 / Math.PI, rise: dy });
    else panels.push({ kind: 'step', from: k, to: k + 1, label: 'Step ' + ++steps, length: Math.abs(dy), angle: 90, rise: dy });
  }
  panels.push({ kind: 'side', from: pts.length - 1, to: pts.length - 1, label: 'Right side', length: pts[pts.length - 1]!.y, angle: 90, rise: 0 });
  if (tops === 1) panels.find(p => p.kind === 'top')!.label = 'Top panel';
  return panels;
}

/** Every rule a buildable skeleton must satisfy. Empty when valid. */
export function shapeProblems(shape: WardrobeShape, w: number): string[] {
  const pts = shape.top, problems: string[] = [];
  if (!(SHAPE_TEMPLATE_IDS as readonly string[]).includes(shape.template)) problems.push('Unknown wardrobe shape.');
  if (pts.length < 2) return [...problems, 'A wardrobe top needs at least two points.'];
  if (pts.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return [...problems, 'Shape points must be numbers.'];
  if (Math.abs(pts[0]!.x) > .05 || Math.abs(pts[pts.length - 1]!.x - w) > .05) problems.push('The top must span the full wardrobe width.');
  for (const p of pts) {
    if (p.y < MIN_OUTER_HEIGHT - .01) problems.push(`Every part must be at least ${MIN_OUTER_HEIGHT} cm tall.`);
    if (p.y > MAX_OUTER_HEIGHT + .01) problems.push(`No part may be taller than ${MAX_OUTER_HEIGHT} cm.`);
  }
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k]!, b = pts[k + 1]!, dx = b.x - a.x, dy = b.y - a.y;
    if (dx < -EPS) { problems.push('Break points must run from left to right.'); continue; }
    if (dx <= EPS) {
      if (k === 0 || k === pts.length - 2) problems.push('A step cannot sit on a side panel.');
      if (Math.abs(dy) < MIN_STEP) problems.push(`A step must rise at least ${MIN_STEP} cm.`);
      const next = pts[k + 2], prev = pts[k - 1];
      if ((next && next.x - b.x <= EPS) || (prev && a.x - prev.x <= EPS)) problems.push('Two steps cannot share a position.');
      const riser = dy > 0 ? a.x : a.x - PANEL;
      if (riser < PANEL - .01 || riser + PANEL > w - PANEL + .01) problems.push('A step must leave room for its riser board inside the side panels.');
      if (dy > 0 ? (pts[k + 2] && pts[k + 2]!.x - a.x < PANEL - .01) : (prev && a.x - prev.x < PANEL - .01)) problems.push('A step riser needs a top panel at least one board wide.');
      continue;
    }
    if (dx < MIN_SEGMENT - .01) problems.push(`Top panels must be at least ${MIN_SEGMENT} cm wide.`);
    if (Math.atan2(Math.abs(dy), dx) * 180 / Math.PI > MAX_SLOPE_DEG + .01) problems.push(`Slopes steeper than ${MAX_SLOPE_DEG}° must be built as a step.`);
  }
  if (!problems.length) {
    const pieces = ceilingPieces(shape), clear = ceilingMin(pieces, PANEL, w - PANEL) - BASE;
    if (clear < MIN_INNER_CLEARANCE - .01) problems.push(`Leave at least ${MIN_INNER_CLEARANCE} cm clear inside under the lowest top panel.`);
  }
  if (shape.back) {
    if (shape.back.length !== pts.length || shape.back.some(y => !Number.isFinite(y))) problems.push('Rear profile must match the front points.');
    else problems.push(...shapeProblems(rearShape(shape), w).filter(p => !/step must rise|Two steps/.test(p)));
  }
  return [...new Set(problems)];
}

/** Apply a new width/height to a skeleton: widths scale proportionally, a new
 * maximum height shifts the whole top so measured slopes and steps are kept. */
export function resizeShape(shape: WardrobeShape, fromW: number, toW: number, fromH: number, toH: number): WardrobeShape {
  const sx = fromW > EPS ? toW / fromW : 1, dy = toH - fromH;
  const top = shape.top.map((p, k, all) => ({ ...p, x: k === all.length - 1 ? toW : round(p.x * sx), y: round(p.y + dy) }));
  return { ...shape, top, ...(shape.back ? { back: shape.back.map(y => round(y + dy)) } : {}) };
}
/** Lowest maximum height that keeps every part above the minimum outer height. */
export function minimumShapeHeight(shape: WardrobeShape): number {
  const ys = [...shape.top.map(p => p.y), ...(shape.back ?? [])];
  return Math.max(...ys) - (Math.min(...ys) - MIN_OUTER_HEIGHT);
}

/** Edits are pure; callers validate the result with shapeProblems before use.
 * A manual x edit releases a step from its partition. */
export function setPoint(shape: WardrobeShape, index: number, patch: { x?: number; y?: number }): WardrobeShape {
  const top = shape.top.map(p => ({ ...p }));
  const p = top[index];
  if (!p) return shape;
  if (patch.y !== undefined) p.y = round(patch.y);
  if (patch.x !== undefined && index > 0 && index < top.length - 1) {
    const x = round(patch.x), mates = [index - 1, index, index + 1].filter(k => top[k] && Math.abs(top[k]!.x - p.x) < EPS);
    for (const k of mates) {
      top[k]!.x = x;
      delete top[k]!.partition;
    }
  }
  return { ...shape, top };
}
/** Change a step's rise. The run after the step moves with it up to the next
 * step (or the right side), so flat panels stay flat and the next step absorbs
 * the change. `index` is the step's left corner. */
export function setStepRise(shape: WardrobeShape, index: number, rise: number): WardrobeShape {
  const a = shape.top[index], b = shape.top[index + 1];
  if (!a || !b || Math.abs(b.x - a.x) > EPS || !Number.isFinite(rise)) return shape;
  const delta = round(a.y + rise - b.y), top = shape.top.map(p => ({ ...p }));
  for (let k = index + 1; k < top.length; k++) {
    top[k]!.y = round(top[k]!.y + delta);
    const next = top[k + 1];
    if (next && Math.abs(next.x - top[k]!.x) < EPS && k > index + 1) break;
  }
  return { ...shape, top };
}
/** Set a top panel's angle by moving its end point (or start when pivoting at the end). */
export function setPanelAngle(shape: WardrobeShape, from: number, degrees: number, pivot: 'start' | 'end' = 'start'): WardrobeShape {
  const a = shape.top[from], b = shape.top[from + 1];
  if (!a || !b || b.x - a.x < EPS || !Number.isFinite(degrees)) return shape;
  const rise = Math.tan(degrees * Math.PI / 180) * (b.x - a.x);
  return pivot === 'start' ? setPoint(shape, from + 1, { y: a.y + rise }) : setPoint(shape, from, { y: b.y - rise });
}
/** Set a top panel's horizontal length by moving its end break point. */
export function setPanelRun(shape: WardrobeShape, from: number, run: number): WardrobeShape {
  const a = shape.top[from];
  if (!a || from + 1 >= shape.top.length - 1) return shape;
  return setPoint(shape, from + 1, { x: a.x + run });
}
/** Split a top panel at the chosen position (its middle by default). */
export function splitPanel(shape: WardrobeShape, from: number, position?: number): WardrobeShape {
  const a = shape.top[from], b = shape.top[from + 1];
  if (!a || !b || b.x - a.x < 2 * MIN_SEGMENT) return shape;
  const top = shape.top.map(p => ({ ...p }));
  const x = round(Math.max(a.x + MIN_SEGMENT, Math.min(b.x - MIN_SEGMENT, position ?? (a.x + b.x) / 2)));
  top.splice(from + 1, 0, { x, y: round(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)) });
  return withRear(shape, top);
}
/** Add a step in the middle of a top panel: the right part drops by `drop` cm. */
export function addStep(shape: WardrobeShape, from: number, drop = 20): WardrobeShape {
  const a = shape.top[from], b = shape.top[from + 1];
  if (!a || !b || b.x - a.x < 2 * MIN_SEGMENT + 2 * PANEL) return shape;
  const x = round((a.x + b.x) / 2), y = round((a.y + b.y) / 2), top = shape.top.map(p => ({ ...p }));
  top.splice(from + 1, 0, { x, y }, { x, y: round(y - drop) });
  for (let k = from + 3; k < top.length; k++) top[k]!.y = round(top[k]!.y - drop);
  return withRear(shape, top);
}
/** Remove a break point (both corners of a step). Side corners are kept. */
export function removePoint(shape: WardrobeShape, index: number): WardrobeShape {
  if (index <= 0 || index >= shape.top.length - 1) return shape;
  const top = shape.top.map(p => ({ ...p })), p = top[index]!;
  // Removing either corner of a step removes the step: the top then runs
  // straight between the neighbouring break points.
  const mate = [index - 1, index + 1].find(k => k > 0 && k < top.length - 1 && Math.abs(top[k]!.x - p.x) < EPS);
  top.splice(mate === undefined ? index : Math.min(index, mate), mate === undefined ? 1 : 2);
  return withRear(shape, top);
}

/** Clear interior (relative to the base board) available to fittings in a section span. */
export function sectionCeiling(pieces: readonly CeilingPiece[], origin: number, x0: number, x1: number): number {
  return ceilingMin(pieces, origin + x0, origin + x1) - BASE;
}

export { friendlyProblem } from './shape-messages';
