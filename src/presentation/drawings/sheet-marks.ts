import type { Item, Sheet } from '../../domain/drawings/drawing';
import { type Box, dimensionMarks } from './dimension-marks';
import { ARROW, LIST_ROW, PAPER, TITLE, type Paper, drawingArea, layoutSheet } from './sheet-layout';
import { tableMarks } from './table-marks';
import { type Mark, type Pen, type Pt, box, marksToSvg, shape, words } from './paper-marks';

/** What the title block says about the whole set. */
export interface SheetSetInfo { readonly project: string; readonly date: string; readonly total: number }

/** A note's box on paper with its text moved `shift` along its own up direction. */
function noteBox(text: readonly string[], small: boolean, c: Pt, angle: number, shift: number): Box {
  const size = small ? 2.4 : 3, w = Math.max(...text.map(l => l.length)) * size * .52, th = -angle * Math.PI / 180;
  const local = [[-w / 2, -size * .8 - shift], [w / 2, -size * .8 - shift], [w / 2, size * .3 + (text.length - 1) * 3.6 - shift], [-w / 2, size * .3 + (text.length - 1) * 3.6 - shift]];
  const pts = local.map(([x, y]) => ({ x: c.x + x! * Math.cos(th) - y! * Math.sin(th), y: c.y + x! * Math.sin(th) + y! * Math.cos(th) }));
  return { x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)) };
}
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** Shifts tried for a note that lands on a mark or a figure, nearest first. Paper millimetres. */
const SHIFTS = [0, 3.6, -3.6, 7.2, -7.2, 10.8, -10.8, 14.4];

function item(i: Item, paper: Paper, taken: Box[]): Mark[] {
  switch (i.kind) {
    case 'line': return [shape(i.points.map(paper), i.stroke as Pen, !!i.closed, i.fill)];
    case 'dims': return dimensionMarks(i, paper, taken);
    case 'tag': {
      const c = paper(i.at);
      taken.push({ x0: c.x - 3.6, x1: c.x + 3.6, y0: c.y - 3.6, y1: c.y + 3.6 });
      return [{ kind: 'circle', c, r: 3.4, pen: 'ring', fill: 'white' }, words(c, i.text, 'tag', 'middle', 0, true)];
    }
    case 'arrow': {
      const c = paper(i.at), d = { x: i.dir.x, y: -i.dir.y }, tip = { x: c.x + d.x * ARROW, y: c.y + d.y * ARROW };
      const barb = (turn: number) => ({ x: tip.x - (d.x * Math.cos(turn) - d.y * Math.sin(turn)) * 1.8, y: tip.y - (d.x * Math.sin(turn) + d.y * Math.cos(turn)) * 1.8 });
      return [shape([c, tip], 'outline'), shape([barb(.45), tip, barb(-.45)], 'outline')];
    }
    case 'note': {
      // Moved along its own up direction until it is clear of the marks, figures and notes already placed.
      const c = paper(i.at), angle = i.angle ?? 0, small = !!i.small, th = -angle * Math.PI / 180;
      const shift = SHIFTS.find(k => !taken.some(t => hits(t, noteBox(i.lines, small, c, angle, k)))) ?? 0;
      taken.push(noteBox(i.lines, small, c, angle, shift));
      const at = { x: c.x + Math.sin(th) * shift, y: c.y - Math.cos(th) * shift };
      return i.lines.map((l, k) => words({ x: at.x - 3.6 * k * Math.sin(th), y: at.y + 3.6 * k * Math.cos(th) }, l, small ? 'small' : 'note', i.align, -angle));
    }
    case 'view-mark': {
      const c = paper(i.at), d = { x: i.dir.x, y: -i.dir.y }, s = { x: -d.y, y: d.x }, tip = { x: c.x + d.x * 7, y: c.y + d.y * 7 };
      const b1 = { x: c.x + d.x * 3 + s.x * 3, y: c.y + d.y * 3 + s.y * 3 }, b2 = { x: c.x + d.x * 3 - s.x * 3, y: c.y + d.y * 3 - s.y * 3 };
      taken.push({ x0: c.x - 4, x1: c.x + 4, y0: c.y - 4, y1: c.y + 4 });
      return [shape([tip, b1, b2], 'none', true, 'black'), { kind: 'circle', c, r: 3.6, pen: 'ring', fill: 'white' }, words(c, i.text, 'mark', 'middle', 0, true)];
    }
  }
}

/** The title block (bottom right) and, to its left, the list of the pieces on the sheet. */
function titleBlock(sheet: Sheet, scale: string, info: SheetSetInfo, strip: number): Mark[] {
  const x = PAPER.w - PAPER.edge - TITLE.w, y = PAPER.h - PAPER.edge - strip, w = TITLE.w, top = PAPER.h - PAPER.edge - TITLE.h;
  const rule = (x0: number, y0: number, x1: number, y1: number) => shape([{ x: x0, y: y0 }, { x: x1, y: y1 }], 'rule');
  const cell = (cx: number, cy: number, key: string, value: string) => [words({ x: cx + 1.5, y: cy + 3 }, key, 'key'), words({ x: cx + 1.5, y: cy + 8 }, value, 'value')];
  const out: Mark[] = [box(x, y, x + w, y + strip, 'heavy'), words({ x: x + 1.5, y: top + 3 }, 'Project', 'key'), words({ x: x + 1.5, y: top + 9 }, info.project, 'project'),
    rule(x, top + 11, x + w, top + 11), ...cell(x, top + 11, 'Drawing', sheet.title), ...cell(x + 110, top + 11, 'Sheet', sheet.number + ' of ' + info.total),
    rule(x, top + 22, x + w, top + 22), ...cell(x, top + 22, 'Scale', scale), ...cell(x + 40, top + 22, 'Units', 'millimetres'), ...cell(x + 110, top + 22, 'Date', info.date),
    rule(x + 108, top + 11, x + 108, top + 33), rule(x + 38, top + 22, x + 38, top + 33)];
  // The list of pieces: two columns across the rest of the strip.
  const lx = PAPER.left, lw = x - lx, col = lw / 2, rows = Math.ceil(sheet.pieces.length / 2);
  out.push(box(lx, y, lx + lw, y + strip, 'heavy'),
    words({ x: lx + 2, y: y + 3.5 }, 'Pieces · width × height × depth · door triangles point to the hinges · verify every dimension on site before making; do not scale from the drawing', 'key'));
  sheet.checks.forEach((c, k) => out.push(words({ x: lx + 2, y: y + 8.5 + k * LIST_ROW }, 'Check before making: ' + c, 'check')));
  const first = y + 8.5 + sheet.checks.length * LIST_ROW;
  sheet.pieces.forEach((p, k) => {
    const cx = lx + 2 + Math.floor(k / rows) * col, cy = first + (k % rows) * LIST_ROW;
    out.push(words({ x: cx, y: cy }, p.mark, 'listMark'), words({ x: cx + 7, y: cy }, p.name, 'list'), words({ x: cx + 38, y: cy }, p.size, 'list'), words({ x: cx + 66, y: cy }, p.where, 'list'));
  });
  return out;
}

/** One sheet as marks on A3 paper: frame, the title and scale, the views (lines first, then figures and marks, then the
 * notes placed clear of them, each view titled under it), a schedule, the list of pieces and the title block. */
export function sheetMarks(sheet: Sheet, info: SheetSetInfo): Mark[] {
  const { scale, placed } = layoutSheet(sheet), area = drawingArea(sheet), ratio = sheet.table ? '—' : '1:' + scale;
  const out: Mark[] = [box(0, 0, PAPER.w, PAPER.h, 'none', 'white'), box(PAPER.left, PAPER.edge, PAPER.w - PAPER.edge, PAPER.h - PAPER.edge, 'frame'),
    words({ x: area.x, y: PAPER.edge + 8 }, sheet.number + '  ' + sheet.title, 'heading')];
  if (!sheet.table) out.push(words({ x: area.x + 4 + sheet.title.length * 2.6 + 6, y: PAPER.edge + 8 }, ratio, 'scale'));
  const ORDER = { line: 0, arrow: 1, dims: 2, tag: 3, 'view-mark': 3, note: 4 } as const, taken: Box[] = [];
  for (const { view, paper } of placed) out.push(...view.items.slice().sort((a, b) => ORDER[a.kind] - ORDER[b.kind]).flatMap(i => item(i, paper, taken)));
  if (placed.length > 1) for (const { view, box: b } of placed) out.push(words({ x: (b.x0 + b.x1) / 2, y: b.y1 + 6 }, view.title + '  1:' + scale, 'caption', 'middle'));
  if (sheet.table) out.push(...tableMarks(sheet.table, { x: area.x, y: area.y, w: area.w }));
  out.push(...titleBlock(sheet, ratio, info, area.strip));
  return out;
}

/** One sheet as a self-contained A3 SVG drawn in paper millimetres, to show on screen. */
export const sheetSvg = (sheet: Sheet, info: SheetSetInfo) => marksToSvg(sheetMarks(sheet, info), { w: PAPER.w, h: PAPER.h }, String(sheet.number), sheet.title);
