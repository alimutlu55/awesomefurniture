import type { Studio } from '../studio/studio';
import { wallExtent } from '../studio/studio';
import { wallUtilitySpec } from '../studio/wall-utilities';
import { kitchenSpans, unitAxes } from '../kitchen/kitchen-runs';
import { type Item, type P, mm, note } from './drawing';
import { local, plan } from './plan-symbols';
import { pieceOperations, quarterArc, type Operation } from './plan-operations';
import { wallGeometry, type PlacedPiece } from './room-pieces';

/** A design-review reference, in mm; this is not a building-code certification. */
export const AISLE_REFERENCE = 900;
interface Obstacle { key: string; group: string; points: readonly P[]; owners: readonly number[]; bottom: number; top: number }
interface Clearance { piece: PlacedPiece; target: Obstacle; from: P; to: P; distance: number }
const footprint = (p: Pick<PlacedPiece, 'x' | 'z' | 'angle'>, w: number, d: number) =>
  [local(p, -w / 2, -d / 2), local(p, w / 2, -d / 2), local(p, w / 2, d / 2), local(p, -w / 2, d / 2)];
const group = (p: PlacedPiece) => {
  const { v } = unitAxes(p.angle);
  return p.wall ?? `run:${mm(p.angle)}:${mm(p.x * v.x + p.z * v.z + p.design.d / 2)}`;
};

/** Solid floor obstructions: furniture, actual worktop overhangs, wall solids and radiator projections.
 * Floor-level doors/archways are gaps. Window walls still obstruct walking underneath their sills. */
function obstacles(studio: Studio | undefined, pieces: readonly PlacedPiece[]): Obstacle[] {
  const out: Obstacle[] = pieces.filter(p => !p.fixture).map(p => ({ key: 'piece:' + p.id, group: group(p), owners: [p.id],
    points: footprint(p, p.design.w, p.design.d), bottom: p.y, top: p.y + p.design.h }));
  for (const span of kitchenSpans(pieces.map(p => ({ ...p, state: p.design })))) {
    if (span.kind !== 'worktop') continue;
    const owners = span.units.map(Number), owner = pieces.find(p => p.id === owners[0])!;
    out.push({ key: 'worktop:' + owners.join(','), group: group(owner), owners,
      points: footprint(span, span.length, span.depth), bottom: span.y, top: span.y + span.height });
  }
  for (const wall of studio?.walls ?? []) {
    const g = wallGeometry(studio!, wall);
    if (!g) continue;
    const { line: l } = g, half = wall.thickness / 2;
    const at = (t: number, n: number) => plan(l.a.x + l.ux * t + l.nx * n, l.a.z + l.uz * t + l.nz * n);
    const extent = wallExtent(studio!, wall, l.length);
    const holes = g.openings.filter(o => (o.kind === 'door' || o.kind === 'archway') && o.sill <= .05);
    let start = extent.start;
    for (const [a, b] of [...holes.map(o => [o.offset - o.width / 2, o.offset + o.width / 2]), [extent.end, extent.end]]) {
      const end = Math.min(a!, extent.end);
      if (end > start) out.push({ key: wall.id, group: wall.id, owners: [], bottom: 0, top: wall.height,
        points: [at(start, -half), at(end, -half), at(end, half), at(start, half)] });
      start = Math.max(start, b!);
    }
    for (const o of g.openings.filter(o => o.kind === 'radiator')) {
      const depth = wallUtilitySpec(o.kind)?.depth ?? 10, a = o.offset - o.width / 2, b = o.offset + o.width / 2;
      out.push({ key: o.id, group: o.id, owners: [], bottom: o.sill, top: o.sill + o.height,
        points: [at(a, half), at(b, half), at(b, half + depth), at(a, half + depth)] });
    }
  }
  return out;
}

/** Clip a convex polygon against a half-plane. Distances and vertices are in drawing millimetres. */
function clip(points: readonly P[], distance: (p: P) => number): P[] {
  const out: P[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!, da = distance(a), db = distance(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  });
  return out;
}

/** Minimum over the entire front width, including obstacle corners between the old three sample rays. */
function clearance(p: PlacedPiece, solids: readonly Obstacle[]): Clearance | undefined {
  const { u, v } = unitAxes(p.angle), front = local(p, 0, p.design.d / 2), half = mm(p.design.w) / 2 - 1;
  const overhang = Math.max(0, ...solids.filter(s => s.owners.includes(p.id)).flatMap(s => s.points)
    .map(q => (q.x - front.x) * v.x - (q.y - front.y) * v.z));
  const origin = { x: front.x + v.x * overhang, y: front.y - v.z * overhang };
  const project = (q: P): P => ({ x: (q.x - origin.x) * u.x - (q.y - origin.y) * u.z,
    y: (q.x - origin.x) * v.x - (q.y - origin.y) * v.z });
  const world = (q: P): P => ({ x: origin.x + q.x * u.x + q.y * v.x, y: origin.y - q.x * u.z - q.y * v.z });
  let best: Clearance | undefined;
  for (const target of solids) {
    if (target.owners.includes(p.id) || target.group === group(p) || target.bottom >= 210) continue;
    let polygon = target.points.map(project);
    polygon = clip(clip(clip(polygon, q => q.x + half), q => half - q.x), q => q.y);
    if (!polygon.length) continue;
    const nearest = polygon.reduce((a, b) => b.y < a.y ? b : a), distance = Math.round(nearest.y);
    if (!best || distance < best.distance) best = { piece: p, target, from: world({ x: nearest.x, y: 0 }), to: world(nearest), distance };
  }
  return best;
}

/** Convex swept sectors and rectangles; a touch at the closed face is not a collision. */
function intersects(a: readonly P[], b: readonly P[]): boolean {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!, n = { x: q.y - p.y, y: p.x - q.x };
    const length = Math.hypot(n.x, n.y);
    if (length < .01) continue;
    const project = (points: readonly P[]) => points.map(v => (v.x * n.x + v.y * n.y) / length);
    const aa = project(a), bb = project(b);
    if (Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) <= 1) return false;
  }
  return true;
}

/** Room doors use a left hinge and inward 90° swing until the room model supports handing. */
export function roomDoorOperation(at: (s: number, t: number) => P, left: number, face: number, width: number, height = 205): Operation {
  const pivot = at(left, face), arc = quarterArc(at, left, face, width, 1);
  return { points: [pivot, ...arc], bottom: 0, top: height, items: [{ kind: 'line', stroke: 'swing', points: arc },
    { kind: 'line', stroke: 'swing', points: [pivot, arc.at(-1)!] }] };
}

export function planClearances(studio: Studio | undefined, pieces: readonly PlacedPiece[]): { items: Item[]; checks: string[] } {
  const solids = obstacles(studio, pieces), items: Item[] = [], checks: string[] = [], runs = new Map<string, Clearance>();
  for (const p of pieces.filter(p => !p.hung && !p.fixture)) {
    const gap = clearance(p, solids);
    if (!gap) continue;
    const key = [group(p), gap.target.group].sort().join('|'), prev = runs.get(key);
    if (!prev || gap.distance < prev.distance) runs.set(key, gap);
  }
  for (const gap of runs.values()) {
    const { from, to, distance, piece } = gap, n = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance > 0) items.push({ kind: 'dims', origin: from, dir: { x: (to.x - from.x) / n, y: (to.y - from.y) / n },
      side: 1, row: 0, clear: 0, stops: [0, distance] });
    items.push(note({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, 'Aisle min ' + distance));
    if (distance < AISLE_REFERENCE) checks.push(piece.mark + ' aisle clearance ' + distance + ' is below the ' + AISLE_REFERENCE + ' review reference');
  }
  for (const p of pieces) {
    const clashes = new Set<string>();
    for (const operation of pieceOperations(p)) for (const solid of solids) {
      if (solid.owners.includes(p.id) || solid.bottom >= operation.top || solid.top <= operation.bottom) continue;
      if (intersects(operation.points, solid.points)) clashes.add(solid.owners.length ? pieces.find(q => q.id === solid.owners[0])!.mark : solid.key);
    }
    for (const target of clashes) checks.push(p.mark + ' opening envelope meets ' + target);
  }
  for (const wall of studio?.walls ?? []) {
    const g = wallGeometry(studio!, wall);
    if (!g) continue;
    const { line: l } = g;
    const at = (t: number, n: number) => plan(l.a.x + l.ux * t + l.nx * n, l.a.z + l.uz * t + l.nz * n);
    for (const door of g.openings.filter(o => o.kind === 'door')) {
      const operation = roomDoorOperation(at, door.offset - door.width / 2, wall.thickness / 2, door.width, door.height);
      const clashes = new Set<string>();
      for (const solid of solids) {
        if (solid.top <= door.sill || solid.bottom >= door.sill + door.height) continue;
        if (intersects(operation.points, solid.points)) clashes.add(solid.owners.length ? pieces.find(p => p.id === solid.owners[0])!.mark : solid.key);
      }
      for (const target of clashes) checks.push('Door ' + door.id + ' opening envelope meets ' + target);
    }
  }
  return { items, checks };
}
