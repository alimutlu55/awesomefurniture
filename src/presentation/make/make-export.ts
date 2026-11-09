import { partOperations } from '../../domain/make/part-operations';
import { flatOutline } from '../../domain/make/make-assembly';
import { type CutLayout, STOCK } from '../../domain/make/make-cut-layout';
import { cutWithBand, type MakePart, type MakePiece } from '../../domain/make/make-parts';
import { thinAxis } from '../../domain/make/make-measures';
import { box, type Mark, type Pt, shape, words } from '../drawings/paper-marks';
import { marksToPdf, type PdfImage } from '../drawings/pdf-writer';
import { PAPER } from '../drawings/sheet-layout';
import { hardwareDisplay } from './make-panel-tabs';
import { stepPages } from './make-steps-pdf';
import type { StepPicture } from './make-pictures';
import { drillingSummary, partDrilling } from './make-sheet';

/**
 * What Make saves: the piece's drawings as an A3 PDF (every part lying flat with its holes measured, the stock sheets
 * with the parts on them, the hardware to buy and the order it goes together) and its cut list as CSV, the columns a
 * panel saw or a cutting optimiser takes. Paper millimetres, y down, through the drawing set's own PDF writer.
 */
export interface ExportInfo {
  readonly title: string;
  readonly material: (decorId: string) => string;
  readonly band: number;
  readonly cut: CutLayout;
  /** Each step's pictures, taken from the film (make-pictures.ts); without them the steps are words only. */
  readonly pictures?: readonly StepPicture[];
}

const mm = (cm: number) => String(Number((cm*10).toPrecision(12)));
const csvCell = (v: string | number) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);

/** The cut list: one line a part, sizes in millimetres; the cut size has the edge banding taken off. */
export function cutListCsv(piece: MakePiece, material: (decorId: string) => string, bandMm: number): string {
  const head = ['Part', 'Name', 'Qty', 'Length mm', 'Width mm', 'Thickness mm', 'Material', 'Edge banding', 'Cut length mm', 'Cut width mm', 'Grain', 'Holes', 'Local machining mm'];
  const rows = piece.parts.map(p => {
    const cut = cutWithBand(p, bandMm), holes = drillingSummary(partDrilling(piece, p)).reduce((s, h) => s + h.qty, 0);
    return [p.n, p.name, p.boards.length, mm(p.cut.length), mm(p.cut.width), mm(p.cut.thickness), material(p.decorId), p.edges, mm(cut.length), mm(cut.width), 'length', holes, JSON.stringify(partOperations(piece, p))];
  });
  return [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const { w: PW, h: PH } = PAPER, M = 12, TITLE = 14;
const P = (x: number, y: number): Pt => ({ x, y });
const line = (a: Pt, b: Pt, pen: Parameters<typeof shape>[1] = 'thin') => shape([a, b], pen);

/** The frame and title strip every page has. */
function frame(info: ExportInfo, piece: MakePiece, page: number, pages: number, heading: string): Mark[] {
  const y = PH - M - TITLE, { w, h, d } = piece.size;
  return [box(M, M, PW - M, PH - M, 'frame'), line(P(M, y), P(PW - M, y), 'outline'),
    words(P(M + 4, y + 9), info.title, 'project'), words(P(150, y + 9), heading, 'heading'),
    words(P(270, y + 9), `${mm(w)} × ${mm(h)} × ${mm(d)} mm`, 'value'), words(P(PW - M - 4, y + 9), `${page} / ${pages}`, 'value', 'end')];
}

/** One part lying flat in a cell: its face, banded edges heavy, holes (a dashed ring on the face under it), grooves,
 * its length and width, and every hole's distance from the corner. */
function partCell(piece: MakePiece, part: MakePart, info: ExportInfo, x0: number, y0: number, cw: number, ch: number): Mark[] {
  const out: Mark[] = [], L = part.cut.length, W = part.cut.width, drill = partDrilling(piece, part), cut = cutWithBand(part, info.band);
  out.push(words(P(x0, y0 + 5), `${part.n}  ${part.name}  ×${part.boards.length}`, 'caption'),
    words(P(x0, y0 + 10), `${mm(L)} × ${mm(W)} × ${mm(part.cut.thickness)}  ·  ${info.material(part.decorId)}  ·  ${part.edges}  ·  cut ${mm(cut.length)} × ${mm(cut.width)}`, 'small'));
  const s = Math.min((cw - 22) / L, (ch - 34) / W), fx = x0 + 14, fy = y0 + 20 + W * s, X = (u: number) => fx + u * s, Y = (v: number) => fy - v * s;
  const b = part.boards[0]!, outlined = b.outline && thinAxis(b) === 'z';
  if (outlined) {
    out.push(shape(flatOutline(b).map(p => P(X(p.x), Y(p.y))), 'outline', true, 'white'));
  } else out.push(box(X(0), Y(W), X(L), Y(0), 'outline', 'white'));
  // Banding: the front long edge (bottom) first, then the far one, then the ends.
  const long = Number(/L(\d)/.exec(part.edges)?.[1] ?? 0), short = Number(/W(\d)/.exec(part.edges)?.[1] ?? 0);
  if (long > 0) out.push(line(P(X(0), Y(0)), P(X(L), Y(0)), 'frame'));
  if (long > 1) out.push(line(P(X(0), Y(W)), P(X(L), Y(W)), 'frame'));
  if (short > 0) out.push(line(P(X(L), Y(0)), P(X(L), Y(W)), 'frame'));
  if (short > 1) out.push(line(P(X(0), Y(0)), P(X(0), Y(W)), 'frame'));
  for (const g of drill.grooves) out.push(box(X(g.u0), Y(g.v1), X(g.u1), Y(g.v0), 'hidden'));
  const us = new Set<number>(), vs = new Set<number>();
  for (const h of drill.holes) {
    if (h.face !== '+' && h.face !== '-') continue;
    out.push({ kind: 'circle', c: P(X(h.u / 10), Y(h.v / 10)), r: Math.max(.5, h.d / 20 * s), pen: h.face === '-' ? 'hidden' : 'ring', fill: h.depth === 0 && h.face === '+' ? 'black' : 'white' });
    us.add(h.u); vs.add(h.v);
  }
  let last = -Infinity;
  for (const u of [...us].sort((a, c) => a - c)) { const x = X(u / 10); if (x - last < 2.6) continue; last = x; out.push(line(P(x, Y(W) - 1), P(x, Y(W) - 2.5), 'dim'), words(P(x + .8, Y(W) - 3), String(u), 'key', 'start', -90)); }
  last = Infinity;
  for (const v of [...vs].sort((a, c) => a - c)) { const y = Y(v / 10); if (last - y < 2.6) continue; last = y; out.push(line(P(X(0) - 1, y), P(X(0) - 2.5, y), 'dim'), words(P(X(0) - 3, y + .8), String(v), 'key', 'end')); }
  // Overall sizes: length under, width to the right.
  out.push(line(P(X(0), fy + 4), P(X(L), fy + 4), 'dim'), words(P((X(0) + X(L)) / 2, fy + 3), mm(L), 'figure', 'middle'),
    line(P(X(L) + 4, Y(W)), P(X(L) + 4, Y(0)), 'dim'), words(P(X(L) + 3, (Y(W) + Y(0)) / 2), mm(W), 'figure', 'middle', -90));
  const summary = drillingSummary(drill).map(h => `Ø${h.d}${h.depth ? '×' + h.depth : ' through'} ×${h.qty}`).join('   ');
  if (summary) out.push(words(P(x0, fy + 10), summary, 'small'));
  return out;
}

/** The drawings: parts six to a page, the stock sheets two to a page, the hardware, then the steps two to a page. */
export function makePdf(piece: MakePiece, info: ExportInfo): Uint8Array {
  const pages: { heading: string; marks: Mark[]; images?: PdfImage[] }[] = [], cols = 3, rows = 2, cw = (PW - 2 * M - 8) / cols, ch = (PH - 2 * M - TITLE - 8) / rows;
  for (let k = 0; k < piece.parts.length; k += cols * rows) {
    const marks = piece.parts.slice(k, k + cols * rows).flatMap((part, i) => partCell(piece, part, info, M + 4 + (i % cols) * cw, M + 4 + Math.floor(i / cols) * ch, cw - 6, ch - 4));
    pages.push({ heading: 'Parts', marks });
  }
  const sw = (PW - 2 * M - 16) / 2, s = sw / STOCK.length;
  for (let k = 0; k < info.cut.sheets.length; k += 2) {
    const marks: Mark[] = [];
    info.cut.sheets.slice(k, k + 2).forEach((sheet, i) => {
      const x0 = M + 4 + i * (sw + 8), y0 = M + 16;
      marks.push(words(P(x0, y0 - 4), `${info.material(sheet.decorId)} · ${sheet.thickness} mm · ${STOCK.length} × ${STOCK.width} · ${Math.round(sheet.used * 100)}%`, 'caption'),
        box(x0, y0, x0 + sw, y0 + STOCK.width * s, 'outline', 'laminated'));
      for (const p of sheet.parts) {
        const x = x0 + p.x * s, y = y0 + p.y * s;
        marks.push(box(x, y, x + p.l * s, y + p.w * s, 'thin', 'white'));
        if (p.l * s > 8 && p.w * s > 5) marks.push(words(P(x + p.l * s / 2, y + p.w * s / 2), String(p.n), 'tag', 'middle', 0, true));
        if (p.l * s > 30 && p.w * s > 12) marks.push(words(P(x + p.l * s / 2, y + p.w * s / 2 + 4), `${p.l} × ${p.w}`, 'key', 'middle', 0, true));
      }
    });
    if (k + 2 >= info.cut.sheets.length) {
      const y = M + 24 + STOCK.width * s;
      info.cut.band.forEach((b, i) => marks.push(words(P(M + 4, y + 6 * i), `Edge banding · ${info.material(b.decorId)}: ${b.metres} m`, 'note')));
      if (info.cut.oversize.length) marks.push(words(P(M + 4, y + 6 * info.cut.band.length), `Longer than a sheet: ${[...new Set(info.cut.oversize)].join(', ')}`, 'check'));
    }
    pages.push({ heading: 'Cut layout', marks });
  }
  const marks: Mark[] = [words(P(M + 4, M + 10), 'Hardware', 'heading')];
  piece.buy.forEach((b, i) => { const d = hardwareDisplay(b); marks.push(words(P(M + 4, M + 18 + i * 5.5), d.name + (d.size ? '  ' + d.size : ''), 'list'),
    words(P(M + 150, M + 18 + i * 5.5), '×' + b.qty, 'listMark', 'end')); });
  marks.push(words(P(M + 4, PH - M - TITLE - 6), `Joints: ${piece.construction.joints} · back: ${piece.construction.back} · holes in mm from the part's lower left corner, face up; dashed: from the face under it.`, 'small'));
  pages.push({ heading: 'Hardware', marks });
  // The steps, as the manual prints them: a drawing and the words for each.
  pages.push(...stepPages(piece, { x: M + 2, y: M + 2, w: PW - 2 * M - 4, h: PH - 2 * M - TITLE - 4 }, info.pictures));
  return marksToPdf(pages.map((p, i) => [...frame(info, piece, i + 1, pages.length, p.heading), ...p.marks]), { w: PW, h: PH }, info.title + ' - make',
    pages.map(p => p.images));
}
