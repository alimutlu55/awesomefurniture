import type { Studio } from '../studio/studio';
import { cornerDegree, wallExtent } from '../studio/studio';
import { isWallUtility, wallUtilitySpec } from '../studio/wall-utilities';
import { kitchenSpans, unitAxes } from '../kitchen/kitchen-runs';
import { kitchenUnit, WORKTOP } from '../kitchen/kitchen-units';
import { isKitchen } from '../furniture/furniture';
import { type Dimensions, type Item, type Line, type P, line, mm, note, stops } from './drawing';
import { type PlacedPiece, wallGeometry } from './room-pieces';
import { openingNote } from './opening-notes';
import { freePosition, pieceSymbols, plan } from './plan-symbols';
import { pieceOperations } from './plan-operations';
import { planClearances, roomDoorOperation } from './plan-clearances';
import { planEndBreak } from './shell-boundaries';


/** An angle turned to read from the bottom or the right of the sheet. Degrees. */
const readable = (deg: number) => deg > 90.01 ? deg - 180 : deg <= -90 ? deg + 180 : deg;

/** The corners of a piece's footprint, or of any box standing at `angle`. */
function footprint(x: number, z: number, angle: number, w: number, d: number): P[] {
  const { u, v } = unitAxes(angle), at = (s: number, t: number) => plan(x + u.x * s + v.x * t, z + u.z * s + v.z * t);
  return [at(-w / 2, -d / 2), at(w / 2, -d / 2), at(w / 2, d / 2), at(-w / 2, d / 2)];
}

/** Walls cut at window-sill height: hatched solid between the openings, mitred where two walls meet; a window is
 * three thin lines across its opening, a door or archway a clear gap. */
function walls(studio: Studio, pieces: readonly PlacedPiece[]): Item[] {
  const out: Item[] = [];
  for (const w of studio.walls) {
    const g = wallGeometry(studio, w);
    if (!g) continue;
    const { line: l, face } = g, half = w.thickness / 2, { start, end } = wallExtent(studio, w, l.length);
    const at = (t: number, s: number) => plan(l.a.x + l.ux * t + l.nx * s, l.a.z + l.uz * t + l.nz * s);
    const holes = g.openings.filter(o => !isWallUtility(o.kind)).map(o => [o.offset - o.width / 2, o.offset + o.width / 2] as const);
    let from = start;
    for (const [a, b] of [...holes, [end, end] as const]) {
      if (a > from + .05) {
        // The room face stops where it meets the next wall's face; the outer face runs to the corner: a mitre.
        const inner0 = Math.max(from, face.start), inner1 = Math.min(a, face.end);
        out.push({ kind: 'line', stroke: 'cut', closed: true, fill: 'hatch', points: [at(inner0, half), at(inner1, half), at(a, -half), at(from, -half)] });
      }
      from = Math.max(from, b);
    }
    if (cornerDegree(studio, w.a) === 1) out.push(planEndBreak(at, start, half));
    if (cornerDegree(studio, w.b) === 1) out.push(planEndBreak(at, end, half));
    for (const o of g.openings) {
      const a = o.offset - o.width / 2, b = o.offset + o.width / 2;
      if (o.kind === 'window') for (const s of [-half, 0, half]) out.push(line(at(a, s * .7), at(b, s * .7), 'thin'));
      else if (o.kind === 'door') out.push(...roomDoorOperation(at, a, half, o.width).items);
      else if (isWallUtility(o.kind)) {
        const depth = wallUtilitySpec(o.kind)?.depth ?? 3;
        out.push({ kind: 'line', stroke: 'thin', closed: true, points: [at(a, half), at(b, half), at(b, half + depth), at(a, half + depth)] });
        if (o.kind !== 'radiator') out.push(line(at(o.offset, half), at(o.offset, half + depth + 6), 'centre'));
      }
      // Written in the room, clear of whatever stands in front of the opening.
      const before = pieces.filter(p => p.wall === w.id && p.hi > a && p.lo < b).map(p => p.off + p.design.d);
      out.push(note(at(o.offset, half + Math.max(0, ...before) + 15), openingNote(o), 'middle', readable(Math.atan2(-l.uz, l.ux) * 180 / Math.PI)));
    }
  }
  return out;
}

/** A string of dimensions along wall `w`'s room face, on the outside of the wall. */
function along(studio: Studio, wallId: string, values: readonly number[], row: number): Dimensions | null {
  const w = studio.walls.find(x => x.id === wallId), g = w && wallGeometry(studio, w);
  if (!g) return null;
  const { line: l, face } = g, inside = (t: number) => Math.max(face.start, Math.min(face.end, t));
  return { kind: 'dims', origin: plan(face.from.x, face.from.z), dir: { x: l.ux, y: -l.uz }, side: 1, clear: mm(w!.thickness), row,
    stops: stops([0, mm(face.length), ...values.map(t => mm(inside(t) - face.start))]) };
}

/** For each wall: the pieces standing on the floor against it with the gaps beside them, then the openings and the
 * centre lines of sinks and hobs, then the wall's whole length; and how deep the run stands out from it. */
function wallDimensions(studio: Studio, pieces: readonly PlacedPiece[]): Item[] {
  const out: Item[] = [];
  for (const w of studio.walls) {
    const g = wallGeometry(studio, w);
    if (!g) continue;
    const mine = pieces.filter(p => p.wall === w.id), floor = mine.filter(p => !p.hung && !p.fixture);
    const centres = mine.filter(p => p.fixture === 'sink' || p.fixture === 'hob').map(p => (p.lo + p.hi) / 2);
    // Wall units and shelves get their own row: they are set out on the wall, not on the floor.
    const units = floor.flatMap(p => [p.lo, p.hi]), hung = mine.filter(p => p.hung).flatMap(p => [p.lo, p.hi]);
    const openings = [...g.openings.flatMap(o => [o.offset - o.width / 2, o.offset + o.width / 2]), ...centres];
    const rows = [units, hung, openings].filter(r => r.length);
    [...rows, []].forEach((values, row) => { const dims = along(studio, w.id, values, row); if (dims) out.push(dims); });
    if (!floor.length) continue;
    // Depth from the wall: the deepest carcass, and the worktop's front where one runs over them. Drawn at the end of
    // the run with more room beside it, so it stays clear of a run along the next wall.
    const { line: l, face } = g, left = Math.min(...floor.map(p => p.lo)), right = Math.max(...floor.map(p => p.hi));
    const deepest = Math.max(...floor.map(p => p.off + p.design.d)), atRight = face.end - right > left - face.start;
    const worktop = floor.some(p => isKitchen(p.design) && kitchenUnit(p.design.unit).worktop) ? deepest + WORKTOP.overhang : deepest;
    const t = (atRight ? right : left) - face.start, origin = { x: face.from.x + l.ux * t, z: face.from.z + l.uz * t };
    out.push({ kind: 'dims', origin: plan(origin.x, origin.z), dir: { x: l.nx, y: -l.nz }, side: atRight ? 1 : -1, clear: 0, row: 0,
      stops: stops([0, mm(deepest), mm(worktop)]) });
  }
  return out;
}

/** The plan: walls cut and hatched, openings with their sizes, every piece's footprint with its mark (wall-hung
 * pieces dashed, as they are above the cut), worktops, and the dimension strings. Pieces standing free carry
 * their own width and depth. */
export function planView(studio: Studio | undefined, pieces: readonly PlacedPiece[]): Item[] {
  const out: Item[] = studio ? walls(studio, pieces) : [];
  const poses = pieces.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, angle: p.angle, state: p.design }));
  for (const s of kitchenSpans(poses)) {
    if (s.kind === 'worktop') out.push({ kind: 'line', stroke: 'outline', closed: true, points: footprint(s.x, s.z, s.angle, s.length, s.depth) });
  }
  for (const p of pieces) {
    const stroke: Line['stroke'] = p.hung ? 'hidden' : p.fixture ? 'thin' : 'outline';
    out.push({ kind: 'line', stroke, closed: true, points: footprint(p.x, p.z, p.angle, p.design.w, p.design.d) });
    if (p.fixture === 'sink' || p.fixture === 'hob') {
      // Its centre line, from the wall out past its front: what the plumber and electrician set out from.
      const { v: f } = unitAxes(p.angle), reach = p.design.d / 2 + 8;
      out.push(line(plan(p.x - f.x * reach, p.z - f.z * reach), plan(p.x + f.x * reach, p.z + f.z * reach), 'centre'));
    }
    // A wall unit's mark sits towards the wall, so it never covers the mark of the unit under it.
    const { v } = unitAxes(p.angle), back = p.hung ? -p.design.d / 4 : p.fixture ? 0 : p.design.d / 8;
    out.push({ kind: 'tag', at: plan(p.x + v.x * back, p.z + v.z * back), text: p.mark });
    out.push(...pieceSymbols(p), ...pieceOperations(p).flatMap(o => o.items));
    if (p.wall === null) {
      out.push(...freePosition(p, pieces, studio));
      const [a, b, , d] = footprint(p.x, p.z, p.angle, p.design.w, p.design.d);
      const dir = (q: P) => { const n = Math.hypot(q.x, q.y) || 1; return { x: q.x / n, y: q.y / n }; };
      out.push({ kind: 'dims', origin: a!, dir: dir({ x: b!.x - a!.x, y: b!.y - a!.y }), side: -1, clear: 0, row: 0, stops: [0, mm(p.design.w)] });
      out.push({ kind: 'dims', origin: a!, dir: dir({ x: d!.x - a!.x, y: d!.y - a!.y }), side: 1, clear: 0, row: 0, stops: [0, mm(p.design.d)] });
    }
  }
  if (studio) out.push(...wallDimensions(studio, pieces));
  out.push(...planClearances(studio, pieces).items);
  return out;
}
