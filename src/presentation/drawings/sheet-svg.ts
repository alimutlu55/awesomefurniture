import type { Item, Sheet } from '../../domain/drawings/drawing';
import { type Box, dimensionSvg } from './dimension-svg';
import { ARROW, LIST_ROW, PAPER, TITLE, type Paper, drawingArea, layoutSheet } from './sheet-layout';
import { tableSvg } from './table-svg';

/** What the title block says about the whole set. */
export interface SheetSetInfo { readonly project: string; readonly date: string; readonly total: number }

const f = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Line weights on paper (ISO 128): cut 0.5, seen outlines 0.35, thin 0.18, hidden 0.25 dashed, centre lines chain. */
const STYLE = `
.cut{stroke:#111;stroke-width:.5;fill:none;stroke-linejoin:miter}.outline{stroke:#111;stroke-width:.35;fill:none}
.thin{stroke:#333;stroke-width:.18;fill:none}.hidden{stroke:#333;stroke-width:.25;fill:none;stroke-dasharray:2 1}
.centre{stroke:#333;stroke-width:.18;fill:none;stroke-dasharray:6 1 1 1}.swing{stroke:#333;stroke-width:.18;fill:none;stroke-dasharray:3 1.5}.glass{fill:#e4ecf2}
.dl{stroke:#111;stroke-width:.13}.dt{stroke:#111;stroke-width:.35}
text{font-family:Helvetica,Arial,sans-serif;fill:#111}.dv{font-size:3.2px;text-anchor:middle}
.nt{font-size:3px}.ns{font-size:2.4px;fill:#444}.ck{font-size:2.9px;fill:#b3261e;font-weight:700}.tg circle{fill:#fff;stroke:#111;stroke-width:.25}.tg text{font-size:2.9px;text-anchor:middle;dominant-baseline:central;font-weight:600}
.vm circle{fill:#fff;stroke:#111;stroke-width:.3}.vm path{fill:#111}.vm text{font-size:3.4px;text-anchor:middle;dominant-baseline:central;font-weight:700}
.frame{fill:#fff;stroke:#111;stroke-width:.7}.tb{fill:none;stroke:#111;stroke-width:.35}.tbl{stroke:#111;stroke-width:.18}
.tk{font-size:2.2px;fill:#555}.tv{font-size:3.4px}.tp{font-size:5px;font-weight:700}.vt{font-size:4.2px;font-weight:700}.vs{font-size:3.2px}
.ls{font-size:2.7px}.vc{font-size:3.6px;font-weight:700;text-anchor:middle}.th{font-size:3px;font-weight:700}.td{font-size:3px}.tbh{stroke:#111;stroke-width:.35}.lm{font-size:2.7px;font-weight:700}`;

/** A note's box on paper with its text moved `shift` along its own up direction. */
function noteBox(text: readonly string[], small: boolean, c: { x: number; y: number }, angle: number, shift: number): Box {
  const size = small ? 2.4 : 3, w = Math.max(...text.map(l => l.length)) * size * .52, th = -angle * Math.PI / 180;
  const local = [[-w / 2, -size * .8 - shift], [w / 2, -size * .8 - shift], [w / 2, size * .3 + (text.length - 1) * 3.6 - shift], [-w / 2, size * .3 + (text.length - 1) * 3.6 - shift]];
  const pts = local.map(([x, y]) => ({ x: c.x + x! * Math.cos(th) - y! * Math.sin(th), y: c.y + x! * Math.sin(th) + y! * Math.cos(th) }));
  return { x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)) };
}
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** Shifts tried for a note that lands on a mark or a figure, nearest first. Paper millimetres. */
const SHIFTS = [0, 3.6, -3.6, 7.2, -7.2, 10.8, -10.8, 14.4];

function item(i: Item, paper: Paper, hatch: string, taken: Box[]): string {
  switch (i.kind) {
    case 'line': {
      const pts = i.points.map(paper).map(p => f(p.x) + ',' + f(p.y)).join(' ');
      const fill = i.fill === 'hatch' ? ` style="fill:url(#${hatch})"` : i.fill === 'glass' ? ' style="fill:#e4ecf2"' : '';
      return i.closed ? `<polygon class="${i.stroke}" points="${pts}"${fill}/>` : `<polyline class="${i.stroke}" points="${pts}"/>`;
    }
    case 'dims': return dimensionSvg(i, paper, taken);
    case 'tag': {
      const c = paper(i.at);
      taken.push({ x0: c.x - 3.6, x1: c.x + 3.6, y0: c.y - 3.6, y1: c.y + 3.6 });
      return `<g class="tg"><circle cx="${f(c.x)}" cy="${f(c.y)}" r="3.4"/><text x="${f(c.x)}" y="${f(c.y)}">${esc(i.text)}</text></g>`;
    }
    case 'arrow': {
      const c = paper(i.at), d = { x: i.dir.x, y: -i.dir.y }, tip = { x: c.x + d.x * ARROW, y: c.y + d.y * ARROW };
      const barb = (turn: number) => ({ x: tip.x - (d.x * Math.cos(turn) - d.y * Math.sin(turn)) * 1.8, y: tip.y - (d.x * Math.sin(turn) + d.y * Math.cos(turn)) * 1.8 });
      const a = barb(.45), b = barb(-.45);
      return `<path class="outline" d="M${f(c.x)} ${f(c.y)}L${f(tip.x)} ${f(tip.y)}M${f(a.x)} ${f(a.y)}L${f(tip.x)} ${f(tip.y)}L${f(b.x)} ${f(b.y)}"/>`;
    }
    case 'note': {
      // Moved along its own up direction until it is clear of the marks, figures and notes already placed.
      const c = paper(i.at), angle = i.angle ?? 0, small = !!i.small, th = -angle * Math.PI / 180;
      const shift = SHIFTS.find(k => !taken.some(t => hits(t, noteBox(i.lines, small, c, angle, k)))) ?? 0;
      taken.push(noteBox(i.lines, small, c, angle, shift));
      const at = { x: c.x + Math.sin(th) * shift, y: c.y - Math.cos(th) * shift };
      const lines = i.lines.map((l, k) => `<tspan x="0" dy="${k ? 3.6 : 0}">${esc(l)}</tspan>`).join('');
      return `<text class="${small ? 'ns' : 'nt'}" text-anchor="${i.align}" transform="translate(${f(at.x)} ${f(at.y)}) rotate(${f(-angle)})">${lines}</text>`;
    }
    case 'view-mark': {
      const c = paper(i.at), d = { x: i.dir.x, y: -i.dir.y }, s = { x: -d.y, y: d.x }, tip = { x: c.x + d.x * 7, y: c.y + d.y * 7 };
      const b1 = { x: c.x + d.x * 3 + s.x * 3, y: c.y + d.y * 3 + s.y * 3 }, b2 = { x: c.x + d.x * 3 - s.x * 3, y: c.y + d.y * 3 - s.y * 3 };
      taken.push({ x0: c.x - 4, x1: c.x + 4, y0: c.y - 4, y1: c.y + 4 });
      return `<g class="vm"><path d="M${f(tip.x)} ${f(tip.y)}L${f(b1.x)} ${f(b1.y)}L${f(b2.x)} ${f(b2.y)}Z"/><circle cx="${f(c.x)}" cy="${f(c.y)}" r="3.6"/>`
        + `<text x="${f(c.x)}" y="${f(c.y)}">${esc(i.text)}</text></g>`;
    }
  }
}

/** The title block (bottom right) and, to its left, the list of the pieces on the sheet. */
function titleBlock(sheet: Sheet, scale: string, info: SheetSetInfo, strip: number): string {
  const x = PAPER.w - PAPER.edge - TITLE.w, y = PAPER.h - PAPER.edge - strip, w = TITLE.w, r = (yy: number) => `<line class="tbl" x1="${x}" y1="${f(yy)}" x2="${x + w}" y2="${f(yy)}"/>`;
  const cell = (cx: number, cy: number, key: string, value: string, cls = 'tv') => `<text class="tk" x="${f(cx + 1.5)}" y="${f(cy + 3)}">${esc(key)}</text><text class="${cls}" x="${f(cx + 1.5)}" y="${f(cy + 8)}">${esc(value)}</text>`;
  const top = PAPER.h - PAPER.edge - TITLE.h;
  let out = `<rect class="tb" x="${x}" y="${f(y)}" width="${w}" height="${f(strip)}"/>`;
  out += `<text class="tk" x="${x + 1.5}" y="${f(top + 3)}">Project</text><text class="tp" x="${x + 1.5}" y="${f(top + 9)}">${esc(info.project)}</text>`;
  out += r(top + 11) + cell(x, top + 11, 'Drawing', sheet.title) + cell(x + 110, top + 11, 'Sheet', sheet.number + ' of ' + info.total);
  out += r(top + 22) + cell(x, top + 22, 'Scale', scale) + cell(x + 40, top + 22, 'Units', 'millimetres') + cell(x + 110, top + 22, 'Date', info.date);
  out += `<line class="tbl" x1="${x + 108}" y1="${f(top + 11)}" x2="${x + 108}" y2="${f(top + 33)}"/><line class="tbl" x1="${x + 38}" y1="${f(top + 22)}" x2="${x + 38}" y2="${f(top + 33)}"/>`;
  // The list of pieces: two columns across the rest of the strip.
  const lx = PAPER.left, lw = x - lx, col = lw / 2, rows = Math.ceil(sheet.pieces.length / 2);
  out += `<rect class="tb" x="${lx}" y="${f(y)}" width="${f(lw)}" height="${f(strip)}"/>`;
  out += `<text class="tk" x="${lx + 2}" y="${f(y + 3.5)}">Pieces · width × height × depth · door triangles point to the hinges · verify every dimension on site before making; do not scale from the drawing</text>`;
  sheet.checks.forEach((c, k) => { out += `<text class="ck" x="${lx + 2}" y="${f(y + 8.5 + k * LIST_ROW)}">Check before making: ${esc(c)}</text>`; });
  const first = y + 8.5 + sheet.checks.length * LIST_ROW;
  sheet.pieces.forEach((p, k) => {
    const cx = lx + 2 + Math.floor(k / rows) * col, cy = first + (k % rows) * LIST_ROW;
    out += `<text class="lm" x="${f(cx)}" y="${f(cy)}">${esc(p.mark)}</text><text class="ls" x="${f(cx + 7)}" y="${f(cy)}">${esc(p.name)}</text>`
      + `<text class="ls" x="${f(cx + 38)}" y="${f(cy)}">${esc(p.size)}</text><text class="ls" x="${f(cx + 66)}" y="${f(cy)}">${esc(p.where)}</text>`;
  });
  return out;
}

/** One sheet as an A3 SVG drawn in paper millimetres: frame, the view's title and scale, the drawing, the list of
 * pieces and the title block. Self-contained, so it prints and shows the same. */
export function sheetSvg(sheet: Sheet, info: SheetSetInfo): string {
  const { scale, placed } = layoutSheet(sheet), area = drawingArea(sheet), hatch = 'hatch-' + sheet.number, ratio = sheet.table ? '—' : '1:' + scale;
  const defs = `<defs><style>${STYLE}</style><pattern id="${hatch}" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="1.4" height="1.4" fill="#fff"/><line x1="0" y1="0" x2="0" y2="1.4" stroke="#333" stroke-width=".13"/></pattern></defs>`;
  const frame = `<rect class="frame" x="0" y="0" width="${PAPER.w}" height="${PAPER.h}" style="stroke:none"/>`
    + `<rect class="frame" x="${PAPER.left}" y="${PAPER.edge}" width="${PAPER.w - PAPER.left - PAPER.edge}" height="${PAPER.h - 2 * PAPER.edge}"/>`;
  const heading = `<text class="vt" x="${area.x}" y="${PAPER.edge + 8}">${esc(sheet.number + '  ' + sheet.title)}</text>`
    + `<text class="vs" x="${area.x + 4 + sheet.title.length * 2.6 + 6}" y="${PAPER.edge + 8}">${ratio}</text>`;
  // Lines first, then figures and marks, then the notes placed clear of them; each view titled under it.
  const ORDER = { line: 0, arrow: 1, dims: 2, tag: 3, 'view-mark': 3, note: 4 } as const, taken: Box[] = [];
  let body = placed.map(({ view, paper }) => view.items.slice().sort((a, b) => ORDER[a.kind] - ORDER[b.kind]).map(i => item(i, paper, hatch, taken)).join('')).join('');
  if (placed.length > 1) body += placed.map(({ view, box }) => `<text class="vc" x="${f((box.x0 + box.x1) / 2)}" y="${f(box.y1 + 6)}">${esc(view.title)}  1:${scale}</text>`).join('');
  if (sheet.table) body += tableSvg(sheet.table, { x: area.x, y: area.y, w: area.w });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAPER.w} ${PAPER.h}" width="${PAPER.w}mm" height="${PAPER.h}mm" role="img" aria-label="${esc(sheet.title)}">`
    + defs + frame + heading + `<g class="drawing">${body}</g>` + titleBlock(sheet, ratio, info, area.strip) + '</svg>';
}
