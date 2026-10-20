import { unitAxes } from '../kitchen/kitchen-runs';
import type { Studio } from '../studio/studio';
import { type Item, type P, type Sheet, mm, rect, line, note, stops } from './drawing';
import { type PlacedPiece, pieceName } from './room-pieces';
import { applianceAllocations, fixturePosition, fixtureRun, runOffsets, worktopFixture } from './appliance-setout';

const at = (x: number, y: number): P => ({ x: mm(x), y: mm(y) });
const dimension = (origin: P, dir: P, values: number[], side: 1 | -1, row = 0): Item =>
  ({ kind: 'dims', origin, dir, stops: stops(values.map(mm)), side, row, clear: 0 });

/** Overall footprint and actual setting-out from the worktop edges; never a fabricated cutting template. */
function fixtureSheet(studio: Studio | undefined, p: PlacedPiece, pieces: readonly PlacedPiece[]): Sheet {
  const { w, d, h } = p.design, reference = fixturePosition(studio, p, pieces);
  const overall: Item[] = [rect(0, -mm(d), mm(w), 0, 'outline'),
    line(at(w / 2, 8), at(w / 2, -d), 'centre'), line(at(-8, -d / 2), at(w, -d / 2), 'centre'),
    dimension(at(0, -d), { x: 1, y: 0 }, [0, w], -1), dimension(at(w, 0), { x: 0, y: -1 }, [0, d], 1),
    { kind: 'tag', at: at(w / 2, -d / 2), text: p.mark },
    note(at(w / 2, 34), [pieceName(p) + ' · overall footprint', 'Model H ' + mm(h) + '; mounting datum FFL ' + mm(p.y)])];
  const views = [{ title: 'Overall model size', items: overall }], run = fixtureRun(p, pieces);
  if (run) {
    const { u, v } = unitAxes(run.angle), axes = unitAxes(p.angle), gap = runOffsets(p, run);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => {
      const x = p.x + axes.u.x * s! * w / 2 + axes.v.x * t! * d / 2 - run.x;
      const z = p.z + axes.u.z * s! * w / 2 + axes.v.z * t! * d / 2 - run.z;
      return at(x * u.x + z * u.z + run.length / 2, -(x * v.x + z * v.z + run.depth / 2));
    });
    const position: Item[] = [rect(0, -mm(run.depth), mm(run.length), 0, 'outline'),
      { kind: 'line', points: corners, closed: true, stroke: 'thin' },
      line(at(gap.s, 10), at(gap.s, -run.depth), 'centre'),
      line(at(0, -gap.t), at(run.length + 10, -gap.t), 'centre'),
      dimension(at(0, -run.depth), { x: 1, y: 0 }, [0, gap.s, run.length], -1),
      dimension(at(0, -run.depth), { x: 1, y: 0 }, [0, run.length], -1, 1),
      dimension(at(0, 0), { x: 0, y: -1 }, [0, gap.t, run.depth], -1),
      { kind: 'tag', at: at(gap.s, -gap.t), text: p.mark },
      note(at(run.length / 2, 36), reference),
      note(at(run.length / 2, -run.depth - 65), [
        'Overall edge gaps: left ' + mm(gap.left) + '; right ' + mm(gap.right),
        'Back ' + mm(gap.back) + '; front ' + mm(gap.front) + ' · worktop ' + mm(run.height) + ' thick'])];
    views.push({ title: 'Centre-line setting out on worktop', items: position });
  } else overall.push(note(at(w / 2, -d - 45), [...reference, 'Supporting worktop is unconfirmed']));
  return { number: 0, title: p.mark + ' ' + pieceName(p) + ' setting out', views, pieces: [],
    legend: ['Dimensions in mm · CL = centre line · FFL = finished floor · wall left is defined by its elevation',
      'Overall footprint and edge gaps are modeled geometry; cut-out, radii and fixing requirements remain UNCONFIRMED'],
    checks: [p.mark + ': confirm manufacturer cutting template before making the worktop'] };
}
/** Each allocated appliance bay shown separately from the appliance's own front or body dimensions. */
function allocationSheet(p: PlacedPiece): Sheet | undefined {
  const allocations = applianceAllocations(p);
  if (!allocations.length) return undefined;
  const { w, h } = p.design, out: Item[] = [rect(0, mm(p.y), mm(w), mm(p.y + h), 'outline'),
    dimension(at(0, p.y), { x: 1, y: 0 }, [0, w], -1),
    dimension(at(0, 0), { x: 0, y: 1 }, [0, p.y, p.y + h], 1),
    line(at(-12, 0), at(w + 12, 0), 'thin')];
  for (const a of allocations) {
    const y = p.y + a.y;
    out.push(rect(mm(a.x), mm(y), mm(a.x + a.width), mm(y + a.height), 'thin'),
      note(at(a.x + a.width / 2, y + a.height / 2), [a.reference + ' ' + a.name,
        mm(a.width) + ' W × ' + mm(a.height) + ' H allocation',
        'Left ' + mm(a.x) + '; bottom FFL ' + mm(y)]));
  }
  out.push(note(at(w / 2, p.y + h + 25), [p.mark + ' housing: ' + mm(w) + ' W × ' + mm(h) + ' H × ' + mm(p.design.d) + ' D',
    'Clear carcass depth ' + mm(allocations[0]!.depth) + ' · verify ventilation and services']));
  return { number: 0, title: p.mark + ' appliance allocations', views: [{ title: 'Modeled housing allocations', items: out }], pieces: [],
    legend: ['Dimensions in mm · allocated bay sizes are taken from the current cabinet layout · FFL = finished floor',
      'Actual appliance body/front, installation niche, ventilation and service requirements remain UNCONFIRMED'],
    checks: [p.mark + ': confirm manufacturer installation dimensions before manufacture'] };
}
export function applianceDetailSheets(studio: Studio | undefined, pieces: readonly PlacedPiece[]): Sheet[] {
  return pieces.flatMap(p => {
    if (worktopFixture(p)) return [fixtureSheet(studio, p, pieces)];
    const sheet = allocationSheet(p);
    return sheet ? [sheet] : [];
  });
}
