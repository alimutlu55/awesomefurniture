import type { Studio } from '../studio/studio';
import { kitchenSpans, unitAxes, type KitchenSpan } from '../kitchen/kitchen-runs';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { fitting, hasTrait } from '../wardrobe/fittings';
import { PANEL } from '../wardrobe/catalog.js';
import { interiorDepth } from '../wardrobe/carcass';
import { isKitchen } from '../furniture/furniture';
import { mm, type DrawingIssue, type Item, type Table, note } from './drawing';
import { local, plan } from './plan-symbols';
import { pieceName, wallGeometry, type PlacedPiece } from './room-pieces';

export const worktopFixture = (p: PlacedPiece) => p.fixture === 'sink' || p.fixture === 'hob';
export interface ApplianceAllocation {
  readonly reference: string; readonly name: string; readonly x: number; readonly y: number;
  readonly width: number; readonly height: number; readonly depth: number;
}
/** Modeled fitting allocations, never manufacturer appliance/niche sizes. Centimetres from the cabinet's left/base. */
export function applianceAllocations(p: PlacedPiece): ApplianceAllocation[] {
  if (!isKitchen(p.design) || p.fixture) return [];
  const geometry = createWardrobeGeometry(() => ({ ...p.design, sel: 0, item: -1, divider: -1, space: null }));
  const out: ApplianceAllocation[] = []; let left = PANEL;
  geometry.widths().forEach((width, bay) => {
    geometry.computeLayout(bay).forEach((pos, index) => {
      const item = p.design.secs[bay]![index]!;
      if (!hasTrait(item.k, 'appliance')) return;
      out.push({ reference: p.mark + '.' + (out.length + 1), name: fitting(item.k)!.zone.label ?? fitting(item.k)!.name,
        x: left + pos.off, y: pos.y0, width: pos.w, height: pos.y1 - pos.y0, depth: interiorDepth(p.design.d) });
    });
    left += width + PANEL;
  });
  return out;
}
export function fixtureRun(p: PlacedPiece, pieces: readonly PlacedPiece[]) {
  const spans = kitchenSpans(pieces.map(p => ({ ...p, state: p.design }))).filter(s => s.kind === 'worktop');
  const candidates = spans.filter(s => {
    const { u, v } = unitAxes(s.angle), dx = p.x - s.x, dz = p.z - s.z;
    return Math.abs(dx * u.x + dz * u.z) <= s.length / 2 + .05 && Math.abs(dx * v.x + dz * v.z) <= s.depth / 2 + .05
      && Math.abs(p.y - s.y - s.height) < .1;
  });
  const margin = (s: KitchenSpan) => { const g = runOffsets(p, s); return Math.min(g.left, g.right, g.back, g.front); };
  const facing = unitAxes(p.angle).u, alignment = (s: KitchenSpan) => { const { u } = unitAxes(s.angle); return Math.abs(u.x * facing.x + u.z * facing.z); };
  return candidates.sort((a, b) => Number(margin(b) >= -.05) - Number(margin(a) >= -.05)
    || alignment(b) - alignment(a) || margin(b) - margin(a))[0];
}
export function runOffsets(p: PlacedPiece, run: KitchenSpan) {
  const { u, v } = unitAxes(run.angle), dx = p.x - run.x, dz = p.z - run.z;
  const s = dx * u.x + dz * u.z + run.length / 2, t = dx * v.x + dz * v.z + run.depth / 2;
  const axes = unitAxes(p.angle), corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
    x: p.x + axes.u.x * x! * p.design.w / 2 + axes.v.x * z! * p.design.d / 2,
    z: p.z + axes.u.z * x! * p.design.w / 2 + axes.v.z * z! * p.design.d / 2 }));
  const xs = corners.map(q => (q.x - run.x) * u.x + (q.z - run.z) * u.z + run.length / 2);
  const zs = corners.map(q => (q.x - run.x) * v.x + (q.z - run.z) * v.z + run.depth / 2);
  return { s, t, left: Math.min(...xs), right: run.length - Math.max(...xs), back: Math.min(...zs), front: run.depth - Math.max(...zs) };
}
/** True centre coordinates from the left finished end and finished face of the supporting wall. */
export function fixtureDatum(studio: Studio | undefined, p: PlacedPiece, pieces: readonly PlacedPiece[]) {
  if (!studio) return undefined;
  const run = fixtureRun(p, pieces), owner = pieces.find(q => run?.units.includes(q.id));
  const wall = studio.walls.find(w => w.id === (p.wall ?? owner?.wall)), g = wall && wallGeometry(studio, wall);
  if (!g) return undefined;
  const dx = p.x - g.face.from.x, dz = p.z - g.face.from.z;
  const letters = studio.walls.filter(w => wallGeometry(studio, w));
  return { wall: String.fromCharCode(65 + letters.findIndex(w => w.id === wall!.id)),
    along: dx * g.line.ux + dz * g.line.uz, normal: dx * g.line.nx + dz * g.line.nz };
}
export function fixturePosition(studio: Studio | undefined, p: PlacedPiece, pieces: readonly PlacedPiece[]): string[] {
  const datum = fixtureDatum(studio, p, pieces);
  if (datum) return ['CL ' + mm(datum.along) + ' from Wall ' + datum.wall + ' left', 'CL ' + mm(datum.normal) + ' from Wall ' + datum.wall + ' face'];
  const run = fixtureRun(p, pieces);
  if (run) {
    const offsets = runOffsets(p, run), marks = run.units.map(id => pieces.find(q => q.id === id)!.mark);
    return ['Run ' + marks.join('/') + ': CL ' + mm(offsets.s) + ' from left', 'CL ' + mm(offsets.t) + ' from worktop back'];
  }
  return ['Scene CL X ' + mm(p.x) + '; Z ' + mm(p.z), 'Rotation ' + p.angle + ' deg; no worktop datum'];
}
/** One readable callout per fixture or appliance housing; shared by plan and PDF. */
export function appliancePlanNote(studio: Studio | undefined, p: PlacedPiece, pieces: readonly PlacedPiece[]): Item[] {
  const allocations = applianceAllocations(p), fixture = worktopFixture(p);
  if (!fixture && !allocations.length) return [];
  const names = fixture ? pieceName(p) : [...new Set(allocations.map(a => a.name))].join(' / ');
  const size = mm(p.design.w) + ' W × ' + mm(p.design.d) + ' D';
  const lines = [p.mark + ' ' + names + ' · ' + size + (fixture ? ' overall' : ' housing')];
  if (fixture) lines.push(...fixturePosition(studio, p, pieces));
  return [note(local(p, 0, p.design.d / 2 + 28), lines)];
}
export function applianceReview(pieces: readonly PlacedPiece[]): DrawingIssue[] {
  const out: DrawingIssue[] = [];
  for (const p of pieces) {
    const allocations = applianceAllocations(p), fixture = worktopFixture(p);
    if (!fixture && !allocations.length) continue;
    out.push({ id: 'appliance-spec:' + p.id, kind: 'unconfirmed', severity: 'review', marks: [p.mark], at: plan(p.x, p.z),
      message: p.mark + ': confirm manufacturer ' + (fixture ? 'cut-out, corner radii, fixing and edge clearances' : 'appliance size, niche, ventilation and service clearances'),
      rule: 'Current dimensions describe the model; manufacturer installation data is not recorded' });
    if (!fixture) continue;
    const run = fixtureRun(p, pieces);
    if (!run) out.push({ id: 'worktop:' + p.id, kind: 'geometry', severity: 'warning', marks: [p.mark], at: plan(p.x, p.z),
      message: p.mark + ': no supporting worktop at the modeled mounting level', rule: 'Worktop support and placement' });
    else if (Object.entries(runOffsets(p, run)).some(([key, value]) => !['s', 't'].includes(key) && value < -.05))
      out.push({ id: 'worktop-edge:' + p.id, kind: 'geometry', severity: 'warning', marks: [p.mark], at: plan(p.x, p.z),
        message: p.mark + ': overall footprint extends beyond its worktop', rule: 'Overall footprint containment; manufacturer cut-out still unconfirmed' });
  }
  return out;
}
export function applianceSchedule(studio: Studio | undefined, pieces: readonly PlacedPiece[]): Table | undefined {
  const rows: string[][] = [];
  for (const p of pieces) {
    if (worktopFixture(p)) {
      const run = fixtureRun(p, pieces), gaps = run && runOffsets(p, run);
      rows.push([p.mark + ' ' + pieceName(p), mm(p.design.w) + ' W × ' + mm(p.design.d) + ' D overall; model H ' + mm(p.design.h),
        fixturePosition(studio, p, pieces).join('; ') + '; mounting FFL ' + mm(p.y),
        gaps ? 'Worktop edge gaps L/R/back/front: ' + [gaps.left, gaps.right, gaps.back, gaps.front].map(mm).join('/') : 'No supporting worktop',
        'UNCONFIRMED: cut-out, radii, fixings and edge clearances']);
    }
    for (const a of applianceAllocations(p)) rows.push([a.reference + ' ' + a.name,
      mm(a.width) + ' W × ' + mm(a.height) + ' H allocation; carcass clear D ' + mm(a.depth),
      'In ' + p.mark + ': left ' + mm(a.x) + '; bottom FFL ' + mm(p.y + a.y),
      'Housing ' + mm(p.design.w) + ' W × ' + mm(p.design.h) + ' H × ' + mm(p.design.d) + ' D',
      'UNCONFIRMED: actual appliance, niche, ventilation and services']);
  }
  return rows.length ? { columns: ['Reference / item', 'Modeled dimensions (mm)', 'Setting out (mm)', 'Surrounding geometry (mm)', 'Manufacturer installation data'],
    numeric: [], rows, notes: ['CL = centre line. Wall left is the left finished end seen in that wall elevation. FFL = finished floor.',
      'Overall sizes, modeled allocations and worktop edge gaps are not cut-out or manufacturer niche sizes. Do not cut until installation data is confirmed.'] } : undefined;
}
