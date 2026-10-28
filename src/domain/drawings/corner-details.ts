import { cornerStripWidth } from '../kitchen/corner-widths';
import { unitAxes } from '../kitchen/kitchen-runs';
import { kitchenFrontThickness } from '../kitchen/installation-parts';
import { installedCorners, cornerJointFindings, type InstalledCorner } from './corner-joints';
import { pieceBoards } from './unit-detail';
import { type Item, type Sheet, type View, line, mm, note, stops } from './drawing';
import type { PlacedPiece } from './room-pieces';

/** A local plan centred on the two carcass front planes. It follows the real pose, including mirrored,
 * rotated, offset and near-square installations. All board polygons come from the cutting-list geometry. */
function jointPlan(j: InstalledCorner, pieces: readonly PlacedPiece[]): View {
  const a = j.other, b = j.owner, axes = unitAxes(b.angle), oa = unitAxes(a.angle);
  const end = { x: b.x + axes.u.x * j.side * b.design.w / 2 + axes.v.x * b.design.d / 2,
    z: b.z + axes.u.z * j.side * b.design.w / 2 + axes.v.z * b.design.d / 2 };
  const origin = { x: end.x + axes.u.x * j.side * j.bodyGap, z: end.z + axes.u.z * j.side * j.bodyGap };
  const at = (x: number, z: number) => ({ x: mm(-j.side * ((x - origin.x) * axes.u.x + (z - origin.z) * axes.u.z)),
    y: mm((x - origin.x) * axes.v.x + (z - origin.z) * axes.v.z) });
  const out: Item[] = [];
  // Crop only the board outlines, never the setting-out dimensions. Keep the detail large enough
  // to read the butt joint at 1:2 on A3, rather than shrinking it to fit irrelevant cabinet depth.
  const x0 = -80, x1 = Math.max(80, mm(j.bodyGap) + 80), y0 = -80, y1 = 80;
  const clip = (points: { x: number; y: number }[]) => {
    for (const [axis, bound, sign] of [['x', x0, 1], ['x', x1, -1], ['y', y0, 1], ['y', y1, -1]] as const) {
      const input = points; points = [];
      input.forEach((p, k) => {
        const q = input[(k + 1) % input.length]!, inside = sign * (p[axis] - bound) >= 0, next = sign * (q[axis] - bound) >= 0;
        if (inside) points.push(p);
        if (inside !== next) {
          const t = (bound - p[axis]) / (q[axis] - p[axis]);
          points.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
        }
      });
    }
    return points;
  };
  const cutHeight = (Math.max(a.y, b.y) + Math.min(a.y + a.design.h, b.y + b.design.h)) / 2;
  for (const p of pieces.filter(p => !p.fixture).sort((a, b) => a.id - b.id)) {
    const { u, v } = unitAxes(p.angle);
    for (const board of pieceBoards(p, pieces).filter(s => p.y + s.y0 <= cutHeight && p.y + s.y1 >= cutHeight)) {
      const polygon = clip([[board.x0, board.z0], [board.x1, board.z0], [board.x1, board.z1], [board.x0, board.z1]].map(([x, z]) =>
        at(p.x + u.x * (x! - p.design.w / 2) + v.x * (z! - p.design.d / 2),
          p.z + u.z * (x! - p.design.w / 2) + v.z * (z! - p.design.d / 2))));
      if (polygon.length > 2) out.push({ kind: 'line', stroke: 'cut', closed: true, fill: 'hatch', points: polygon });
    }
  }
  const plane = { x: a.x + oa.v.x * a.design.d / 2, z: a.z + oa.v.z * a.design.d / 2 };
  for (const thickness of [0, kitchenFrontThickness(a.design)]) {
    const p = at(plane.x + oa.v.x * thickness, plane.z + oa.v.z * thickness), dir = at(plane.x + oa.v.x * thickness + oa.u.x, plane.z + oa.v.z * thickness + oa.u.z);
    const dx = dir.x - p.x, dy = dir.y - p.y;
    if (dy) out.push(line({ x: p.x + (y0 - p.y) * dx / dy, y: y0 },
      { x: p.x + (y1 - p.y) * dx / dy, y: y1 }, thickness ? 'hidden' : 'centre'));
  }
  const dimension = (values: number[], row: number): Item => ({ kind: 'dims', origin: { x: 0, y: y0 }, dir: { x: 1, y: 0 },
    side: -1, clear: 0, row, stops: stops(values.map(mm)) });
  out.push(dimension([0, j.frontProjection, j.bodyGap], 0), dimension([0, j.requiredGap], 1));
  if (j.blind) out.push({ kind: 'dims', origin: { x: x0, y: 0 }, dir: { x: 0, y: 1 }, side: 1,
    clear: 0, row: 0, stops: stops([0, mm(cornerStripWidth(a.design))]) });
  out.push(note({ x: x0, y: y1 + 70 }, a.mark + ' carcass / finished face', 'start'),
    note({ x: x1, y: y1 + 25 }, b.mark + ' module edge', 'end'));
  return { title: 'Horizontal section at joint - actual installed geometry', items: out };
}

/** One enlarged sheet per installed corner, independent of whether its contents use a corner mechanism. */
export function cornerDetails(pieces: readonly PlacedPiece[]): Sheet[] {
  const findings = cornerJointFindings(pieces);
  return installedCorners(pieces).filter(j => j.blind || j.owner.id < j.other.id).map(j => ({
    number: 0, title: 'Corner ' + j.other.mark + ' / ' + j.owner.mark,
    legend: ['Carcass datum -> front thickness -> return strip. Outer: specified; inner: actual. Confirm handle / mechanism opening clearance.',
      j.blind ? 'Butt joint: ' + mm(j.requiredGap) + ' allocation = ' + mm(j.frontProjection) + ' overlap + ' + mm(j.stripWidth) + ' return strip (mm).'
        : 'Open corner: two full strips; adjoining front thickness is additional.'],
    views: [jointPlan(j, pieces)], pieces: [],
    checks: findings.filter(f => f.marks.includes(j.owner.mark) && f.marks.includes(j.other.mark)).map(f => f.message),
  }));
}
