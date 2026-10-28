import type { Dimensions } from '../../domain/drawings/drawing';
import { DIM, type Paper, dimOffset, normal } from './sheet-layout';
import { textWidth } from './helvetica-metrics';
import { fontOf, type Mark, type Pt, shape, words } from './paper-marks';

/** A box on paper, millimetres. */
export interface Box { x0: number; x1: number; y0: number; y1: number }
/** Width of a dimension figure on paper, about. */
const figureWidth = (text: string) => textWidth(text, fontOf('figure').size) + 1.2;
/** A point `k` up from `c` in the frame of words turned `deg` clockwise. */
const up = (c: Pt, deg: number, k: number): Pt => { const r = deg * Math.PI / 180; return { x: c.x + Math.sin(r) * k, y: c.y - Math.cos(r) * k }; };

/**
 * A dimension string drawn as architects and joiners draw one (ISO 129): thin extension lines from just off the measured
 * points, a thin dimension line through them, a short heavy 45° tick at each stop, and each figure written above its
 * line, read from the bottom or the right of the sheet. Short segments spread their figures along the string, with leaders to their true midpoints,
 * so neighbours and adjacent dimension tiers stay clear. Each figure's box is added to `figures`, for notes to keep clear of.
 */
export function dimensionCorridor(d: Dimensions, paper: Paper): Box {
  const n = normal(d), off = dimOffset(d, paper.scale), out = { x: n.x, y: -n.y };
  const at = (s: number, k: number) => { const p = paper({ x: d.origin.x + d.dir.x * s, y: d.origin.y + d.dir.y * s }); return { x: p.x + out.x * k, y: p.y + out.y * k }; };
  const pts = [d.stops[0]!, d.stops[d.stops.length - 1]!].flatMap(s => [at(s, off - .2), at(s, off + .2)]);
  return { x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)) };
}

export function dimensionMarks(d: Dimensions, paper: Paper, figures: Box[] = [], corridors: readonly Box[] = []): Mark[] {
  const n = normal(d), off = dimOffset(d, paper.scale), clear = d.clear / paper.scale + DIM.gap;
  // Paper directions: along the string and away from what it measures.
  const along = { x: d.dir.x, y: -d.dir.y }, out = { x: n.x, y: -n.y };
  const at = (s: number, k: number) => { const p = paper({ x: d.origin.x + d.dir.x * s, y: d.origin.y + d.dir.y * s }); return { x: p.x + out.x * k, y: p.y + out.y * k }; };
  const marks: Mark[] = [shape([at(d.stops[0]!, off), at(d.stops[d.stops.length - 1]!, off)], 'dim')];
  // The tick leans the same way at every stop: along + out, a quarter turn from the line.
  const tick = { x: (along.x + out.x) * 1.1 / Math.SQRT2, y: (along.y + out.y) * 1.1 / Math.SQRT2 };
  for (const s of d.stops) {
    const c = at(s, off);
    marks.push(shape([at(s, clear), at(s, off + 1.5)], 'dim'), shape([{ x: c.x - tick.x, y: c.y - tick.y }, { x: c.x + tick.x, y: c.y + tick.y }], 'tick'));
  }
  // Text reads from the bottom or the right: never upside down.
  let angle = Math.atan2(along.y, along.x) * 180 / Math.PI;
  if (angle > 89.99) angle -= 180; else if (angle < -90.01) angle += 180;
  // Pool adjacent labels until their centres are far enough apart along the measured line.
  // This keeps short zone dimensions legible inside their own tier instead of spilling into the next row.
  const quiet = new Set(d.quiet ?? []);
  const labels = d.stops.slice(1).flatMap((s1, k) => {
    const s0 = d.stops[k]!, text = String(Math.round((s1 - s0) * 10) / 10);
    return quiet.has(k) ? [] : [{ text, mid: (s0 + s1) / 2, width: figureWidth(text), s0, s1, first: k === 0, last: k === d.stops.length - 2 }];
  });
  const spacing = labels.map(() => 0);
  labels.forEach((l, k) => { if (k) spacing[k] = spacing[k - 1]! + (labels[k - 1]!.width + l.width) / 2 + .6; });
  const blocks: { first: number; last: number; sum: number; count: number }[] = [];
  labels.forEach((l, k) => {
    blocks.push({ first: k, last: k, sum: l.mid / paper.scale - spacing[k]!, count: 1 });
    while (blocks.length > 1) {
      const b = blocks.at(-1)!, a = blocks.at(-2)!;
      if (a.sum / a.count <= b.sum / b.count) break;
      blocks.splice(-2, 2, { first: a.first, last: b.last, sum: a.sum + b.sum, count: a.count + b.count });
    }
  });
  const centres = labels.map(() => 0);
  for (const b of blocks) for (let k = b.first; k <= b.last; k++) centres[k] = (b.sum / b.count + spacing[k]!) * paper.scale;
  for (let k = 0; k < labels.length; k++) {
    const { text, mid: measured, width } = labels[k]!;
    const half = width / 2, baseline = 2.2, rad = angle * Math.PI / 180;
    const ex = Math.abs(Math.cos(rad)) * half + Math.abs(Math.sin(rad)) * fontOf('figure').size / 2, ey = Math.abs(Math.sin(rad)) * half + Math.abs(Math.cos(rad)) * fontOf('figure').size / 2;
    const bounds = (position: number): Box => {
      const mid = up(at(position, off), angle, baseline + fontOf('figure').size / 2);
      return { x0: mid.x - ex, x1: mid.x + ex, y0: mid.y - ey, y1: mid.y + ey };
    };
    let position = centres[k]!, figure = bounds(position);
    const hits = (b: Box, q: Box, pad: number) => b.x0 < q.x1 + pad && b.x1 + pad > q.x0 && b.y0 < q.y1 + pad && b.y1 + pad > q.y0;
    const occupied = (b: Box) => figures.some(q => hits(b, q, .4)) || corridors.some(q => hits(b, q, .2));
    // Intersecting run-front and depth chains share the same figure reserve. Move only lettering along
    // its own tier; extension stops and measured values remain exact, with a leader to the true midpoint.
    if (occupied(figure)) for (let step = 1; step <= 30; step++) {
      const candidate = centres[k]! + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * paper.scale;
      const box = bounds(candidate);
      if (!occupied(box)) { position = candidate; figure = box; break; }
    }
    const c = at(position, off);
    if (Math.abs(position - measured) / paper.scale > 3.5) {
      marks.push(shape([at(measured, off), at(position, off + 1.8)], 'dim'));
    }
    figures.push(figure);
    marks.push(words(up(c, angle, baseline), text, 'figure', 'middle', angle));
  }
  return marks;
}
