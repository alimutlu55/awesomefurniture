import type { Dimensions } from '../../domain/drawings/drawing';
import { DIM, type Paper, dimOffset, normal } from './sheet-layout';

const f = (n: number) => String(Math.round(n * 100) / 100);
/** Width of a dimension figure on paper, about. */
const figureWidth = (text: string) => text.length * DIM.text * .62 + 1;

/**
 * A dimension string drawn as architects and joiners draw one (ISO 129): thin extension lines from just off the measured
 * points, a thin dimension line through them, a short heavy 45° tick at each stop, and each figure written above its
 * line, read from the bottom or the right of the sheet. A figure too long for its space steps up beside it, alternately,
 * so neighbours never sit on each other.
 */
export function dimensionSvg(d: Dimensions, paper: Paper): string {
  const n = normal(d), off = dimOffset(d, paper.scale), clear = d.clear / paper.scale + DIM.gap;
  // Paper directions: along the string and away from what it measures.
  const along = { x: d.dir.x, y: -d.dir.y }, out = { x: n.x, y: -n.y };
  const at = (s: number, k: number) => { const p = paper({ x: d.origin.x + d.dir.x * s, y: d.origin.y + d.dir.y * s }); return { x: p.x + out.x * k, y: p.y + out.y * k }; };
  const parts: string[] = [];
  const a = at(d.stops[0]!, off), b = at(d.stops[d.stops.length - 1]!, off);
  parts.push(`<line class="dl" x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}"/>`);
  // The tick leans the same way at every stop: along + out, a quarter turn from the line.
  const tick = { x: (along.x + out.x) * 1.1 / Math.SQRT2, y: (along.y + out.y) * 1.1 / Math.SQRT2 };
  for (const s of d.stops) {
    const e0 = at(s, clear), e1 = at(s, off + 1.5), c = at(s, off);
    parts.push(`<line class="dl" x1="${f(e0.x)}" y1="${f(e0.y)}" x2="${f(e1.x)}" y2="${f(e1.y)}"/>`);
    parts.push(`<line class="dt" x1="${f(c.x - tick.x)}" y1="${f(c.y - tick.y)}" x2="${f(c.x + tick.x)}" y2="${f(c.y + tick.y)}"/>`);
  }
  // Text reads from the bottom or the right: never upside down.
  let angle = Math.atan2(along.y, along.x) * 180 / Math.PI;
  if (angle > 89.99) angle -= 180; else if (angle < -90.01) angle += 180;
  let stepped = 0;
  for (let k = 0; k < d.stops.length - 1; k++) {
    const s0 = d.stops[k]!, s1 = d.stops[k + 1]!, text = String(s1 - s0), room = (s1 - s0) / paper.scale;
    const lift = room >= figureWidth(text) ? 0 : (stepped++ % 2 === 0 ? DIM.text + 1.2 : 2 * (DIM.text + 1.2));
    const c = at((s0 + s1) / 2, off);
    parts.push(`<text class="dv" transform="translate(${f(c.x)} ${f(c.y)}) rotate(${f(angle)})" y="${f(-0.9 - lift)}">${text}</text>`);
    if (!lift) stepped = 0;
  }
  return `<g class="dims">${parts.join('')}</g>`;
}
