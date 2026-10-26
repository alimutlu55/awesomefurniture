import { fixtureSymbols } from './fixture-symbols';
import { planDimensions } from './plan-dimensions';
import type { Studio } from '../studio/studio';
import { cornerDegree, wallExtent } from '../studio/studio';
import { isWallUtility, wallUtilitySpec } from '../studio/wall-utilities';
import { kitchenSpans, unitAxes } from '../kitchen/kitchen-runs';
import { type Item, type Line, type P, line, mm, note, stops } from './drawing';
import { type PlacedPiece, pieceName, wallGeometry } from './room-pieces';
import { openingNote } from './opening-notes';
import { freePosition, pieceSymbols, plan } from './plan-symbols';
import { pieceOperations } from './plan-operations';
import { planClearances, roomDoorOperation } from './plan-clearances';
import type { DrawingOptions } from './view-policy';
import { appliancePlanNote } from './appliance-setout';
import { planEndBreak } from './shell-boundaries';
import { fixturePlan } from './fixture-plan';
import { cornerWidthStops } from './corner-widths';


/** An angle turned to read from the bottom or the right of the sheet. Degrees. */
const readable = (deg: number) => deg > 90.01 ? deg - 180 : deg <= -90 ? deg + 180 : deg;

/** The corners of a piece's footprint, or of any box standing at `angle`. */
function footprint(x: number, z: number, angle: number, w: number, d: number): P[] {
  const { u, v } = unitAxes(angle), at = (s: number, t: number) => plan(x + u.x * s + v.x * t, z + u.z * s + v.z * t);
  return [at(-w / 2, -d / 2), at(w / 2, -d / 2), at(w / 2, d / 2), at(-w / 2, d / 2)];
}

/** Walls cut at window-sill height: hatched solid between the openings, mitred where two walls meet; a window is
 * three thin lines across its opening, a door or archway a clear gap. */
function walls(studio: Studio, pieces: readonly PlacedPiece[], operations: boolean): Item[] {
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
      else if (o.kind === 'door' && o.hinge && o.swing) out.push(...roomDoorOperation(at, a, half, o.width, o.height, o.hinge, o.swing).items);
      else if (isWallUtility(o.kind)) {
        const depth = wallUtilitySpec(o.kind)?.depth ?? 3;
        out.push({ kind: 'line', stroke: 'thin', closed: true, points: [at(a, half), at(b, half), at(b, half + depth), at(a, half + depth)] });
        if (o.kind !== 'radiator') out.push(line(at(o.offset, half), at(o.offset, half + depth + 6), 'centre'));
      }
      // Written in the room, clear of whatever stands in front of the opening.
      const before = pieces.filter(p => p.wall === w.id && p.hi > a && p.lo < b).map(p => p.off + p.design.d);
      const describe = !isWallUtility(o.kind) || !pieces.some(p => !p.fixture);
      if (describe && (!operations || o.kind !== 'door' || (o.hinge && o.swing))) out.push(note(at(o.offset, half + Math.max(0, ...before) + 15), openingNote(o), 'middle', readable(Math.atan2(-l.uz, l.ux) * 180 / Math.PI)));
    }
  }
  return out;
}

/** The plan: walls cut and hatched, openings with their sizes, every piece's footprint with its mark (wall-hung
 * pieces dashed, as they are above the cut), worktops, and the dimension strings. Pieces standing free carry
 * their own width and depth. */
export function planView(studio: Studio | undefined, pieces: readonly PlacedPiece[], options: DrawingOptions = {}): Item[] {
  const preset = options.preset ?? 'installation', upper = options.upperPlan ?? false, operations = preset === 'clearances';
  const visible = pieces.filter(p => upper ? p.y >= 120 : p.y < 120);
  const out: Item[] = studio ? [...walls(studio, visible, operations), ...(upper ? [] : fixturePlan(studio))] : [];
  const poses = pieces.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, angle: p.angle, state: p.design }));
  for (const s of kitchenSpans(poses)) {
    if (!upper && s.kind === 'worktop') out.push({ kind: 'line', stroke: 'outline', closed: true, points: footprint(s.x, s.z, s.angle, s.length, s.depth) });
  }
  for (const p of pieces) {
    const shown = visible.includes(p);
    if (!shown && upper) continue;
    const stroke: Line['stroke'] = shown ? (p.fixture ? 'thin' : 'outline') : 'overhead';
    out.push({ kind: 'line', stroke, closed: true, points: footprint(p.x, p.z, p.angle, p.design.w, p.design.d) });
    if (!shown) {
      if (p.hung && !p.fixture) {
        const pts = footprint(p.x, p.z, p.angle, p.design.w, p.design.d);
        out.push(line(pts[0]!, pts[2]!, 'overhead'), line(pts[1]!, pts[3]!, 'overhead'));
      }
      continue;
    }
    out.push(...fixtureSymbols(p));
    if (p.fixture === 'sink' || p.fixture === 'hob') {
      // Its centre line, from the wall out past its front: what the plumber and electrician set out from.
      const { v: f } = unitAxes(p.angle), reach = p.design.d / 2 + 8;
      out.push(line(plan(p.x - f.x * reach, p.z - f.z * reach), plan(p.x + f.x * reach, p.z + f.z * reach), 'centre'));
    }
    // A wall unit's mark sits towards the wall, so it never covers the mark of the unit under it.
    const { v } = unitAxes(p.angle), back = p.hung ? -p.design.d / 4 : p.fixture ? 0 : p.design.d * .3;
    out.push({ kind: 'tag', at: plan(p.x + v.x * back, p.z + v.z * back), text: p.mark });
    if (p.fixture === 'shelf') out.push(note(plan(p.x + v.x * (p.design.d / 2 + 15), p.z + v.z * (p.design.d / 2 + 15)), pieceName(p)));
    // Appliance setting-out callouts have their own detail sheets; keep the cabinet plan clear.
    if (!studio && !operations) out.push(...appliancePlanNote(studio, p, pieces));
    if (!upper) out.push(...pieceSymbols(p, pieces).filter(i => operations || i.kind !== 'arrow'));
    if (operations) out.push(...pieceOperations(p, pieces).flatMap(o => o.items));
    if (p.wall === null) {
      out.push(...freePosition(p, visible, studio));
      const [a, b, , d] = footprint(p.x, p.z, p.angle, p.design.w, p.design.d);
      const dir = (q: P) => { const n = Math.hypot(q.x, q.y) || 1; return { x: q.x / n, y: q.y / n }; };
      out.push({ kind: 'dims', origin: a!, dir: dir({ x: b!.x - a!.x, y: b!.y - a!.y }), side: -1, clear: 0, row: 0, stops: [0, mm(p.design.w)] });
      out.push({ kind: 'dims', origin: a!, dir: dir({ x: d!.x - a!.x, y: d!.y - a!.y }), side: 1, clear: 0, row: 0, stops: [0, mm(p.design.d)] });
      const widths = cornerWidthStops(p, pieces);
      if (widths.length > 2) out.push({ kind: 'dims', origin: d!, dir: dir({ x: b!.x - a!.x, y: b!.y - a!.y }), side: 1, clear: 0, row: 0, stops: stops(widths.map(mm)) });
    }
  }
  if (studio) out.push(...planDimensions(studio, visible, pieces, preset === 'layout' || operations, upper));
  if (operations) out.push(...planClearances(studio, pieces, options.clearanceProfile).items);
  return out;
}
