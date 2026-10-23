import { boundaryPosition, studioBoundaryEdges, studioSolid } from '../../domain/studio/studio-solid';
import type { SolidSelection, StudioEdge, WorldPoint } from '../../domain/studio/studio-solid';
import type { SolidLocation } from '../../domain/geometry/profile-solid';
import { controlPoint, locationPoint, ringAt } from '../../domain/geometry/profile-solid';
import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { splitCeilingPanel } from '../../domain/studio/studio-ceiling';
import { divideStudioBoundary, moveStudioControl } from '../../domain/studio/studio-solid';
import { ceilingHandles } from './studio-ceiling-drag';
import type { RoomMeasure } from './studio-editor.ports';
import { measureNumber, unitSuffix } from './editor-format.js';

const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const selectionOf = (h: RoomHandle): SolidSelection => ({ kind: h.solidKind ?? 'ceiling', id: h.id });
export const isBoundaryCursor = (h: RoomHandle) => h.kind === 'ceiling-split' || h.kind === 'wall-split';
export function activateBoundary(room: Studio, h: RoomHandle): Studio | null {
  const selection = selectionOf(h), model = studioSolid(room, selection), at = h.boundary;
  if (!model || !at) return null;
  if (model.ceiling && !model.ceiling.shape && !at.through && at.u === model.baselineU && at.loop === 0
    && at.edge < model.ceiling.profile.length - 1) {
    // Existing working edges keep the exact original division operation.
    const original = splitCeilingPanel(room, h.id, at.edge, h.position, h.boundaryMoved);
    if (original) return original;
  }
  return divideStudioBoundary(room, selection, at);
}
const interpolate = (a: WorldPoint, b: WorldPoint, f: number): WorldPoint => ({
  x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f,
});

/** One movable cursor. Screen projection locates a continuous point on the real 3D edges;
 * activating it is a separate operation and leaves all ordinary point editing planar. */
export function createStudioBoundaryCursor(screen: (p: WorldPoint) => { x: number; y: number }) {
  type Cursor = { selection: SolidSelection; at: SolidLocation } | null;
  let cursor: Cursor = null, before: Cursor = null;
  const same = (selection: SolidSelection) => cursor?.selection.kind === selection.kind && cursor.selection.id === selection.id;
  function handle(room: Studio, selection: SolidSelection, fallback?: RoomHandle): RoomHandle | null {
    const model = studioSolid(room, selection);
    if (!model) return null;
    let at = same(selection) ? cursor!.at : null;
    if (at && model.shape.loops[at.loop]?.[at.edge] === undefined) at = null;
    if (!at && fallback && model.ceiling) {
      const loop = model.shape.loops[0]!, k = fallback.index!;
      at = { loop: 0, edge: k, u: model.baselineU,
        fraction: (fallback.position! - model.ceiling.profile[k]!.t) / (model.ceiling.profile[k + 1]!.t - model.ceiling.profile[k]!.t) };
      if (k >= loop.length) at = null;
    }
    if (!at) {
      const edges = studioBoundaryEdges(room, selection).filter(e => !e.location.through && e.location.u === model.baselineU);
      const edge = edges.sort((a, b) => selection.kind === 'wall' ? (b.a.y + b.b.y) - (a.a.y + a.b.y) || distance(b.a, b.b) - distance(a.a, a.b)
        : distance(b.a, b.b) - distance(a.a, a.b))[0];
      if (!edge) return null;
      at = { ...edge.location, fraction: .5 };
    }
    const point = boundaryPosition(room, selection, at);
    if (!point) return null;
    const local = locationPoint(model.shape, at);
    return { ...fallback, ...point, key: (selection.kind === 'ceiling' ? 'ceiling-split:' : 'wall-split:') + selection.id,
      id: selection.id, kind: selection.kind === 'ceiling' ? 'ceiling-split' : 'wall-split', solidKind: selection.kind,
      boundary: at, boundaryMoved: !!same(selection), index: at.edge, position: local.t,
      label: selection.kind === 'ceiling' ? 'Add a ceiling shape point here. Drag along the edge to choose where; tap to divide'
        : 'Add a wall shape point here. Drag along the edge to choose where; tap to divide' };
  }
  function move(room: Studio, h: RoomHandle, dx: number, dy: number) {
    const selection = selectionOf(h), origin = screen(h), target = { x: origin.x + dx, y: origin.y + dy };
    const previous = same(selection) ? boundaryPosition(room, selection, cursor!.at) ?? h : h;
    let best: { edge: StudioEdge; fraction: number; distance: number; travel: number } | null = null;
    for (const edge of studioBoundaryEdges(room, selection)) {
      const p = screen(edge.a), q = screen(edge.b), ux = q.x - p.x, uy = q.y - p.y, length = ux * ux + uy * uy;
      if (length < 1e-10) continue;
      const fraction = Math.max(0, Math.min(1, ((target.x - p.x) * ux + (target.y - p.y) * uy) / length));
      const d = Math.hypot(target.x - p.x - ux * fraction, target.y - p.y - uy * fraction);
      let lo = 0, hi = 1;
      for (let n = 0; n < 40; n++) {
        const mid = (lo + hi) / 2, at = screen(interpolate(edge.a, edge.b, mid));
        if (((at.x - p.x) * ux + (at.y - p.y) * uy) / length < fraction) lo = mid; else hi = mid;
      }
      const f = fraction === 0 || fraction === 1 ? fraction : (lo + hi) / 2;
      const travel = distance(previous, interpolate(edge.a, edge.b, f));
      if (!best || d < best.distance - .001 || Math.abs(d - best.distance) <= .001 && travel < best.travel)
        best = { edge, fraction: f, distance: d, travel };
    }
    if (best) {
      const at = best.edge.location;
      cursor = { selection, at: at.through ? { ...at, u: at.u + (at.fraction - at.u) * best.fraction, fraction: 0 }
        : { ...at, fraction: best.fraction } };
    }
  }
  function nudge(room: Studio, h: RoomHandle, amount: number) {
    const selection = selectionOf(h), model = studioSolid(room, selection);
    if (!model || !h.boundary) return;
    const at = h.boundary, loop = model.shape.loops[at.loop]!;
    let fraction = at.fraction;
    if (at.through) {
      const point = model.shape.rings[0]!.points[loop[at.edge]!]!;
      const span = distance(model.at(point, 0), model.at(point, 1));
      cursor = { selection, at: { ...at, u: Math.max(0, Math.min(1, at.u + amount / span)) } }; return;
    }
    const points = ringAt(model.shape, at.u);
    let edge = at.edge, remaining = amount;
    for (let n = 0; n <= loop.length; n++) {
      const p = points[loop[edge]!]!, q = points[loop[(edge + 1) % loop.length]!]!;
      const span = Math.abs(q.t - p.t) || distance(model.at(p, at.u), model.at(q, at.u));
      if (span < 1e-8) { edge = (edge + (remaining > 0 ? 1 : loop.length - 1)) % loop.length; continue; }
      const next = fraction + remaining / span;
      if (next >= 0 && next <= 1) { fraction = next; break; }
      remaining -= (remaining > 0 ? 1 - fraction : -fraction) * span;
      edge = (edge + (remaining > 0 ? 1 : loop.length - 1)) % loop.length; fraction = remaining > 0 ? 0 : 1;
    }
    cursor = { selection, at: { ...at, edge, fraction } };
  }
  return { handle, move, nudge, begin() { before = cursor; }, cancel() { cursor = before; }, clear() { cursor = null; } };
}

/** Existing profile dots plus just those controls requested through the cursor. */
export function studioSolidHandles(room: Studio, selection: SolidSelection): RoomHandle[] {
  const model = studioSolid(room, selection);
  if (!model) return [];
  return model.shape.controls.map((control, k) => ({
    key: 'shape-point:' + selection.kind + ':' + selection.id + ':' + control.id,
    kind: 'shape-point', id: selection.id, solidKind: selection.kind, control: control.id,
    ...model.at(controlPoint(model.shape, control), control.u), ux: model.axis.x, uz: model.axis.z,
    label: 'Point ' + (k + 1) + ', drag to move the adjoining parts independently',
  }));
}

export function boundaryHandles(room: Studio, selection: SolidSelection, cursor: ReturnType<typeof createStudioBoundaryCursor>): RoomHandle[] {
  const model = studioSolid(room, selection);
  if (!model) return [];
  const original = model.ceiling ? ceilingHandles(room, model.ceiling) : [];
  const custom = !!(model.ceiling ?? model.wall).shape;
  const handles = custom ? [...original.filter(h => h.kind === 'depth'), ...studioSolidHandles(room, selection)]
    : original.filter(h => h.kind !== 'ceiling-split');
  const split = cursor.handle(room, selection, custom ? undefined : original.find(h => h.kind === 'ceiling-split'));
  return split ? [...handles, split] : handles;
}

export function boundaryControlMotion(original: Studio, last: Studio, h: RoomHandle, delta: { s: number; y: number }, step: (v: number) => number) {
  const selection = selectionOf(h), source = studioSolid(original, selection)!, current = studioSolid(last, selection)!;
  const p = controlPoint(source.shape, source.shape.controls.find(c => c.id === h.control)!);
  const now = controlPoint(current.shape, current.shape.controls.find(c => c.id === h.control)!);
  return (fraction: number) => moveStudioControl(original, selection, h.control!,
    now.t + (step(p.t + delta.s) - now.t) * fraction, now.y + (step(p.y + delta.y) - now.y) * fraction);
}

export function boundaryMeasures(room: Studio, selection: SolidSelection, active?: string): RoomMeasure[] {
  return studioSolidHandles(room, selection).filter(h => !active || h.key === active).map(h => ({
    a: { x: h.x, y: 0, z: h.z }, b: h, text: measureNumber(h.y) + unitSuffix(), axis: 'height', edit: 'control:' + h.control,
  }));
}
