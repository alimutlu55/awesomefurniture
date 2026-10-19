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
 * line, read from the bottom or the right of the sheet. A figure too long for its space steps up beside it, alternately,
 * so neighbours never sit on each other. Each figure's box is added to `figures`, for notes to keep clear of.
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
  let stepped = 0;
  for (let k = 0; k < d.stops.length - 1; k++) {
    const s0 = d.stops[k]!, s1 = d.stops[k + 1]!, text = String(Math.round((s1 - s0) * 10) / 10), room = (s1 - s0) / paper.scale;
    const lift = room >= figureWidth(text) ? 0 : (stepped++ % 2 === 0 ? DIM.text + 1.2 : 2 * (DIM.text + 1.2));
    const c = at((s0 + s1) / 2, off), half = figureWidth(text) / 2, mid = up(c, angle, .9 + lift + DIM.text / 2), rad = angle * Math.PI / 180;
    const ex = Math.abs(Math.cos(rad)) * half + Math.abs(Math.sin(rad)) * DIM.text / 2, ey = Math.abs(Math.sin(rad)) * half + Math.abs(Math.cos(rad)) * DIM.text / 2;
    figures.push({ x0: mid.x - ex, x1: mid.x + ex, y0: mid.y - ey, y1: mid.y + ey });
    marks.push(words(up(c, angle, .9 + lift), text, 'figure', 'middle', angle));
    if (!lift) stepped = 0;
  }
  return marks;
}
