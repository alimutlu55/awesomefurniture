import type { Box } from './dimension-marks';
import { textWidth } from './helvetica-metrics';
import { fontOf, type Mark, type Pt, type Words, shape } from './paper-marks';

export interface AnnotationOffset { readonly x: number; readonly y: number }
export type AnnotationOffsets = Readonly<Record<string, AnnotationOffset>>;
export interface Anchor { readonly key: string; readonly at: Pt; readonly box: Box; readonly offset: Pt }
export const intersectsBox = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
export function wordBox(m: Words): Box {
  const font = fontOf(m.font), w = textWidth(m.text, font.size, font.bold), h = font.size;
  const left = m.anchor === 'middle' ? -w / 2 : m.anchor === 'end' ? -w : 0;
  const top = m.central ? -h / 2 : -h * .8, a = m.angle * Math.PI / 180;
  const points = [[left, top], [left + w, top], [left + w, top + h], [left, top + h]].map(([x, y]) =>
    ({ x: m.at.x + x! * Math.cos(a) - y! * Math.sin(a), y: m.at.y + x! * Math.sin(a) + y! * Math.cos(a) }));
  return { x0: Math.min(...points.map(p => p.x)) - .5, x1: Math.max(...points.map(p => p.x)) + .5,
    y0: Math.min(...points.map(p => p.y)) - .5, y1: Math.max(...points.map(p => p.y)) + .5 };
}
function bounds(marks: readonly Mark[]): Box {
  const boxes = marks.flatMap(m => m.kind === 'text' ? [wordBox(m)] : m.kind === 'circle'
    ? [{ x0: m.c.x - m.r - .8, x1: m.c.x + m.r + .8, y0: m.c.y - m.r - .8, y1: m.c.y + m.r + .8 }]
    : [{ x0: Math.min(...m.points.map(p => p.x)) - .5, x1: Math.max(...m.points.map(p => p.x)) + .5,
      y0: Math.min(...m.points.map(p => p.y)) - .5, y1: Math.max(...m.points.map(p => p.y)) + .5 }]);
  return { x0: Math.min(...boxes.map(b => b.x0)), x1: Math.max(...boxes.map(b => b.x1)),
    y0: Math.min(...boxes.map(b => b.y0)), y1: Math.max(...boxes.map(b => b.y1)) };
}
const inside = (b: Box, area: Box) => b.x0 >= area.x0 && b.x1 <= area.x1 && b.y0 >= area.y0 && b.y1 <= area.y1;
function segmentHits(a: Pt, b: Pt, box: Box): boolean {
  let lo = 0, hi = 1;
  for (const [p, d, min, max] of [[a.x, b.x - a.x, box.x0, box.x1], [a.y, b.y - a.y, box.y0, box.y1]]) {
    if (Math.abs(d!) < 1e-9) { if (p! < min! || p! > max!) return false; }
    else { const u = (min! - p!) / d!, v = (max! - p!) / d!; lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v)); }
  }
  return lo <= hi;
}
export function geometrySegments(marks: readonly Mark[]): readonly [Pt, Pt][] {
  return marks.flatMap(m => {
    if (m.kind !== 'shape') return [];
    const pts = m.closed ? [...m.points, m.points[0]!] : m.points;
    return pts.slice(1).map((p, i) => [pts[i]!, p] as [Pt, Pt]);
  });
}
function leaderStart(source: Pt, end: Pt, boxes: readonly Box[]): Pt {
  const dx = end.x - source.x, dy = end.y - source.y;
  let t = 0;
  for (const b of boxes) {
    if (source.x < b.x0 || source.x > b.x1 || source.y < b.y0 || source.y > b.y1) continue;
    const tx = dx > 0 ? (b.x1 - source.x) / dx : dx < 0 ? (b.x0 - source.x) / dx : Infinity;
    const ty = dy > 0 ? (b.y1 - source.y) / dy : dy < 0 ? (b.y0 - source.y) / dy : Infinity;
    t = Math.max(t, Math.min(tx, ty) + .002);
  }
  return { x: source.x + dx * Math.min(1, t), y: source.y + dy * Math.min(1, t) };
}
function shifted(m: Mark, dx: number, dy: number): Mark {
  const at = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  if (m.kind === 'text') return { ...m, at: at(m.at) };
  if (m.kind === 'circle') return { ...m, c: at(m.c) };
  return { ...m, points: m.points.map(at) };
}

/** Paper-space placement with exact PDF font metrics, geometry avoidance and deterministic fallback lanes.
 * Unplaceable annotations become explicit review issues; they are never silently drawn over each other. */
export function annotationLayout(geometry: readonly Mark[], taken: Box[], area: Box, offsets: AnnotationOffsets = {}) {
  const segments = geometrySegments(geometry), anchors: Anchor[] = [], warnings: string[] = [];
  const place = (key: string, marks: readonly Mark[], source: Pt): Mark[] => {
    const base = bounds(marks), saved = offsets[key], candidates: Pt[] = saved ? [saved] : [];
    candidates.push({ x: 0, y: 0 });
    for (const radius of [8, 14, 22, 32, 45, 60]) for (const [x, y] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]])
      candidates.push({ x: x! * radius, y: y! * radius });
    // If the preferred neighbourhood is full, use empty paper in stable rows, nearest candidates first.
    const bank: Pt[] = [];
    for (let y = area.y0 + 6; y < area.y1 - 5; y += 5) for (let x = area.x0 + 8; x < area.x1 - 8; x += 6)
      bank.push({ x: x - (base.x0 + base.x1) / 2, y: y - (base.y0 + base.y1) / 2 });
    bank.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)); candidates.push(...bank);
    for (const offset of candidates) {
      const b = { x0: base.x0 + offset.x, x1: base.x1 + offset.x, y0: base.y0 + offset.y, y1: base.y1 + offset.y };
      if (!inside(b, area) || taken.some(t => intersectsBox(b, t)) || segments.some(([a, c]) => segmentHits(a, c, b))) continue;
      const centre = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, moved = Math.hypot(offset.x, offset.y) > .2;
      const edge = { x: Math.max(b.x0, Math.min(b.x1, source.x)), y: Math.max(b.y0, Math.min(b.y1, source.y)) };
      const start = leaderStart(source, edge, taken);
      let leader = [start, edge];
      if (moved && taken.some(t => segmentHits(start, edge, t))) {
        const bends = [{ x: start.x, y: edge.y }, { x: edge.x, y: start.y }];
        const bend = bends.find(p => !taken.some(t => segmentHits(start, p, t) || segmentHits(p, edge, t)));
        if (!bend) continue;
        leader = [start, bend, edge];
      }
      taken.push(b); anchors.push({ key, at: centre, box: b, offset });
      return [...(moved ? [shape(leader, 'thin')] : []), ...marks.map(m => shifted(m, offset.x, offset.y))];
    }
    warnings.push('Enlarged detail or label adjustment required: ' + key.split('/').at(-1));
    return [];
  };
  return { place, anchors, warnings };
}
