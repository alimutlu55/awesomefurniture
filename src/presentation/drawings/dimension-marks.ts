import type { Dimensions } from '../../domain/drawings/drawing';
import { DIM, type Paper, dimOffset, normal } from './sheet-layout';
import { type Mark, type Pt, shape, words } from './paper-marks';

/** A box on paper, millimetres. */
export interface Box { x0: number; x1: number; y0: number; y1: number }
/** Width of a dimension figure on paper, about. */
const figureWidth = (text: string) => text.length * DIM.text * .62 + 1;
/** A point `k` up from `c` in the frame of words turned `deg` clockwise. */
const up = (c: Pt, deg: number, k: number): Pt => { const r = deg * Math.PI / 180; return { x: c.x + Math.sin(r) * k, y: c.y - Math.cos(r) * k }; };

/**
 * A dimension string drawn as architects and joiners draw one (ISO 129): thin extension lines from just off the measured
 * points, a thin dimension line through them, a short heavy 45° tick at each stop, and each figure written above its
 * line, read from the bottom or the right of the sheet. Short segments spread their figures along the string, with leaders to their true midpoints,
 * so neighbours and adjacent dimension tiers stay clear. Each figure's box is added to `figures`, for notes to keep clear of.
 */
export function dimensionMarks(d: Dimensions, paper: Paper, figures: Box[] = []): Mark[] {
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
  const labels = d.stops.slice(1).map((s1, k) => {
    const s0 = d.stops[k]!, text = String(Math.round((s1 - s0) * 10) / 10);
    return { text, mid: (s0 + s1) / 2, width: figureWidth(text) };
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
    const { text, mid: measured, width } = labels[k]!, position = centres[k]!;
    const c = at(position, off), half = width / 2, baseline = 2.2, mid = up(c, angle, baseline + DIM.text / 2), rad = angle * Math.PI / 180;
    if (Math.abs(position - measured) / paper.scale > .2) {
      marks.push(shape([at(measured, off), at(position, off + 1.8)], 'dim'));
    }
    const ex = Math.abs(Math.cos(rad)) * half + Math.abs(Math.sin(rad)) * DIM.text / 2, ey = Math.abs(Math.sin(rad)) * half + Math.abs(Math.cos(rad)) * DIM.text / 2;
    figures.push({ x0: mid.x - ex, x1: mid.x + ex, y0: mid.y - ey, y1: mid.y + ey });
    marks.push(words(up(c, angle, baseline), text, 'figure', 'middle', angle));
  }
  return marks;
}
